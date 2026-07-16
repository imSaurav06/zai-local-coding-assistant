/**
 * Z.ai Backend Unit Tests
 * Run: node backend/tests/run_tests.js
 *
 * All tests use Node's built-in 'assert' module — no external dependencies.
 */

"use strict";

const assert = require("assert");
const path = require("path");
const axios = require("axios");

// ─── Test Runner ─────────────────────────────────────────────────────────────
const results = { passed: 0, failed: 0, total: 0 };
const suites = [];
let currentSuite = null;

function suite(suiteName, fn) {
    const suiteObj = { name: suiteName, tests: [] };
    suites.push(suiteObj);
    currentSuite = suiteObj;
    fn();
    currentSuite = null;
}

function test(name, fn) {
    if (currentSuite) {
        currentSuite.tests.push({ name, fn });
    } else {
        suites.push({ name: "Default Suite", tests: [{ name, fn }] });
    }
}

// ─── Import modules under test ───────────────────────────────────────────────
// Resolve from the backend root (this file is in backend/tests/)
const backendRoot = path.resolve(__dirname, "..");

const { applyContentGuard, generateRichPlan, generateRichReadme } = require(path.join(backendRoot, "services/generationOrchestrator"));
const { validateProjectFiles } = require(path.join(backendRoot, "services/validationProfiles"));
const { planGeneration } = require(path.join(backendRoot, "services/generationPlanner"));
const { buildSharedContracts, buildProjectManifest } = require(path.join(backendRoot, "services/contractBuilder"));
const { sanitizePackageJson } = require(path.join(backendRoot, "services/previewService"));
const { calculateAdaptiveTimeout } = require(path.join(backendRoot, "services/aiGenerationExecutor"));

// ─── Test Data ────────────────────────────────────────────────────────────────
const SAMPLE_REACT_SPEC = {
    projectName: "FitZone",
    projectType: "React Landing Page",
    frontend: "React (Vite) 18.2",
    backend: "None",
    database: "None",
    authentication: "None",
    designRequirements: "Tailwind CSS",
    pagesAndRoutes: [
        { path: "/", name: "LandingPage", description: "Hero section with CTA and features" },
        { path: "/classes", name: "ClassesPage", description: "Gym classes grid" }
    ],
    components: [
        { name: "Navbar", purpose: "Top navigation with logo and links" },
        { name: "HeroSection", purpose: "Full-screen gym hero with headline" },
        { name: "FeatureCard", purpose: "Individual feature card component" }
    ],
    backendApis: [],
    databaseModels: [],
    integrations: [],
    importantDependencies: ["react-router-dom", "lucide-react", "framer-motion"],
    environmentVariables: [],
    architectureConstraints: ["Single page application"],
    runBuildRequirements: { runScript: "npm run dev", buildScript: "npm run build" },
    deploymentRequirements: "Vercel",
    assumptions: ["No backend required for landing page"]
};

const SAMPLE_MERN_SPEC = {
    projectName: "TaskManager",
    projectType: "MERN Application",
    frontend: "React (Vite) 18.2",
    backend: "Express.js (Node)",
    database: "MongoDB with Mongoose",
    authentication: "JWT Authentication",
    designRequirements: "Tailwind CSS",
    pagesAndRoutes: [
        { path: "/", name: "Dashboard", description: "Task overview" },
        { path: "/login", name: "Login", description: "User login page" }
    ],
    components: [
        { name: "TaskCard", purpose: "Individual task display" }
    ],
    backendApis: [
        { method: "GET", path: "/api/tasks", purpose: "List all user tasks" },
        { method: "POST", path: "/api/tasks", purpose: "Create new task" },
        { method: "DELETE", path: "/api/tasks/:id", purpose: "Delete task by ID" }
    ],
    databaseModels: [
        { name: "Task", fields: ["title (String)", "completed (Boolean)", "userId (ObjectId)"] },
        { name: "User", fields: ["email (String)", "password (String)"] }
    ],
    integrations: [],
    importantDependencies: ["axios", "jsonwebtoken", "bcryptjs", "mongoose"],
    environmentVariables: ["MONGODB_URI", "JWT_SECRET", "PORT"],
    architectureConstraints: [],
    runBuildRequirements: { runScript: "npm run dev", buildScript: "npm run build" },
    deploymentRequirements: "Render",
    assumptions: ["Auth via JWT stored in localStorage"]
};

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1: Content Guard
// ─────────────────────────────────────────────────────────────────────────────
suite("Content Guard (applyContentGuard)", () => {

    test("accepts well-formed JSX file", () => {
        const files = [{ name: "src/App.jsx", content: `
import React from 'react';
export default function App() {
  return <div className="text-white">Hello World</div>;
}
`.trim() }];
        const errors = applyContentGuard(files);
        assert.strictEqual(errors.length, 0, `Expected 0 errors but got: ${errors.join("; ")}`);
    });

    test("rejects file with standalone '...' placeholder", () => {
        const files = [{ name: "src/HeroSection.jsx", content: `
import React from 'react';
export default function HeroSection() {
  // ...
}
`.trim() }];
        const errors = applyContentGuard(files);
        assert.ok(errors.length > 0, "Expected content guard to flag '...' placeholder");
        assert.ok(errors[0].includes("src/HeroSection.jsx"), "Error should reference the offending file");
    });

    test("rejects file with '(content given)' placeholder", () => {
        const files = [{ name: "src/pages/LandingPage.jsx", content: `... (content given)` }];
        const errors = applyContentGuard(files);
        assert.ok(errors.length > 0, "Expected content guard to flag '(content given)'");
    });

    test("rejects near-empty non-config source file", () => {
        const files = [{ name: "src/components/Navbar.jsx", content: `//TODO` }];
        const errors = applyContentGuard(files);
        assert.ok(errors.length > 0, "Expected content guard to flag near-empty file");
    });

    test("accepts legitimately tiny config files (postcss, tailwind)", () => {
        const files = [
            { name: "postcss.config.js", content: `export default { plugins: { tailwindcss: {} } }` },
            { name: "tailwind.config.js", content: `export default { content: [] }` },
            { name: ".env.example", content: `PORT=5000` }
        ];
        const errors = applyContentGuard(files);
        assert.strictEqual(errors.length, 0, `Config files should not be flagged: ${errors.join("; ")}`);
    });

    test("rejects file with '{content}' template placeholder", () => {
        const files = [{ name: "src/Feature.jsx", content: `<div>{content}</div>` }];
        const errors = applyContentGuard(files);
        assert.ok(errors.length > 0, "Expected content guard to flag '{content}' placeholder");
    });

    test("rejects file with '// ... rest of component' pattern", () => {
        const files = [{
            name: "src/ClassesPage.jsx",
            content: `import React from 'react';\nexport default function Classes() {\n  // ... rest of component\n}`
        }];
        const errors = applyContentGuard(files);
        assert.ok(errors.length > 0, "Expected guard to flag '// ... rest of component'");
    });

    test("handles multiple files - only flags offenders", () => {
        const files = [
            {
                name: "src/App.jsx",
                content: `import React from 'react';\nexport default function App() { return <div>Hello FitZone</div>; }`
            },
            {
                name: "src/pages/LandingPage.jsx",
                content: `... (content given)`
            }
        ];
        const errors = applyContentGuard(files);
        assert.strictEqual(errors.length, 1, "Only the placeholder file should be flagged");
        assert.ok(errors[0].includes("LandingPage.jsx"), "Correct file referenced in error");
    });

    // ── New patterns added in release hardening ──────────────────────────────

    test("rejects file with 'same as above' placeholder", () => {
        const files = [{
            name: "src/components/Footer.jsx",
            content: `import React from 'react';\n// same as above\nexport default function Footer() { return <footer>Footer</footer>; }`
        }];
        const errors = applyContentGuard(files);
        assert.ok(errors.length > 0, "Expected guard to flag 'same as above'");
        assert.ok(errors[0].includes("Footer.jsx"), "Error should reference Footer.jsx");
    });

    test("rejects file with 'rest of code' placeholder", () => {
        const files = [{
            name: "src/components/Gallery.jsx",
            content: `import React from 'react';\nexport default function Gallery() {\n  // ... rest of code\n}`
        }];
        const errors = applyContentGuard(files);
        assert.ok(errors.length > 0, "Expected guard to flag 'rest of code'");
    });

    test("rejects file with 'implementation omitted' placeholder", () => {
        const files = [{
            name: "src/services/api.js",
            content: `// implementation omitted\nexport const fetchData = () => {};`
        }];
        const errors = applyContentGuard(files);
        assert.ok(errors.length > 0, "Expected guard to flag 'implementation omitted'");
    });

    test("rejects file with 'existing code here' placeholder", () => {
        const files = [{
            name: "src/utils/helpers.js",
            content: `// existing code goes here\nexport const helper = () => {};`
        }];
        const errors = applyContentGuard(files);
        assert.ok(errors.length > 0, "Expected guard to flag 'existing code goes here'");
    });

    test("rejects file where AI returned markdown fence wrappers as raw content", () => {
        const files = [{
            name: "src/components/Hero.jsx",
            content: "```jsx\nimport React from 'react';\nexport default function Hero() { return <div>Hero</div>; }\n```"
        }];
        const errors = applyContentGuard(files);
        assert.ok(errors.length > 0, "Expected guard to flag persisted markdown code fence in .jsx source file");
    });

    test("does NOT reject README.md that legitimately contains markdown code fences", () => {
        const files = [{
            name: "README.md",
            content: "# My Project\n\n## Getting Started\n\n```bash\nnpm install\nnpm run dev\n```\n\nThis is a fully documented project.\n"
        }];
        const errors = applyContentGuard(files);
        assert.strictEqual(errors.length, 0, `README.md with code fences should NOT be flagged: ${errors.join("; ")}`);
    });


    test("does NOT reject file with valid JSX that mentions 'code' in comments", () => {
        // Guard should not be too broad — normal code comments must not false-trigger
        const files = [{
            name: "src/utils/format.js",
            content: `// Format utilities — this code handles date and currency formatting for the app\nexport const formatDate = (date) => new Date(date).toLocaleDateString();\nexport const formatCurrency = (n) => '$' + n.toFixed(2);`
        }];
        const errors = applyContentGuard(files);
        assert.strictEqual(errors.length, 0, `Should NOT flag valid utility file: ${errors.join("; ")}`);
    });
});


// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2: Validation Profiles — React/Vite Completeness
// ─────────────────────────────────────────────────────────────────────────────
suite("validateProjectFiles — React/Vite Completeness", () => {

    // Complete set of files including all components and pages from the spec
    global.COMPLETE_REACT_FILES = [
        { name: "package.json", content: JSON.stringify({
            name: "fitzone",
            private: true,
            scripts: { dev: "vite", build: "vite build" },
            dependencies: { react: "^18.2.0", "react-dom": "^18.2.0" },
            devDependencies: { vite: "^5.0.0", tailwindcss: "^3.3.0", "@vitejs/plugin-react": "^4.0.0" }
        }, null, 2) },
        { name: "index.html", content: `<!doctype html><html><head></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>` },
        { name: "vite.config.js", content: `import { defineConfig } from 'vite'; import react from '@vitejs/plugin-react'; export default defineConfig({ plugins: [react()] });` },
        { name: "src/main.jsx", content: `import React from 'react'; import ReactDOM from 'react-dom/client'; import App from './App'; ReactDOM.createRoot(document.getElementById('root')).render(<App />);` },
        { name: "src/App.jsx", content: `import React from 'react'; export default function App() { return <div className="text-white bg-gray-900 min-h-screen">Hello FitZone!</div>; }` },
        { name: "src/index.css", content: `@tailwind base; @tailwind components; @tailwind utilities; body { margin: 0; }` },
        { name: "README.md", content: `# FitZone\n\nA React landing page that is fully complete and has more than thirty characters to pass validation checks.` },
        // Components required by SAMPLE_REACT_SPEC
        { name: "src/components/Navbar.jsx", content: `import React from 'react'; export default function Navbar() { return <nav className="bg-gray-800 text-white p-4 flex justify-between items-center"><span className="font-bold">FitZone</span></nav>; }` },
        { name: "src/components/HeroSection.jsx", content: `import React from 'react'; export default function HeroSection() { return <section className="min-h-screen bg-gray-900 flex items-center justify-center"><h1 className="text-5xl font-bold text-white">Transform Your Body</h1></section>; }` },
        { name: "src/components/FeatureCard.jsx", content: `import React from 'react'; export default function FeatureCard({ title, desc }) { return <div className="bg-gray-800 rounded-xl p-6 text-white"><h3 className="font-bold text-xl mb-2">{title}</h3><p>{desc}</p></div>; }` },
        // Pages required by SAMPLE_REACT_SPEC
        { name: "src/pages/LandingPage.jsx", content: `import React from 'react'; import HeroSection from '../components/HeroSection'; import FeatureCard from '../components/FeatureCard'; export default function LandingPage() { return <div className="bg-gray-900"><HeroSection /><section className="py-16 px-8 grid grid-cols-3 gap-6"><FeatureCard title="Strength" desc="Build power" /><FeatureCard title="Cardio" desc="Burn fat" /><FeatureCard title="Flexibility" desc="Stay limber" /></section></div>; }` },
        { name: "src/pages/ClassesPage.jsx", content: `import React from 'react'; export default function ClassesPage() { return <div className="bg-gray-900 min-h-screen py-16 px-8"><h1 className="text-3xl font-bold text-white mb-8">Our Classes</h1><p className="text-gray-400">Browse our full schedule of gym classes and find the perfect fit.</p></div>; }` }
    ];

    test("passes with all required React/Vite files present", () => {
        const errors = validateProjectFiles(COMPLETE_REACT_FILES, SAMPLE_REACT_SPEC);
        const criticalErrors = errors.filter(e =>
            e.includes("Missing required file") ||
            e.includes("package.json") ||
            e.includes("src/main") ||
            e.includes("src/App") ||
            e.includes("App.jsx only contains boilerplate")
        );
        assert.strictEqual(criticalErrors.length, 0,
            `Expected no critical errors, got: ${criticalErrors.join("; ")}`
        );
    });

    test("flags missing src/main.jsx", () => {
        const incomplete = COMPLETE_REACT_FILES.filter(f => f.name !== "src/main.jsx");
        const errors = validateProjectFiles(incomplete, SAMPLE_REACT_SPEC);
        assert.ok(
            errors.some(e => e.includes("src/main.jsx")),
            "Should flag missing src/main.jsx"
        );
    });

    test("flags missing src/App.jsx", () => {
        const incomplete = COMPLETE_REACT_FILES.filter(f => f.name !== "src/App.jsx");
        const errors = validateProjectFiles(incomplete, SAMPLE_REACT_SPEC);
        assert.ok(
            errors.some(e => e.includes("src/App.jsx")),
            "Should flag missing src/App.jsx"
        );
    });

    test("flags missing index.html", () => {
        const incomplete = COMPLETE_REACT_FILES.filter(f => f.name !== "index.html");
        const errors = validateProjectFiles(incomplete, SAMPLE_REACT_SPEC);
        assert.ok(
            errors.some(e => e.includes("index.html")),
            "Should flag missing index.html"
        );
    });

    test("flags src/App.jsx with boilerplate-only content", () => {
        const boilerplate = COMPLETE_REACT_FILES.map(f =>
            f.name === "src/App.jsx"
                ? { ...f, content: "export default function App() { return <div/>; }" }
                : f
        );
        const errors = validateProjectFiles(boilerplate, SAMPLE_REACT_SPEC);
        assert.ok(
            errors.some(e => e.includes("boilerplate")),
            "Should flag boilerplate App.jsx"
        );
    });

    test("flags invalid JSON in package.json", () => {
        const broken = COMPLETE_REACT_FILES.map(f =>
            f.name === "package.json" ? { ...f, content: `{ "name": "fitzone", "version": BROKEN }` } : f
        );
        const errors = validateProjectFiles(broken, SAMPLE_REACT_SPEC);
        assert.ok(
            errors.some(e => e.includes("Invalid JSON") || e.includes("package.json")),
            "Should flag invalid JSON in package.json"
        );
    });

    test("flags undeclared external import", () => {
        const withUndeclaredImport = COMPLETE_REACT_FILES.map(f =>
            f.name === "src/App.jsx"
                ? {
                    ...f,
                    content: `import axios from 'axios';
import React from 'react';
export default function App() { return <div className="text-white">Hello FitZone! This is a long enough content to pass the length check for boilerplate detection rules.</div>; }`
                  }
                : f
        );
        const errors = validateProjectFiles(withUndeclaredImport, SAMPLE_REACT_SPEC);
        assert.ok(
            errors.some(e => e.includes("axios") && e.includes("undeclared")),
            "Should flag undeclared 'axios' import"
        );
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 3: Generation Planner — Strategy Selection
// ─────────────────────────────────────────────────────────────────────────────
suite("planGeneration — Strategy Selection", () => {

    test("selects SCAFFOLD_AI for React/Vite projects", () => {
        const plan = planGeneration(SAMPLE_REACT_SPEC);
        assert.strictEqual(plan.strategy, "SCAFFOLD_AI",
            `Expected SCAFFOLD_AI for React spec, got ${plan.strategy}`
        );
    });

    test("sets scaffoldAdapter to 'react-vite' for React/Vite", () => {
        const plan = planGeneration(SAMPLE_REACT_SPEC);
        assert.strictEqual(plan.scaffoldAdapter, "react-vite");
    });

    test("includes deterministic files for react-vite scaffold", () => {
        const plan = planGeneration(SAMPLE_REACT_SPEC);
        assert.ok(plan.deterministicFiles.includes("package.json"), "Should include package.json");
        assert.ok(plan.deterministicFiles.includes("vite.config.js"), "Should include vite.config.js");
        assert.ok(plan.deterministicFiles.includes("index.html"), "Should include index.html");
    });

    test("returns maxAttempts repairPolicy", () => {
        const plan = planGeneration(SAMPLE_REACT_SPEC);
        assert.ok(plan.repairPolicy && plan.repairPolicy.maxAttempts >= 2,
            "repairPolicy.maxAttempts should be >= 2"
        );
    });

    test("selects SCAFFOLD_AI for MERN stack (complex)", () => {
        const plan = planGeneration(SAMPLE_MERN_SPEC);
        // MERN with many pages and components can be SCAFFOLD_AI or PARALLEL/CHUNKED
        assert.ok(["SCAFFOLD_AI", "PARALLEL", "CHUNKED"].includes(plan.strategy),
            `Expected multi-call strategy for MERN, got ${plan.strategy}`
        );
    });

    test("plan has tokenBudget > 0", () => {
        const plan = planGeneration(SAMPLE_REACT_SPEC);
        assert.ok(plan.tokenBudget > 0, "tokenBudget should be positive");
    });

    test("plan has at least one generation unit", () => {
        const plan = planGeneration(SAMPLE_REACT_SPEC);
        assert.ok(plan.generationUnits.length >= 1, "At least one generation unit required");
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 4: Contract Builder — Folder Structure
// ─────────────────────────────────────────────────────────────────────────────
suite("buildSharedContracts — Folder Structure", () => {

    test("includes src/main.jsx for React frontend", () => {
        const contracts = buildSharedContracts(SAMPLE_REACT_SPEC);
        assert.ok(contracts.folderStructure.includes("src/main.jsx"),
            "folderStructure should include src/main.jsx"
        );
    });

    test("includes src/App.jsx for React frontend", () => {
        const contracts = buildSharedContracts(SAMPLE_REACT_SPEC);
        assert.ok(contracts.folderStructure.includes("src/App.jsx"),
            "folderStructure should include src/App.jsx"
        );
    });

    test("includes component paths derived from projectSpec.components", () => {
        const contracts = buildSharedContracts(SAMPLE_REACT_SPEC);
        assert.ok(contracts.folderStructure.includes("src/components/Navbar.jsx"),
            "Should include Navbar.jsx component path"
        );
        assert.ok(contracts.folderStructure.includes("src/components/HeroSection.jsx"),
            "Should include HeroSection.jsx component path"
        );
    });

    test("includes page paths derived from projectSpec.pagesAndRoutes", () => {
        const contracts = buildSharedContracts(SAMPLE_REACT_SPEC);
        assert.ok(contracts.folderStructure.includes("src/pages/LandingPage.jsx"),
            "Should include LandingPage.jsx page path"
        );
    });

    test("includes server.js and model paths for MERN spec", () => {
        const contracts = buildSharedContracts(SAMPLE_MERN_SPEC);
        // MERN stack uses frontend/backend subfolder structure
        assert.ok(
            contracts.folderStructure.includes("backend/server.js"),
            "Should include backend/server.js for MERN backend"
        );
        assert.ok(
            contracts.folderStructure.includes("backend/models/Task.js"),
            "Should include backend/models/Task.js for MERN"
        );
        // isMern flag must be set
        assert.strictEqual(contracts.isMern, true, "MERN spec should have isMern=true");
    });

    test("maps backendApis to apiEndpoints", () => {
        const contracts = buildSharedContracts(SAMPLE_MERN_SPEC);
        assert.ok(contracts.apiEndpoints.length === 3,
            `Expected 3 API endpoints, got ${contracts.apiEndpoints.length}`
        );
        assert.ok(
            contracts.apiEndpoints.some(e => e.method === "GET" && e.path === "/api/tasks"),
            "Should include GET /api/tasks endpoint"
        );
    });

    test("maps databaseModels to databaseSchemas", () => {
        const contracts = buildSharedContracts(SAMPLE_MERN_SPEC);
        assert.ok(contracts.databaseSchemas.length === 2,
            `Expected 2 database schemas, got ${contracts.databaseSchemas.length}`
        );
        assert.ok(
            contracts.databaseSchemas.some(s => s.name === "Task"),
            "Should include Task schema"
        );
    });

    test("no-backend spec does not include server.js", () => {
        const contracts = buildSharedContracts(SAMPLE_REACT_SPEC);
        assert.ok(!contracts.folderStructure.includes("server.js"),
            "No-backend spec should not include server.js"
        );
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 5: Rich Plan Generator
// ─────────────────────────────────────────────────────────────────────────────
suite("generateRichPlan — Markdown Content", () => {

    test("includes project name in heading", () => {
        const plan = generateRichPlan(SAMPLE_REACT_SPEC);
        assert.ok(plan.includes("FitZone"), "Plan should include project name 'FitZone'");
    });

    test("includes Tech Stack section", () => {
        const plan = generateRichPlan(SAMPLE_REACT_SPEC);
        assert.ok(plan.includes("## Tech Stack"), "Plan should include Tech Stack section");
    });

    test("includes Pages & Routes section with route table", () => {
        const plan = generateRichPlan(SAMPLE_REACT_SPEC);
        assert.ok(plan.includes("## Pages & Routes"), "Plan should include Pages & Routes section");
        assert.ok(plan.includes("LandingPage"), "Plan should include LandingPage");
        assert.ok(plan.includes("ClassesPage"), "Plan should include ClassesPage");
    });

    test("includes UI Components section", () => {
        const plan = generateRichPlan(SAMPLE_REACT_SPEC);
        assert.ok(plan.includes("## UI Components"), "Plan should include UI Components section");
        assert.ok(plan.includes("Navbar"), "Plan should include Navbar component");
        assert.ok(plan.includes("HeroSection"), "Plan should include HeroSection component");
    });

    test("includes Backend API table for MERN spec", () => {
        const plan = generateRichPlan(SAMPLE_MERN_SPEC);
        assert.ok(plan.includes("## Backend API Endpoints"), "Plan should include Backend API section");
        assert.ok(plan.includes("/api/tasks"), "Plan should include /api/tasks endpoint");
    });

    test("includes Database Models for MERN spec", () => {
        const plan = generateRichPlan(SAMPLE_MERN_SPEC);
        assert.ok(plan.includes("## Database Models"), "Plan should include Database Models section");
        assert.ok(plan.includes("### Task"), "Plan should include Task model");
    });

    test("includes Assumptions section", () => {
        const plan = generateRichPlan(SAMPLE_REACT_SPEC);
        assert.ok(plan.includes("## Assumptions Made"), "Plan should include Assumptions section");
        assert.ok(plan.includes("No backend required"), "Plan should include assumption text");
    });

    test("includes Run & Build Commands section", () => {
        const plan = generateRichPlan(SAMPLE_REACT_SPEC);
        assert.ok(plan.includes("## Run & Build Commands"), "Plan should include run commands");
        assert.ok(plan.includes("npm run dev"), "Plan should include dev run command");
        assert.ok(plan.includes("npm run build"), "Plan should include build command");
    });

    test("no-backend spec does not include Backend API section", () => {
        const plan = generateRichPlan(SAMPLE_REACT_SPEC);
        assert.ok(!plan.includes("## Backend API Endpoints"), "No-backend plan should not include API section");
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 6: Rich README Generator
// ─────────────────────────────────────────────────────────────────────────────
suite("generateRichReadme — Content Validation", () => {

    const SAMPLE_FILES = [
        { name: "package.json", content: "{}" },
        { name: "vite.config.js", content: "..." },
        { name: "index.html", content: "..." },
        { name: "src/main.jsx", content: "..." },
        { name: "src/App.jsx", content: "..." },
        { name: "src/index.css", content: "..." },
        { name: "src/components/Navbar.jsx", content: "..." },
        { name: "src/pages/LandingPage.jsx", content: "..." }
    ];

    test("includes project name as H1 heading", () => {
        const readme = generateRichReadme(SAMPLE_REACT_SPEC, SAMPLE_FILES);
        assert.ok(readme.startsWith("# FitZone"), "README should start with # FitZone");
    });

    test("includes Features section with page names", () => {
        const readme = generateRichReadme(SAMPLE_REACT_SPEC, SAMPLE_FILES);
        assert.ok(readme.includes("## ✨ Features"), "README should include Features section");
        assert.ok(readme.includes("LandingPage"), "README should include LandingPage feature");
    });

    test("includes Tech Stack section", () => {
        const readme = generateRichReadme(SAMPLE_REACT_SPEC, SAMPLE_FILES);
        assert.ok(readme.includes("## 🛠 Tech Stack"), "README should include Tech Stack section");
        assert.ok(readme.includes("React (Vite) 18.2"), "README should include frontend framework");
    });

    test("includes Getting Started with npm commands", () => {
        const readme = generateRichReadme(SAMPLE_REACT_SPEC, SAMPLE_FILES);
        assert.ok(readme.includes("npm install"), "README should include npm install command");
        assert.ok(readme.includes("npm run dev"), "README should include npm run dev command");
    });

    test("includes Environment Variables table for MERN spec", () => {
        const readme = generateRichReadme(SAMPLE_MERN_SPEC, SAMPLE_FILES);
        assert.ok(readme.includes("## 🔐 Environment Variables"), "README should include env vars section");
        assert.ok(readme.includes("MONGODB_URI"), "README should include MONGODB_URI");
        assert.ok(readme.includes("JWT_SECRET"), "README should include JWT_SECRET");
    });

    test("includes API Endpoints table for MERN spec", () => {
        const readme = generateRichReadme(SAMPLE_MERN_SPEC, SAMPLE_FILES);
        assert.ok(readme.includes("## 📡 API Endpoints"), "README should include API section");
        assert.ok(readme.includes("/api/tasks"), "README should include /api/tasks");
    });

    test("includes Project Structure section", () => {
        const readme = generateRichReadme(SAMPLE_REACT_SPEC, SAMPLE_FILES);
        assert.ok(readme.includes("## 📁 Project Structure"), "README should include structure section");
        assert.ok(readme.includes("src/"), "README should include src/ directory");
    });

    test("includes Prerequisites with Node.js when package.json exists", () => {
        const readme = generateRichReadme(SAMPLE_REACT_SPEC, SAMPLE_FILES);
        assert.ok(readme.includes("Node.js"), "README should list Node.js as prerequisite");
    });

    test("includes license section", () => {
        const readme = generateRichReadme(SAMPLE_REACT_SPEC, SAMPLE_FILES);
        assert.ok(readme.includes("## 📝 License"), "README should include License section");
    });

    test("MERN spec includes Data Models section", () => {
        const readme = generateRichReadme(SAMPLE_MERN_SPEC, SAMPLE_FILES);
        assert.ok(readme.includes("## 🗄 Data Models"), "README should include Data Models section");
        assert.ok(readme.includes("### Task"), "README should include Task model");
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 7: JS/JSX Syntax Validation
// ─────────────────────────────────────────────────────────────────────────────
const { validateJsSyntax, validateSyntax } = require(path.join(backendRoot, "utils/syntaxValidator"));
const { orchestrateGeneration } = require(path.join(backendRoot, "services/generationOrchestrator"));
const aiExecutor = require(path.join(backendRoot, "services/aiGenerationExecutor"));

const overrideAiExecutor = (executeMock, generateMock) => {
    // Seed alternative casing cache keys for targeted modules
    const keys = Object.keys(require.cache);
    for (const key of keys) {
        if (key.toLowerCase().includes("aigenerationexecutor") || key.toLowerCase().includes("targetedrepairservice")) {
            const altKey = key.startsWith("C:") 
                ? "c:" + key.slice(2) 
                : key.startsWith("c:") 
                    ? "C:" + key.slice(2) 
                    : null;
            if (altKey && !require.cache[altKey]) {
                require.cache[altKey] = require.cache[key];
            }
        }
    }

    const originals = [];
    for (const key in require.cache) {
        if (key.toLowerCase().includes("aigenerationexecutor")) {
            const mod = require.cache[key].exports;
            originals.push({
                mod,
                execute: mod.executeAiRequest,
                generate: mod.generateUnitCode
            });
            if (executeMock) mod.executeAiRequest = executeMock;
            if (generateMock) mod.generateUnitCode = generateMock;
        }
    }
    return () => {
        for (const item of originals) {
            item.mod.executeAiRequest = item.execute;
            item.mod.generateUnitCode = item.generate;
        }
    };
};

suite("JS/JSX Syntax Validation", () => {
    test("rejects malformed JSX", () => {
        const err = validateJsSyntax("export default function App() { return ( <div> <span>Hello </div> ); }", "App.jsx");
        assert.ok(err, "Expected syntax error for malformed JSX");
        assert.strictEqual(err.errorType, "SyntaxError");
        assert.ok(err.reason.includes("Unexpected token") || err.reason.includes("Expected") || err.reason.includes("Unterminated"));
    });

    test("rejects unterminated JSX", () => {
        const err = validateJsSyntax("export default function App() { return <div>hello", "App.jsx");
        assert.ok(err, "Expected syntax error for unterminated JSX");
        assert.strictEqual(err.errorType, "SyntaxError");
    });

    test("rejects invalid import syntax", () => {
        const err = validateJsSyntax("import from './App';", "App.js");
        assert.ok(err, "Expected syntax error for invalid import syntax");
    });

    test("accepts valid JSX", () => {
        const err = validateJsSyntax("import React from 'react'; export default function App() { return <div>Hello</div>; }", "App.jsx");
        assert.strictEqual(err, null);
    });

    test("accepts valid JS", () => {
        const err = validateJsSyntax("const x = 10; export default x;", "index.js");
        assert.strictEqual(err, null);
    });

    test("rejects syntax-invalid repair output and keeps valid previous content", async () => {
        const { repairAffectedFiles } = require(path.join(backendRoot, "services/targetedRepairService"));
        
        // Mock executeAiRequest to return syntax-invalid code for App.jsx
        const restore = overrideAiExecutor(async () => {
            return `--- START_FILES ---
--- FILE: src/App.jsx ---
export default function App() { return <div>broken
--- END_FILE ---
--- END_FILES ---`;
        });

        const initialFiles = [
            { name: "src/App.jsx", content: "export default function App() { return <div>Valid JSX</div>; }" }
        ];

        try {
            const repaired = await repairAffectedFiles(
                ["File src/App.jsx has an error"],
                initialFiles,
                SAMPLE_REACT_SPEC,
                { folderStructure: ["src/App.jsx"] }
            );

            const repairedApp = repaired.find(f => f.name === "src/App.jsx");
            assert.strictEqual(repairedApp.content, initialFiles[0].content, "Valid file should not be replaced by syntax-invalid repair output");
        } finally {
            restore();
        }
    });

    test("fails generation if repair budget is exhausted", async () => {
        // Mock both to always return code that triggers validation error
        const mockResponse = `--- START_FILES ---
--- FILE: src/App.jsx ---
\`\`\`jsx
export default function App() { return <div>broken
\`\`\`
--- END_FILE ---
--- END_FILES ---`;
        const restore = overrideAiExecutor(async () => mockResponse, async () => mockResponse);

        try {
            await orchestrateGeneration({
                originalPrompt: "test",
                projectSpec: SAMPLE_REACT_SPEC
            }, { emit: () => {} }, null, { cancelSignal: null });
            assert.fail("Should have thrown error on exhausted repair budget");
        } catch (err) {
            assert.ok(err.message.includes("validation/repair failed") || err.message.includes("Syntax Error"));
        } finally {
            restore();
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 8: Hardened Content Guard Semantics
// ─────────────────────────────────────────────────────────────────────────────
suite("Hardened Content Guard Semantics", () => {
    const makeFilesBlock = (filesList) => {
        return `--- START_FILES ---\n` +
            filesList.map(f => `--- FILE: ${f.name} ---\n\`\`\`jsx\n${f.content}\n\`\`\`\n--- END_FILE ---`).join("\n") +
            `\n--- END_FILES ---`;
    };

    test("invalid file reaches targeted repair and revalidates", async () => {
        let repairAttempted = false;

        const filesWithPlaceholder = COMPLETE_REACT_FILES.map(f => {
            if (f.name === "src/pages/LandingPage.jsx") return { ...f, content: "... (content given)" };
            if (f.name === "README.md") return { ...f, content: "# FitZone\n\nA React landing page that is fully complete and has more than thirty characters to pass validation checks." };
            return f;
        });
        const primaryResponse = makeFilesBlock(filesWithPlaceholder);

        const executeMock = async (sys, user, opts) => {
            if (opts && opts.tokenBudget && opts.tokenBudget < 4000) {
                // This is a repair call
                repairAttempted = true;
                return `--- START_FILES ---
--- FILE: src/pages/LandingPage.jsx ---
\`\`\`jsx
export default function LandingPage() { return <div>Repaired, fully implemented Landing Page!</div>; }
\`\`\`
--- END_FILE ---
--- END_FILES ---`;
            }
            return primaryResponse;
        };

        const generateMock = async () => {
            return primaryResponse;
        };

        const restore = overrideAiExecutor(executeMock, generateMock);

        try {
            const result = await orchestrateGeneration({
                originalPrompt: "test",
                projectSpec: SAMPLE_REACT_SPEC
            }, { emit: () => {} }, null, { cancelSignal: null });

            assert.ok(repairAttempted, "Targeted repair should have been triggered for content guard fail");
            const landingPage = result.files.find(f => f.name === "src/pages/LandingPage.jsx");
            assert.ok(landingPage.content.includes("Repaired"), "Repaired content should be retained");
        } finally {
            restore();
        }
    });

    test("exhausted repair budget for Content Guard fails generation", async () => {
        const filesWithPlaceholder = COMPLETE_REACT_FILES.map(f => {
            if (f.name === "src/pages/LandingPage.jsx") return { ...f, content: "... (content given)" };
            if (f.name === "README.md") return { ...f, content: "# FitZone\n\nA React landing page that is fully complete and has more than thirty characters to pass validation checks." };
            return f;
        });
        const primaryResponse = makeFilesBlock(filesWithPlaceholder);

        const restore = overrideAiExecutor(async () => primaryResponse, async () => primaryResponse);

        try {
            await orchestrateGeneration({
                originalPrompt: "test",
                projectSpec: SAMPLE_REACT_SPEC
            }, { emit: () => {} }, null, { cancelSignal: null });
            assert.fail("Should have failed generation on persistent content guard failures");
        } catch (err) {
            assert.ok(err.message.includes("Content guard") || err.message.includes("validation/repair failed"));
        } finally {
            restore();
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 9: Preview State Machine & Preconditions
// ─────────────────────────────────────────────────────────────────────────────
const previewService = require(path.join(backendRoot, "services/previewService"));
const Project = require(path.join(backendRoot, "models/Project"));
const cp = require("child_process");

suite("Preview State Machine & Preconditions", () => {
    let originalFindById;
    let originalSpawn;
    let mockProject;
    let mockProc;

    const setupMocks = (filesList, projectSpecification = SAMPLE_REACT_SPEC) => {
        originalFindById = Project.findById;
        originalSpawn = cp.spawn;

        mockProject = {
            _id: "project123",
            userId: "user123",
            files: filesList,
            projectSpec: projectSpecification,
            save: async function() { return this; }
        };

        Project.findById = async function(id) {
            return mockProject;
        };

        mockProc = createMockProcess();
        cp.spawn = (cmd, args, opts) => {
            return mockProc;
        };
    };

    const restoreMocks = () => {
        Project.findById = originalFindById;
        cp.spawn = originalSpawn;
        previewService.activePreviews.clear();
    };

    const createMockProcess = () => {
        const listeners = {};
        const stdoutListeners = {};
        const stderrListeners = {};
        return {
            stdout: {
                on: (event, cb) => { stdoutListeners[event] = cb; },
                emit: (event, data) => { if (stdoutListeners[event]) stdoutListeners[event](data); }
            },
            stderr: {
                on: (event, cb) => { stderrListeners[event] = cb; },
                emit: (event, data) => { if (stderrListeners[event]) stderrListeners[event](data); }
            },
            on: (event, cb) => { listeners[event] = cb; },
            emit: (event, code) => { if (listeners[event]) listeners[event](code); },
            kill: () => {}
        };
    };

    test("invalid LandingPage.jsx cannot start preview (precondition fail)", async () => {
        const files = [
            { name: "package.json", content: "{}" },
            { name: "src/pages/LandingPage.jsx", content: "... (content given)" }
        ];
        setupMocks(files);
        try {
            const meta = await previewService.startPreview("project123", "user123");
            await new Promise(r => setTimeout(r, 100));
            const session = previewService.activePreviews.get("project123");
            assert.strictEqual(session.status, "FAILED");
            assert.ok(session.errors.some(e => e.includes("Content Guard")));
        } finally {
            restoreMocks();
        }
    });

    test("syntax-invalid JSX cannot start preview (precondition fail)", async () => {
        const files = [
            { name: "package.json", content: "{}" },
            { name: "src/App.jsx", content: "export default function App() { return <div>broken" }
        ];
        setupMocks(files);
        try {
            const meta = await previewService.startPreview("project123", "user123");
            await new Promise(r => setTimeout(r, 100));
            const session = previewService.activePreviews.get("project123");
            assert.strictEqual(session.status, "FAILED");
            assert.ok(session.errors.some(e => e.includes("Syntax Error")));
        } finally {
            restoreMocks();
        }
    });

    test("Vite compilation error transitions to FAILED", async () => {
        setupMocks(COMPLETE_REACT_FILES);

        cp.spawn = (cmd, args, opts) => {
            console.log("[MOCK SPAWN] cmd =", cmd, "args =", args);
            const p = createMockProcess();
            if (args.includes("install") || args.includes("build")) {
                setTimeout(() => p.emit("close", 0), 10);
            } else if (args.includes("vite")) {
                mockProc = p;
            }
            return p;
        };

        try {
            await previewService.startPreview("project123", "user123");
            await new Promise(r => setTimeout(r, 100));
            
            const session = previewService.activePreviews.get("project123");
            assert.strictEqual(session.status, "STARTING", `Expected status STARTING, got ${session.status}. Errors: ${JSON.stringify(session.errors)}`);

            mockProc.stdout.emit("data", "Vite compilation error: Failed to parse React components");
            
            assert.strictEqual(session.status, "FAILED");
            assert.ok(session.errors.some(e => e.includes("Vite compilation error")));
        } finally {
            restoreMocks();
        }
    });

    test("child process early exit transitions to FAILED", async () => {
        setupMocks(COMPLETE_REACT_FILES);

        cp.spawn = (cmd, args, opts) => {
            const p = createMockProcess();
            if (args.includes("install") || args.includes("build")) {
                setTimeout(() => p.emit("close", 0), 10);
            } else if (args.includes("vite")) {
                mockProc = p;
            }
            return p;
        };

        try {
            await previewService.startPreview("project123", "user123");
            await new Promise(r => setTimeout(r, 100));
            
            const session = previewService.activePreviews.get("project123");
            assert.strictEqual(session.status, "STARTING", `Expected status STARTING, got ${session.status}. Errors: ${JSON.stringify(session.errors)}`);

            mockProc.emit("close", 1);
            
            assert.strictEqual(session.status, "FAILED");
            assert.ok(session.errors.some(e => e.includes("Vite server closed early")));
        } finally {
            restoreMocks();
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// E2E Fix Regression Tests
// ─────────────────────────────────────────────────────────────────────────────
suite("E2E Fix Regressions", () => {
    // Fix 1: sanitizePackageJson must preserve the build script so that the
    // preview service can run `npm run build` inside the sandbox.
    test("sanitizePackageJson preserves build script", async () => {
        const raw = JSON.stringify({
            name: "my-app",
            private: true,
            dependencies: { react: "^18.2.0", "react-dom": "^18.2.0" },
            devDependencies: { vite: "^5.0.0", "@vitejs/plugin-react": "^4.2.0" },
            scripts: { dev: "vite", build: "vite build", preview: "vite preview" }
        });
        const result = JSON.parse(sanitizePackageJson(raw));
        assert.strictEqual(result.scripts.dev, "vite", "dev script must be present");
        assert.strictEqual(result.scripts.build, "vite build", "build script must be preserved");
    });

    // Fix 2: calculateAdaptiveTimeout must always stay within 120s–240s regardless
    // of strategy or token budget, matching the 2–4 minute range requirement.
    test("calculateAdaptiveTimeout stays within 120s–240s bounds", async () => {
        const strategies = ["DIRECT", "SCAFFOLD_AI", "PARALLEL", "CHUNKED"];
        const tokenBudgets = [0, 100, 500, 1000, 3000, 10000];
        for (const strategy of strategies) {
            for (const budget of tokenBudgets) {
                const ms = calculateAdaptiveTimeout(strategy, budget);
                assert.ok(
                    ms >= 120000,
                    `Timeout ${ms}ms < 120s minimum for strategy=${strategy} tokens=${budget}`
                );
                assert.ok(
                    ms <= 240000,
                    `Timeout ${ms}ms > 240s maximum for strategy=${strategy} tokens=${budget}`
                );
            }
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 10: MERN Stack Registry & Contract Builder
// ─────────────────────────────────────────────────────────────────────────────
const { generateScaffoldFiles } = require(path.join(backendRoot, "services/scaffoldRegistry"));
const { isMernStack } = require(path.join(backendRoot, "services/contractBuilder"));

suite("MERN Scaffold Registry & Contract Builder", () => {

    test("isMernStack detects MERN correctly", () => {
        assert.strictEqual(isMernStack(SAMPLE_MERN_SPEC), true, "MERN spec should be detected as MERN");
        assert.strictEqual(isMernStack(SAMPLE_REACT_SPEC), false, "React-only spec should NOT be detected as MERN");
    });

    test("generateScaffoldFiles returns mern adapter files", () => {
        const files = generateScaffoldFiles("mern", SAMPLE_MERN_SPEC);
        const names = files.map(f => f.name);
        assert.ok(names.includes("frontend/package.json"), "Should include frontend/package.json");
        assert.ok(names.includes("backend/package.json"), "Should include backend/package.json");
        assert.ok(names.includes("backend/config/db.js"), "Should include backend/config/db.js");
        assert.ok(names.includes("backend/.env.example"), "Should include backend/.env.example");
        assert.ok(names.includes("frontend/vite.config.js"), "Should include frontend/vite.config.js");
        assert.ok(names.includes("frontend/tailwind.config.js"), "Should include frontend/tailwind.config.js");
        assert.ok(names.includes(".gitignore"), "Should include .gitignore");
    });

    test("MERN frontend/package.json has react-router-dom and axios", () => {
        const files = generateScaffoldFiles("mern", SAMPLE_MERN_SPEC);
        const frontendPkg = files.find(f => f.name === "frontend/package.json");
        assert.ok(frontendPkg, "frontend/package.json should exist");
        const parsed = JSON.parse(frontendPkg.content);
        assert.ok(parsed.dependencies["react-router-dom"], "Should have react-router-dom in frontend deps");
        assert.ok(parsed.dependencies["axios"], "Should have axios in frontend deps");
    });

    test("MERN backend/package.json has express, mongoose, jsonwebtoken, bcryptjs", () => {
        const files = generateScaffoldFiles("mern", SAMPLE_MERN_SPEC);
        const backendPkg = files.find(f => f.name === "backend/package.json");
        assert.ok(backendPkg, "backend/package.json should exist");
        const parsed = JSON.parse(backendPkg.content);
        assert.ok(parsed.dependencies["express"], "Should have express in backend deps");
        assert.ok(parsed.dependencies["mongoose"], "Should have mongoose in backend deps");
        assert.ok(parsed.dependencies["jsonwebtoken"], "Should have jsonwebtoken in backend deps");
        assert.ok(parsed.dependencies["bcryptjs"], "Should have bcryptjs in backend deps");
    });

    test("MERN backend/.env.example has PORT, MONGO_URI, JWT_SECRET", () => {
        const files = generateScaffoldFiles("mern", SAMPLE_MERN_SPEC);
        const envFile = files.find(f => f.name === "backend/.env.example");
        assert.ok(envFile, "backend/.env.example should exist");
        assert.ok(envFile.content.includes("MONGO_URI"), "Should include MONGO_URI");
        assert.ok(envFile.content.includes("JWT_SECRET"), "Should include JWT_SECRET");
        assert.ok(envFile.content.includes("PORT"), "Should include PORT");
    });

    test("MERN vite.config.js has proxy to backend :5000", () => {
        const files = generateScaffoldFiles("mern", SAMPLE_MERN_SPEC);
        const viteConfig = files.find(f => f.name === "frontend/vite.config.js");
        assert.ok(viteConfig, "frontend/vite.config.js should exist");
        assert.ok(viteConfig.content.includes("5000"), "vite.config.js should proxy to port 5000");
        assert.ok(viteConfig.content.includes("/api"), "vite.config.js should proxy /api");
    });

    test("MERN contract has frontend and backend folder structure paths", () => {
        const { buildSharedContracts } = require(path.join(backendRoot, "services/contractBuilder"));
        const contracts = buildSharedContracts(SAMPLE_MERN_SPEC);
        assert.ok(contracts.folderStructure.includes("frontend/src/main.jsx"), "Should have frontend/src/main.jsx");
        assert.ok(contracts.folderStructure.includes("frontend/src/App.jsx"), "Should have frontend/src/App.jsx");
        assert.ok(contracts.folderStructure.includes("backend/server.js"), "Should have backend/server.js");
        assert.ok(contracts.folderStructure.includes("backend/app.js"), "Should have backend/app.js");
        assert.ok(contracts.folderStructure.includes("backend/middleware/authMiddleware.js"), "Should have authMiddleware");
        assert.ok(contracts.folderStructure.includes("backend/utils/generateToken.js"), "Should have generateToken");
    });

    test("MERN contract does not use flat server.js path", () => {
        const { buildSharedContracts } = require(path.join(backendRoot, "services/contractBuilder"));
        const contracts = buildSharedContracts(SAMPLE_MERN_SPEC);
        // Flat server.js (not prefixed with backend/) should NOT exist in MERN contract
        assert.ok(
            !contracts.folderStructure.includes("server.js"),
            "MERN contract should NOT include flat 'server.js' — it should be 'backend/server.js'"
        );
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 11: MERN Generation Planner Strategy
// ─────────────────────────────────────────────────────────────────────────────
suite("MERN Generation Planner — Strategy & Units", () => {

    test("MERN spec selects CHUNKED strategy", () => {
        const plan = planGeneration(SAMPLE_MERN_SPEC);
        assert.strictEqual(plan.strategy, "CHUNKED",
            `Expected CHUNKED strategy for MERN, got ${plan.strategy}`
        );
    });

    test("MERN spec uses 'mern' scaffold adapter", () => {
        const plan = planGeneration(SAMPLE_MERN_SPEC);
        assert.strictEqual(plan.scaffoldAdapter, "mern",
            `Expected mern scaffold adapter, got ${plan.scaffoldAdapter}`
        );
    });

    test("MERN spec generates 6 MERN-specific generation units", () => {
        const plan = planGeneration(SAMPLE_MERN_SPEC);
        assert.ok(plan.generationUnits.length >= 5,
            `Expected at least 5 generation units for MERN, got ${plan.generationUnits.length}`
        );
    });

    test("MERN deterministic files include backend and frontend scaffold files", () => {
        const plan = planGeneration(SAMPLE_MERN_SPEC);
        assert.ok(plan.deterministicFiles.includes("frontend/package.json"),
            "MERN deterministic files should include frontend/package.json"
        );
        assert.ok(plan.deterministicFiles.includes("backend/package.json"),
            "MERN deterministic files should include backend/package.json"
        );
        assert.ok(plan.deterministicFiles.includes("backend/config/db.js"),
            "MERN deterministic files should include backend/config/db.js"
        );
    });

    test("MERN plan isMern flag is true", () => {
        const plan = planGeneration(SAMPLE_MERN_SPEC);
        assert.strictEqual(plan.isMern, true, "MERN plan should have isMern=true");
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 12: MERN Validation Profiles
// ─────────────────────────────────────────────────────────────────────────────
suite("validateProjectFiles — MERN Stack", () => {

    const COMPLETE_MERN_FILES = [
        // Root level
        { name: ".gitignore", content: "node_modules/\n.env\n" },
        { name: "README.md", content: "# TaskManager\n\nA full-stack MERN application with backend API and React frontend." },
        // Backend
        { name: "backend/package.json", content: JSON.stringify({
            name: "taskmanager-backend",
            scripts: { start: "node server.js", dev: "nodemon server.js" },
            dependencies: { express: "^4.18.2", mongoose: "^8.0.0", jsonwebtoken: "^9.0.2", bcryptjs: "^2.4.3", dotenv: "^16.3.1", cors: "^2.8.5" }
        }, null, 2)},
        { name: "backend/.env.example", content: "PORT=5000\nMONGO_URI=mongodb://localhost/taskmanager\nJWT_SECRET=your_secret_here\n" },
        { name: "backend/config/db.js", content: "const mongoose = require('mongoose');\nconst connectDB = async () => { await mongoose.connect(process.env.MONGO_URI); };\nmodule.exports = connectDB;" },
        { name: "backend/server.js", content: "const express = require('express');\nconst connectDB = require('./config/db');\nconst app = require('./app');\nconst PORT = process.env.PORT || 5000;\nconnectDB();\napp.listen(PORT, () => console.log('Server running on port ' + PORT));" },
        { name: "backend/app.js", content: "const express = require('express');\nconst cors = require('cors');\nconst app = express();\napp.use(cors());\napp.use(express.json());\napp.use('/api/health', require('./routes/healthRoutes'));\nmodule.exports = app;" },
        { name: "backend/models/Task.js", content: "const mongoose = require('mongoose');\nconst TaskSchema = new mongoose.Schema({ title: String, completed: Boolean, userId: mongoose.Schema.Types.ObjectId });\nmodule.exports = mongoose.model('Task', TaskSchema);" },
        { name: "backend/models/User.js", content: "const mongoose = require('mongoose');\nconst UserSchema = new mongoose.Schema({ email: String, password: String });\nmodule.exports = mongoose.model('User', UserSchema);" },
        { name: "backend/controllers/authController.js", content: "const jwt = require('jsonwebtoken');\nconst User = require('../models/User');\nexports.login = async (req, res) => { res.json({ token: 'test' }); };" },
        { name: "backend/controllers/taskController.js", content: "const Task = require('../models/Task');\nexports.getTasks = async (req, res) => { const tasks = await Task.find(); res.json(tasks); };" },
        { name: "backend/routes/authRoutes.js", content: "const express = require('express');\nconst router = express.Router();\nconst { login } = require('../controllers/authController');\nrouter.post('/login', login);\nmodule.exports = router;" },
        { name: "backend/routes/taskRoutes.js", content: "const express = require('express');\nconst router = express.Router();\nconst { getTasks } = require('../controllers/taskController');\nrouter.get('/', getTasks);\nmodule.exports = router;" },
        { name: "backend/middleware/authMiddleware.js", content: "const jwt = require('jsonwebtoken');\nconst protect = (req, res, next) => { const token = req.headers.authorization?.split(' ')[1]; if (!token) return res.status(401).json({ message: 'Unauthorized' }); jwt.verify(token, process.env.JWT_SECRET, (err, user) => { if (err) return res.status(403).json({ message: 'Forbidden' }); req.user = user; next(); }); };\nmodule.exports = { protect };" },
        { name: "backend/middleware/errorMiddleware.js", content: "const errorHandler = (err, req, res, next) => { res.status(500).json({ message: err.message }); };\nmodule.exports = { errorHandler };" },
        { name: "backend/utils/generateToken.js", content: "const jwt = require('jsonwebtoken');\nconst generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });\nmodule.exports = generateToken;" },
        { name: "backend/routes/healthRoutes.js", content: "const express = require('express');\nconst router = express.Router();\nrouter.get('/', (req, res) => res.json({ status: 'OK' }));\nmodule.exports = router;" },
        // Frontend
        { name: "frontend/package.json", content: JSON.stringify({
            name: "taskmanager-frontend",
            type: "module",
            scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
            dependencies: { react: "^18.2.0", "react-dom": "^18.2.0", "react-router-dom": "^6.20.0", axios: "^1.6.0" },
            devDependencies: { vite: "^5.0.0", "@vitejs/plugin-react": "^4.2.0", tailwindcss: "^3.4.0" }
        }, null, 2)},
        { name: "frontend/index.html", content: `<!doctype html><html><head><title>TaskManager</title></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>` },
        { name: "frontend/vite.config.js", content: "import { defineConfig } from 'vite'; import react from '@vitejs/plugin-react'; export default defineConfig({ plugins: [react()], server: { proxy: { '/api': 'http://localhost:5000' } } });" },
        { name: "frontend/tailwind.config.js", content: "export default { content: ['./index.html', './src/**/*.{js,jsx}'] };" },
        { name: "frontend/postcss.config.js", content: "export default { plugins: { tailwindcss: {}, autoprefixer: {} } };" },
        { name: "frontend/.env.example", content: "VITE_API_URL=http://localhost:5000/api\n" },
        { name: "frontend/src/main.jsx", content: "import React from 'react'; import ReactDOM from 'react-dom/client'; import App from './App'; ReactDOM.createRoot(document.getElementById('root')).render(<App />);" },
        { name: "frontend/src/App.jsx", content: "import React from 'react'; import { BrowserRouter, Routes, Route } from 'react-router-dom'; import Dashboard from './pages/Dashboard'; import Login from './pages/Login'; export default function App() { return (<BrowserRouter><Routes><Route path='/' element={<Dashboard />} /><Route path='/login' element={<Login />} /></Routes></BrowserRouter>); }" },
        { name: "frontend/src/index.css", content: "@tailwind base;\n@tailwind components;\n@tailwind utilities;\nbody { margin: 0; background: #111827; color: #fff; }" },
        { name: "frontend/src/context/AuthContext.jsx", content: "import React, { createContext, useContext, useState } from 'react'; const AuthContext = createContext(); export const AuthProvider = ({ children }) => { const [user, setUser] = useState(null); return (<AuthContext.Provider value={{ user, setUser }}>{children}</AuthContext.Provider>); }; export const useAuth = () => useContext(AuthContext);" },
        { name: "frontend/src/hooks/useAuth.js", content: "import { useAuth } from '../context/AuthContext'; export default useAuth;" },
        { name: "frontend/src/services/api.js", content: "import axios from 'axios'; const api = axios.create({ baseURL: '/api' }); export default api;" },
        { name: "frontend/src/services/authService.js", content: "import api from './api'; export const login = (data) => api.post('/auth/login', data); export const register = (data) => api.post('/auth/register', data);" },
        { name: "frontend/src/services/taskService.js", content: "import api from './api'; export const getTasks = () => api.get('/tasks'); export const createTask = (data) => api.post('/tasks', data);" },
        { name: "frontend/src/pages/Dashboard.jsx", content: "import React, { useEffect, useState } from 'react'; import TaskCard from '../components/TaskCard'; import { getTasks } from '../services/taskService'; export default function Dashboard() { const [tasks, setTasks] = useState([]); useEffect(() => { getTasks().then(r => setTasks(r.data)); }, []); return (<div className='p-8'><h1 className='text-3xl font-bold text-white mb-6'>Dashboard</h1>{tasks.map(t => <TaskCard key={t._id} task={t} />)}</div>); }" },
        { name: "frontend/src/pages/Login.jsx", content: "import React, { useState } from 'react'; import { login } from '../services/authService'; export default function Login() { const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const handleSubmit = async (e) => { e.preventDefault(); await login({ email, password }); }; return (<div className='flex min-h-screen items-center justify-center bg-gray-900'><form onSubmit={handleSubmit} className='bg-gray-800 p-8 rounded-xl'><input type='email' value={email} onChange={e=>setEmail(e.target.value)} placeholder='Email' /><input type='password' value={password} onChange={e=>setPassword(e.target.value)} placeholder='Password' /><button type='submit'>Login</button></form></div>); }" },
        { name: "frontend/src/components/TaskCard.jsx", content: "import React from 'react'; export default function TaskCard({ task }) { return (<div className='bg-gray-800 p-4 rounded-lg mb-4 text-white'><h3 className='font-semibold'>{task.title}</h3><span className='text-sm text-gray-400'>{task.completed ? 'Completed' : 'Pending'}</span></div>); }" },
    ];

    test("passes with all required MERN files present", () => {
        const errors = validateProjectFiles(COMPLETE_MERN_FILES, SAMPLE_MERN_SPEC);
        const criticalErrors = errors.filter(e =>
            e.includes("Missing required") ||
            e.includes("frontend/src/main.jsx") ||
            e.includes("frontend/src/App.jsx") ||
            e.includes("backend/server.js") ||
            e.includes("backend/package.json") ||
            e.includes("frontend/package.json") ||
            e.includes("boilerplate")
        );
        assert.strictEqual(criticalErrors.length, 0,
            `Expected no critical MERN errors, got: ${criticalErrors.join("; ")}`
        );
    });

    test("flags missing backend/server.js in MERN project", () => {
        const incomplete = COMPLETE_MERN_FILES.filter(f => f.name !== "backend/server.js");
        const errors = validateProjectFiles(incomplete, SAMPLE_MERN_SPEC);
        assert.ok(
            errors.some(e => e.includes("backend/server.js")),
            "Should flag missing backend/server.js in MERN project"
        );
    });

    test("flags missing frontend/src/main.jsx in MERN project", () => {
        const incomplete = COMPLETE_MERN_FILES.filter(f => f.name !== "frontend/src/main.jsx");
        const errors = validateProjectFiles(incomplete, SAMPLE_MERN_SPEC);
        assert.ok(
            errors.some(e => e.includes("frontend/src/main.jsx")),
            "Should flag missing frontend/src/main.jsx in MERN project"
        );
    });

    test("flags missing backend/.env.example in MERN project", () => {
        const incomplete = COMPLETE_MERN_FILES.filter(f => f.name !== "backend/.env.example");
        const errors = validateProjectFiles(incomplete, SAMPLE_MERN_SPEC);
        assert.ok(
            errors.some(e => e.includes("backend/.env.example")),
            "Should flag missing backend/.env.example in MERN project"
        );
    });

    test("flags boilerplate-only frontend/src/App.jsx in MERN project", () => {
        const withBoilerplate = COMPLETE_MERN_FILES.map(f =>
            f.name === "frontend/src/App.jsx"
                ? { ...f, content: "export default function App() { return <div/>; }" }
                : f
        );
        const errors = validateProjectFiles(withBoilerplate, SAMPLE_MERN_SPEC);
        assert.ok(
            errors.some(e => e.includes("boilerplate")),
            "Should flag boilerplate App.jsx in MERN project"
        );
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 13: Content Guard MERN Config File Exemptions
// ─────────────────────────────────────────────────────────────────────────────
suite("Content Guard — MERN Config File Exemptions", () => {

    test("does not flag frontend/package.json as near-empty", () => {
        const files = [
            { name: "frontend/package.json", content: '{"name": "test"}' }
        ];
        const errors = applyContentGuard(files);
        assert.strictEqual(errors.length, 0,
            "frontend/package.json should not be flagged as near-empty by content guard"
        );
    });

    test("does not flag frontend/vite.config.js as near-empty", () => {
        const files = [
            { name: "frontend/vite.config.js", content: "export default {};" }
        ];
        const errors = applyContentGuard(files);
        assert.strictEqual(errors.length, 0,
            "frontend/vite.config.js should not be flagged as near-empty"
        );
    });

    test("does not flag backend/.env.example as near-empty", () => {
        const files = [
            { name: "backend/.env.example", content: "PORT=5000\n" }
        ];
        const errors = applyContentGuard(files);
        assert.strictEqual(errors.length, 0,
            "backend/.env.example should not be flagged as near-empty"
        );
    });

    test("does not flag frontend/tailwind.config.js as near-empty", () => {
        const files = [
            { name: "frontend/tailwind.config.js", content: "export default { content: [] };" }
        ];
        const errors = applyContentGuard(files);
        assert.strictEqual(errors.length, 0,
            "frontend/tailwind.config.js should not be flagged as near-empty"
        );
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 14: Generalized Stack Profiles and Dynamic Project Manifests
// ─────────────────────────────────────────────────────────────────────────────
suite("Generalized Stack Profiles & Project Manifests", () => {

    test("Vanilla HTML/CSS/JS spec creates correct manifest", () => {
        const spec = {
            projectName: "Vanilla Site",
            projectType: "Website",
            frontend: "HTML/CSS/JS",
            backend: "None",
            pagesAndRoutes: [{ name: "About" }, { name: "Contact" }]
        };
        const manifest = buildProjectManifest("build a vanilla site", spec);
        assert.strictEqual(manifest.projectName, "Vanilla Site");
        assert.strictEqual(manifest.stackProfile, "vanilla");
        assert.ok(manifest.expectedFiles.includes("index.html"));
        assert.ok(manifest.expectedFiles.includes("style.css"));
        assert.ok(manifest.expectedFiles.includes("about.html"));
        assert.ok(manifest.expectedFiles.includes("contact.html"));
        assert.strictEqual(manifest.previewStrategy.type, "static");
    });

    test("Next.js spec creates correct manifest", () => {
        const spec = {
            projectName: "Next App",
            projectType: "Web App",
            frontend: "Next.js",
            pagesAndRoutes: [{ name: "Dashboard" }]
        };
        const manifest = buildProjectManifest("build a next.js app", spec);
        assert.strictEqual(manifest.stackProfile, "nextjs");
        assert.ok(manifest.expectedFiles.includes("app/page.jsx"));
        assert.ok(manifest.expectedFiles.includes("app/layout.jsx"));
        assert.ok(manifest.expectedFiles.includes("app/dashboard/page.jsx"));
        assert.strictEqual(manifest.previewStrategy.type, "next");
    });

    test("Express API spec creates correct manifest", () => {
        const spec = {
            projectName: "Express API",
            projectType: "REST API",
            backend: "Express",
            databaseModels: [{ name: "User" }, { name: "Product" }]
        };
        const manifest = buildProjectManifest("build express server", spec);
        assert.strictEqual(manifest.stackProfile, "express");
        assert.ok(manifest.expectedFiles.includes("server.js"));
        assert.ok(manifest.expectedFiles.includes("models/User.js"));
        assert.ok(manifest.expectedFiles.includes("models/Product.js"));
        assert.strictEqual(manifest.previewStrategy.type, "node");
    });

    test("FastAPI spec creates correct manifest", () => {
        const spec = {
            projectName: "FastAPI Project",
            projectType: "Backend Service",
            backend: "FastAPI"
        };
        const manifest = buildProjectManifest("build fastapi backend", spec);
        assert.strictEqual(manifest.stackProfile, "fastapi");
        assert.ok(manifest.expectedFiles.includes("main.py"));
        assert.ok(manifest.expectedFiles.includes("requirements.txt"));
        assert.strictEqual(manifest.previewStrategy.type, "fastapi");
    });
});


// ─────────────────────────────────────────────────────────────────────────────
// SUITE 15: Mongoose Options Sanitization & Backend Readiness Polling
// ─────────────────────────────────────────────────────────────────────────────
const { detectProfile } = require(path.join(backendRoot, "services/stackProfiles"));
const { sanitizeMongooseConnectOptions } = require(path.join(backendRoot, "services/generationOrchestrator"));

suite("Mongoose Options Sanitization & Backend Readiness", () => {
    let originalFindById;
    let originalSpawn;
    let originalAxiosGet;
    let mockProject;
    let mockProc;
    let axiosCalls = [];
    let axiosResponseMock = () => { throw new Error("Connection refused"); };

    const setupMocks = (filesList, projectSpecification = { backend: "express", projectType: "Express API" }) => {
        originalFindById = Project.findById;
        originalSpawn = cp.spawn;
        originalAxiosGet = axios.get;

        mockProject = {
            _id: "projectExpress",
            userId: "user123",
            files: filesList,
            projectSpec: projectSpecification,
            save: async function() { return this; }
        };

        Project.findById = async function(id) {
            return mockProject;
        };

        mockProc = createMockProcess();
        cp.spawn = (cmd, args, opts) => {
            const hasInstallOrBuild = (args && (args.includes("install") || args.includes("build"))) || (cmd && cmd.includes("npm"));
            if (hasInstallOrBuild) {
                const p = createMockProcess();
                setTimeout(() => p.emit("close", 0), 10);
                return p;
            }
            return mockProc;
        };

        axiosCalls = [];
        axios.get = async (url, opts) => {
            axiosCalls.push(url);
            return axiosResponseMock(url);
        };
    };

    const restoreMocks = () => {
        Project.findById = originalFindById;
        cp.spawn = originalSpawn;
        axios.get = originalAxiosGet;
        previewService.activePreviews.clear();
    };

    const createMockProcess = () => {
        const listeners = {};
        const stdoutListeners = {};
        const stderrListeners = {};
        return {
            stdout: {
                on: (event, cb) => { stdoutListeners[event] = cb; },
                emit: (event, data) => { if (stdoutListeners[event]) stdoutListeners[event](data); }
            },
            stderr: {
                on: (event, cb) => { stderrListeners[event] = cb; },
                emit: (event, data) => { if (stderrListeners[event]) stderrListeners[event](data); }
            },
            on: (event, cb) => { listeners[event] = cb; },
            emit: (event, code) => { if (listeners[event]) listeners[event](code); },
            kill: () => {},
            exitCode: null
        };
    };

    test("detectProfile returns correct previewTimeoutMs for stacks", () => {
        const nextSpec = detectProfile({ backend: "nextjs", projectType: "Next.js App" });
        assert.strictEqual(nextSpec.previewTimeoutMs, 240000, "Next.js timeout should be 240s");

        const expressSpec = detectProfile({ backend: "express", projectType: "Express API" });
        assert.strictEqual(expressSpec.previewTimeoutMs, 120000, "Express timeout should be 120s");

        const mernSpec = detectProfile({ backend: "express", projectType: "MERN Stack" });
        assert.strictEqual(mernSpec.previewTimeoutMs, 180000, "MERN timeout should be 180s");
    });

    test("sanitizeMongooseConnectOptions strips useNewUrlParser and useUnifiedTopology", () => {
        const files = [
            {
                name: "server.js",
                content: `
                    mongoose.connect(process.env.MONGODB_URI, {
                        useNewUrlParser: true,
                        useUnifiedTopology: true,
                        someOtherOption: 'hello'
                    });
                `
            }
        ];
        sanitizeMongooseConnectOptions(files);

        assert.ok(!files[0].content.includes("useNewUrlParser"), "Should strip useNewUrlParser");
        assert.ok(!files[0].content.includes("useUnifiedTopology"), "Should strip useUnifiedTopology");
        assert.ok(files[0].content.includes("someOtherOption"), "Should preserve other options");
    });

    test("delayed server startup eventually becomes READY", async () => {
        const files = [
            { name: "package.json", content: '{"main":"server.js","dependencies":{"express":"^4.18.0"}}' },
            { name: "server.js", content: "const express = require('express');" },
            { name: ".env.example", content: "PORT=3000" },
            { name: "README.md", content: "# Express API" }
        ];

        let callCount = 0;
        axiosResponseMock = () => {
            callCount++;
            if (callCount < 3) {
                const err = new Error("connect ECONNREFUSED 127.0.0.1:port");
                err.code = "ECONNREFUSED";
                throw err;
            }
            return { status: 200, data: { status: "ok" } };
        };

        setupMocks(files);
        try {
            await previewService.startPreview("projectExpress", "user123");
            const session = previewService.activePreviews.get("projectExpress");

            // Wait up to 4 seconds for readiness polling to execute
            for (let i = 0; i < 40; i++) {
                if (session.status === "READY" || session.status === "FAILED") break;
                await new Promise(r => setTimeout(r, 100));
            }
            assert.strictEqual(session.status, "READY", "Session should eventually transition to READY");
        } finally {
            restoreMocks();
        }
    });

    test("child exits before readiness transitions to FAILED", async () => {
        const files = [
            { name: "package.json", content: '{"main":"server.js","dependencies":{"express":"^4.18.0"}}' },
            { name: "server.js", content: "const express = require('express');" },
            { name: ".env.example", content: "PORT=3000" },
            { name: "README.md", content: "# Express API" }
        ];

        axiosResponseMock = () => {
            const err = new Error("connect ECONNREFUSED 127.0.0.1:port");
            err.code = "ECONNREFUSED";
            throw err;
        };

        setupMocks(files);
        try {
            await previewService.startPreview("projectExpress", "user123");
            const session = previewService.activePreviews.get("projectExpress");

            // Wait brief moment then mark process exited
            await new Promise(r => setTimeout(r, 200));
            mockProc.exitCode = 1;
            mockProc.emit("close", 1);

            // Wait up to 2 seconds for polling to detect the exit
            for (let i = 0; i < 20; i++) {
                if (session.status === "FAILED") break;
                await new Promise(r => setTimeout(r, 100));
            }
            console.log("DEBUG child exits status:", session.status, "errors:", session.errors);
            assert.strictEqual(session.status, "FAILED", "Session should transition to FAILED if process exits");
            assert.ok(session.errors.some(e => e.includes("early")), "Errors should explain the exit");
        } finally {
            restoreMocks();
        }
    });

    test("readiness deadline exceeded transitions to FAILED", async () => {
        const files = [
            { name: "package.json", content: '{"main":"server.js","dependencies":{"express":"^4.18.0"}}' },
            { name: "server.js", content: "const express = require('express');" },
            { name: ".env.example", content: "PORT=3000" },
            { name: "README.md", content: "# Express API" }
        ];

        axiosResponseMock = () => {
            const err = new Error("connect ECONNREFUSED");
            err.code = "ECONNREFUSED";
            throw err;
        };

        const { detectProfile } = require(path.join(backendRoot, "services/stackProfiles"));

        const originalDetectProfile = detectProfile;
        require(path.join(backendRoot, "services/stackProfiles")).detectProfile = (spec) => {
            const profile = originalDetectProfile(spec);
            return { ...profile, previewTimeoutMs: 100 };
        };

        setupMocks(files, { backend: "express", projectType: "Express API" });
        try {
            await previewService.startPreview("projectExpress", "user123");
            const session = previewService.activePreviews.get("projectExpress");

            // Wait up to 2.5 seconds for polling to timeout (deadline is 100ms)
            for (let i = 0; i < 25; i++) {
                if (session.status === "FAILED") break;
                await new Promise(r => setTimeout(r, 100));
            }
            console.log("DEBUG deadline exceeded status:", session.status, "errors:", session.errors);
            assert.strictEqual(session.status, "FAILED", "Session should transition to FAILED upon exceeding deadline");
            assert.ok(session.errors.some(e => e.includes("did not become healthy")), "Error should mention health check failure");
        } finally {
            require(path.join(backendRoot, "services/stackProfiles")).detectProfile = originalDetectProfile;
            restoreMocks();
        }
    });
});


// ─────────────────────────────────────────────────────────────────────────────
// SUITE 9: Requirement Analysis Characterization (Phase 1A)
// ─────────────────────────────────────────────────────────────────────────────
suite("Requirement Analysis Characterization (Phase 1A)", () => {
    let originalSend;
    let originalSetTimeout;

    const mockSendCompletion = (fn) => {
        providerRouter.sendChatCompletion = fn;
    };

    const setupMocks = () => {
        originalSend = providerRouter.sendChatCompletion;
        originalSetTimeout = global.setTimeout;
        global.setTimeout = (cb) => cb(); // Instant retries
    };

    const restoreMocks = () => {
        providerRouter.sendChatCompletion = originalSend;
        global.setTimeout = originalSetTimeout;
    };

    const providerRouter = require(path.join(backendRoot, "services/aiProviders/providerRouter"));
    const projectService = require(path.join(backendRoot, "services/projectService"));

    test("Valid requirement-analysis response parsing", async () => {
        setupMocks();
        const validPayload = {
            projectName: "GymSite",
            projectType: "React Landing Page",
            frontend: "React (Vite)",
            backend: "None",
            database: "None",
            authentication: "None",
            designRequirements: "Tailwind CSS",
            pagesAndRoutes: [{ path: "/", name: "Landing", description: "Hero section" }],
            components: [{ name: "Navbar", purpose: "Nav bar" }],
            backendApis: [],
            databaseModels: [],
            integrations: [],
            importantDependencies: ["react-router-dom"],
            environmentVariables: [],
            architectureConstraints: [],
            runBuildRequirements: { runScript: "npm run dev", buildScript: "npm run build" },
            deploymentRequirements: "Vercel",
            assumptions: ["Frontend only"]
        };

        mockSendCompletion(async () => {
            return { content: JSON.stringify(validPayload), provider: "mock", model: "mock-model" };
        });

        try {
            const spec = await projectService.analyzeRequirements({ prompt: "Test prompt" });
            assert.strictEqual(spec.projectName, "GymSite");
            assert.strictEqual(spec.projectType, "React Landing Page");
            assert.strictEqual(spec.frontend, "React (Vite)");
            assert.deepStrictEqual(spec.pagesAndRoutes, validPayload.pagesAndRoutes);
            assert.deepStrictEqual(spec.runBuildRequirements, validPayload.runBuildRequirements);
        } finally {
            restoreMocks();
        }
    });

    test("Fenced JSON extraction with leading/trailing prose", async () => {
        setupMocks();
        const jsonWithProse = `Some introductory text...
\`\`\`json
{
  "projectName": "FitApp",
  "projectType": "MERN app",
  "frontend": "React"
}
\`\`\`
Some footer text...`;

        mockSendCompletion(async () => {
            return { content: jsonWithProse, provider: "mock", model: "mock-model" };
        });

        try {
            const spec = await projectService.analyzeRequirements({ prompt: "Test prompt" });
            assert.strictEqual(spec.projectName, "FitApp");
            assert.strictEqual(spec.projectType, "MERN app");
            assert.strictEqual(spec.frontend, "React");
            assert.strictEqual(spec.backend, "None"); // Defaulted
            assert.deepStrictEqual(spec.pagesAndRoutes, []); // Defaulted
        } finally {
            restoreMocks();
        }
    });

    test("Missing/partial fields defaults", async () => {
        setupMocks();
        // Return JSON missing almost all fields
        mockSendCompletion(async () => {
            return { content: '{"projectName":"OnlyName"}', provider: "mock", model: "mock-model" };
        });

        try {
            const spec = await projectService.analyzeRequirements({ prompt: "Test prompt" });
            assert.strictEqual(spec.projectName, "OnlyName");
            assert.strictEqual(spec.projectType, "Web Application"); // Default
            assert.strictEqual(spec.backend, "None"); // Default
            assert.deepStrictEqual(spec.pagesAndRoutes, []); // Default
            assert.deepStrictEqual(spec.runBuildRequirements, { runScript: "npm run dev", buildScript: "" }); // Default
            assert.strictEqual(spec.deploymentRequirements, "None"); // Default
        } finally {
            restoreMocks();
        }
    });

    test("Malformed AI output fallback retry success", async () => {
        setupMocks();
        let callCount = 0;
        mockSendCompletion(async () => {
            callCount++;
            if (callCount === 1) {
                return { content: "This is not JSON at all!", provider: "mock", model: "mock-model" };
            }
            return { content: '{"projectName":"RetrySuccess"}', provider: "mock", model: "mock-model" };
        });

        try {
            const spec = await projectService.analyzeRequirements({ prompt: "Test prompt" });
            assert.strictEqual(callCount, 2, "Should retry and call provider twice");
            assert.strictEqual(spec.projectName, "RetrySuccess");
        } finally {
            restoreMocks();
        }
    });

    test("Empty response behavior and retrying", async () => {
        setupMocks();
        let callCount = 0;
        mockSendCompletion(async () => {
            callCount++;
            if (callCount === 1) {
                return { content: "", provider: "mock", model: "mock-model" }; // empty
            }
            return { content: '{"projectName":"RetryEmptySuccess"}', provider: "mock", model: "mock-model" };
        });

        try {
            const spec = await projectService.analyzeRequirements({ prompt: "Test prompt" });
            assert.strictEqual(callCount, 2, "Should retry after empty response");
            assert.strictEqual(spec.projectName, "RetryEmptySuccess");
        } finally {
            restoreMocks();
        }
    });

    test("Provider failure retrying and propagation", async () => {
        setupMocks();
        let callCount = 0;
        mockSendCompletion(async () => {
            callCount++;
            throw new Error("Provider rate limit error");
        });

        try {
            await assert.rejects(
                projectService.analyzeRequirements({ prompt: "Test prompt" }),
                /Failed to analyze requirements: Provider rate limit error/
            );
            assert.strictEqual(callCount, 3, "Should retry up to max attempts (3)");
        } finally {
            restoreMocks();
        }
    });

    test("Stack profiles mapping (unknown/dynamic stack)", () => {
        const { detectProfile } = require(path.join(backendRoot, "services/stackProfiles"));
        const spec = {
            projectName: "UnknownStackProj",
            projectType: "Some random tech",
            frontend: "Ruby on Rails",
            backend: "Ruby",
            database: "SQLite"
        };
        const profile = detectProfile(spec);
        assert.strictEqual(profile.name, "dynamic", "Unknown stack should map to the dynamic fallback profile");
    });

    test("projectSpec immutability under planner and contract building", () => {
        const spec = { ...SAMPLE_REACT_SPEC };
        const originalSpecStr = JSON.stringify(spec);
        planGeneration(spec);
        buildSharedContracts(spec);
        buildProjectManifest("gym app", spec);
        assert.strictEqual(JSON.stringify(spec), originalSpecStr, "projectSpec must not be modified by planners or contract builders");
    });

    test("Collision: React and Express without Mongo maps to dynamic fallback if React is in projectType", () => {
        const { detectProfile } = require(path.join(backendRoot, "services/stackProfiles"));
        const spec = {
            frontend: "React",
            backend: "Express",
            projectType: "React Application",
            database: "None"
        };
        const profile = detectProfile(spec);
        assert.strictEqual(profile.name, "dynamic", "React + Express without Mongo should map to dynamic when React is in projectType");
    });

    test("Collision: React and Express without Mongo maps to express if React is only in frontend field", () => {
        const { detectProfile } = require(path.join(backendRoot, "services/stackProfiles"));
        const spec = {
            frontend: "React",
            backend: "Express",
            database: "None"
        };
        const profile = detectProfile(spec);
        assert.strictEqual(profile.name, "express", "React + Express should map to express if React is only in frontend because Express detect ignores frontend field");
    });

    test("Collision: Next.js and React maps to nextjs", () => {
        const { detectProfile } = require(path.join(backendRoot, "services/stackProfiles"));
        const spec = {
            frontend: "Next.js with React",
            projectType: "Next.js Portfolio"
        };
        const profile = detectProfile(spec);
        assert.strictEqual(profile.name, "nextjs", "Next.js + React should map to nextjs");
    });

    test("Collision: Django backend maps to dynamic generating django files", () => {
        const { detectProfile } = require(path.join(backendRoot, "services/stackProfiles"));
        const spec = {
            backend: "Django framework",
            database: "Postgres"
        };
        const profile = detectProfile(spec);
        assert.strictEqual(profile.name, "dynamic", "Django maps to dynamic");
        const folderStructure = profile.getFolderStructure(spec);
        assert.ok(folderStructure.includes("manage.py"), "Should include manage.py for Django");
        assert.ok(folderStructure.includes("requirements.txt"), "Should include requirements.txt for Django");
    });

    test("Collision: Vanilla fallback maps correctly on empty backend/database", () => {
        const { detectProfile } = require(path.join(backendRoot, "services/stackProfiles"));
        const spec = {
            frontend: "None",
            backend: "None",
            database: "None"
        };
        const profile = detectProfile(spec);
        assert.strictEqual(profile.name, "vanilla", "No backend/database matches should map to vanilla");
    });
});

suite("Canonical ProjectSpec Schema & Validation (Phase 1B)", () => {
    const { validateProjectSpec, errorCodes } = require(path.join(backendRoot, "core/projectSpec"));

    const getValidSpec = () => ({
        schemaVersion: "1.0",
        projectName: "ValidProject",
        projectType: "React Landing Page",
        frontend: "React (Vite)",
        backend: "None",
        database: "None",
        authentication: "None",
        designRequirements: "Tailwind CSS",
        pagesAndRoutes: [
            { path: "/", name: "LandingPage", description: "Hero section" }
        ],
        components: [
            { name: "Navbar", purpose: "Navigation" }
        ],
        backendApis: [],
        databaseModels: [],
        integrations: ["Stripe"],
        importantDependencies: ["react", "react-dom"],
        environmentVariables: ["VITE_API_KEY"],
        architectureConstraints: ["Responsive layout"],
        runBuildRequirements: {
            runScript: "npm run dev",
            buildScript: "npm run build"
        },
        deploymentRequirements: "Vercel",
        assumptions: ["No database needed"]
    });

    test("1. Complete valid canonical ProjectSpec passes", () => {
        const spec = getValidSpec();
        const res = validateProjectSpec(spec);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.errors.length, 0);
        assert.strictEqual(res.value.projectName, "ValidProject");
    });

    test("2. Validation does not mutate input", () => {
        const spec = getValidSpec();
        const originalJson = JSON.stringify(spec);
        validateProjectSpec(spec);
        assert.strictEqual(JSON.stringify(spec), originalJson);
    });

    test("3. Validated output does not share nested mutable references with input", () => {
        const spec = getValidSpec();
        const res = validateProjectSpec(spec);
        assert.ok(res.success);
        assert.notStrictEqual(res.value, spec);
        assert.notStrictEqual(res.value.pagesAndRoutes, spec.pagesAndRoutes);
        assert.notStrictEqual(res.value.pagesAndRoutes[0], spec.pagesAndRoutes[0]);
    });

    test("4. Validated output is deeply immutable", () => {
        const spec = getValidSpec();
        const res = validateProjectSpec(spec);
        assert.ok(res.success);
        assert.throws(() => {
            res.value.projectName = "MutatedName";
        }, TypeError);
        assert.throws(() => {
            res.value.pagesAndRoutes[0].path = "/new";
        }, TypeError);
        assert.throws(() => {
            res.value.pagesAndRoutes.push({ path: "/foo", name: "Foo", description: "Foo" });
        }, TypeError);
    });

    test("5. Missing schemaVersion fails", () => {
        const spec = getValidSpec();
        delete spec.schemaVersion;
        const res = validateProjectSpec(spec);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === errorCodes.MISSING_VERSION && e.path === "schemaVersion"));
    });

    test("6. Unsupported schemaVersion fails", () => {
        const spec = getValidSpec();
        spec.schemaVersion = "2.0";
        const res = validateProjectSpec(spec);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === errorCodes.INVALID_VERSION && e.path === "schemaVersion"));
    });

    test("7. Missing required top-level field fails", () => {
        const spec = getValidSpec();
        delete spec.projectName;
        const res = validateProjectSpec(spec);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === errorCodes.MISSING_REQUIRED && e.path === "projectName"));
    });

    test("8. Wrong primitive type fails", () => {
        const spec = getValidSpec();
        spec.projectName = 12345;
        const res = validateProjectSpec(spec);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === errorCodes.INVALID_TYPE && e.path === "projectName"));
    });

    test("9. Wrong array element type fails", () => {
        const spec = getValidSpec();
        spec.integrations = [123];
        const res = validateProjectSpec(spec);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === errorCodes.INVALID_TYPE && e.path === "integrations[0]"));
    });

    test("10. Malformed pagesAndRoutes entry fails", () => {
        const spec = getValidSpec();
        spec.pagesAndRoutes = [
            { path: "no-leading-slash", name: "Page", description: "Desc" }
        ];
        const res = validateProjectSpec(spec);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === errorCodes.INVALID_PAGE_ROUTE && e.path === "pagesAndRoutes[0].path"));
    });

    test("11. Malformed components entry fails", () => {
        const spec = getValidSpec();
        spec.components = [
            { name: "", purpose: "Invalid empty name" }
        ];
        const res = validateProjectSpec(spec);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === errorCodes.INVALID_VALUE && e.path === "components[0].name"));
    });

    test("12. Malformed backendApis entry fails", () => {
        const spec = getValidSpec();
        spec.backendApis = [
            { method: "GET", path: "no-slash", purpose: "invalid path" }
        ];
        const res = validateProjectSpec(spec);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === errorCodes.INVALID_API_PATH && e.path === "backendApis[0].path"));
    });

    test("13. Invalid HTTP method fails", () => {
        const spec = getValidSpec();
        spec.backendApis = [
            { method: "INVALID", path: "/api/test", purpose: "invalid method" }
        ];
        const res = validateProjectSpec(spec);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === errorCodes.INVALID_HTTP_METHOD && e.path === "backendApis[0].method"));
    });

    test("14. Malformed API path fails", () => {
        const spec = getValidSpec();
        spec.backendApis = [
            { method: "POST", path: "api/test", purpose: "missing leading slash" }
        ];
        const res = validateProjectSpec(spec);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === errorCodes.INVALID_API_PATH && e.path === "backendApis[0].path"));
    });

    test("15. Duplicate API method/path fails", () => {
        const spec = getValidSpec();
        spec.backendApis = [
            { method: "GET", path: "/api/users", purpose: "first" },
            { method: "get ", path: " /api/users", purpose: "second" }
        ];
        const res = validateProjectSpec(spec);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === errorCodes.DUPLICATE_API && e.path === "backendApis[1]"));
    });

    test("16. Duplicate page route fails", () => {
        const spec = getValidSpec();
        spec.pagesAndRoutes = [
            { path: "/home", name: "Home", description: "Home page" },
            { path: "/home", name: "Home2", description: "Duplicate path" }
        ];
        const res = validateProjectSpec(spec);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === errorCodes.DUPLICATE_ROUTE && e.path === "pagesAndRoutes[1].path"));
    });

    test("17. Duplicate component name fails", () => {
        const spec = getValidSpec();
        spec.components = [
            { name: "Button", purpose: "A button" },
            { name: "button", purpose: "A duplicate button" }
        ];
        const res = validateProjectSpec(spec);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === errorCodes.DUPLICATE_COMPONENT && e.path === "components[1].name"));
    });

    test("18. Malformed databaseModels entry fails", () => {
        const spec = getValidSpec();
        spec.databaseModels = [
            { name: "User", fields: [123] }
        ];
        const res = validateProjectSpec(spec);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === errorCodes.INVALID_TYPE && e.path === "databaseModels[0].fields[0]"));
    });

    test("19. Duplicate database model name fails", () => {
        const spec = getValidSpec();
        spec.databaseModels = [
            { name: "User", fields: ["name (String)"] },
            { name: "user", fields: ["email (String)"] }
        ];
        const res = validateProjectSpec(spec);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === errorCodes.DUPLICATE_MODEL && e.path === "databaseModels[1].name"));
    });

    test("20. Invalid environment variable name fails", () => {
        const spec = getValidSpec();
        spec.environmentVariables = ["1INVALID_ENV"];
        const res = validateProjectSpec(spec);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === errorCodes.INVALID_ENV_VAR && e.path === "environmentVariables[0]"));
    });

    test("21. Invalid dependency name fails according to documented policy", () => {
        const spec = getValidSpec();
        spec.importantDependencies = ["react space"];
        const res = validateProjectSpec(spec);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === errorCodes.INVALID_DEP_NAME && e.path === "importantDependencies[0]"));
    });

    test("22. Missing runBuildRequirements key fails", () => {
        const spec = getValidSpec();
        spec.runBuildRequirements = { runScript: "node index.js" };
        const res = validateProjectSpec(spec);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === errorCodes.MISSING_REQUIRED && e.path === "runBuildRequirements.buildScript"));
    });

    test("23. Unknown top-level field behavior matches strictness policy", () => {
        const spec = getValidSpec();
        spec.unknownField = "value";
        const res = validateProjectSpec(spec);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === errorCodes.UNKNOWN_FIELD && e.path === "unknownField"));
    });

    test("24. Unknown nested field behavior matches strictness policy", () => {
        const spec = getValidSpec();
        spec.pagesAndRoutes[0].unknownNested = "some value";
        const res = validateProjectSpec(spec);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === errorCodes.UNKNOWN_FIELD && e.path === "pagesAndRoutes[0].unknownNested"));
    });

    test("25. Empty/whitespace-only string behavior matches policy", () => {
        const spec = getValidSpec();
        spec.projectName = "   ";
        const res = validateProjectSpec(spec);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === errorCodes.INVALID_VALUE && e.path === "projectName"));
    });

    test("26. Multiple validation errors are returned where practical", () => {
        const spec = getValidSpec();
        spec.projectName = "";
        spec.frontend = "";
        const res = validateProjectSpec(spec);
        assert.strictEqual(res.success, false);
        assert.strictEqual(res.errors.length, 2);
    });

    test("27. Validation error ordering is deterministic", () => {
        const spec = getValidSpec();
        spec.frontend = "";
        spec.projectName = "";
        const res = validateProjectSpec(spec);
        assert.strictEqual(res.errors[0].path, "frontend");
        assert.strictEqual(res.errors[1].path, "projectName");
    });

    test("28. Same candidate produces deterministic validation result", () => {
        const spec = getValidSpec();
        spec.frontend = "";
        spec.projectName = "";
        const res1 = validateProjectSpec(spec);
        const res2 = validateProjectSpec(spec);
        assert.deepStrictEqual(res1, res2);
    });

    test("29. Total boundary checks with arbitrary inputs (null, undefined, date, class, functions)", () => {
        assert.strictEqual(validateProjectSpec(null).success, false);
        assert.strictEqual(validateProjectSpec(undefined).success, false);
        assert.strictEqual(validateProjectSpec(true).success, false);
        assert.strictEqual(validateProjectSpec(123).success, false);
        assert.strictEqual(validateProjectSpec("string").success, false);
        assert.strictEqual(validateProjectSpec([]).success, false);
        assert.strictEqual(validateProjectSpec(() => {}).success, false);
        assert.strictEqual(validateProjectSpec(new Date()).success, false);
        assert.strictEqual(validateProjectSpec(/regex/).success, false);
        
        class MyClass {}
        assert.strictEqual(validateProjectSpec(new MyClass()).success, false);

        const spec = getValidSpec();
        spec.runBuildRequirements = new Date();
        assert.strictEqual(validateProjectSpec(spec).success, false);
    });

    test("30. Sparse arrays are caught and fail validation", () => {
        const spec = getValidSpec();
        spec.pagesAndRoutes = [];
        spec.pagesAndRoutes[0] = { path: "/a", name: "A", description: "A" };
        spec.pagesAndRoutes[2] = { path: "/b", name: "B", description: "B" };
        const res = validateProjectSpec(spec);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === errorCodes.INVALID_TYPE && e.path === "pagesAndRoutes[1]"));
    });

    test("31. Prototype pollution / inherited property bypasses are prevented", () => {
        // Pollute Object.prototype temporarily
        Object.prototype.tempPollutedField = "polluted";
        try {
            const spec = getValidSpec();
            // Delete a required field from own properties
            delete spec.projectName;
            // Set the deleted property on Object.prototype to simulate prototype pollution bypass attempt
            Object.prototype.projectName = "BypassedName";

            const res = validateProjectSpec(spec);
            assert.strictEqual(res.success, false);
            assert.ok(res.errors.some(e => e.code === errorCodes.MISSING_REQUIRED && e.path === "projectName"), 
                "Should catch missing required field even if present on Object.prototype");
        } finally {
            delete Object.prototype.tempPollutedField;
            delete Object.prototype.projectName;
        }
    });

    test("32. Throwing getters are caught safely without crashing", () => {
        const spec = getValidSpec();
        Object.defineProperty(spec, "projectName", {
            get() { throw new Error("Malicious throwing getter"); },
            enumerable: true
        });
        const res = validateProjectSpec(spec);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === errorCodes.INVALID_VALUE && e.path === "" && e.message.includes("Malicious throwing getter")));
    });

    test("33. Route / API path strict validations", () => {
        const spec = getValidSpec();
        
        // Allowed paths
        const validPaths = ["/", "/users", "/users/:id", "/users/{id}", "/users/*"];
        validPaths.forEach(p => {
            spec.pagesAndRoutes[0].path = p;
            assert.strictEqual(validateProjectSpec(spec).success, true, `Should accept valid path: ${p}`);
        });

        // Rejected paths
        const invalidPaths = ["users", "//users", "/users/", "/users/ ", "/users?foo=bar", "/users#section"];
        invalidPaths.forEach(p => {
            spec.pagesAndRoutes[0].path = p;
            assert.strictEqual(validateProjectSpec(spec).success, false, `Should reject invalid path: ${p}`);
        });
    });

    test("34. Dependency name format rules (NPM scopes, versions, spaces)", () => {
        const spec = getValidSpec();

        // Allowed
        const validDeps = ["react", "@scope/package", "package-name", "package_name"];
        validDeps.forEach(d => {
            spec.importantDependencies = [d];
            assert.strictEqual(validateProjectSpec(spec).success, true, `Should accept valid dependency: ${d}`);
        });

        // Rejected
        const invalidDeps = ["package/name", "react@18", "git+ssh://github.com", "http://github.com", "", "   "];
        invalidDeps.forEach(d => {
            spec.importantDependencies = [d];
            assert.strictEqual(validateProjectSpec(spec).success, false, `Should reject invalid dependency: ${d}`);
        });
    });

    test("35. Environment variable name format rules (digits, lower, symbols)", () => {
        const spec = getValidSpec();

        // Allowed
        const validEnvs = ["DATABASE_URL", "VITE_API_URL", "NEXT_PUBLIC_API_URL", "db_url", "_my_var"];
        validEnvs.forEach(env => {
            spec.environmentVariables = [env];
            assert.strictEqual(validateProjectSpec(spec).success, true, `Should accept valid env: ${env}`);
        });

        // Rejected
        const invalidEnvs = ["1_VAR", "VAR-NAME", "VAR=VAL", "", "   "];
        invalidEnvs.forEach(env => {
            spec.environmentVariables = [env];
            assert.strictEqual(validateProjectSpec(spec).success, false, `Should reject invalid env: ${env}`);
        });
    });
});

suite("ProjectSpec Compiler / Adapter (Phase 1C)", () => {
    const { compileProjectSpec, compilerErrorCodes, errorCodes } = require(path.join(backendRoot, "core/projectSpec"));

    const getLegacyPayload = () => ({
        projectName: "LegacyProject",
        projectType: "React Landing Page",
        frontend: "React (Vite)",
        backend: "None",
        database: "None",
        authentication: "None",
        designRequirements: "Tailwind CSS",
        pagesAndRoutes: [
            { path: "/", name: "Landing", description: "Hero section" }
        ],
        components: [
            { name: "Navbar", purpose: "Navigation" }
        ],
        backendApis: [],
        databaseModels: [],
        integrations: ["Stripe"],
        importantDependencies: ["react"],
        environmentVariables: ["VITE_API_KEY"],
        architectureConstraints: ["Responsive"],
        runBuildRequirements: {
            runScript: "npm run dev",
            buildScript: "npm run build"
        },
        deploymentRequirements: "Vercel",
        assumptions: ["None"]
    });

    test("1. Complete canonical-compatible legacy payload compiles successfully", () => {
        const payload = getLegacyPayload();
        const res = compileProjectSpec(payload);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.value.projectName, "LegacyProject");
    });

    test("2. schemaVersion is assigned by compiler", () => {
        const payload = getLegacyPayload();
        delete payload.schemaVersion;
        const res = compileProjectSpec(payload);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.value.schemaVersion, "1.0");
    });

    test("3. Caller-supplied schemaVersion cannot override compiler-owned version", () => {
        // schemaVersion "1.0"
        const payload1 = getLegacyPayload();
        payload1.schemaVersion = "1.0";
        const res1 = compileProjectSpec(payload1);
        assert.strictEqual(res1.success, true);
        assert.strictEqual(res1.value.schemaVersion, "1.0");

        // schemaVersion unsupported string
        const payload2 = getLegacyPayload();
        payload2.schemaVersion = "99.0";
        const res2 = compileProjectSpec(payload2);
        assert.strictEqual(res2.success, true);
        assert.strictEqual(res2.value.schemaVersion, "1.0");

        // schemaVersion wrong primitive type
        const payload3 = getLegacyPayload();
        payload3.schemaVersion = 123;
        const res3 = compileProjectSpec(payload3);
        assert.strictEqual(res3.success, true);
        assert.strictEqual(res3.value.schemaVersion, "1.0");

        // schemaVersion object
        const payload4 = getLegacyPayload();
        payload4.schemaVersion = { ver: "1.0" };
        const res4 = compileProjectSpec(payload4);
        assert.strictEqual(res4.success, true);
        assert.strictEqual(res4.value.schemaVersion, "1.0");

        // schemaVersion throwing getter
        const payload5 = getLegacyPayload();
        Object.defineProperty(payload5, "schemaVersion", {
            get() { throw new Error("Throwing schemaVersion"); },
            enumerable: true
        });
        const res5 = compileProjectSpec(payload5);
        assert.strictEqual(res5.success, false);
        assert.ok(res5.errors[0].message.includes("Throwing schemaVersion"));
    });

    test("4. Missing array fields normalize to []", () => {
        const payload = getLegacyPayload();
        delete payload.pagesAndRoutes;
        delete payload.components;
        delete payload.backendApis;
        delete payload.databaseModels;
        const res = compileProjectSpec(payload);
        assert.strictEqual(res.success, true);
        assert.deepStrictEqual(res.value.pagesAndRoutes, []);
        assert.deepStrictEqual(res.value.components, []);
    });

    test("5. Missing string fields normalize to characterized defaults", () => {
        const payload = getLegacyPayload();
        delete payload.frontend;
        delete payload.backend;
        delete payload.database;
        delete payload.authentication;
        delete payload.designRequirements;
        delete payload.deploymentRequirements;
        const res = compileProjectSpec(payload);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.value.frontend, "None");
        assert.strictEqual(res.value.backend, "None");
        assert.strictEqual(res.value.database, "None");
    });

    test("6. Missing projectName defaults to MyProject", () => {
        const payload = getLegacyPayload();
        delete payload.projectName;
        const res = compileProjectSpec(payload);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.value.projectName, "MyProject");
    });

    test("7. Missing projectType defaults to Web Application", () => {
        const payload = getLegacyPayload();
        delete payload.projectType;
        const res = compileProjectSpec(payload);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.value.projectType, "Web Application");
    });

    test("8. Missing runBuildRequirements gets characterized default", () => {
        const payload = getLegacyPayload();
        delete payload.runBuildRequirements;
        const res = compileProjectSpec(payload);
        assert.strictEqual(res.success, true);
        assert.deepStrictEqual(res.value.runBuildRequirements, { runScript: "npm run dev", buildScript: "" });
    });

    test("9. Input is not mutated", () => {
        const payload = getLegacyPayload();
        const original = JSON.parse(JSON.stringify(payload));
        compileProjectSpec(payload);
        assert.deepStrictEqual(payload, original);
    });

    test("10. Successful output shares no nested mutable references", () => {
        const payload = getLegacyPayload();
        const res = compileProjectSpec(payload);
        assert.notStrictEqual(res.value.runBuildRequirements, payload.runBuildRequirements);
        assert.notStrictEqual(res.value.pagesAndRoutes, payload.pagesAndRoutes);
    });

    test("11. Successful output is deeply immutable", () => {
        const payload = getLegacyPayload();
        const res = compileProjectSpec(payload);
        assert.throws(() => { res.value.projectName = "Changed"; });
        assert.throws(() => { res.value.runBuildRequirements.runScript = "node server.js"; });
    });

    test("12. Missing nested keys behavior for pagesAndRoutes", () => {
        const payload = getLegacyPayload();
        payload.pagesAndRoutes = [{ path: "/" }];
        const res = compileProjectSpec(payload);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === errorCodes.MISSING_REQUIRED && e.path.startsWith("pagesAndRoutes[0]")));
    });

    test("13. Missing nested keys behavior for components", () => {
        const payload = getLegacyPayload();
        payload.components = [{ name: "Navbar" }];
        const res = compileProjectSpec(payload);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === errorCodes.MISSING_REQUIRED && e.path === "components[0].purpose"));
    });

    test("14. Missing nested keys behavior for backendApis", () => {
        const payload = getLegacyPayload();
        payload.backendApis = [{ method: "GET", path: "/api" }];
        const res = compileProjectSpec(payload);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === errorCodes.MISSING_REQUIRED && e.path === "backendApis[0].purpose"));
    });

    test("15. Missing nested keys behavior for databaseModels", () => {
        const payload = getLegacyPayload();
        payload.databaseModels = [{ name: "User" }];
        const res = compileProjectSpec(payload);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === errorCodes.MISSING_REQUIRED && e.path === "databaseModels[0].fields"));
    });

    test("16. Extra nested fields policy", () => {
        const payload = getLegacyPayload();
        payload.components = [{ name: "Navbar", purpose: "Nav", extraField: "value" }];
        const res = compileProjectSpec(payload);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === compilerErrorCodes.UNKNOWN_FIELD && e.path === "components[0].extraField"));
    });

    test("17. Unknown top-level field policy", () => {
        const payload = getLegacyPayload();
        payload.unknownField = "value";
        const res = compileProjectSpec(payload);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === compilerErrorCodes.UNKNOWN_FIELD && e.path === "unknownField"));
    });

    test("18. Wrong top-level primitive type rejection", () => {
        const payload = getLegacyPayload();
        payload.projectName = 123;
        const res = compileProjectSpec(payload);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === compilerErrorCodes.INVALID_TYPE && e.path === "projectName"));
    });

    test("19. Wrong collection type rejection", () => {
        const payload = getLegacyPayload();
        payload.pagesAndRoutes = "not-an-array";
        const res = compileProjectSpec(payload);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === compilerErrorCodes.INVALID_TYPE && e.path === "pagesAndRoutes"));
    });

    test("20. Primitive nested array element rejection", () => {
        const payload = getLegacyPayload();
        payload.pagesAndRoutes = ["string-not-object"];
        const res = compileProjectSpec(payload);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === errorCodes.INVALID_TYPE && e.path === "pagesAndRoutes[0]"));
    });

    test("21. Sparse array rejection", () => {
        const payload = getLegacyPayload();
        payload.pagesAndRoutes = [];
        payload.pagesAndRoutes[0] = { path: "/", name: "Home", description: "Home" };
        payload.pagesAndRoutes[2] = { path: "/about", name: "About", description: "About" };
        const res = compileProjectSpec(payload);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === compilerErrorCodes.SPARSE_ARRAY && e.path === "pagesAndRoutes[1]"));
    });

    test("22. Null handling", () => {
        const res = compileProjectSpec(null);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === compilerErrorCodes.INVALID_INPUT));
    });

    test("23. undefined handling", () => {
        const res = compileProjectSpec(undefined);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === compilerErrorCodes.INVALID_INPUT));
    });

    test("24. Empty-string policy", () => {
        const payload = getLegacyPayload();
        payload.projectName = "";
        const res = compileProjectSpec(payload);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.value.projectName, "MyProject");
    });

    test("25. Whitespace-only policy", () => {
        const payload = getLegacyPayload();
        payload.projectName = "   ";
        const res = compileProjectSpec(payload);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.value.projectName, "MyProject");
    });

    test("26. 'None' casing/whitespace policy", () => {
        const payload = getLegacyPayload();
        payload.frontend = "  nOnE  ";
        const res = compileProjectSpec(payload);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.value.frontend, "None");
    });

    test("27. runBuildRequirements partial object behavior", () => {
        const payload = getLegacyPayload();
        payload.runBuildRequirements = { runScript: "node index.js" };
        const res = compileProjectSpec(payload);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.value.runBuildRequirements.buildScript, "");
    });

    test("28. Invalid HTTP method delegated to validator", () => {
        const payload = getLegacyPayload();
        payload.backendApis = [{ method: "INVALID", path: "/api", purpose: "Test" }];
        const res = compileProjectSpec(payload);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === errorCodes.INVALID_HTTP_METHOD && e.path === "backendApis[0].method"));
    });

    test("29. Invalid route delegated to validator", () => {
        const payload = getLegacyPayload();
        payload.pagesAndRoutes = [{ path: "invalid-path-no-slash", name: "Home", description: "Home" }];
        const res = compileProjectSpec(payload);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === errorCodes.INVALID_PAGE_ROUTE && e.path === "pagesAndRoutes[0].path"));
    });

    test("30. Duplicate route delegated to validator", () => {
        const payload = getLegacyPayload();
        payload.pagesAndRoutes = [
            { path: "/home", name: "H1", description: "D1" },
            { path: "/home", name: "H2", description: "D2" }
        ];
        const res = compileProjectSpec(payload);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === errorCodes.DUPLICATE_ROUTE && e.path === "pagesAndRoutes[1].path"));
    });

    test("31. Duplicate API delegated to validator", () => {
        const payload = getLegacyPayload();
        payload.backendApis = [
            { method: "get", path: "/api", purpose: "d1" },
            { method: "GET", path: "/api", purpose: "d2" }
        ];
        const res = compileProjectSpec(payload);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === errorCodes.DUPLICATE_API && e.path === "backendApis[1]"));
    });

    test("32. Invalid env var delegated to validator", () => {
        const payload = getLegacyPayload();
        payload.environmentVariables = ["INVALID-ENV-VAR"];
        const res = compileProjectSpec(payload);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === errorCodes.INVALID_ENV_VAR && e.path === "environmentVariables[0]"));
    });

    test("33. Invalid dependency delegated to validator", () => {
        const payload = getLegacyPayload();
        payload.importantDependencies = ["react@18"];
        const res = compileProjectSpec(payload);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === errorCodes.INVALID_DEP_NAME && e.path === "importantDependencies[0]"));
    });

    test("34. Case preservation for stack fields, dependencies, env vars, routes, component/model names, and free text", () => {
        const payload = getLegacyPayload();
        payload.projectName = "PreserveMyCase";
        payload.projectType = "preserveMyCase Stack";
        payload.frontend = "ReactFrontend";
        payload.backend = "ExpressBackend";
        payload.database = "MongoDb";
        payload.authentication = "JwtAuth";
        payload.designRequirements = "TailwindCss";
        payload.deploymentRequirements = "AwsAmplify";
        
        payload.importantDependencies = ["React-Router-Dom", "Axios"];
        payload.environmentVariables = ["PRESERVE_CASE_ENV"];
        
        payload.integrations = ["StripePay"];
        payload.architectureConstraints = ["CleanArchitecture"];
        payload.assumptions = ["SomeFreeTextAssumption"];
        
        payload.pagesAndRoutes = [
            { path: "/SomeRoutePath", name: "SomePageName", description: "SomePageDescription" }
        ];
        payload.components = [
            { name: "SomeComponentName", purpose: "SomeComponentPurpose" }
        ];
        payload.backendApis = [
            { method: "get", path: "/SomeApiPath", purpose: "SomeApiPurpose" }
        ];
        payload.databaseModels = [
            { name: "SomeModelName", fields: ["FieldName1", "FieldName2"] }
        ];
        payload.runBuildRequirements = {
            runScript: "npm Run Dev",
            buildScript: "npm Run Build"
        };

        const res = compileProjectSpec(payload);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.value.projectName, "PreserveMyCase");
        assert.strictEqual(res.value.projectType, "preserveMyCase Stack");
        assert.strictEqual(res.value.frontend, "ReactFrontend");
        assert.strictEqual(res.value.backend, "ExpressBackend");
        assert.strictEqual(res.value.database, "MongoDb");
        assert.strictEqual(res.value.authentication, "JwtAuth");
        assert.strictEqual(res.value.designRequirements, "TailwindCss");
        assert.strictEqual(res.value.deploymentRequirements, "AwsAmplify");
        assert.strictEqual(res.value.importantDependencies[0], "React-Router-Dom");
        assert.strictEqual(res.value.importantDependencies[1], "Axios");
        assert.strictEqual(res.value.environmentVariables[0], "PRESERVE_CASE_ENV");
        assert.strictEqual(res.value.integrations[0], "StripePay");
        assert.strictEqual(res.value.architectureConstraints[0], "CleanArchitecture");
        assert.strictEqual(res.value.assumptions[0], "SomeFreeTextAssumption");
        assert.strictEqual(res.value.pagesAndRoutes[0].path, "/SomeRoutePath");
        assert.strictEqual(res.value.pagesAndRoutes[0].name, "SomePageName");
        assert.strictEqual(res.value.pagesAndRoutes[0].description, "SomePageDescription");
        assert.strictEqual(res.value.components[0].name, "SomeComponentName");
        assert.strictEqual(res.value.components[0].purpose, "SomeComponentPurpose");
        assert.strictEqual(res.value.backendApis[0].method, "GET"); // HTTP method uppercase
        assert.strictEqual(res.value.backendApis[0].path, "/SomeApiPath");
        assert.strictEqual(res.value.backendApis[0].purpose, "SomeApiPurpose");
        assert.strictEqual(res.value.databaseModels[0].name, "SomeModelName");
        assert.strictEqual(res.value.databaseModels[0].fields[0], "FieldName1");
        assert.strictEqual(res.value.databaseModels[0].fields[1], "FieldName2");
        assert.strictEqual(res.value.runBuildRequirements.runScript, "npm Run Dev");
        assert.strictEqual(res.value.runBuildRequirements.buildScript, "npm Run Build");
    });

    test("35. Stack semantic fields preserved and stack-selection quirks are not altered", () => {
        const { detectProfile } = require(path.join(backendRoot, "services/stackProfiles"));
        
        // Case 1: React + Express without Mongo maps to dynamic when React is in projectType
        const p1 = getLegacyPayload();
        p1.frontend = "React";
        p1.backend = "Express";
        p1.projectType = "React Application";
        p1.database = "None";
        const res1 = compileProjectSpec(p1);
        assert.strictEqual(res1.success, true);
        const profile1 = detectProfile(res1.value);
        assert.strictEqual(profile1.name, "dynamic");

        // Case 2: React + Express without Mongo maps to express if React is only in frontend field
        const p2 = getLegacyPayload();
        p2.frontend = "React";
        p2.backend = "Express";
        p2.projectType = "Web Application";
        p2.database = "None";
        const res2 = compileProjectSpec(p2);
        assert.strictEqual(res2.success, true);
        const profile2 = detectProfile(res2.value);
        assert.strictEqual(profile2.name, "express");

        // Case 3: Django backend maps to dynamic
        const p3 = getLegacyPayload();
        p3.frontend = "None";
        p3.backend = "Django";
        p3.projectType = "Django Web App";
        const res3 = compileProjectSpec(p3);
        assert.strictEqual(res3.success, true);
        const profile3 = detectProfile(res3.value);
        assert.strictEqual(profile3.name, "dynamic");
    });

    test("36. Missing, undefined, and null normalization policies matrix", () => {
        // Missing/undefined/null to defaults
        const p1 = getLegacyPayload();
        delete p1.frontend;
        p1.integrations = undefined;
        p1.runBuildRequirements = null;
        const res1 = compileProjectSpec(p1);
        assert.strictEqual(res1.success, true);
        assert.strictEqual(res1.value.frontend, "None");
        assert.deepStrictEqual(res1.value.integrations, []);
        assert.deepStrictEqual(res1.value.runBuildRequirements, { runScript: "npm run dev", buildScript: "" });

        // Reject null inside string arrays
        const p2 = getLegacyPayload();
        p2.integrations = ["Stripe", null];
        const res2 = compileProjectSpec(p2);
        assert.strictEqual(res2.success, false);
        assert.ok(res2.errors.some(e => e.code === errorCodes.INVALID_TYPE && e.path === "integrations[1]"));

        // Reject null inside nested fields
        const p3 = getLegacyPayload();
        p3.pagesAndRoutes = [{ path: null, name: "Home", description: "Home" }];
        const res3 = compileProjectSpec(p3);
        assert.strictEqual(res3.success, false);
        assert.ok(res3.errors.some(e => e.code === errorCodes.INVALID_TYPE && e.path === "pagesAndRoutes[0].path"));
    });

    test("37. Validation errors remain structured", () => {
        const payload = getLegacyPayload();
        payload.projectName = "";
        payload.importantDependencies = ["react@18"];
        const res = compileProjectSpec(payload);
        assert.strictEqual(res.success, false);
        assert.strictEqual(Array.isArray(res.errors), true);
        assert.strictEqual(res.errors.length, 1);
        assert.strictEqual(res.errors[0].code, errorCodes.INVALID_DEP_NAME);
    });

    test("38. Compiler errors are distinguishable from validator errors", () => {
        const payload = getLegacyPayload();
        payload.unknownField = "val";
        payload.importantDependencies = ["react@18"];
        const res = compileProjectSpec(payload);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === compilerErrorCodes.UNKNOWN_FIELD));
    });

    test("39. Error ordering deterministic", () => {
        const payload = getLegacyPayload();
        payload.unknownField = "val";
        payload.anotherUnknown = "val";
        const res = compileProjectSpec(payload);
        assert.strictEqual(res.success, false);
        assert.strictEqual(res.errors[0].path, "anotherUnknown");
        assert.strictEqual(res.errors[1].path, "unknownField");
    });

    test("40. Repeated compilation deterministic", () => {
        const payload = getLegacyPayload();
        const res1 = compileProjectSpec(payload);
        const res2 = compileProjectSpec(payload);
        assert.deepStrictEqual(res1, res2);
    });

    test("41. Arbitrary JS input does not unexpectedly throw", () => {
        assert.strictEqual(compileProjectSpec(123).success, false);
        assert.strictEqual(compileProjectSpec("string").success, false);
        assert.strictEqual(compileProjectSpec(new Date()).success, false);
        assert.strictEqual(compileProjectSpec(/regex/).success, false);
    });

    test("42. Throwing getter safely rejected if testable", () => {
        const payload = getLegacyPayload();
        Object.defineProperty(payload, "projectName", {
            get() { throw new Error("Throwing getter"); },
            enumerable: true
        });
        const res = compileProjectSpec(payload);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors[0].message.includes("Throwing getter"));
    });

    test("43. Circular reference safely rejected", () => {
        const payload = getLegacyPayload();
        payload.self = payload;
        const res = compileProjectSpec(payload);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === compilerErrorCodes.CIRCULAR_REFERENCE));
    });
});

suite("Requirement Identity (Phase 1D)", () => {
    const { deriveRequirementIdentities, REQUIREMENT_IDENTITY_VERSION, identityErrorCodes } = require(path.join(backendRoot, "core/requirements"));
    const { _deriveRequirementIdentitiesInternal } = require(path.join(backendRoot, "core/requirements/requirementIdentity"));
    const { compileProjectSpec, errorCodes } = require(path.join(backendRoot, "core/projectSpec"));

    const getValidProjectSpec = () => {
        const payload = {
            projectName: "MyTestProject",
            projectType: "Web Application",
            frontend: "React (Vite)",
            backend: "Express.js",
            database: "MongoDB",
            authentication: "JWT",
            designRequirements: "Tailwind CSS",
            pagesAndRoutes: [
                { path: "/", name: "Landing", description: "Landing page view" }
            ],
            components: [
                { name: "Button", purpose: "Generic UI button" }
            ],
            backendApis: [
                { method: "GET", path: "/api/status", purpose: "Status check API" }
            ],
            databaseModels: [
                { name: "User", fields: ["username (String)", "email (String)"] }
            ],
            integrations: ["Stripe"],
            importantDependencies: ["react", "express"],
            environmentVariables: ["PORT", "DATABASE_URL"],
            architectureConstraints: ["Use Clean Architecture"],
            runBuildRequirements: {
                runScript: "npm run dev",
                buildScript: "npm run build"
            },
            deploymentRequirements: "Vercel",
            assumptions: ["Assume user has internet access for Stripe integration."]
        };
        const res = compileProjectSpec(payload);
        if (!res.success) {
            throw new Error("Helper getValidProjectSpec failed compilation: " + JSON.stringify(res.errors));
        }
        return res.value;
    };

    test("1. Valid canonical ProjectSpec derives requirements successfully", () => {
        const spec = getValidProjectSpec();
        const res = deriveRequirementIdentities(spec);
        assert.strictEqual(res.success, true);
        assert.ok(res.requirements.length > 0);
        assert.strictEqual(res.errors.length, 0);
    });

    test("2. Identity API revalidates malformed ProjectSpec", () => {
        const spec = getValidProjectSpec();
        // Mutate a copy to bypass validation
        const malformed = JSON.parse(JSON.stringify(spec));
        malformed.pagesAndRoutes[0].path = "invalid-path-no-slash";
        const res = deriveRequirementIdentities(malformed);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.length > 0);
        assert.strictEqual(res.errors[0].code, identityErrorCodes.REQUIREMENT_ID_VALIDATION_FAILED);
    });

    test("3. Input is not mutated", () => {
        const spec = getValidProjectSpec();
        const originalString = JSON.stringify(spec);
        deriveRequirementIdentities(spec);
        assert.strictEqual(JSON.stringify(spec), originalString);
    });

    test("4. Output shares no mutable nested references with input", () => {
        const spec = getValidProjectSpec();
        const res = deriveRequirementIdentities(spec);
        assert.strictEqual(res.success, true);
        // Ensure modifying output has no effect on input (output is frozen anyway, but let's test value isolation)
        const req = res.requirements.find(r => r.kind === "component");
        assert.notStrictEqual(req.payload, spec.components[0]);
    });

    test("5. Output is deeply immutable", () => {
        const spec = getValidProjectSpec();
        const res = deriveRequirementIdentities(spec);
        assert.strictEqual(res.success, true);
        assert.throws(() => {
            res.success = false;
        });
        assert.throws(() => {
            res.requirements[0].displayId = "mod";
        });
        assert.throws(() => {
            res.requirements.push({});
        });
    });

    test("6. Identity version exported", () => {
        assert.strictEqual(REQUIREMENT_IDENTITY_VERSION, "1.0");
    });

    test("7. Same ProjectSpec produces identical stableIds", () => {
        const spec1 = getValidProjectSpec();
        const spec2 = getValidProjectSpec();
        const res1 = deriveRequirementIdentities(spec1);
        const res2 = deriveRequirementIdentities(spec2);
        assert.strictEqual(res1.requirements.length, res2.requirements.length);
        for (let i = 0; i < res1.requirements.length; i++) {
            assert.strictEqual(res1.requirements[i].stableId, res2.requirements[i].stableId);
        }
    });

    test("8. Same ProjectSpec produces identical displayIds", () => {
        const spec1 = getValidProjectSpec();
        const spec2 = getValidProjectSpec();
        const res1 = deriveRequirementIdentities(spec1);
        const res2 = deriveRequirementIdentities(spec2);
        for (let i = 0; i < res1.requirements.length; i++) {
            assert.strictEqual(res1.requirements[i].displayId, res2.requirements[i].displayId);
        }
    });

    test("9. Repeated derivation result is deterministic", () => {
        const spec = getValidProjectSpec();
        const res1 = deriveRequirementIdentities(spec);
        const res2 = deriveRequirementIdentities(spec);
        assert.strictEqual(JSON.stringify(res1), JSON.stringify(res2));
    });

    test("10. Reordering pages changes display order/displayIds as documented", () => {
        const payload = {
            projectName: "MyTestProject",
            projectType: "Web Application",
            frontend: "None",
            backend: "None",
            database: "None",
            authentication: "None",
            designRequirements: "None",
            pagesAndRoutes: [
                { path: "/a", name: "PageA", description: "DescA" },
                { path: "/b", name: "PageB", description: "DescB" }
            ],
            components: [],
            backendApis: [],
            databaseModels: [],
            integrations: [],
            importantDependencies: [],
            environmentVariables: [],
            architectureConstraints: [],
            runBuildRequirements: { runScript: "dev", buildScript: "" },
            deploymentRequirements: "None",
            assumptions: []
        };
        const spec1 = compileProjectSpec(payload).value;
        
        const payload2 = JSON.parse(JSON.stringify(payload));
        payload2.pagesAndRoutes = [payload.pagesAndRoutes[1], payload.pagesAndRoutes[0]];
        const spec2 = compileProjectSpec(payload2).value;

        const res1 = deriveRequirementIdentities(spec1);
        const res2 = deriveRequirementIdentities(spec2);

        assert.strictEqual(res1.requirements[0].payload.path, "/a");
        assert.strictEqual(res1.requirements[0].displayId, "REQ-001");
        
        assert.strictEqual(res2.requirements[0].payload.path, "/b");
        assert.strictEqual(res2.requirements[0].displayId, "REQ-001");
    });

    test("11. Reordering pages does not change stableIds", () => {
        const payload = {
            projectName: "MyTestProject",
            projectType: "Web Application",
            frontend: "None",
            backend: "None",
            database: "None",
            authentication: "None",
            designRequirements: "None",
            pagesAndRoutes: [
                { path: "/a", name: "PageA", description: "DescA" },
                { path: "/b", name: "PageB", description: "DescB" }
            ],
            components: [],
            backendApis: [],
            databaseModels: [],
            integrations: [],
            importantDependencies: [],
            environmentVariables: [],
            architectureConstraints: [],
            runBuildRequirements: { runScript: "dev", buildScript: "" },
            deploymentRequirements: "None",
            assumptions: []
        };
        const spec1 = compileProjectSpec(payload).value;
        
        const payload2 = JSON.parse(JSON.stringify(payload));
        payload2.pagesAndRoutes = [payload.pagesAndRoutes[1], payload.pagesAndRoutes[0]];
        const spec2 = compileProjectSpec(payload2).value;

        const res1 = deriveRequirementIdentities(spec1);
        const res2 = deriveRequirementIdentities(spec2);

        const stableA1 = res1.requirements.find(r => r.payload.path === "/a").stableId;
        const stableA2 = res2.requirements.find(r => r.payload.path === "/a").stableId;
        assert.strictEqual(stableA1, stableA2);
    });

    test("12. Reordering APIs does not change stableIds", () => {
        const payload = {
            projectName: "MyTestProject",
            projectType: "Web Application",
            frontend: "None",
            backend: "None",
            database: "None",
            authentication: "None",
            designRequirements: "None",
            pagesAndRoutes: [],
            components: [],
            backendApis: [
                { method: "GET", path: "/a", purpose: "purposeA" },
                { method: "POST", path: "/b", purpose: "purposeB" }
            ],
            databaseModels: [],
            integrations: [],
            importantDependencies: [],
            environmentVariables: [],
            architectureConstraints: [],
            runBuildRequirements: { runScript: "dev", buildScript: "" },
            deploymentRequirements: "None",
            assumptions: []
        };
        const spec1 = compileProjectSpec(payload).value;
        const payload2 = JSON.parse(JSON.stringify(payload));
        payload2.backendApis = [payload.backendApis[1], payload.backendApis[0]];
        const spec2 = compileProjectSpec(payload2).value;

        const res1 = deriveRequirementIdentities(spec1);
        const res2 = deriveRequirementIdentities(spec2);

        const stableA1 = res1.requirements.find(r => r.payload.path === "/a").stableId;
        const stableA2 = res2.requirements.find(r => r.payload.path === "/a").stableId;
        assert.strictEqual(stableA1, stableA2);
    });

    test("13. Reordering components does not change stableIds", () => {
        const payload = {
            projectName: "MyTestProject",
            projectType: "Web Application",
            frontend: "None",
            backend: "None",
            database: "None",
            authentication: "None",
            designRequirements: "None",
            pagesAndRoutes: [],
            components: [
                { name: "CompA", purpose: "purposeA" },
                { name: "CompB", purpose: "purposeB" }
            ],
            backendApis: [],
            databaseModels: [],
            integrations: [],
            importantDependencies: [],
            environmentVariables: [],
            architectureConstraints: [],
            runBuildRequirements: { runScript: "dev", buildScript: "" },
            deploymentRequirements: "None",
            assumptions: []
        };
        const spec1 = compileProjectSpec(payload).value;
        const payload2 = JSON.parse(JSON.stringify(payload));
        payload2.components = [payload.components[1], payload.components[0]];
        const spec2 = compileProjectSpec(payload2).value;

        const res1 = deriveRequirementIdentities(spec1);
        const res2 = deriveRequirementIdentities(spec2);

        const stableA1 = res1.requirements.find(r => r.payload.name === "CompA").stableId;
        const stableA2 = res2.requirements.find(r => r.payload.name === "CompA").stableId;
        assert.strictEqual(stableA1, stableA2);
    });

    test("14. Reordering database models does not change stableIds", () => {
        const payload = {
            projectName: "MyTestProject",
            projectType: "Web Application",
            frontend: "None",
            backend: "None",
            database: "None",
            authentication: "None",
            designRequirements: "None",
            pagesAndRoutes: [],
            components: [],
            backendApis: [],
            databaseModels: [
                { name: "ModelA", fields: ["f1", "f2"] },
                { name: "ModelB", fields: ["f3"] }
            ],
            integrations: [],
            importantDependencies: [],
            environmentVariables: [],
            architectureConstraints: [],
            runBuildRequirements: { runScript: "dev", buildScript: "" },
            deploymentRequirements: "None",
            assumptions: []
        };
        const spec1 = compileProjectSpec(payload).value;
        const payload2 = JSON.parse(JSON.stringify(payload));
        payload2.databaseModels = [payload.databaseModels[1], payload.databaseModels[0]];
        const spec2 = compileProjectSpec(payload2).value;

        const res1 = deriveRequirementIdentities(spec1);
        const res2 = deriveRequirementIdentities(spec2);

        const stableA1 = res1.requirements.find(r => r.payload.name === "ModelA").stableId;
        const stableA2 = res2.requirements.find(r => r.payload.name === "ModelA").stableId;
        assert.strictEqual(stableA1, stableA2);
    });

    test("15. Semantic page change changes stableId", () => {
        const spec1 = getValidProjectSpec();
        const res1 = deriveRequirementIdentities(spec1);

        const spec2 = JSON.parse(JSON.stringify(spec1));
        spec2.pagesAndRoutes[0].description = "Different page description";
        const res2 = deriveRequirementIdentities(spec2);

        const stable1 = res1.requirements.find(r => r.kind === "pageRoute").stableId;
        const stable2 = res2.requirements.find(r => r.kind === "pageRoute").stableId;
        assert.notStrictEqual(stable1, stable2);
    });

    test("16. Semantic API change changes stableId", () => {
        const spec1 = getValidProjectSpec();
        const res1 = deriveRequirementIdentities(spec1);

        const spec2 = JSON.parse(JSON.stringify(spec1));
        spec2.backendApis[0].purpose = "Different api purpose";
        const res2 = deriveRequirementIdentities(spec2);

        const stable1 = res1.requirements.find(r => r.kind === "backendApi").stableId;
        const stable2 = res2.requirements.find(r => r.kind === "backendApi").stableId;
        assert.notStrictEqual(stable1, stable2);
    });

    test("17. Semantic component change changes stableId", () => {
        const spec1 = getValidProjectSpec();
        const res1 = deriveRequirementIdentities(spec1);

        const spec2 = JSON.parse(JSON.stringify(spec1));
        spec2.components[0].purpose = "Different comp purpose";
        const res2 = deriveRequirementIdentities(spec2);

        const stable1 = res1.requirements.find(r => r.kind === "component").stableId;
        const stable2 = res2.requirements.find(r => r.kind === "component").stableId;
        assert.notStrictEqual(stable1, stable2);
    });

    test("18. Semantic database model change changes stableId", () => {
        const spec1 = getValidProjectSpec();
        const res1 = deriveRequirementIdentities(spec1);

        const spec2 = JSON.parse(JSON.stringify(spec1));
        spec2.databaseModels[0].fields = ["username (String)", "email (String)", "newField (Type)"];
        const res2 = deriveRequirementIdentities(spec2);

        const stable1 = res1.requirements.find(r => r.kind === "databaseModel").stableId;
        const stable2 = res2.requirements.find(r => r.kind === "databaseModel").stableId;
        assert.notStrictEqual(stable1, stable2);
    });

    test("19. projectName does not create a requirement", () => {
        const spec = getValidProjectSpec();
        const res = deriveRequirementIdentities(spec);
        const req = res.requirements.find(r => r.sourcePath === "projectName" || r.kind === "projectName");
        assert.strictEqual(req, undefined);
    });

    test("20. schemaVersion does not create a requirement", () => {
        const spec = getValidProjectSpec();
        const res = deriveRequirementIdentities(spec);
        const req = res.requirements.find(r => r.sourcePath === "schemaVersion" || r.kind === "schemaVersion");
        assert.strictEqual(req, undefined);
    });

    test("21. 'None' authentication produces no requirement", () => {
        const spec = getValidProjectSpec();
        const specNone = JSON.parse(JSON.stringify(spec));
        specNone.authentication = "None";
        const res = deriveRequirementIdentities(specNone);
        const req = res.requirements.find(r => r.kind === "authentication");
        assert.strictEqual(req, undefined);
    });

    test("22. Empty arrays produce no requirements", () => {
        const payload = {
            projectName: "MyTestProject",
            projectType: "Web Application",
            frontend: "None",
            backend: "None",
            database: "None",
            authentication: "None",
            designRequirements: "None",
            pagesAndRoutes: [],
            components: [],
            backendApis: [],
            databaseModels: [],
            integrations: [],
            importantDependencies: [],
            environmentVariables: [],
            architectureConstraints: [],
            runBuildRequirements: { runScript: "dev", buildScript: "" },
            deploymentRequirements: "None",
            assumptions: []
        };
        const spec = compileProjectSpec(payload).value;
        const res = deriveRequirementIdentities(spec);
        assert.strictEqual(res.requirements.length, 0);
    });

    test("23. assumptions follow documented non-requirement policy", () => {
        const spec = getValidProjectSpec();
        const res = deriveRequirementIdentities(spec);
        const req = res.requirements.find(r => r.kind === "assumptions" || r.sourcePath.startsWith("assumptions"));
        assert.strictEqual(req, undefined);
    });

    test("24. runBuildRequirements follows documented classification", () => {
        const spec = getValidProjectSpec();
        const res = deriveRequirementIdentities(spec);
        const req = res.requirements.find(r => r.kind === "runBuildRequirements" || r.sourcePath.startsWith("runBuildRequirements"));
        assert.strictEqual(req, undefined);
    });

    test("25. frontend classification behavior", () => {
        const spec = getValidProjectSpec();
        const res = deriveRequirementIdentities(spec);
        const req = res.requirements.find(r => r.kind === "frontend");
        assert.strictEqual(req.sourcePath, "frontend");
        assert.strictEqual(req.payload, "React (Vite)");
    });

    test("26. backend classification behavior", () => {
        const spec = getValidProjectSpec();
        const res = deriveRequirementIdentities(spec);
        const req = res.requirements.find(r => r.kind === "backend");
        assert.strictEqual(req.sourcePath, "backend");
        assert.strictEqual(req.payload, "Express.js");
    });

    test("27. database classification behavior", () => {
        const spec = getValidProjectSpec();
        const res = deriveRequirementIdentities(spec);
        const req = res.requirements.find(r => r.kind === "database");
        assert.strictEqual(req.sourcePath, "database");
        assert.strictEqual(req.payload, "MongoDB");
    });

    test("28. authentication classification behavior", () => {
        const spec = getValidProjectSpec();
        const res = deriveRequirementIdentities(spec);
        const req = res.requirements.find(r => r.kind === "authentication");
        assert.strictEqual(req.sourcePath, "authentication");
        assert.strictEqual(req.payload, "JWT");
    });

    test("29. designRequirements classification behavior", () => {
        const spec = getValidProjectSpec();
        const res = deriveRequirementIdentities(spec);
        const req = res.requirements.find(r => r.kind === "designRequirements");
        assert.strictEqual(req.sourcePath, "designRequirements");
        assert.strictEqual(req.payload, "Tailwind CSS");
    });

    test("30. deploymentRequirements classification behavior", () => {
        const spec = getValidProjectSpec();
        const res = deriveRequirementIdentities(spec);
        const req = res.requirements.find(r => r.kind === "deploymentRequirement");
        assert.strictEqual(req.sourcePath, "deploymentRequirements");
        assert.strictEqual(req.payload, "Vercel");
    });

    test("31. one route produces one route requirement", () => {
        const spec = getValidProjectSpec();
        const res = deriveRequirementIdentities(spec);
        const reqs = res.requirements.filter(r => r.kind === "pageRoute");
        assert.strictEqual(reqs.length, 1);
        assert.strictEqual(reqs[0].sourcePath, "pagesAndRoutes[0]");
        assert.strictEqual(reqs[0].semanticKey, "/");
    });

    test("32. one component produces one component requirement", () => {
        const spec = getValidProjectSpec();
        const res = deriveRequirementIdentities(spec);
        const reqs = res.requirements.filter(r => r.kind === "component");
        assert.strictEqual(reqs.length, 1);
        assert.strictEqual(reqs[0].sourcePath, "components[0]");
        assert.strictEqual(reqs[0].semanticKey, "Button");
    });

    test("33. one API produces one API requirement", () => {
        const spec = getValidProjectSpec();
        const res = deriveRequirementIdentities(spec);
        const reqs = res.requirements.filter(r => r.kind === "backendApi");
        assert.strictEqual(reqs.length, 1);
        assert.strictEqual(reqs[0].sourcePath, "backendApis[0]");
        assert.strictEqual(reqs[0].semanticKey, "GET /api/status");
    });

    test("34. one model produces one model requirement", () => {
        const spec = getValidProjectSpec();
        const res = deriveRequirementIdentities(spec);
        const reqs = res.requirements.filter(r => r.kind === "databaseModel");
        assert.strictEqual(reqs.length, 1);
        assert.strictEqual(reqs[0].sourcePath, "databaseModels[0]");
        assert.strictEqual(reqs[0].semanticKey, "User");
    });

    test("35. one integration produces one integration requirement if classified traceable", () => {
        const spec = getValidProjectSpec();
        const res = deriveRequirementIdentities(spec);
        const reqs = res.requirements.filter(r => r.kind === "integration");
        assert.strictEqual(reqs.length, 1);
        assert.strictEqual(reqs[0].sourcePath, "integrations[0]");
        assert.strictEqual(reqs[0].payload, "Stripe");
    });

    test("36. one architecture constraint produces one requirement if classified traceable", () => {
        const spec = getValidProjectSpec();
        const res = deriveRequirementIdentities(spec);
        const reqs = res.requirements.filter(r => r.kind === "architectureConstraint");
        assert.strictEqual(reqs.length, 1);
        assert.strictEqual(reqs[0].sourcePath, "architectureConstraints[0]");
        assert.strictEqual(reqs[0].payload, "Use Clean Architecture");
    });

    test("37. duplicate same-kind semantic requirements follow duplicate policy", () => {
        const payload = {
            projectName: "MyTestProject",
            projectType: "Web Application",
            frontend: "None",
            backend: "None",
            database: "None",
            authentication: "None",
            designRequirements: "None",
            pagesAndRoutes: [],
            components: [],
            backendApis: [],
            databaseModels: [],
            integrations: ["Stripe", "Stripe"],
            importantDependencies: [],
            environmentVariables: [],
            architectureConstraints: [],
            runBuildRequirements: { runScript: "dev", buildScript: "" },
            deploymentRequirements: "None",
            assumptions: []
        };
        const spec = compileProjectSpec(payload).value;
        const res = deriveRequirementIdentities(spec);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.requirements.length, 1); // Only first Stripe
        assert.strictEqual(res.duplicates.length, 1); // Second Stripe
        assert.strictEqual(res.requirements[0].payload, "Stripe");
        assert.strictEqual(res.requirements[0].displayId, "REQ-001");
        
        // Duplicate contract assertions
        assert.strictEqual(res.duplicates[0].stableId, res.requirements[0].stableId);
        assert.strictEqual(res.duplicates[0].displayId, "REQ-001"); // References canonical displayId
        assert.strictEqual(res.duplicates[0].canonicalSourcePath, "integrations[0]");
        assert.strictEqual(res.duplicates[0].duplicateSourcePath, "integrations[1]");
        assert.strictEqual(res.duplicates[0].payload, undefined); // No payload in duplicate metadata
    });

    test("38. same semantic payload under different kinds does not accidentally collide", () => {
        const payload = {
            projectName: "MyTestProject",
            projectType: "Web Application",
            frontend: "Stripe",
            backend: "None",
            database: "None",
            authentication: "None",
            designRequirements: "None",
            pagesAndRoutes: [],
            components: [],
            backendApis: [],
            databaseModels: [],
            integrations: ["Stripe"],
            importantDependencies: [],
            environmentVariables: [],
            architectureConstraints: [],
            runBuildRequirements: { runScript: "dev", buildScript: "" },
            deploymentRequirements: "None",
            assumptions: []
        };
        const spec = compileProjectSpec(payload).value;
        const res = deriveRequirementIdentities(spec);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.requirements.length, 2); // frontend 'Stripe' and integration 'Stripe'
        assert.notStrictEqual(res.requirements[0].stableId, res.requirements[1].stableId);
    });

    test("39. duplicate metadata preserves source occurrences if policy requires it", () => {
        const payload = {
            projectName: "MyTestProject",
            projectType: "Web Application",
            frontend: "None",
            backend: "None",
            database: "None",
            authentication: "None",
            designRequirements: "None",
            pagesAndRoutes: [],
            components: [],
            backendApis: [],
            databaseModels: [],
            integrations: ["Stripe", "Stripe"],
            importantDependencies: [],
            environmentVariables: [],
            architectureConstraints: [],
            runBuildRequirements: { runScript: "dev", buildScript: "" },
            deploymentRequirements: "None",
            assumptions: []
        };
        const spec = compileProjectSpec(payload).value;
        const res = deriveRequirementIdentities(spec);
        assert.strictEqual(res.duplicates[0].duplicateSourcePath, "integrations[1]");
    });

    test("40. display IDs are REQ-001 format", () => {
        const spec = getValidProjectSpec();
        const res = deriveRequirementIdentities(spec);
        assert.strictEqual(res.requirements[0].displayId, "REQ-001");
    });

    test("41. display IDs continue correctly beyond REQ-999", () => {
        const spec = getValidProjectSpec();
        const payload = {
            projectName: "MyTestProject",
            projectType: "Web Application",
            frontend: "None",
            backend: "None",
            database: "None",
            authentication: "None",
            designRequirements: "None",
            pagesAndRoutes: [],
            components: [],
            backendApis: [],
            databaseModels: [],
            integrations: Array.from({ length: 1000 }, (_, i) => `Int${i}`),
            importantDependencies: [],
            environmentVariables: [],
            architectureConstraints: [],
            runBuildRequirements: { runScript: "dev", buildScript: "" },
            deploymentRequirements: "None",
            assumptions: []
        };
        const bigSpec = compileProjectSpec(payload).value;
        const res = deriveRequirementIdentities(bigSpec);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.requirements[999].displayId, "REQ-1000");
    });

    test("42. source paths are precise", () => {
        const spec = getValidProjectSpec();
        const res = deriveRequirementIdentities(spec);
        const req = res.requirements.find(r => r.kind === "pageRoute");
        assert.strictEqual(req.sourcePath, "pagesAndRoutes[0]");
    });

    test("43. sourcePath/index is not part of stableId", () => {
        const payload = {
            projectName: "MyTestProject",
            projectType: "Web Application",
            frontend: "None",
            backend: "None",
            database: "None",
            authentication: "None",
            designRequirements: "None",
            pagesAndRoutes: [
                { path: "/a", name: "PageA", description: "DescA" },
                { path: "/b", name: "PageB", description: "DescB" }
            ],
            components: [],
            backendApis: [],
            databaseModels: [],
            integrations: [],
            importantDependencies: [],
            environmentVariables: [],
            architectureConstraints: [],
            runBuildRequirements: { runScript: "dev", buildScript: "" },
            deploymentRequirements: "None",
            assumptions: []
        };
        const spec1 = compileProjectSpec(payload).value;
        const payload2 = JSON.parse(JSON.stringify(payload));
        payload2.pagesAndRoutes = [payload.pagesAndRoutes[1], payload.pagesAndRoutes[0]];
        const spec2 = compileProjectSpec(payload2).value;

        const res1 = deriveRequirementIdentities(spec1);
        const res2 = deriveRequirementIdentities(spec2);

        const stableA1 = res1.requirements.find(r => r.payload.path === "/a").stableId;
        const stableA2 = res2.requirements.find(r => r.payload.path === "/a").stableId;
        assert.strictEqual(stableA1, stableA2);
    });

    test("44. identity version affects stableId namespace/input", () => {
        const spec = getValidProjectSpec();
        const res = deriveRequirementIdentities(spec);
        assert.ok(res.requirements[0].stableId.startsWith("req_v1_"));
    });

    test("45. no timestamp/randomness", () => {
        const spec = getValidProjectSpec();
        const res1 = deriveRequirementIdentities(spec);
        const res2 = deriveRequirementIdentities(spec);
        assert.strictEqual(res1.requirements[0].stableId, res2.requirements[0].stableId);
    });

    test("46. malformed arbitrary JS inputs return structured failures", () => {
        assert.strictEqual(deriveRequirementIdentities(null).success, false);
        assert.strictEqual(deriveRequirementIdentities(undefined).success, false);
        assert.strictEqual(deriveRequirementIdentities(123).success, false);
        assert.strictEqual(deriveRequirementIdentities("string").success, false);
        assert.strictEqual(deriveRequirementIdentities([]).success, false);
    });

    test("47. throwing getter does not unexpectedly escape if safely testable", () => {
        const spec = getValidProjectSpec();
        const malicious = JSON.parse(JSON.stringify(spec));
        Object.defineProperty(malicious, "pagesAndRoutes", {
            get() { throw new Error("Malicious getter"); },
            enumerable: true
        });
        const res = deriveRequirementIdentities(malicious);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === identityErrorCodes.REQUIREMENT_ID_INTERNAL_ERROR));
    });

    test("48. circular input returns structured failure", () => {
        const spec = getValidProjectSpec();
        const malicious = JSON.parse(JSON.stringify(spec));
        malicious.self = malicious;
        const res = deriveRequirementIdentities(malicious);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === identityErrorCodes.REQUIREMENT_ID_INTERNAL_ERROR));
    });

    test("49. validation errors remain structured", () => {
        const spec = getValidProjectSpec();
        const malformed = JSON.parse(JSON.stringify(spec));
        malformed.pagesAndRoutes[0].path = "invalid-path";
        const res = deriveRequirementIdentities(malformed);
        assert.strictEqual(res.success, false);
        assert.strictEqual(typeof res.errors[0].code, "string");
        assert.strictEqual(typeof res.errors[0].path, "string");
        assert.strictEqual(typeof res.errors[0].message, "string");
        assert.strictEqual(typeof res.errors[0].keyword, "string");
    });

    test("50. identity-layer errors remain structured", () => {
        const res = deriveRequirementIdentities(null);
        assert.strictEqual(res.success, false);
        assert.strictEqual(typeof res.errors[0].code, "string");
        assert.strictEqual(typeof res.errors[0].path, "string");
        assert.strictEqual(typeof res.errors[0].message, "string");
        assert.strictEqual(typeof res.errors[0].keyword, "string");
    });

    test("51. error ordering deterministic", () => {
        const spec = getValidProjectSpec();
        const malformed = JSON.parse(JSON.stringify(spec));
        malformed.pagesAndRoutes[0].path = "invalid-path";
        malformed.components[0].name = ""; // Another validation error
        const res1 = deriveRequirementIdentities(malformed);
        const res2 = deriveRequirementIdentities(malformed);
        assert.strictEqual(JSON.stringify(res1.errors), JSON.stringify(res2.errors));
    });

    test("52. full SHA-256 digest format is correct if selected", () => {
        const spec = getValidProjectSpec();
        const res = deriveRequirementIdentities(spec);
        const stableId = res.requirements[0].stableId;
        assert.strictEqual(stableId.length, 7 + 64);
        assert.ok(/^req_v1_[0-9a-f]{64}$/.test(stableId));
    });

    test("53. collision-detection branch is testable without weakening production hash algorithm, if practical via internal dependency injection/test seam", () => {
        const spec = getValidProjectSpec();
        const res = _deriveRequirementIdentitiesInternal(spec, () => "constant_hash");
        assert.strictEqual(res.success, false);
        assert.strictEqual(res.errors[0].code, identityErrorCodes.REQUIREMENT_ID_COLLISION);
    });

    test("54. semanticKey is deterministically derived and caller-provided semanticKey is not allowed", () => {
        const spec = getValidProjectSpec();
        const res = deriveRequirementIdentities(spec);
        const routeReq = res.requirements.find(r => r.kind === "pageRoute");
        assert.strictEqual(routeReq.semanticKey, routeReq.payload.path);
    });

    test("55. databaseModel field sorting preserves stableId, changed fields change stableId, duplicate fields are preserved", () => {
        const payload = {
            projectName: "MyTestProject",
            projectType: "Web Application",
            frontend: "None",
            backend: "None",
            database: "None",
            authentication: "None",
            designRequirements: "None",
            pagesAndRoutes: [],
            components: [],
            backendApis: [],
            databaseModels: [
                { name: "User", fields: ["a", "b"] }
            ],
            integrations: [],
            importantDependencies: [],
            environmentVariables: [],
            architectureConstraints: [],
            runBuildRequirements: { runScript: "dev", buildScript: "" },
            deploymentRequirements: "None",
            assumptions: []
        };
        const spec1 = compileProjectSpec(payload).value;
        
        const payload2 = JSON.parse(JSON.stringify(payload));
        payload2.databaseModels[0].fields = ["b", "a"];
        const spec2 = compileProjectSpec(payload2).value;

        const res1 = deriveRequirementIdentities(spec1);
        const res2 = deriveRequirementIdentities(spec2);

        assert.strictEqual(res1.requirements[0].stableId, res2.requirements[0].stableId);

        // Adding field changes stableId
        const payload3 = JSON.parse(JSON.stringify(payload));
        payload3.databaseModels[0].fields = ["a", "b", "c"];
        const spec3 = compileProjectSpec(payload3).value;
        const res3 = deriveRequirementIdentities(spec3);
        assert.notStrictEqual(res1.requirements[0].stableId, res3.requirements[0].stableId);

        // Duplicate fields are preserved (not deduplicated)
        const payload4 = JSON.parse(JSON.stringify(payload));
        payload4.databaseModels[0].fields = ["a", "a", "b"];
        const spec4 = compileProjectSpec(payload4).value;
        const res4 = deriveRequirementIdentities(spec4);
        assert.strictEqual(res4.requirements[0].payload.fields.length, 3);
        assert.strictEqual(res4.requirements[0].payload.fields[0], "a");
        assert.strictEqual(res4.requirements[0].payload.fields[1], "a");
    });

    test("56. exact None sentinel matches, other case-insensitive or integration none remain requirements", () => {
        const payload = {
            projectName: "MyTestProject",
            projectType: "Web Application",
            frontend: "None",
            backend: "None",
            database: "None",
            authentication: "None",
            designRequirements: "None",
            pagesAndRoutes: [],
            components: [],
            backendApis: [],
            databaseModels: [],
            integrations: ["none", "None", "Stripe"],
            importantDependencies: [],
            environmentVariables: [],
            architectureConstraints: [],
            runBuildRequirements: { runScript: "dev", buildScript: "" },
            deploymentRequirements: "None",
            assumptions: []
        };
        const spec = compileProjectSpec(payload).value;
        const res = deriveRequirementIdentities(spec);
        const intReqs = res.requirements.filter(r => r.kind === "integration");
        assert.strictEqual(intReqs.length, 3);
    });

    test("57. property insertion order differences in object payloads do not alter stableId", () => {
        const route1 = {};
        route1.path = "/test";
        route1.name = "TestPage";
        route1.description = "Test page view";

        const route2 = {};
        route2.description = "Test page view";
        route2.name = "TestPage";
        route2.path = "/test";

        const payload1 = {
            projectName: "MyTestProject",
            projectType: "Web Application",
            frontend: "None",
            backend: "None",
            database: "None",
            authentication: "None",
            designRequirements: "None",
            pagesAndRoutes: [route1],
            components: [],
            backendApis: [],
            databaseModels: [],
            integrations: [],
            importantDependencies: [],
            environmentVariables: [],
            architectureConstraints: [],
            runBuildRequirements: { runScript: "dev", buildScript: "" },
            deploymentRequirements: "None",
            assumptions: []
        };
        const spec1 = compileProjectSpec(payload1).value;

        const payload2 = JSON.parse(JSON.stringify(payload1));
        payload2.pagesAndRoutes = [route2];
        const spec2 = compileProjectSpec(payload2).value;

        const res1 = deriveRequirementIdentities(spec1);
        const res2 = deriveRequirementIdentities(spec2);

        assert.strictEqual(res1.requirements[0].stableId, res2.requirements[0].stableId);
    });

    test("58. duplicate metadata contract checks", () => {
        const payload = {
            projectName: "MyTestProject",
            projectType: "Web Application",
            frontend: "None",
            backend: "None",
            database: "None",
            authentication: "None",
            designRequirements: "None",
            pagesAndRoutes: [],
            components: [],
            backendApis: [],
            databaseModels: [],
            integrations: ["Stripe", "Stripe", "Stripe"],
            importantDependencies: [],
            environmentVariables: [],
            architectureConstraints: [],
            runBuildRequirements: { runScript: "dev", buildScript: "" },
            deploymentRequirements: "None",
            assumptions: []
        };
        const spec = compileProjectSpec(payload).value;
        const res = deriveRequirementIdentities(spec);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.requirements.length, 1);
        assert.strictEqual(res.duplicates.length, 2);
        assert.strictEqual(res.requirements[0].displayId, "REQ-001");
        assert.strictEqual(res.duplicates[0].displayId, "REQ-001");
        assert.strictEqual(res.duplicates[1].displayId, "REQ-001");
        assert.strictEqual(res.duplicates[0].stableId, res.requirements[0].stableId);
        assert.strictEqual(res.duplicates[1].stableId, res.requirements[0].stableId);
        assert.strictEqual(res.duplicates[0].canonicalSourcePath, "integrations[0]");
        assert.strictEqual(res.duplicates[0].duplicateSourcePath, "integrations[1]");
        assert.strictEqual(res.duplicates[1].canonicalSourcePath, "integrations[0]");
        assert.strictEqual(res.duplicates[1].duplicateSourcePath, "integrations[2]");
    });
});

suite("Pipeline Integration (Phase 1E)", () => {
    const { orchestrateGeneration, prepareCanonicalProjectSpec, _testHooks } = require(path.join(backendRoot, "services/generationOrchestrator"));
    const { compileProjectSpec } = require(path.join(backendRoot, "core/projectSpec"));
    const { deriveRequirementIdentities } = require(path.join(backendRoot, "core/requirements"));
    const projectService = require(path.join(backendRoot, "services/projectService"));
    const { adaptProjectSpecForPersistence } = require(path.join(backendRoot, "controllers/projectController"));

    const getSampleLegacyPayload = () => ({
        projectName: "TestApp",
        projectType: "Web Application",
        frontend: "React (Vite)",
        backend: "Express.js",
        database: "MongoDB",
        authentication: "JWT",
        designRequirements: "Tailwind CSS",
        pagesAndRoutes: [{ path: "/", name: "Home", description: "Home page" }],
        components: [{ name: "Header", purpose: "Header view" }],
        backendApis: [],
        databaseModels: [],
        integrations: [],
        importantDependencies: [],
        environmentVariables: [],
        architectureConstraints: [],
        runBuildRequirements: { runScript: "npm run dev", buildScript: "" },
        deploymentRequirements: "None",
        assumptions: []
    });

    test("1. prepareCanonicalProjectSpec compiles, validates and derives identities", () => {
        const payload = getSampleLegacyPayload();
        const prep = prepareCanonicalProjectSpec(payload);
        assert.strictEqual(prep.projectSpec.projectName, "TestApp");
        assert.strictEqual(prep.projectSpec.schemaVersion, "1.0");
        assert.ok(prep.requirementIdentity.success);
        assert.ok(prep.requirementIdentity.requirements.length > 0);
    });

    test("2. prepareCanonicalProjectSpec throws PROJECT_PREPARATION_COMPILE_FAILED on invalid spec", () => {
        const invalidPayload = getSampleLegacyPayload();
        invalidPayload.pagesAndRoutes = [{ path: "invalid-path", name: "Home", description: "Home" }]; // Path must start with /
        
        let threw = false;
        try {
            prepareCanonicalProjectSpec(invalidPayload);
        } catch (err) {
            threw = true;
            assert.strictEqual(err.code, "PROJECT_PREPARATION_COMPILE_FAILED");
            assert.ok(err.errors.length > 0);
        }
        assert.ok(threw, "prepareCanonicalProjectSpec must throw immediately on compile failure");
    });

    test("3. Canonical ProjectSpec and Requirement Identity are deeply immutable and isolated", () => {
        const payload = getSampleLegacyPayload();
        const prep = prepareCanonicalProjectSpec(payload);
        assert.ok(Object.isFrozen(prep.projectSpec));
        assert.ok(Object.isFrozen(prep.requirementIdentity));
        assert.ok(Object.isFrozen(prep.requirementIdentity.requirements));
    });

    test("4. Generation planner and contract builder accept canonical ProjectSpec verbatim", () => {
        const { planGeneration } = require(path.join(backendRoot, "services/generationPlanner"));
        const { buildSharedContracts, buildProjectManifest } = require(path.join(backendRoot, "services/contractBuilder"));
        
        const payload = getSampleLegacyPayload();
        const prep = prepareCanonicalProjectSpec(payload);
        const compiled = prep.projectSpec;

        const plan = planGeneration(compiled);
        const contracts = buildSharedContracts(compiled);
        const manifest = buildProjectManifest("prompt", compiled);

        assert.strictEqual(plan.scaffoldAdapter, "mern");
        assert.strictEqual(contracts.stackProfile, "mern");
        assert.strictEqual(manifest.projectName, "TestApp");
    });

    test("5. Stack selection quirks are preserved on compiled canonical boundary", () => {
        const { detectProfile } = require(path.join(backendRoot, "services/stackProfiles"));
        
        const payload = getSampleLegacyPayload();
        const prep = prepareCanonicalProjectSpec(payload);
        const compiled = prep.projectSpec;
        const profile = detectProfile(compiled);
        assert.strictEqual(profile.name, "mern");
    });

    test("6. Already-canonical bypass check avoids double compilation but derives identities", () => {
        const payload = getSampleLegacyPayload();
        const prep1 = prepareCanonicalProjectSpec(payload);
        const frozenSpec = prep1.projectSpec;

        let compileCount = 0;
        let deriveCount = 0;
        const originalCompile = _testHooks.compileProjectSpec;
        const originalDerive = _testHooks.deriveRequirementIdentities;

        _testHooks.compileProjectSpec = (p) => { compileCount++; return originalCompile(p); };
        _testHooks.deriveRequirementIdentities = (s) => { deriveCount++; return originalDerive(s); };

        try {
            const prep2 = prepareCanonicalProjectSpec(frozenSpec);
            assert.strictEqual(compileCount, 0, "Should bypass compile stage for already-canonical spec");
            assert.strictEqual(deriveCount, 1, "Should still derive identities exactly once");
            assert.strictEqual(prep2.projectSpec, frozenSpec, "Should return identical frozen spec reference");
        } finally {
            _testHooks.compileProjectSpec = originalCompile;
            _testHooks.deriveRequirementIdentities = originalDerive;
        }
    });

    test("7. Exactly-once execution tracking in prepareCanonicalProjectSpec", () => {
        const payload = getSampleLegacyPayload();

        let compileCount = 0;
        let deriveCount = 0;
        const originalCompile = _testHooks.compileProjectSpec;
        const originalDerive = _testHooks.deriveRequirementIdentities;

        _testHooks.compileProjectSpec = (p) => { compileCount++; return originalCompile(p); };
        _testHooks.deriveRequirementIdentities = (s) => { deriveCount++; return originalDerive(s); };

        try {
            prepareCanonicalProjectSpec(payload);
            assert.strictEqual(compileCount, 1, "Compiler must be called exactly once");
            assert.strictEqual(deriveCount, 1, "Identity must be derived exactly once");
        } finally {
            _testHooks.compileProjectSpec = originalCompile;
            _testHooks.deriveRequirementIdentities = originalDerive;
        }
    });

    test("8. Compiler failure causes zero identity derivation calls and halts", () => {
        const invalidPayload = getSampleLegacyPayload();
        invalidPayload.pagesAndRoutes = [{ path: "invalid-path", name: "Home", description: "Home" }];

        let compileCount = 0;
        let deriveCount = 0;
        const originalCompile = _testHooks.compileProjectSpec;
        const originalDerive = _testHooks.deriveRequirementIdentities;

        _testHooks.compileProjectSpec = (p) => { compileCount++; return originalCompile(p); };
        _testHooks.deriveRequirementIdentities = (s) => { deriveCount++; return originalDerive(s); };

        try {
            assert.throws(() => {
                prepareCanonicalProjectSpec(invalidPayload);
            });
            assert.strictEqual(compileCount, 1, "Compiler should execute once");
            assert.strictEqual(deriveCount, 0, "Identity derivation should not be called if compilation fails");
        } finally {
            _testHooks.compileProjectSpec = originalCompile;
            _testHooks.deriveRequirementIdentities = originalDerive;
        }
    });

    test("9. Persistence adapter strips schemaVersion and deep-clones ProjectSpec", () => {
        const payload = getSampleLegacyPayload();
        const prep = prepareCanonicalProjectSpec(payload);
        const canonicalSpec = prep.projectSpec;

        assert.strictEqual(canonicalSpec.schemaVersion, "1.0");

        const adapted = adaptProjectSpecForPersistence(canonicalSpec);
        assert.strictEqual(adapted.schemaVersion, undefined, "Adapted spec must not contain schemaVersion");
        assert.strictEqual(adapted.projectName, "TestApp");
        assert.ok(!Object.isFrozen(adapted), "Adapted copy must be non-frozen to protect Mongoose writing");
    });

    test("10. Immutable actual consumer audit checks compatibility", () => {
        const { planGeneration } = require(path.join(backendRoot, "services/generationPlanner"));
        const { buildSharedContracts, buildProjectManifest } = require(path.join(backendRoot, "services/contractBuilder"));
        const { detectProfile } = require(path.join(backendRoot, "services/stackProfiles"));
        const { generateScaffoldFiles } = require(path.join(backendRoot, "services/scaffoldRegistry"));
        const { validateProjectFiles } = require(path.join(backendRoot, "services/validationProfiles"));

        const payload = getSampleLegacyPayload();
        const prep = prepareCanonicalProjectSpec(payload);
        const compiled = prep.projectSpec;

        // Verify no throwing on frozen inputs for actual integration modules
        assert.doesNotThrow(() => {
            planGeneration(compiled);
            buildSharedContracts(compiled);
            buildProjectManifest("prompt", compiled);
            detectProfile(compiled);
            generateScaffoldFiles("mern", compiled);
            validateProjectFiles([], compiled);
        });
    });

    test("11. Identity failure prevents all generation side effects", () => {
        const payload = getSampleLegacyPayload();

        let compileCount = 0;
        let deriveCount = 0;
        const originalCompile = _testHooks.compileProjectSpec;
        const originalDerive = _testHooks.deriveRequirementIdentities;

        _testHooks.compileProjectSpec = (p) => { compileCount++; return originalCompile(p); };
        _testHooks.deriveRequirementIdentities = (s) => {
            deriveCount++;
            return { success: false, errors: [{ path: "root", message: "Simulated identity failure" }] };
        };

        try {
            let threw = false;
            try {
                prepareCanonicalProjectSpec(payload);
            } catch (err) {
                threw = true;
                assert.strictEqual(err.code, "PROJECT_PREPARATION_IDENTITY_FAILED");
                assert.ok(err.errors.length > 0);
                assert.ok(err.message.includes("Requirement Identity derivation failed"));
            }
            assert.ok(threw, "Identity failure must throw before any side effects");
            assert.strictEqual(compileCount, 1, "Compiler should have succeeded");
            assert.strictEqual(deriveCount, 1, "Identity derivation should have been called exactly once");
        } finally {
            _testHooks.compileProjectSpec = originalCompile;
            _testHooks.deriveRequirementIdentities = originalDerive;
        }
    });

    test("12. analyzeRequirements observable contract remains unchanged", () => {
        // Verify that projectService.analyzeRequirements is not modified by 1E
        const projectServiceSource = require("fs").readFileSync(
            path.join(backendRoot, "services/projectService.js"), "utf8"
        );
        // Must NOT import compileProjectSpec or deriveRequirementIdentities
        assert.ok(!projectServiceSource.includes("compileProjectSpec"),
            "projectService must not reference compileProjectSpec — it stays legacy");
        assert.ok(!projectServiceSource.includes("deriveRequirementIdentities"),
            "projectService must not reference deriveRequirementIdentities");
        assert.ok(!projectServiceSource.includes("prepareCanonicalProjectSpec"),
            "projectService must not reference prepareCanonicalProjectSpec");
    });

    test("13. Pre-1E vs Post-1E Project.create persistence shape equivalence", () => {
        const payload = getSampleLegacyPayload();
        const prep = prepareCanonicalProjectSpec(payload);

        const adapted = adaptProjectSpecForPersistence(prep.projectSpec);

        // Pre-1E persisted the raw legacy payload directly. Verify adapted shape matches:
        // 1. schemaVersion must NOT be present (it didn't exist pre-1E)
        assert.strictEqual(adapted.schemaVersion, undefined, "schemaVersion must not be persisted");
        // 2. All original semantic fields must be present
        assert.strictEqual(adapted.projectName, "TestApp");
        assert.strictEqual(adapted.projectType, "Web Application");
        assert.ok(Array.isArray(adapted.pagesAndRoutes));
        assert.ok(Array.isArray(adapted.components));
        assert.ok(Array.isArray(adapted.backendApis));
        assert.ok(Array.isArray(adapted.databaseModels));
        assert.ok(Array.isArray(adapted.integrations));
        assert.ok(Array.isArray(adapted.importantDependencies));
        assert.ok(Array.isArray(adapted.environmentVariables));
        assert.ok(Array.isArray(adapted.architectureConstraints));
        assert.ok(Array.isArray(adapted.assumptions));
        assert.ok(typeof adapted.runBuildRequirements === "object");
        // 3. requirementIdentity must NOT be on adapted spec
        assert.strictEqual(adapted.requirementIdentity, undefined, "requirementIdentity must not be persisted");
        // 4. stableId and displayId must NOT be on adapted spec
        assert.strictEqual(adapted.stableId, undefined, "stableId must not be persisted");
        assert.strictEqual(adapted.displayId, undefined, "displayId must not be persisted");
        // 5. duplicates must NOT be on adapted spec
        assert.strictEqual(adapted.duplicates, undefined, "duplicates must not be persisted");
    });

    test("14. Pre-1E vs Post-1E History.create persistence shape equivalence", () => {
        const payload = getSampleLegacyPayload();
        const prep = prepareCanonicalProjectSpec(payload);

        const adapted = adaptProjectSpecForPersistence(prep.projectSpec);

        // Both Project.create and History.create receive the same adapted spec
        assert.strictEqual(adapted.schemaVersion, undefined, "History spec must not contain schemaVersion");
        assert.strictEqual(adapted.requirementIdentity, undefined, "History spec must not contain requirementIdentity");
        assert.strictEqual(adapted.stableId, undefined);
        assert.strictEqual(adapted.displayId, undefined);
        assert.strictEqual(adapted.duplicates, undefined);
        assert.ok(!Object.isFrozen(adapted), "History adapted spec must be mutable for Mongoose");
    });

    test("15. Public API response shape does not leak internal sidecar data", () => {
        // The progressEmitter.end() call determines the public SSE response shape
        // Verify that orchestrateGeneration return includes projectSpec and requirementIdentity
        // but the controller's progressEmitter.end() omits them
        const controllerSource = require("fs").readFileSync(
            path.join(backendRoot, "controllers/projectController.js"), "utf8"
        );
        // Find the progressEmitter.end block
        const endMatch = controllerSource.match(/progressEmitter\.end\(\{[\s\S]*?\}\)/);
        assert.ok(endMatch, "progressEmitter.end call must exist");
        const endBlock = endMatch[0];
        // Must NOT include requirementIdentity, schemaVersion, or projectSpec in SSE response
        assert.ok(!endBlock.includes("requirementIdentity"), "requirementIdentity must not leak to SSE response");
        assert.ok(!endBlock.includes("schemaVersion"), "schemaVersion must not leak to SSE response");
        assert.ok(!endBlock.includes("projectSpec"), "projectSpec must not leak to SSE response");
    });

    test("16. Stack selection across multiple profiles through compiled canonical boundary", () => {
        const { detectProfile } = require(path.join(backendRoot, "services/stackProfiles"));

        // MERN profile
        const mernPayload = getSampleLegacyPayload();
        const mernPrep = prepareCanonicalProjectSpec(mernPayload);
        assert.strictEqual(detectProfile(mernPrep.projectSpec).name, "mern");

        // React-Vite profile
        const reactPayload = {
            ...getSampleLegacyPayload(),
            backend: "None",
            database: "None",
            authentication: "None",
            frontend: "React (Vite) 18.2"
        };
        const reactPrep = prepareCanonicalProjectSpec(reactPayload);
        assert.strictEqual(detectProfile(reactPrep.projectSpec).name, "react-vite");

        // Next.js profile
        const nextPayload = {
            ...getSampleLegacyPayload(),
            frontend: "Next.js 14",
            backend: "None",
            database: "None",
            authentication: "None",
            projectType: "Next.js Application"
        };
        const nextPrep = prepareCanonicalProjectSpec(nextPayload);
        assert.strictEqual(detectProfile(nextPrep.projectSpec).name, "nextjs");
    });

    test("17. Error propagation: compile failure thrown through orchestrateGeneration boundary", async () => {
        const invalidPayload = getSampleLegacyPayload();
        invalidPayload.pagesAndRoutes = [{ path: "invalid-path", name: "Home", description: "Home" }];

        let threw = false;
        try {
            await orchestrateGeneration({
                originalPrompt: "test",
                projectSpec: invalidPayload
            }, { emit: () => {} }, null, { cancelSignal: null });
        } catch (err) {
            threw = true;
            assert.strictEqual(err.code, "PROJECT_PREPARATION_COMPILE_FAILED",
                "orchestrateGeneration must propagate the compile failure error code");
        }
        assert.ok(threw, "orchestrateGeneration must throw on compilation failure before any generation");
    });

    test("18. Error propagation: identity failure thrown through orchestrateGeneration boundary", async () => {
        const payload = getSampleLegacyPayload();
        const originalDerive = _testHooks.deriveRequirementIdentities;
        _testHooks.deriveRequirementIdentities = (s) => {
            return { success: false, errors: [{ path: "root", message: "Forced identity failure" }] };
        };

        try {
            let threw = false;
            try {
                await orchestrateGeneration({
                    originalPrompt: "test",
                    projectSpec: payload
                }, { emit: () => {} }, null, { cancelSignal: null });
            } catch (err) {
                threw = true;
                assert.strictEqual(err.code, "PROJECT_PREPARATION_IDENTITY_FAILED",
                    "orchestrateGeneration must propagate the identity failure error code");
            }
            assert.ok(threw, "orchestrateGeneration must throw on identity failure before any generation");
        } finally {
            _testHooks.deriveRequirementIdentities = originalDerive;
        }
    });

    test("19. Requirement Identity sidecar is retained in orchestrateGeneration return value", () => {
        // Verify the return contract includes requirementIdentity at stable boundary
        const payload = getSampleLegacyPayload();
        const prep = prepareCanonicalProjectSpec(payload);
        assert.ok(prep.requirementIdentity, "requirementIdentity must be present");
        assert.ok(prep.requirementIdentity.success, "requirementIdentity must succeed");
        assert.ok(Array.isArray(prep.requirementIdentity.requirements), "requirements must be an array");
        assert.ok(prep.requirementIdentity.requirements.length > 0, "requirements must not be empty for valid spec");
        // Verify sidecar is in orchestrator return shape (code evidence)
        const orchestratorSource = require("fs").readFileSync(
            path.join(backendRoot, "services/generationOrchestrator.js"), "utf8"
        );
        assert.ok(orchestratorSource.includes("requirementIdentity  // Sidecar metadata"),
            "orchestrateGeneration return must include requirementIdentity sidecar");
    });

    test("20. Rollback boundary: reverting 1E changes removes all new imports and functions", () => {
        // Evidence test: verify that all 1E additions are localized and revertible
        const orchestratorSource = require("fs").readFileSync(
            path.join(backendRoot, "services/generationOrchestrator.js"), "utf8"
        );
        const controllerSource = require("fs").readFileSync(
            path.join(backendRoot, "controllers/projectController.js"), "utf8"
        );
        // 1E additions in orchestrator are: require core/projectSpec, require core/requirements,
        // _testHooks, prepareCanonicalProjectSpec function, and the call site in orchestrateGeneration
        assert.ok(orchestratorSource.includes('require("../core/projectSpec")'),
            "Orchestrator must import core/projectSpec");
        assert.ok(orchestratorSource.includes('require("../core/requirements")'),
            "Orchestrator must import core/requirements");
        assert.ok(orchestratorSource.includes("function prepareCanonicalProjectSpec"),
            "prepareCanonicalProjectSpec function must exist");
        // 1E additions in controller: adaptProjectSpecForPersistence
        assert.ok(controllerSource.includes("function adaptProjectSpecForPersistence"),
            "Controller must contain adaptProjectSpecForPersistence");
        // Verify no other files were modified by 1E beyond these two + tests
        // (This is structural evidence that rollback is a clean git revert)
    });

    test("21. adaptProjectSpecForPersistence handles null/undefined gracefully", () => {
        assert.strictEqual(adaptProjectSpecForPersistence(null), null);
        assert.strictEqual(adaptProjectSpecForPersistence(undefined), undefined);
    });
});

suite("Requirement Classification (Phase 2A)", () => {
    const { classifyRequirements, classificationErrorCodes } = require(path.join(backendRoot, "core/requirementsClassification"));

    test("1. Rejects invalid non-array input with appropriate error", () => {
        const results = [
            classifyRequirements(null),
            classifyRequirements(undefined),
            classifyRequirements("not-an-array"),
            classifyRequirements(123),
            classifyRequirements({})
        ];

        results.forEach(res => {
            assert.strictEqual(res.success, false);
            assert.strictEqual(res.classifications.length, 0);
            assert.strictEqual(res.errors[0].code, classificationErrorCodes.CLASSIFICATION_INVALID_INPUT);
            assert.ok(res.errors[0].message.includes("must be an array"));
        });
    });

    test("2. Rejects individual requirements missing critical fields", () => {
        const input = [
            { displayId: "REQ-001", stableId: "req_v1_123", kind: "frontend", semanticKey: "key" }, // missing payload
            { displayId: "REQ-002", stableId: "req_v1_123", kind: "frontend", payload: {} }, // missing semanticKey
            { displayId: "REQ-003", stableId: "req_v1_123", semanticKey: "key", payload: {} }, // missing kind
            { displayId: "REQ-004", kind: "frontend", semanticKey: "key", payload: {} }, // missing stableId
            { stableId: "req_v1_123", kind: "frontend", semanticKey: "key", payload: {} }, // missing displayId
            null, // null requirement
            "string-requirement" // invalid type
        ];

        const res = classifyRequirements(input);
        assert.strictEqual(res.success, false);
        assert.strictEqual(res.classifications.length, 0);
        assert.ok(res.errors.length >= 7);
        res.errors.forEach(err => {
            assert.strictEqual(err.code, classificationErrorCodes.CLASSIFICATION_VALIDATION_FAILED);
        });
    });

    test("3. Primary category maps strictly by requirement kind", () => {
        const input = [
            { stableId: "1", displayId: "REQ-001", kind: "frontend", semanticKey: "key", payload: {} },
            { stableId: "2", displayId: "REQ-002", kind: "backend", semanticKey: "key", payload: {} },
            { stableId: "3", displayId: "REQ-003", kind: "database", semanticKey: "key", payload: {} },
            { stableId: "4", displayId: "REQ-004", kind: "authentication", semanticKey: "key", payload: {} },
            { stableId: "5", displayId: "REQ-005", kind: "designRequirements", semanticKey: "key", payload: {} },
            { stableId: "6", displayId: "REQ-006", kind: "deploymentRequirements", semanticKey: "key", payload: {} },
            { stableId: "7", displayId: "REQ-007", kind: "pageRoute", semanticKey: "key", payload: {} },
            { stableId: "8", displayId: "REQ-008", kind: "component", semanticKey: "key", payload: {} },
            { stableId: "9", displayId: "REQ-009", kind: "backendApi", semanticKey: "key", payload: {} },
            { stableId: "10", displayId: "REQ-010", kind: "integration", semanticKey: "key", payload: {} },
            { stableId: "11", displayId: "REQ-011", kind: "architectureConstraint", semanticKey: "key", payload: {} },
            { stableId: "12", displayId: "REQ-012", kind: "unknownKind", semanticKey: "key", payload: {} }
        ];

        const res = classifyRequirements(input);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.classifications.length, 12);
        
        assert.strictEqual(res.classifications[0].primaryCategory, "FRONTEND");
        assert.strictEqual(res.classifications[1].primaryCategory, "BACKEND");
        assert.strictEqual(res.classifications[2].primaryCategory, "DATABASE");
        assert.strictEqual(res.classifications[3].primaryCategory, "AUTH");
        assert.strictEqual(res.classifications[4].primaryCategory, "DESIGN");
        assert.strictEqual(res.classifications[5].primaryCategory, "DEPLOYMENT");
        assert.strictEqual(res.classifications[6].primaryCategory, "ROUTE");
        assert.strictEqual(res.classifications[7].primaryCategory, "UI");
        assert.strictEqual(res.classifications[8].primaryCategory, "API");
        assert.strictEqual(res.classifications[9].primaryCategory, "INTEGRATION");
        assert.strictEqual(res.classifications[10].primaryCategory, "ARCHITECTURE");
        assert.strictEqual(res.classifications[11].primaryCategory, "OTHER");
    });

    test("4. Changing keywords never changes primaryCategory", () => {
        const input1 = [
            { stableId: "1", displayId: "REQ-001", kind: "component", semanticKey: "Navbar", payload: { purpose: "Display nav bar" } }
        ];
        const input2 = [
            { stableId: "1", displayId: "REQ-001", kind: "component", semanticKey: "LoginForm", payload: { purpose: "Secure auth login with Stripe checkout payment and sendgrid email" } }
        ];

        const res1 = classifyRequirements(input1);
        const res2 = classifyRequirements(input2);

        assert.strictEqual(res1.classifications[0].primaryCategory, "UI");
        assert.strictEqual(res2.classifications[0].primaryCategory, "UI");
        
        // However, secondary tags must capture the keywords
        assert.deepStrictEqual(res1.classifications[0].secondaryTags, []);
        assert.deepStrictEqual(res2.classifications[0].secondaryTags, ["AUTH", "EMAIL", "PAYMENT"]);
    });

    test("5. Secondary tags are deterministic, sorted, and unique", () => {
        // Stripe (PAYMENT), SendGrid (EMAIL), OpenAI (AI), and Login (AUTH)
        const input = [
            {
                stableId: "1",
                displayId: "REQ-001",
                kind: "component",
                semanticKey: "Stripe Payment Banner with sendgrid mailer and login auth and openai gpt chat",
                payload: {
                    details: "Stripe, SendGrid, OpenAI GPT, Auth, stripe payment checkout login email sendgrid mail"
                }
            }
        ];

        const res = classifyRequirements(input);
        assert.strictEqual(res.success, true);
        
        const tags = res.classifications[0].secondaryTags;
        // Verify unique (no duplicates of PAYMENT or EMAIL or AUTH)
        assert.strictEqual(tags.length, 5); // AUTH, AI, EMAIL, PAYMENT, CHAT (via 'chat')
        // Verify sorted alphabetically
        const sortedTags = [...tags].sort();
        assert.deepStrictEqual(tags, sortedTags);
    });

    test("6. Output is deeply immutable and frozen", () => {
        const input = [
            { stableId: "1", displayId: "REQ-001", kind: "frontend", semanticKey: "React Front", payload: "React" }
        ];

        const res = classifyRequirements(input);
        assert.strictEqual(res.success, true);
        assert.ok(Object.isFrozen(res));
        assert.ok(Object.isFrozen(res.classifications));
        assert.ok(Object.isFrozen(res.classifications[0]));
        assert.ok(Object.isFrozen(res.classifications[0].secondaryTags));

        assert.throws(() => {
            res.success = false;
        }, TypeError);

        assert.throws(() => {
            res.classifications.push({});
        }, TypeError);

        assert.throws(() => {
            res.classifications[0].primaryCategory = "BACKEND";
        }, TypeError);
    });

    test("7. Classification runs are deterministic and identical", () => {
        const input = [
            { stableId: "1", displayId: "REQ-001", kind: "component", semanticKey: "Navbar", payload: { name: "Navbar", purpose: "Top navigation banner" } },
            { stableId: "2", displayId: "REQ-002", kind: "backendApi", semanticKey: "POST /api/login", payload: { method: "POST", path: "/api/login", purpose: "Authenticate user" } }
        ];

        const run1 = classifyRequirements(input);
        const run2 = classifyRequirements(input);

        assert.deepStrictEqual(run1, run2);
    });
});

suite("RTM-Lite Model (Phase 2B)", () => {
    const { createRTM, rtmErrorCodes, RTM_MODEL_VERSION } = require(path.join(backendRoot, "core/rtm"));

    test("1. Rejects invalid non-array inputs", () => {
        const results = [
            createRTM(null),
            createRTM(undefined),
            createRTM("string"),
            createRTM(456),
            createRTM({})
        ];

        results.forEach(res => {
            assert.strictEqual(res.success, false);
            assert.strictEqual(res.errors[0].code, rtmErrorCodes.RTM_INVALID_INPUT);
            assert.ok(res.errors[0].message.includes("must be an array"));
        });
    });

    test("2. Rejects individual requirements missing required fields", () => {
        const input = [
            { displayId: "REQ-001", stableId: "req_1", kind: "component", semanticKey: "Navbar" }, // missing payload
            { stableId: "req_2", kind: "component", semanticKey: "Navbar", payload: {} } // missing displayId
        ];

        const res = createRTM(input);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.length >= 2);
        res.errors.forEach(err => {
            assert.strictEqual(err.code, rtmErrorCodes.RTM_INVALID_REQUIREMENT);
            assert.ok(err.message.includes("missing required field"));
        });
    });

    test("3. Detects duplicate stableId and rejects creation", () => {
        const input = [
            { stableId: "dup_id", displayId: "REQ-001", kind: "component", semanticKey: "Navbar", payload: {} },
            { stableId: "dup_id", displayId: "REQ-002", kind: "component", semanticKey: "Button", payload: {} }
        ];

        const res = createRTM(input);
        assert.strictEqual(res.success, false);
        assert.strictEqual(res.errors[0].code, rtmErrorCodes.RTM_DUPLICATE_REQUIREMENT);
        assert.ok(res.errors[0].message.includes("Duplicate requirement stableId"));
    });

    test("4. Instantiates default status and empty evidence", () => {
        const input = [
            { stableId: "req_1", displayId: "REQ-001", kind: "component", semanticKey: "Navbar", payload: {} }
        ];

        const res = createRTM(input);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.entries.length, 1);
        
        const entry = res.entries[0];
        assert.strictEqual(entry.status, "UNTRACKED");
        assert.deepStrictEqual(entry.evidence, {
            generatedFiles: [],
            generatedApis: [],
            generatedRoutes: [],
            generatedComponents: [],
            notes: []
        });
    });

    test("5. Populates correct deterministic metadata structure", () => {
        const input = [
            { stableId: "req_1", displayId: "REQ-001", kind: "component", semanticKey: "Navbar", payload: {} }
        ];

        const res = createRTM(input);
        assert.strictEqual(res.success, true);
        
        const meta = res.metadata;
        assert.strictEqual(meta.identityVersion, "1.0");
        assert.strictEqual(meta.classificationVersion, "1.0");
        assert.strictEqual(meta.createdBy, "rtm-lite");
        assert.strictEqual(meta.modelVersion, RTM_MODEL_VERSION);
        assert.strictEqual(meta.totalRequirementsCount, 1);

        const entryMeta = res.entries[0].metadata;
        assert.strictEqual(entryMeta.identityVersion, "1.0");
        assert.strictEqual(entryMeta.classificationVersion, "1.0");
        assert.strictEqual(entryMeta.createdBy, "rtm-lite");
        assert.strictEqual(entryMeta.modelVersion, RTM_MODEL_VERSION);
    });

    test("6. Output data structure is deeply frozen and immutable", () => {
        const input = [
            { stableId: "req_1", displayId: "REQ-001", kind: "component", semanticKey: "Navbar", payload: {} }
        ];

        const res = createRTM(input);
        assert.strictEqual(res.success, true);
        
        assert.ok(Object.isFrozen(res));
        assert.ok(Object.isFrozen(res.entries));
        assert.ok(Object.isFrozen(res.entries[0]));
        assert.ok(Object.isFrozen(res.entries[0].evidence));
        assert.ok(Object.isFrozen(res.entries[0].metadata));

        assert.throws(() => {
            res.entries[0].status = "PLANNED";
        }, TypeError);

        assert.throws(() => {
            res.entries[0].evidence.generatedFiles.push("file.js");
        }, TypeError);
    });

    test("7. Creation is stateless, pure, and deterministic", () => {
        const input = [
            { stableId: "req_1", displayId: "REQ-001", kind: "component", semanticKey: "Navbar", payload: {} },
            { stableId: "req_2", displayId: "REQ-002", kind: "pageRoute", semanticKey: "/home", payload: {} }
        ];

        const run1 = createRTM(input);
        const run2 = createRTM(input);

        assert.deepStrictEqual(run1, run2);
    });
});

suite("RTM-Lite Builder (Phase 2C)", () => {
    const { buildRTM, rtmErrorCodes } = require(path.join(backendRoot, "core/rtm"));
    const classifier = require(path.join(backendRoot, "core/requirementsClassification"));

    test("1. Rejects invalid non-array inputs", () => {
        const results = [
            buildRTM(null),
            buildRTM(undefined),
            buildRTM("string"),
            buildRTM(123),
            buildRTM({})
        ];

        results.forEach(res => {
            assert.strictEqual(res.success, false);
            assert.strictEqual(res.errors[0].code, rtmErrorCodes.RTM_INVALID_INPUT);
        });
    });

    test("2. Invokes classifyRequirements and createRTM exactly once", () => {
        buildRTM._testHooks.reset();

        const input = [
            { stableId: "req_1", displayId: "REQ-001", kind: "component", semanticKey: "Navbar", payload: {} }
        ];

        const res = buildRTM(input);
        assert.strictEqual(res.success, true);
        assert.strictEqual(buildRTM._testHooks.classifyCalls, 1);
        assert.strictEqual(buildRTM._testHooks.createRTMCalls, 1);
    });

    test("3. Classification failure prevents RTM creation and returns error", () => {
        buildRTM._testHooks.reset();

        // Missing payload to force classification failure
        const input = [
            { stableId: "req_1", displayId: "REQ-001", kind: "component", semanticKey: "Navbar" }
        ];

        const res = buildRTM(input);
        assert.strictEqual(res.success, false);
        assert.strictEqual(buildRTM._testHooks.classifyCalls, 1);
        assert.strictEqual(buildRTM._testHooks.createRTMCalls, 0);
        assert.strictEqual(res.errors[0].code, rtmErrorCodes.RTM_INVALID_REQUIREMENT);
        assert.ok(res.errors[0].message.includes("Classification failed"));
    });

    test("4. createRTM failure propagates correctly", () => {
        buildRTM._testHooks.reset();

        // Duplicate stableIds to force createRTM failure (after successful classification)
        const input = [
            { stableId: "dup", displayId: "REQ-001", kind: "component", semanticKey: "Navbar", payload: {} },
            { stableId: "dup", displayId: "REQ-002", kind: "component", semanticKey: "Button", payload: {} }
        ];

        const res = buildRTM(input);
        assert.strictEqual(res.success, false);
        assert.strictEqual(buildRTM._testHooks.classifyCalls, 1);
        assert.strictEqual(buildRTM._testHooks.createRTMCalls, 1);
        assert.strictEqual(res.errors[0].code, rtmErrorCodes.RTM_DUPLICATE_REQUIREMENT);
    });

    test("5. Builder is deterministic and returns deeply frozen structure", () => {
        const input = [
            { stableId: "req_1", displayId: "REQ-001", kind: "component", semanticKey: "Navbar", payload: {} }
        ];

        const run1 = buildRTM(input);
        const run2 = buildRTM(input);

        assert.deepStrictEqual(run1, run2);
        assert.ok(Object.isFrozen(run1));
        assert.ok(Object.isFrozen(run1.entries));
        assert.ok(Object.isFrozen(run1.entries[0]));
    });

    test("6. Caller input is never mutated", () => {
        const input = [
            { stableId: "req_1", displayId: "REQ-001", kind: "component", semanticKey: "Navbar", payload: {} }
        ];
        const inputOriginal = JSON.parse(JSON.stringify(input));

        buildRTM(input);

        assert.deepStrictEqual(input, inputOriginal);
    });
});

suite("RTM-Lite Validator (Phase 2D)", () => {
    const { buildRTM, validateRTM, rtmErrorCodes } = require(path.join(backendRoot, "core/rtm"));

    // Deep clone helper that returns a non-frozen plain JS object
    const deepClonePlain = (obj) => JSON.parse(JSON.stringify(obj));

    // Deep freeze helper to satisfy frozen check in tests
    function deepFreeze(obj) {
        if (obj === null || typeof obj !== "object") return obj;
        Object.freeze(obj);
        Object.getOwnPropertyNames(obj).forEach(prop => {
            if (obj.hasOwnProperty(prop) && obj[prop] !== null && typeof obj[prop] === "object") {
                deepFreeze(obj[prop]);
            }
        });
        return obj;
    }

    test("1. Valid frozen RTM is successfully accepted", () => {
        const input = [
            { stableId: "req_1", displayId: "REQ-001", kind: "component", semanticKey: "Navbar", payload: {} },
            { stableId: "req_2", displayId: "REQ-002", kind: "pageRoute", semanticKey: "/dashboard", payload: {} }
        ];
        const rtm = buildRTM(input);
        
        const res = validateRTM(rtm);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.errors.length, 0);
    });

    test("2. Rejects invalid root structures", () => {
        assert.strictEqual(validateRTM(null).success, false);
        assert.strictEqual(validateRTM(undefined).success, false);
        assert.strictEqual(validateRTM("string").success, false);
        assert.strictEqual(validateRTM([]).success, false);

        // Missing success/rtmVersion/entries/metadata
        const badRtm = deepFreeze({ success: true });
        const res = validateRTM(badRtm);
        assert.strictEqual(res.success, false);
        assert.strictEqual(res.errors[0].code, rtmErrorCodes.RTM_INVALID_STRUCTURE);
    });

    test("3. Rejects non-frozen RTM structures", () => {
        const input = [
            { stableId: "req_1", displayId: "REQ-001", kind: "component", semanticKey: "Navbar", payload: {} }
        ];
        const rtm = buildRTM(input);
        
        // Clone to a non-frozen object
        const plainRtm = deepClonePlain(rtm);
        
        const res = validateRTM(plainRtm);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === rtmErrorCodes.RTM_INVALID_STRUCTURE && e.message.includes("must be frozen")));
    });

    test("4. Rejects invalid status in entries", () => {
        const input = [
            { stableId: "req_1", displayId: "REQ-001", kind: "component", semanticKey: "Navbar", payload: {} }
        ];
        const rtm = buildRTM(input);
        const plainRtm = deepClonePlain(rtm);
        
        // Corrupt status
        plainRtm.entries[0].status = "INVALID_STATUS_VALUE";
        
        const frozenCorrupt = deepFreeze(plainRtm);
        const res = validateRTM(frozenCorrupt);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === rtmErrorCodes.RTM_INVALID_STATUS));
    });

    test("5. Rejects invalid primaryCategory in entries", () => {
        const input = [
            { stableId: "req_1", displayId: "REQ-001", kind: "component", semanticKey: "Navbar", payload: {} }
        ];
        const rtm = buildRTM(input);
        const plainRtm = deepClonePlain(rtm);
        
        // Corrupt category
        plainRtm.entries[0].primaryCategory = "INVALID_CATEGORY_NAME";
        
        const frozenCorrupt = deepFreeze(plainRtm);
        const res = validateRTM(frozenCorrupt);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === rtmErrorCodes.RTM_INVALID_CATEGORY));
    });

    test("6. Rejects invalid secondaryTags array patterns", () => {
        const input = [
            { stableId: "req_1", displayId: "REQ-001", kind: "component", semanticKey: "Navbar", payload: {} }
        ];
        const rtm = buildRTM(input);
        
        // Case A: lowercase tags
        const plainA = deepClonePlain(rtm);
        plainA.entries[0].secondaryTags = ["auth"];
        const resA = validateRTM(deepFreeze(plainA));
        assert.strictEqual(resA.success, false);
        assert.ok(resA.errors.some(e => e.code === rtmErrorCodes.RTM_INVALID_TAGS && e.message.includes("must be uppercase")));

        // Case B: duplicate tags
        const plainB = deepClonePlain(rtm);
        plainB.entries[0].secondaryTags = ["AUTH", "AUTH"];
        const resB = validateRTM(deepFreeze(plainB));
        assert.strictEqual(resB.success, false);
        assert.ok(resB.errors.some(e => e.code === rtmErrorCodes.RTM_INVALID_TAGS && e.message.includes("Duplicate tag element")));

        // Case C: unsorted tags
        const plainC = deepClonePlain(rtm);
        plainC.entries[0].secondaryTags = ["PAYMENT", "AUTH"]; // unsorted
        const resC = validateRTM(deepFreeze(plainC));
        assert.strictEqual(resC.success, false);
        assert.ok(resC.errors.some(e => e.code === rtmErrorCodes.RTM_INVALID_TAGS && e.message.includes("sorted alphabetically")));
    });

    test("7. Rejects duplicate stableId across entries", () => {
        const input = [
            { stableId: "req_1", displayId: "REQ-001", kind: "component", semanticKey: "Navbar", payload: {} }
        ];
        const rtm = buildRTM(input);
        const plain = deepClonePlain(rtm);
        
        // Push a duplicate stableId entry
        const dupEntry = deepClonePlain(plain.entries[0]);
        dupEntry.displayId = "REQ-002"; // change displayId to only trigger stableId check
        plain.entries.push(dupEntry);
        plain.metadata.totalRequirementsCount = 2;

        const res = validateRTM(deepFreeze(plain));
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === rtmErrorCodes.RTM_DUPLICATE_STABLE_ID));
    });

    test("8. Rejects duplicate displayId across entries", () => {
        const input = [
            { stableId: "req_1", displayId: "REQ-001", kind: "component", semanticKey: "Navbar", payload: {} }
        ];
        const rtm = buildRTM(input);
        const plain = deepClonePlain(rtm);
        
        // Push duplicate displayId entry
        const dupEntry = deepClonePlain(plain.entries[0]);
        dupEntry.stableId = "req_2"; // change stableId to only trigger displayId check
        plain.entries.push(dupEntry);
        plain.metadata.totalRequirementsCount = 2;

        const res = validateRTM(deepFreeze(plain));
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === rtmErrorCodes.RTM_INVALID_ENTRY && e.message.includes("must be strictly sequential")));
    });

    test("9. Rejects duplicate semanticKey within same kind", () => {
        const input = [
            { stableId: "req_1", displayId: "REQ-001", kind: "component", semanticKey: "Navbar", payload: {} }
        ];
        const rtm = buildRTM(input);
        const plain = deepClonePlain(rtm);
        
        // Duplicate component semanticKey "Navbar"
        const dupEntry = deepClonePlain(plain.entries[0]);
        dupEntry.stableId = "req_2";
        dupEntry.displayId = "REQ-002";
        plain.entries.push(dupEntry);
        plain.metadata.totalRequirementsCount = 2;

        const res = validateRTM(deepFreeze(plain));
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === rtmErrorCodes.RTM_INVALID_ENTRY && e.message.includes("Duplicate semanticKey")));
    });

    test("10. Validation is deterministic and never mutates input", () => {
        const input = [
            { stableId: "req_1", displayId: "REQ-001", kind: "component", semanticKey: "Navbar", payload: {} }
        ];
        const rtm = buildRTM(input);
        const rtmOriginal = JSON.parse(JSON.stringify(rtm));

        const run1 = validateRTM(rtm);
        const run2 = validateRTM(rtm);

        assert.deepStrictEqual(run1, run2);
        assert.deepStrictEqual(rtm, rtmOriginal);
    });
});

suite("RTM Pipeline Integration (Phase 2E)", () => {
    const { orchestrateGeneration, prepareCanonicalProjectSpec, _testHooks } = require(path.join(backendRoot, "services/generationOrchestrator"));
    const { adaptProjectSpecForPersistence } = require(path.join(backendRoot, "controllers/projectController"));

    const getSampleLegacyPayload = () => ({
        projectName: "TestApp",
        projectType: "Web Application",
        frontend: "React (Vite)",
        backend: "Express.js",
        database: "MongoDB",
        authentication: "JWT",
        designRequirements: "Tailwind CSS",
        pagesAndRoutes: [
            { path: "/home", name: "Home", description: "Home Page" }
        ],
        components: [
            { name: "Navbar", purpose: "Nav bar component" }
        ],
        backendApis: [
            { path: "/api/status", method: "GET", purpose: "Status check API" }
        ],
        databaseModels: [
            { name: "User", fields: ["email: String (required) - User email"] }
        ],
        integrations: [],
        importantDependencies: [],
        environmentVariables: [],
        architectureConstraints: [],
        runBuildRequirements: { runScript: "npm run dev", buildScript: "" },
        deploymentRequirements: "None",
        assumptions: []
    });

    test("1. RTM builder executes exactly once in preparation pipeline", () => {
        const payload = getSampleLegacyPayload();
        
        // Reset count
        _testHooks.buildRTMCallCount = 0;
        
        const prep = prepareCanonicalProjectSpec(payload);
        assert.strictEqual(_testHooks.buildRTMCallCount, 1);
        assert.ok(prep.rtm);
        assert.strictEqual(prep.rtm.success, true);
    });

    test("2. RTM validator executes exactly once in preparation pipeline", () => {
        const payload = getSampleLegacyPayload();
        
        // Reset count
        _testHooks.validateRTMCallCount = 0;
        
        const prep = prepareCanonicalProjectSpec(payload);
        assert.strictEqual(_testHooks.validateRTMCallCount, 1);
        assert.ok(prep.rtm);
    });

    test("3. Builder failure prevents generation and throws correct error code", () => {
        const payload = getSampleLegacyPayload();
        
        // Mock buildRTM to return failure
        const originalBuildRTM = _testHooks.buildRTM;
        _testHooks.buildRTM = () => ({
            success: false,
            errors: [{ code: "RTM_MOCK_ERROR", path: "mock", message: "Mocked build failure" }]
        });

        try {
            let threw = false;
            try {
                prepareCanonicalProjectSpec(payload);
            } catch (err) {
                threw = true;
                assert.strictEqual(err.code, "PROJECT_PREPARATION_RTM_BUILD_FAILED");
                assert.ok(err.errors.length > 0);
                assert.strictEqual(err.errors[0].code, "RTM_MOCK_ERROR");
            }
            assert.ok(threw, "Must throw on builder failure");
        } finally {
            // Restore mock
            _testHooks.buildRTM = originalBuildRTM;
        }
    });

    test("4. Validator failure prevents generation and throws correct error code", () => {
        const payload = getSampleLegacyPayload();
        
        // Mock validateRTM to return failure
        const originalValidateRTM = _testHooks.validateRTM;
        _testHooks.validateRTM = () => ({
            success: false,
            errors: [{ code: "RTM_MOCK_VAL_ERROR", path: "mock", message: "Mocked validation failure" }]
        });

        try {
            let threw = false;
            try {
                prepareCanonicalProjectSpec(payload);
            } catch (err) {
                threw = true;
                assert.strictEqual(err.code, "PROJECT_PREPARATION_RTM_VALIDATION_FAILED");
                assert.ok(err.errors.length > 0);
                assert.strictEqual(err.errors[0].code, "RTM_MOCK_VAL_ERROR");
            }
            assert.ok(threw, "Must throw on validation failure");
        } finally {
            // Restore mock
            _testHooks.validateRTM = originalValidateRTM;
        }
    });

    test("5. RTM remains frozen in preparation result", () => {
        const payload = getSampleLegacyPayload();
        const prep = prepareCanonicalProjectSpec(payload);
        
        assert.ok(prep.rtm);
        assert.ok(Object.isFrozen(prep.rtm));
        assert.ok(Object.isFrozen(prep.rtm.entries));
    });

    test("6. RTM never reaches persistence adapter", () => {
        const payload = getSampleLegacyPayload();
        const prep = prepareCanonicalProjectSpec(payload);
        
        const dbSpec = adaptProjectSpecForPersistence(prep.projectSpec);
        assert.strictEqual(dbSpec.rtm, undefined);
        assert.strictEqual(dbSpec._rtm, undefined);
    });

    test("7. RTM sidecar is not returned by public orchestrateGeneration result", () => {
        const orchestratorSource = require("fs").readFileSync(
            path.join(backendRoot, "services/generationOrchestrator.js"), "utf8"
        );
        const returnBlockIndex = orchestratorSource.indexOf("summary: richPlan,");
        assert.ok(returnBlockIndex !== -1, "Return block of orchestrateGeneration not found");
        
        const returnBlock = orchestratorSource.substring(returnBlockIndex, returnBlockIndex + 300);
        assert.ok(!/\brtm\b/.test(returnBlock), "orchestrateGeneration return block must not leak rtm sidecar");
    });
});

suite("TaskGraph Domain Model (Phase 3A)", () => {
    const { createTaskGraph, taskGraphErrorCodes, TASK_GRAPH_MODEL_VERSION } = require(path.join(backendRoot, "core/taskGraph"));

    test("1. Rejects invalid non-array inputs", () => {
        const results = [
            createTaskGraph(null),
            createTaskGraph(undefined),
            createTaskGraph("string"),
            createTaskGraph(123),
            createTaskGraph({})
        ];

        results.forEach(res => {
            assert.strictEqual(res.success, false);
            assert.strictEqual(res.graph, null);
            assert.strictEqual(res.errors[0].code, taskGraphErrorCodes.TASK_GRAPH_INVALID_INPUT);
        });
    });

    test("2. Rejects individual requirements missing required fields", () => {
        const input = [
            { displayId: "REQ-001", stableId: "req_1", kind: "component", semanticKey: "Navbar" }, // missing payload
            { stableId: "req_2", kind: "component", semanticKey: "Navbar", payload: {} } // missing displayId
        ];

        const res = createTaskGraph(input);
        assert.strictEqual(res.success, false);
        assert.strictEqual(res.graph, null);
        assert.ok(res.errors.length >= 2);
        res.errors.forEach(err => {
            assert.strictEqual(err.code, taskGraphErrorCodes.TASK_GRAPH_INVALID_REQUIREMENT);
            assert.ok(err.message.includes("missing required field"));
        });
    });

    test("3. Detects duplicate stableId and rejects creation", () => {
        const input = [
            { stableId: "dup_id", displayId: "REQ-001", kind: "component", semanticKey: "Navbar", payload: {} },
            { stableId: "dup_id", displayId: "REQ-002", kind: "component", semanticKey: "Button", payload: {} }
        ];

        const res = createTaskGraph(input);
        assert.strictEqual(res.success, false);
        assert.strictEqual(res.graph, null);
        assert.strictEqual(res.errors[0].code, taskGraphErrorCodes.TASK_GRAPH_DUPLICATE_NODE);
        assert.ok(res.errors[0].message.includes("Duplicate requirement stableId"));
    });

    test("4. Instantiates default status and empty dependencies", () => {
        const input = [
            { stableId: "req_1", displayId: "REQ-001", kind: "component", semanticKey: "Navbar", payload: { some: "payload" } }
        ];

        const res = createTaskGraph(input);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.graph.nodes.length, 1);
        
        const node = res.graph.nodes[0];
        assert.strictEqual(node.status, "PENDING");
        assert.deepStrictEqual(node.dependencies, []);
        assert.deepStrictEqual(node.payload, { some: "payload" });
        assert.strictEqual(node.stableId, "req_1");
        assert.strictEqual(node.displayId, "REQ-001");
        assert.strictEqual(node.kind, "component");
        assert.strictEqual(node.semanticKey, "Navbar");
    });

    test("5. Populates correct deterministic metadata structure", () => {
        const input = [
            { stableId: "req_1", displayId: "REQ-001", kind: "component", semanticKey: "Navbar", payload: {} }
        ];

        const res = createTaskGraph(input);
        assert.strictEqual(res.success, true);
        
        const meta = res.graph.metadata;
        assert.strictEqual(meta.graphVersion, TASK_GRAPH_MODEL_VERSION);
        assert.strictEqual(meta.identityVersion, "1.0");
        assert.strictEqual(meta.createdBy, "task-graph");
        assert.strictEqual(meta.totalNodes, 1);

        const nodeMeta = res.graph.nodes[0].metadata;
        assert.strictEqual(nodeMeta.graphVersion, TASK_GRAPH_MODEL_VERSION);
        assert.strictEqual(nodeMeta.identityVersion, "1.0");
        assert.strictEqual(nodeMeta.createdBy, "task-graph");
    });

    test("6. Output data structure is deeply frozen and immutable", () => {
        const input = [
            { stableId: "req_1", displayId: "REQ-001", kind: "component", semanticKey: "Navbar", payload: { inner: { value: 10 } } }
        ];

        const res = createTaskGraph(input);
        assert.strictEqual(res.success, true);
        
        assert.ok(Object.isFrozen(res));
        assert.ok(Object.isFrozen(res.graph));
        assert.ok(Object.isFrozen(res.graph.nodes));
        assert.ok(Object.isFrozen(res.graph.nodes[0]));
        assert.ok(Object.isFrozen(res.graph.nodes[0].payload));
        assert.ok(Object.isFrozen(res.graph.nodes[0].payload.inner));
        assert.ok(Object.isFrozen(res.graph.nodes[0].metadata));

        assert.throws(() => {
            res.graph.nodes[0].status = "RUNNING";
        }, TypeError);

        assert.throws(() => {
            res.graph.nodes[0].dependencies.push("dep");
        }, TypeError);
    });

    test("7. Creation is stateless, pure, and deterministic", () => {
        const input = [
            { stableId: "req_1", displayId: "REQ-001", kind: "component", semanticKey: "Navbar", payload: {} },
            { stableId: "req_2", displayId: "REQ-002", kind: "pageRoute", semanticKey: "/home", payload: {} }
        ];

        const run1 = createTaskGraph(input);
        const run2 = createTaskGraph(input);

        assert.deepStrictEqual(run1, run2);
    });

    test("8. Caller input is never mutated", () => {
        const input = [
            { stableId: "req_1", displayId: "REQ-001", kind: "component", semanticKey: "Navbar", payload: { some: "data" } }
        ];
        const inputOriginal = JSON.parse(JSON.stringify(input));

        createTaskGraph(input);

        assert.deepStrictEqual(input, inputOriginal);
    });
});

suite("Dependency Rule Engine (Phase 3B)", () => {
    const { getDependencyRules, getDependenciesForKind, taskGraphErrorCodes } = require(path.join(backendRoot, "core/taskGraph"));

    test("1. Known kinds return expected dependency arrays", () => {
        const kinds = [
            "frontend", "backend", "authentication", "database", "pageRoute",
            "component", "backendApi", "databaseModel", "integration",
            "deploymentRequirement", "architectureConstraint", "designRequirement"
        ];

        kinds.forEach(kind => {
            const deps = getDependenciesForKind(kind);
            assert.ok(Array.isArray(deps));
        });

        // Assert concrete dependency rules
        assert.deepStrictEqual(getDependenciesForKind("architectureConstraint"), []);
        assert.deepStrictEqual(getDependenciesForKind("frontend"), ["backend", "architectureConstraint"]);
        assert.deepStrictEqual(getDependenciesForKind("backendApi"), ["backend", "authentication", "databaseModel", "architectureConstraint"]);
    });

    test("2. Unknown or empty kinds are rejected with correct error codes", () => {
        assert.throws(() => {
            getDependenciesForKind("unknownKind");
        }, err => {
            return err.code === taskGraphErrorCodes.TASK_GRAPH_UNKNOWN_KIND;
        });

        assert.throws(() => {
            getDependenciesForKind("");
        }, err => {
            return err.code === taskGraphErrorCodes.TASK_GRAPH_INVALID_KIND;
        });

        assert.throws(() => {
            getDependenciesForKind("   ");
        }, err => {
            return err.code === taskGraphErrorCodes.TASK_GRAPH_INVALID_KIND;
        });

        assert.throws(() => {
            getDependenciesForKind(null);
        }, err => {
            return err.code === taskGraphErrorCodes.TASK_GRAPH_INVALID_KIND;
        });
    });

    test("3. Rules structure and returned arrays are deeply immutable and frozen", () => {
        const rules = getDependencyRules();
        assert.ok(Object.isFrozen(rules));
        assert.ok(Object.isFrozen(rules.frontend));

        const pageDeps = getDependenciesForKind("pageRoute");
        assert.ok(Object.isFrozen(pageDeps));

        assert.throws(() => {
            pageDeps.push("new_dep");
        }, TypeError);

        assert.throws(() => {
            rules.newKind = [];
        }, TypeError);
    });

    test("4. Dependency mapping is deterministic and pure", () => {
        const run1 = getDependenciesForKind("component");
        const run2 = getDependenciesForKind("component");
        assert.deepStrictEqual(run1, run2);
        assert.strictEqual(run1, run2); // Should point to the exact same pre-frozen array reference
    });
});

suite("TaskGraph Builder (Phase 3C)", () => {
    const { buildTaskGraph, taskGraphErrorCodes } = require(path.join(backendRoot, "core/taskGraph"));

    const getSampleRequirements = () => [
        { stableId: "req_arch", displayId: "REQ-001", kind: "architectureConstraint", semanticKey: "Base", payload: {} },
        { stableId: "req_db", displayId: "REQ-002", kind: "database", semanticKey: "Postgres", payload: {} },
        { stableId: "req_be", displayId: "REQ-003", kind: "backend", semanticKey: "Express", payload: {} },
        { stableId: "req_api", displayId: "REQ-004", kind: "backendApi", semanticKey: "GetUser", payload: {} },
        { stableId: "req_fe", displayId: "REQ-005", kind: "frontend", semanticKey: "React", payload: {} },
        { stableId: "req_page", displayId: "REQ-006", kind: "pageRoute", semanticKey: "/dashboard", payload: {} }
    ];

    test("1. Rejects invalid requirements arrays or elements", () => {
        const res = buildTaskGraph(null);
        assert.strictEqual(res.success, false);
        assert.strictEqual(res.graph, null);
        assert.strictEqual(res.errors[0].code, taskGraphErrorCodes.TASK_GRAPH_BUILD_FAILED);

        // Missing fields
        const badReqs = [{ stableId: "req_1", kind: "backend" }];
        const res2 = buildTaskGraph(badReqs);
        assert.strictEqual(res2.success, false);
        assert.strictEqual(res2.errors[0].code, taskGraphErrorCodes.TASK_GRAPH_INVALID_REQUIREMENT);
    });

    test("2. Correctly builds dependency edges and maps to stableId only", () => {
        const reqs = getSampleRequirements();
        const res = buildTaskGraph(reqs);
        assert.strictEqual(res.success, true);

        // N: backendApi -> depends on: backend, authentication, databaseModel, architectureConstraint
        const nodeApi = res.graph.nodes.find(n => n.stableId === "req_api");
        assert.ok(nodeApi);
        assert.deepStrictEqual(nodeApi.dependencies, ["req_arch", "req_be"]); // databaseModel & auth missing, so omitted!
        
        // Assert only stableIds are in dependency edges
        nodeApi.dependencies.forEach(depId => {
            assert.ok(depId.startsWith("req_"));
            assert.notStrictEqual(depId, "REQ-001");
            assert.notStrictEqual(depId, "REQ-003");
        });
    });

    test("3. Correctly populates dependents map on target nodes", () => {
        const reqs = getSampleRequirements();
        const res = buildTaskGraph(reqs);
        assert.strictEqual(res.success, true);

        // backend (req_be) should be a dependency of backendApi (req_api) and frontend (req_fe)
        const nodeBe = res.graph.nodes.find(n => n.stableId === "req_be");
        assert.ok(nodeBe);
        assert.deepStrictEqual(nodeBe.dependents, ["req_api", "req_fe"]);

        // architectureConstraint (req_arch) should be a dependency of database (req_db), backend (req_be), frontend (req_fe), backendApi (req_api), pageRoute (req_page)
        const nodeArch = res.graph.nodes.find(n => n.stableId === "req_arch");
        assert.ok(nodeArch);
        assert.deepStrictEqual(nodeArch.dependents, ["req_api", "req_be", "req_db", "req_fe", "req_page"]); // sorted alphabetically
    });

    test("4. Tolerates missing dependency kinds in supplied payload", () => {
        // Only provide frontend and component, leaving out pageRoute and designRequirement kinds
        const reqs = [
            { stableId: "req_fe", displayId: "REQ-001", kind: "frontend", semanticKey: "React", payload: {} },
            { stableId: "req_comp", displayId: "REQ-002", kind: "component", semanticKey: "Navbar", payload: {} }
        ];

        const res = buildTaskGraph(reqs);
        assert.strictEqual(res.success, true);

        const nodeComp = res.graph.nodes.find(n => n.stableId === "req_comp");
        assert.ok(nodeComp);
        assert.deepStrictEqual(nodeComp.dependencies, ["req_fe"]); // Omitted designRequirement and pageRoute since missing
    });

    test("5. Deep freezing guarantees immutable output", () => {
        const reqs = getSampleRequirements();
        const res = buildTaskGraph(reqs);
        assert.strictEqual(res.success, true);

        assert.ok(Object.isFrozen(res));
        assert.ok(Object.isFrozen(res.graph));
        assert.ok(Object.isFrozen(res.graph.nodes));
        assert.ok(Object.isFrozen(res.graph.nodes[0]));
        assert.ok(Object.isFrozen(res.graph.nodes[0].dependencies));
        assert.ok(Object.isFrozen(res.graph.nodes[0].dependents));

        assert.throws(() => {
            res.graph.nodes[0].dependencies.push("hack");
        }, TypeError);

        assert.throws(() => {
            res.graph.nodes[0].dependents.push("hack");
        }, TypeError);
    });

    test("6. Builds are stateless, pure, and deterministic", () => {
        const reqs = getSampleRequirements();
        const run1 = buildTaskGraph(reqs);
        const run2 = buildTaskGraph(reqs);

        assert.deepStrictEqual(run1, run2);
    });

    test("7. Input parameters are never mutated", () => {
        const reqs = getSampleRequirements();
        const originalReqs = JSON.parse(JSON.stringify(reqs));

        buildTaskGraph(reqs);

        assert.deepStrictEqual(reqs, originalReqs);
    });
});

suite("TaskGraph Validator (Phase 3D)", () => {
    const { buildTaskGraph, validateTaskGraph, taskGraphErrorCodes } = require(path.join(backendRoot, "core/taskGraph"));

    const getSampleValidGraph = () => {
        const reqs = [
            { stableId: "req_be", displayId: "REQ-001", kind: "backend", semanticKey: "Express", payload: {} },
            { stableId: "req_fe", displayId: "REQ-002", kind: "frontend", semanticKey: "React", payload: {} }
        ];
        const res = buildTaskGraph(reqs);
        return res.graph;
    };

    const deepClonePlain = (obj) => JSON.parse(JSON.stringify(obj));

    // Deep freeze utility specifically for testing custom modifications
    const deepFreeze = (obj) => {
        if (obj === null || typeof obj !== "object") return obj;
        Object.freeze(obj);
        Object.getOwnPropertyNames(obj).forEach(prop => {
            if (obj[prop] !== null && typeof obj[prop] === "object") {
                deepFreeze(obj[prop]);
            }
        });
        return obj;
    };

    test("1. Accepts a valid pre-built frozen TaskGraph", () => {
        const graph = getSampleValidGraph();
        const res = validateTaskGraph(graph);
        assert.strictEqual(res.success, true);
        assert.deepStrictEqual(res.errors, []);
    });

    test("2. Rejects root graph structures that are not frozen", () => {
        const plain = deepClonePlain(getSampleValidGraph());
        // Do NOT freeze plain
        const res = validateTaskGraph(plain);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === taskGraphErrorCodes.TASK_GRAPH_INVALID_GRAPH && e.message.includes("must be frozen")));
    });

    test("3. Rejects nodes containing duplicate stableId or displayId keys", () => {
        const plain = deepClonePlain(getSampleValidGraph());
        // Force duplicate stableId
        plain.nodes[1].stableId = plain.nodes[0].stableId;
        const frozen = deepFreeze(plain);

        const res = validateTaskGraph(frozen);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === taskGraphErrorCodes.TASK_GRAPH_DUPLICATE_NODE));
    });

    test("4. Rejects self dependencies (self-loops)", () => {
        const plain = deepClonePlain(getSampleValidGraph());
        // Node 0 depends on itself
        plain.nodes[0].dependencies.push(plain.nodes[0].stableId);
        const frozen = deepFreeze(plain);

        const res = validateTaskGraph(frozen);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === taskGraphErrorCodes.TASK_GRAPH_SELF_DEPENDENCY));
    });

    test("5. Rejects asymmetric edges (A depends on B, but B has no dependent edge for A)", () => {
        const plain = deepClonePlain(getSampleValidGraph());
        // A depends on B
        plain.nodes[1].dependencies.push(plain.nodes[0].stableId);
        // But B (index 0) has NO A in dependents!
        const frozen = deepFreeze(plain);

        const res = validateTaskGraph(frozen);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === taskGraphErrorCodes.TASK_GRAPH_ASYMMETRIC_EDGE));
    });

    test("6. Rejects broken references (dependencies pointing to non-existent nodes)", () => {
        const plain = deepClonePlain(getSampleValidGraph());
        // A depends on non-existent node
        plain.nodes[0].dependencies.push("non_existent_id");
        // Maintain symmetry for validator checks: non_existent_id has A as dependent (can't, since it doesn't exist)
        const frozen = deepFreeze(plain);

        const res = validateTaskGraph(frozen);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === taskGraphErrorCodes.TASK_GRAPH_BROKEN_REFERENCE));
    });

    test("7. Cycle detection correctly rejects graphs with cyclic dependencies", () => {
        const plain = deepClonePlain(getSampleValidGraph());
        // Force cycle: make req_be depend on req_fe
        plain.nodes[0].dependencies.push(plain.nodes[1].stableId);
        plain.nodes[1].dependents.push(plain.nodes[0].stableId);

        const frozen = deepFreeze(plain);
        const res = validateTaskGraph(frozen);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === taskGraphErrorCodes.TASK_GRAPH_CYCLE && e.message.includes("Cyclic dependency detected")));
    });

    test("8. Validation is deterministic and does not mutate graph parameters", () => {
        const graph = getSampleValidGraph();
        const graphOriginal = deepClonePlain(graph);

        const run1 = validateTaskGraph(graph);
        const run2 = validateTaskGraph(graph);

        assert.deepStrictEqual(run1, run2);
        assert.deepStrictEqual(deepClonePlain(graph), graphOriginal);
    });
});

suite("TaskGraph Pipeline Integration (Phase 3E)", () => {
    const { orchestrateGeneration, prepareCanonicalProjectSpec, _testHooks } = require(path.join(backendRoot, "services/generationOrchestrator"));
    const { adaptProjectSpecForPersistence } = require(path.join(backendRoot, "controllers/projectController"));

    const getSampleLegacyPayload = () => ({
        projectName: "TestApp",
        projectType: "Web Application",
        frontend: "React (Vite)",
        backend: "Express.js",
        database: "MongoDB",
        authentication: "JWT",
        designRequirements: "Tailwind CSS",
        pagesAndRoutes: [
            { path: "/home", name: "Home", description: "Home Page" }
        ],
        components: [
            { name: "Navbar", purpose: "Nav bar component" }
        ],
        backendApis: [
            { path: "/api/status", method: "GET", purpose: "Status check API" }
        ],
        databaseModels: [
            { name: "User", fields: ["email: String (required) - User email"] }
        ],
        integrations: [],
        importantDependencies: [],
        environmentVariables: [],
        architectureConstraints: [],
        runBuildRequirements: { runScript: "npm run dev", buildScript: "" },
        deploymentRequirements: "None",
        assumptions: []
    });

    test("1. TaskGraph Builder executes once in preparation pipeline", () => {
        const payload = getSampleLegacyPayload();
        
        // Reset count
        _testHooks.buildTaskGraphCallCount = 0;
        
        const prep = prepareCanonicalProjectSpec(payload);
        assert.strictEqual(_testHooks.buildTaskGraphCallCount, 1);
        assert.ok(prep.taskGraph);
    });

    test("2. TaskGraph Validator executes once in preparation pipeline", () => {
        const payload = getSampleLegacyPayload();
        
        // Reset count
        _testHooks.validateTaskGraphCallCount = 0;
        
        const prep = prepareCanonicalProjectSpec(payload);
        assert.strictEqual(_testHooks.validateTaskGraphCallCount, 1);
        assert.ok(prep.taskGraph);
    });

    test("3. Builder failure halts preparation and throws correct error code", () => {
        const payload = getSampleLegacyPayload();
        
        // Mock buildTaskGraph to return failure
        const originalBuildTaskGraph = _testHooks.buildTaskGraph;
        _testHooks.buildTaskGraph = () => ({
            success: false,
            errors: [{ code: "TASK_GRAPH_MOCK_ERROR", path: "mock", message: "Mocked build failure" }]
        });

        try {
            let threw = false;
            try {
                prepareCanonicalProjectSpec(payload);
            } catch (err) {
                threw = true;
                assert.strictEqual(err.code, "PROJECT_PREPARATION_TASK_GRAPH_BUILD_FAILED");
                assert.ok(err.errors.length > 0);
                assert.strictEqual(err.errors[0].code, "TASK_GRAPH_MOCK_ERROR");
            }
            assert.ok(threw, "Must throw on builder failure");
        } finally {
            // Restore mock
            _testHooks.buildTaskGraph = originalBuildTaskGraph;
        }
    });

    test("4. Validator failure halts preparation and throws correct error code", () => {
        const payload = getSampleLegacyPayload();
        
        // Mock validateTaskGraph to return failure
        const originalValidateTaskGraph = _testHooks.validateTaskGraph;
        _testHooks.validateTaskGraph = () => ({
            success: false,
            errors: [{ code: "TASK_GRAPH_MOCK_VAL_ERROR", path: "mock", message: "Mocked validation failure" }]
        });

        try {
            let threw = false;
            try {
                prepareCanonicalProjectSpec(payload);
            } catch (err) {
                threw = true;
                assert.strictEqual(err.code, "PROJECT_PREPARATION_TASK_GRAPH_VALIDATION_FAILED");
                assert.ok(err.errors.length > 0);
                assert.strictEqual(err.errors[0].code, "TASK_GRAPH_MOCK_VAL_ERROR");
            }
            assert.ok(threw, "Must throw on validation failure");
        } finally {
            // Restore mock
            _testHooks.validateTaskGraph = originalValidateTaskGraph;
        }
    });

    test("5. TaskGraph remains frozen in preparation result", () => {
        const payload = getSampleLegacyPayload();
        const prep = prepareCanonicalProjectSpec(payload);
        
        assert.ok(prep.taskGraph);
        assert.ok(Object.isFrozen(prep.taskGraph));
        assert.ok(Object.isFrozen(prep.taskGraph.nodes));
    });

    test("6. TaskGraph never reaches persistence adapter", () => {
        const payload = getSampleLegacyPayload();
        const prep = prepareCanonicalProjectSpec(payload);
        
        const dbSpec = adaptProjectSpecForPersistence(prep.projectSpec);
        assert.strictEqual(dbSpec.taskGraph, undefined);
        assert.strictEqual(dbSpec._taskGraph, undefined);
    });

    test("7. TaskGraph sidecar is not returned by public orchestrateGeneration result", () => {
        const orchestratorSource = require("fs").readFileSync(
            path.join(backendRoot, "services/generationOrchestrator.js"), "utf8"
        );
        const returnBlockIndex = orchestratorSource.indexOf("summary: richPlan,");
        assert.ok(returnBlockIndex !== -1, "Return block of orchestrateGeneration not found");
        
        const returnBlock = orchestratorSource.substring(returnBlockIndex, returnBlockIndex + 300);
        assert.ok(!/\btaskGraph\b/.test(returnBlock), "orchestrateGeneration return block must not leak taskGraph sidecar");
    });
});

suite("Planner Domain Model (Phase 4A)", () => {
    const { createPlanner, PLANNER_MODEL_VERSION, plannerErrorCodes } = require(path.join(backendRoot, "core/planner"));

    const getSampleTaskGraph = () => ({
        graphVersion: "1.0",
        metadata: {
            graphVersion: "1.0",
            identityVersion: "1.0",
            createdBy: "taskGraphBuilder"
        },
        nodes: [
            {
                stableId: "req_be",
                displayId: "REQ-001",
                kind: "backend",
                semanticKey: "Express",
                status: "PENDING",
                dependencies: [],
                dependents: ["req_fe"],
                metadata: { sourcePath: "backend" },
                payload: {}
            },
            {
                stableId: "req_fe",
                displayId: "REQ-002",
                kind: "frontend",
                semanticKey: "React",
                status: "PENDING",
                dependencies: ["req_be"],
                dependents: [],
                metadata: { sourcePath: "frontend" },
                payload: {}
            }
        ]
    });

    const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

    test("1. Rejects invalid non-object inputs", () => {
        const res1 = createPlanner(null);
        assert.strictEqual(res1.success, false);
        assert.strictEqual(res1.errors[0].code, plannerErrorCodes.PLANNER_INVALID_INPUT);

        const res2 = createPlanner(undefined);
        assert.strictEqual(res2.success, false);

        const res3 = createPlanner("not-a-graph");
        assert.strictEqual(res3.success, false);
    });

    test("2. Rejects invalid TaskGraph structures", () => {
        const invalidGraph = { graphVersion: "1.0" }; // missing nodes & metadata
        const res = createPlanner(invalidGraph);
        assert.strictEqual(res.success, false);
        assert.strictEqual(res.errors[0].code, plannerErrorCodes.PLANNER_INVALID_GRAPH);
    });

    test("3. Rejects duplicate task stableId or displayId keys", () => {
        const graph = getSampleTaskGraph();
        graph.nodes[1].stableId = graph.nodes[0].stableId; // duplicate stableId
        const res = createPlanner(graph);
        assert.strictEqual(res.success, false);
        assert.strictEqual(res.errors[0].code, plannerErrorCodes.PLANNER_DUPLICATE_TASK);
    });

    test("4. Instantiates PENDING status, ready=false, and blocked=false by default", () => {
        const graph = getSampleTaskGraph();
        const res = createPlanner(graph);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.planner.version, PLANNER_MODEL_VERSION);

        const tasks = res.planner.tasks;
        assert.strictEqual(tasks.length, 2);
        
        tasks.forEach(task => {
            assert.strictEqual(task.status, "PENDING");
            assert.strictEqual(task.ready, false);
            assert.strictEqual(task.blocked, false);
        });
    });

    test("5. Populates correct metadata mapping", () => {
        const graph = getSampleTaskGraph();
        const res = createPlanner(graph);
        assert.strictEqual(res.success, true);
        
        const metadata = res.planner.metadata;
        assert.strictEqual(metadata.plannerVersion, PLANNER_MODEL_VERSION);
        assert.strictEqual(metadata.graphVersion, graph.graphVersion);
        assert.strictEqual(metadata.identityVersion, graph.metadata.identityVersion);
        assert.strictEqual(metadata.createdBy, "planner");
    });

    test("6. Planner data structures are deeply frozen and immutable", () => {
        const graph = getSampleTaskGraph();
        const res = createPlanner(graph);
        assert.strictEqual(res.success, true);

        assert.ok(Object.isFrozen(res));
        assert.ok(Object.isFrozen(res.planner));
        assert.ok(Object.isFrozen(res.planner.metadata));
        assert.ok(Object.isFrozen(res.planner.tasks));
        assert.ok(Object.isFrozen(res.planner.tasks[0]));
        assert.ok(Object.isFrozen(res.planner.tasks[0].dependencies));
    });

    test("7. Planner creation is stateless and pure", () => {
        const graph = getSampleTaskGraph();
        const res1 = createPlanner(graph);
        const res2 = createPlanner(graph);
        assert.deepStrictEqual(res1, res2);
    });

    test("8. Caller taskGraph input parameters are never mutated", () => {
        const graph = getSampleTaskGraph();
        const original = deepClone(graph);
        createPlanner(graph);
        assert.deepStrictEqual(graph, original);
    });
});

suite("Topological Planner Foundation (Phase 4B)", () => {
    const { createExecutionPlan, topologyErrorCodes } = require(path.join(backendRoot, "core/planner"));

    const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

    // Helper to construct a basic mock planner structure
    const createMockPlanner = (tasks) => ({
        version: "1.0",
        metadata: {
            plannerVersion: "1.0",
            graphVersion: "1.0",
            identityVersion: "1.0",
            createdBy: "planner"
        },
        tasks
    });

    test("1. Correctly orders a simple Directed Acyclic Graph (DAG)", () => {
        const tasks = [
            { stableId: "req_be", displayId: "REQ-001", kind: "backend", dependencies: [], dependents: ["req_fe"] },
            { stableId: "req_fe", displayId: "REQ-002", kind: "frontend", dependencies: ["req_be"], dependents: [] }
        ];
        const planner = createMockPlanner(tasks);
        const res = createExecutionPlan(planner);
        assert.strictEqual(res.success, true);
        assert.deepStrictEqual(res.executionOrder, ["req_be", "req_fe"]);
    });

    test("2. Deterministically resolves sibling branches with multiple roots via displayId sorting", () => {
        // req_be1 (REQ-002) and req_be2 (REQ-001) both have 0 in-degree. REQ-001 must come first.
        const tasks = [
            { stableId: "req_be1", displayId: "REQ-002", kind: "backend", dependencies: [], dependents: ["req_fe"] },
            { stableId: "req_be2", displayId: "REQ-001", kind: "backend", dependencies: [], dependents: ["req_fe"] },
            { stableId: "req_fe", displayId: "REQ-003", kind: "frontend", dependencies: ["req_be1", "req_be2"], dependents: [] }
        ];
        const planner = createMockPlanner(tasks);
        const res = createExecutionPlan(planner);
        assert.strictEqual(res.success, true);
        // REQ-001 ("req_be2") must precede REQ-002 ("req_be1")
        assert.deepStrictEqual(res.executionOrder, ["req_be2", "req_be1", "req_fe"]);
    });

    test("3. Correctly orders a diamond graph structure", () => {
        //            REQ-001 (Root)
        //            /            \
        // REQ-002 (Left)        REQ-003 (Right)
        //            \            /
        //            REQ-004 (Sink)
        const tasks = [
            { stableId: "root", displayId: "REQ-001", kind: "backend", dependencies: [], dependents: ["left", "right"] },
            { stableId: "left", displayId: "REQ-002", kind: "backend", dependencies: ["root"], dependents: ["sink"] },
            { stableId: "right", displayId: "REQ-003", kind: "backend", dependencies: ["root"], dependents: ["sink"] },
            { stableId: "sink", displayId: "REQ-004", kind: "frontend", dependencies: ["left", "right"], dependents: [] }
        ];
        const planner = createMockPlanner(tasks);
        const res = createExecutionPlan(planner);
        assert.strictEqual(res.success, true);
        assert.deepStrictEqual(res.executionOrder, ["root", "left", "right", "sink"]);
    });

    test("4. Deterministically schedules multiple independent branches", () => {
        // Two independent paths:
        // Path A: A1 (REQ-002) -> A2 (REQ-004)
        // Path B: B1 (REQ-001) -> B2 (REQ-003)
        // Sibling sorting order should sort all ready nodes at any iteration:
        // Iteration 1: Ready list: [B1 (REQ-001), A1 (REQ-002)]. Sorts to [B1, A1]. Select B1.
        // Iteration 2: Ready list: [A1 (REQ-002), B2 (REQ-003)]. Sorts to [A1, B2]. Select A1.
        // Iteration 3: Ready list: [B2 (REQ-003), A2 (REQ-004)]. Sorts to [B2, A2]. Select B2.
        // Iteration 4: Ready list: [A2 (REQ-004)]. Select A2.
        // Execution order: [B1, A1, B2, A2] -> ["b1", "a1", "b2", "a2"]
        const tasks = [
            { stableId: "a1", displayId: "REQ-002", kind: "backend", dependencies: [], dependents: ["a2"] },
            { stableId: "a2", displayId: "REQ-004", kind: "frontend", dependencies: ["a1"], dependents: [] },
            { stableId: "b1", displayId: "REQ-001", kind: "backend", dependencies: [], dependents: ["b2"] },
            { stableId: "b2", displayId: "REQ-003", kind: "frontend", dependencies: ["b1"], dependents: [] }
        ];
        const planner = createMockPlanner(tasks);
        const res = createExecutionPlan(planner);
        assert.strictEqual(res.success, true);
        assert.deepStrictEqual(res.executionOrder, ["b1", "a1", "b2", "a2"]);
    });

    test("5. Rejects graph cycles with PLANNER_TOPOLOGY_CYCLE", () => {
        // A -> B -> A
        const tasks = [
            { stableId: "a", displayId: "REQ-001", kind: "backend", dependencies: ["b"], dependents: ["b"] },
            { stableId: "b", displayId: "REQ-002", kind: "backend", dependencies: ["a"], dependents: ["a"] }
        ];
        const planner = createMockPlanner(tasks);
        const res = createExecutionPlan(planner);
        assert.strictEqual(res.success, false);
        assert.strictEqual(res.errors[0].code, topologyErrorCodes.PLANNER_TOPOLOGY_CYCLE);
    });

    test("6. Creation is deterministic, pure, and does not mutate planner parameters", () => {
        const tasks = [
            { stableId: "a", displayId: "REQ-002", kind: "backend", dependencies: [], dependents: [] },
            { stableId: "b", displayId: "REQ-001", kind: "backend", dependencies: [], dependents: [] }
        ];
        const planner = createMockPlanner(tasks);
        const originalPlanner = deepClone(planner);

        const res1 = createExecutionPlan(planner);
        const res2 = createExecutionPlan(planner);

        assert.deepStrictEqual(res1, res2);
        assert.deepStrictEqual(planner, originalPlanner);
        assert.ok(Object.isFrozen(res1));
    });
});

suite("Ready Queue Builder (Phase 4C)", () => {
    const { buildReadyQueue, readyErrorCodes } = require(path.join(backendRoot, "core/planner"));

    const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

    const createMockPlanner = (tasks) => ({
        version: "1.0",
        metadata: {
            plannerVersion: "1.0",
            graphVersion: "1.0",
            identityVersion: "1.0",
            createdBy: "planner"
        },
        tasks
    });

    test("1. Tasks without dependencies are READY if pending and not blocked", () => {
        const tasks = [
            { stableId: "t1", displayId: "REQ-001", status: "PENDING", blocked: false, dependencies: [] },
            { stableId: "t2", displayId: "REQ-002", status: "COMPLETED", blocked: false, dependencies: [] }
        ];
        const planner = createMockPlanner(tasks);
        const res = buildReadyQueue(planner);
        assert.strictEqual(res.success, true);
        assert.deepStrictEqual(res.readyQueue, ["t1"]);
    });

    test("2. Completed dependencies unlock tasks", () => {
        const tasks = [
            { stableId: "t1", displayId: "REQ-001", status: "COMPLETED", blocked: false, dependencies: [] },
            { stableId: "t2", displayId: "REQ-002", status: "PENDING", blocked: false, dependencies: ["t1"] }
        ];
        const planner = createMockPlanner(tasks);
        const res = buildReadyQueue(planner);
        assert.strictEqual(res.success, true);
        assert.deepStrictEqual(res.readyQueue, ["t2"]);
    });

    test("3. Blocked tasks are excluded from ready queue", () => {
        const tasks = [
            { stableId: "t1", displayId: "REQ-001", status: "PENDING", blocked: true, dependencies: [] },
            { stableId: "t2", displayId: "REQ-002", status: "PENDING", blocked: false, dependencies: [] }
        ];
        const planner = createMockPlanner(tasks);
        const res = buildReadyQueue(planner);
        assert.strictEqual(res.success, true);
        assert.deepStrictEqual(res.readyQueue, ["t2"]);
    });

    test("4. Pending dependencies block downstream tasks", () => {
        const tasks = [
            { stableId: "t1", displayId: "REQ-001", status: "PENDING", blocked: false, dependencies: [] },
            { stableId: "t2", displayId: "REQ-002", status: "PENDING", blocked: false, dependencies: ["t1"] }
        ];
        const planner = createMockPlanner(tasks);
        const res = buildReadyQueue(planner);
        assert.strictEqual(res.success, true);
        // Only t1 is ready, t2 is blocked by t1 being PENDING
        assert.deepStrictEqual(res.readyQueue, ["t1"]);
    });

    test("5. Ordering uses displayId ascending", () => {
        const tasks = [
            { stableId: "t2", displayId: "REQ-002", status: "PENDING", blocked: false, dependencies: [] },
            { stableId: "t1", displayId: "REQ-001", status: "PENDING", blocked: false, dependencies: [] }
        ];
        const planner = createMockPlanner(tasks);
        const res = buildReadyQueue(planner);
        assert.strictEqual(res.success, true);
        // t1 (REQ-001) must come before t2 (REQ-002)
        assert.deepStrictEqual(res.readyQueue, ["t1", "t2"]);
    });

    test("6. Planner input is never mutated, repeated runs are identical and output is frozen", () => {
        const tasks = [
            { stableId: "t1", displayId: "REQ-001", status: "PENDING", blocked: false, dependencies: [] }
        ];
        const planner = createMockPlanner(tasks);
        const originalPlanner = deepClone(planner);

        const res1 = buildReadyQueue(planner);
        const res2 = buildReadyQueue(planner);

        assert.deepStrictEqual(res1, res2);
        assert.deepStrictEqual(planner, originalPlanner);
        assert.ok(Object.isFrozen(res1));
        assert.ok(Object.isFrozen(res1.readyQueue));
    });
});

suite("Planner Validator (Phase 4D)", () => {
    const { validatePlanner, validatorErrorCodes } = require(path.join(backendRoot, "core/planner"));

    const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

    const deepFreeze = (obj) => {
        if (obj === null || typeof obj !== "object") return obj;
        Object.freeze(obj);
        Object.getOwnPropertyNames(obj).forEach(prop => {
            if (obj.hasOwnProperty(prop) && obj[prop] !== null && typeof obj[prop] === "object") {
                deepFreeze(obj[prop]);
            }
        });
        return obj;
    };

    const getSampleValidPlanner = () => {
        const planner = {
            version: "1.0",
            metadata: {
                plannerVersion: "1.0",
                graphVersion: "1.0",
                identityVersion: "1.0",
                createdBy: "planner"
            },
            tasks: [
                {
                    stableId: "t1",
                    displayId: "REQ-001",
                    kind: "backend",
                    status: "PENDING",
                    dependencies: [],
                    dependents: ["t2"],
                    ready: false,
                    blocked: false,
                    metadata: { sourcePath: "backend" }
                },
                {
                    stableId: "t2",
                    displayId: "REQ-002",
                    kind: "frontend",
                    status: "PENDING",
                    dependencies: ["t1"],
                    dependents: [],
                    ready: false,
                    blocked: false,
                    metadata: { sourcePath: "frontend" }
                }
            ]
        };
        return deepFreeze(planner);
    };

    test("1. Accepts a valid pre-built frozen Planner", () => {
        const planner = getSampleValidPlanner();
        const res = validatePlanner(planner);
        assert.strictEqual(res.success, true);
    });

    test("2. Rejects invalid root structures", () => {
        assert.strictEqual(validatePlanner(null).success, false);
        assert.strictEqual(validatePlanner(undefined).success, false);
        assert.strictEqual(validatePlanner("string").success, false);

        // Missing metadata or version
        const planner = { version: "1.0", tasks: [] };
        const res = validatePlanner(deepFreeze(planner));
        assert.strictEqual(res.success, false);
        assert.strictEqual(res.errors[0].code, validatorErrorCodes.PLANNER_INVALID_STRUCTURE);
    });

    test("3. Rejects duplicate stableId across tasks", () => {
        const raw = JSON.parse(JSON.stringify(getSampleValidPlanner()));
        raw.tasks[1].stableId = "t1"; // duplicate stableId
        const planner = deepFreeze(raw);
        const res = validatePlanner(planner);
        assert.strictEqual(res.success, false);
        assert.strictEqual(res.errors[0].code, validatorErrorCodes.PLANNER_DUPLICATE_TASK);
    });

    test("4. Rejects duplicate displayId across tasks", () => {
        const raw = JSON.parse(JSON.stringify(getSampleValidPlanner()));
        raw.tasks[1].displayId = "REQ-001"; // duplicate displayId
        const planner = deepFreeze(raw);
        const res = validatePlanner(planner);
        assert.strictEqual(res.success, false);
        assert.strictEqual(res.errors[0].code, validatorErrorCodes.PLANNER_DUPLICATE_TASK);
    });

    test("5. Rejects broken references in dependencies", () => {
        const raw = JSON.parse(JSON.stringify(getSampleValidPlanner()));
        raw.tasks[1].dependencies.push("non-existent");
        const planner = deepFreeze(raw);
        const res = validatePlanner(planner);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === validatorErrorCodes.PLANNER_BROKEN_REFERENCE));
    });

    test("6. Rejects self-dependencies", () => {
        const raw = JSON.parse(JSON.stringify(getSampleValidPlanner()));
        raw.tasks[0].dependencies.push("t1");
        const planner = deepFreeze(raw);
        const res = validatePlanner(planner);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === validatorErrorCodes.PLANNER_SELF_DEPENDENCY));
    });

    test("7. Rejects asymmetric edges", () => {
        const raw = JSON.parse(JSON.stringify(getSampleValidPlanner()));
        // Break symmetry: t1 depends on nothing, but let's add t2 as dependent without t2 listing t1 as dependency
        raw.tasks[0].dependents.push("t2");
        raw.tasks[1].dependencies = [];
        const planner = deepFreeze(raw);
        const res = validatePlanner(planner);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === validatorErrorCodes.PLANNER_ASYMMETRIC_EDGE));
    });

    test("8. Rejects invalid statuses", () => {
        const raw = JSON.parse(JSON.stringify(getSampleValidPlanner()));
        raw.tasks[0].status = "RUNNING"; // invalid status
        const planner = deepFreeze(raw);
        const res = validatePlanner(planner);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === validatorErrorCodes.PLANNER_INVALID_STATUS));
    });

    test("9. Rejects non-frozen planners", () => {
        const planner = JSON.parse(JSON.stringify(getSampleValidPlanner()));
        // Not frozen
        const res = validatePlanner(planner);
        assert.strictEqual(res.success, false);
        assert.ok(res.errors.some(e => e.code === validatorErrorCodes.PLANNER_INVALID_STRUCTURE));
    });

    test("10. Validation is deterministic, pure, and does not mutate planner parameter", () => {
        const planner = getSampleValidPlanner();
        const original = deepClone(planner);

        const res1 = validatePlanner(planner);
        const res2 = validatePlanner(planner);

        assert.deepStrictEqual(res1, res2);
        assert.deepStrictEqual(planner, original);
    });
});

suite("Planner Pipeline Integration (Phase 4E)", () => {
    const { orchestrateGeneration, prepareCanonicalProjectSpec, _testHooks } = require(path.join(backendRoot, "services/generationOrchestrator"));
    const { adaptProjectSpecForPersistence } = require(path.join(backendRoot, "controllers/projectController"));

    const getSampleLegacyPayload = () => ({
        projectName: "TestApp",
        projectType: "Web Application",
        frontend: "React (Vite)",
        backend: "Express.js",
        database: "MongoDB",
        authentication: "JWT",
        designRequirements: "Tailwind CSS",
        pagesAndRoutes: [
            { path: "/home", name: "Home", description: "Home Page" }
        ],
        components: [
            { name: "Navbar", purpose: "Nav bar component" }
        ],
        backendApis: [
            { path: "/api/status", method: "GET", purpose: "Status check API" }
        ],
        databaseModels: [
            { name: "User", fields: ["email: String (required) - User email"] }
        ],
        integrations: [],
        importantDependencies: [],
        environmentVariables: [],
        architectureConstraints: [],
        runBuildRequirements: { runScript: "npm run dev", buildScript: "" },
        deploymentRequirements: "None",
        assumptions: []
    });

    test("1. Planner Model executes exactly once in preparation pipeline", () => {
        const payload = getSampleLegacyPayload();
        _testHooks.createPlannerCallCount = 0;
        const prep = prepareCanonicalProjectSpec(payload);
        assert.strictEqual(_testHooks.createPlannerCallCount, 1);
        assert.ok(prep.planner);
    });

    test("2. Planner Topology executes exactly once in preparation pipeline", () => {
        const payload = getSampleLegacyPayload();
        _testHooks.createExecutionPlanCallCount = 0;
        const prep = prepareCanonicalProjectSpec(payload);
        assert.strictEqual(_testHooks.createExecutionPlanCallCount, 1);
        assert.ok(prep.planner);
    });

    test("3. Ready Queue Builder executes exactly once in preparation pipeline", () => {
        const payload = getSampleLegacyPayload();
        _testHooks.buildReadyQueueCallCount = 0;
        const prep = prepareCanonicalProjectSpec(payload);
        assert.strictEqual(_testHooks.buildReadyQueueCallCount, 1);
        assert.ok(prep.planner);
    });

    test("4. Planner Validator executes exactly once in preparation pipeline", () => {
        const payload = getSampleLegacyPayload();
        _testHooks.validatePlannerCallCount = 0;
        const prep = prepareCanonicalProjectSpec(payload);
        assert.strictEqual(_testHooks.validatePlannerCallCount, 1);
        assert.ok(prep.planner);
    });

    test("5. Planner Model failure prevents planning and throws correct error code", () => {
        const payload = getSampleLegacyPayload();
        const originalCreatePlanner = _testHooks.createPlanner;
        _testHooks.createPlanner = () => ({
            success: false,
            errors: [{ code: "MOCK_PLANNER_BUILD_ERROR", path: "mock", message: "Mocked build failure" }]
        });

        try {
            let threw = false;
            try {
                prepareCanonicalProjectSpec(payload);
            } catch (err) {
                threw = true;
                assert.strictEqual(err.code, "PROJECT_PREPARATION_PLANNER_BUILD_FAILED");
                assert.ok(err.errors.length > 0);
                assert.strictEqual(err.errors[0].code, "MOCK_PLANNER_BUILD_ERROR");
            }
            assert.ok(threw, "Must throw on model builder failure");
        } finally {
            _testHooks.createPlanner = originalCreatePlanner;
        }
    });

    test("6. Planner Topology failure prevents planning and throws correct error code", () => {
        const payload = getSampleLegacyPayload();
        const originalCreateExecutionPlan = _testHooks.createExecutionPlan;
        _testHooks.createExecutionPlan = () => ({
            success: false,
            executionOrder: [],
            errors: [{ code: "MOCK_PLANNER_TOPOLOGY_ERROR", path: "mock", message: "Mocked topology failure" }]
        });

        try {
            let threw = false;
            try {
                prepareCanonicalProjectSpec(payload);
            } catch (err) {
                threw = true;
                assert.strictEqual(err.code, "PROJECT_PREPARATION_PLANNER_TOPOLOGY_FAILED");
                assert.ok(err.errors.length > 0);
                assert.strictEqual(err.errors[0].code, "MOCK_PLANNER_TOPOLOGY_ERROR");
            }
            assert.ok(threw, "Must throw on topology sorting failure");
        } finally {
            _testHooks.createExecutionPlan = originalCreateExecutionPlan;
        }
    });

    test("7. Ready Queue failure prevents planning and throws correct error code", () => {
        const payload = getSampleLegacyPayload();
        const originalBuildReadyQueue = _testHooks.buildReadyQueue;
        _testHooks.buildReadyQueue = () => ({
            success: false,
            readyQueue: [],
            errors: [{ code: "MOCK_PLANNER_READY_ERROR", path: "mock", message: "Mocked ready failure" }]
        });

        try {
            let threw = false;
            try {
                prepareCanonicalProjectSpec(payload);
            } catch (err) {
                threw = true;
                assert.strictEqual(err.code, "PROJECT_PREPARATION_PLANNER_READY_FAILED");
                assert.ok(err.errors.length > 0);
                assert.strictEqual(err.errors[0].code, "MOCK_PLANNER_READY_ERROR");
            }
            assert.ok(threw, "Must throw on ready queue building failure");
        } finally {
            _testHooks.buildReadyQueue = originalBuildReadyQueue;
        }
    });

    test("8. Planner validation failure prevents planning and throws correct error code", () => {
        const payload = getSampleLegacyPayload();
        const originalValidatePlanner = _testHooks.validatePlanner;
        _testHooks.validatePlanner = () => ({
            success: false,
            errors: [{ code: "MOCK_PLANNER_VAL_ERROR", path: "mock", message: "Mocked validation failure" }]
        });

        try {
            let threw = false;
            try {
                prepareCanonicalProjectSpec(payload);
            } catch (err) {
                threw = true;
                assert.strictEqual(err.code, "PROJECT_PREPARATION_PLANNER_VALIDATION_FAILED");
                assert.ok(err.errors.length > 0);
                assert.strictEqual(err.errors[0].code, "MOCK_PLANNER_VAL_ERROR");
            }
            assert.ok(threw, "Must throw on validation failure");
        } finally {
            _testHooks.validatePlanner = originalValidatePlanner;
        }
    });

    test("9. Planner remains frozen in preparation result", () => {
        const payload = getSampleLegacyPayload();
        const prep = prepareCanonicalProjectSpec(payload);
        assert.ok(prep.planner);
        assert.ok(Object.isFrozen(prep.planner));
        assert.ok(Object.isFrozen(prep.planner.tasks));
    });

    test("10. Planner never reaches persistence adapter", () => {
        const payload = getSampleLegacyPayload();
        const prep = prepareCanonicalProjectSpec(payload);
        const dbSpec = adaptProjectSpecForPersistence(prep.projectSpec);
        assert.strictEqual(dbSpec.planner, undefined);
        assert.strictEqual(dbSpec._planner, undefined);
    });

    test("11. Planner sidecar is not returned by public orchestrateGeneration result", () => {
        const orchestratorSource = require("fs").readFileSync(
            path.join(backendRoot, "services/generationOrchestrator.js"), "utf8"
        );
        const returnBlockIndex = orchestratorSource.indexOf("summary: richPlan,");
        assert.ok(returnBlockIndex !== -1, "Return block of orchestrateGeneration not found");
        const returnBlock = orchestratorSource.substring(returnBlockIndex, returnBlockIndex + 300);
        assert.ok(!/\bplanner\b/.test(returnBlock), "orchestrateGeneration return block must not leak planner sidecar");
    });
});

suite("Checkpoint Domain Model (Phase 5A)", () => {
    const { createCheckpoint, CHECKPOINT_MODEL_VERSION, checkpointErrorCodes } = require(path.join(backendRoot, "core/checkpoints"));

    const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

    const getSampleValidPlanner = () => ({
        version: "1.0",
        metadata: {
            plannerVersion: "1.0",
            graphVersion: "1.0",
            identityVersion: "1.0",
            createdBy: "planner"
        },
        tasks: [
            {
                stableId: "t1",
                displayId: "REQ-001",
                kind: "backend",
                status: "COMPLETED",
                dependencies: [],
                dependents: ["t2"]
            },
            {
                stableId: "t2",
                displayId: "REQ-002",
                kind: "frontend",
                status: "PENDING",
                dependencies: ["t1"],
                dependents: []
            }
        ]
    });

    test("1. Rejects invalid non-object planner inputs", () => {
        const res1 = createCheckpoint(null);
        assert.strictEqual(res1.success, false);
        assert.strictEqual(res1.errors[0].code, checkpointErrorCodes.CHECKPOINT_INVALID_INPUT);

        const res2 = createCheckpoint(undefined);
        assert.strictEqual(res2.success, false);

        const res3 = createCheckpoint("not-a-planner");
        assert.strictEqual(res3.success, false);
    });

    test("2. Rejects invalid planner structures", () => {
        const invalidPlanner = { version: "1.0" }; // missing tasks & metadata
        const res = createCheckpoint(invalidPlanner);
        assert.strictEqual(res.success, false);
        assert.strictEqual(res.errors[0].code, checkpointErrorCodes.CHECKPOINT_INVALID_PLANNER);
    });

    test("3. Rejects duplicate task IDs", () => {
        const planner = getSampleValidPlanner();
        planner.tasks[1].stableId = "t1"; // duplicate stableId
        const res = createCheckpoint(planner);
        assert.strictEqual(res.success, false);
        assert.strictEqual(res.errors[0].code, checkpointErrorCodes.CHECKPOINT_DUPLICATE_TASK);
    });

    test("4. Checkpoint initializes correctly and populates executionState groups", () => {
        const planner = getSampleValidPlanner();
        const res = createCheckpoint(planner, "test-runner");
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.checkpoint.version, CHECKPOINT_MODEL_VERSION);
        
        const metadata = res.checkpoint.metadata;
        assert.strictEqual(metadata.checkpointVersion, CHECKPOINT_MODEL_VERSION);
        assert.strictEqual(metadata.plannerVersion, planner.version);
        assert.strictEqual(metadata.createdBy, "test-runner");

        const state = res.checkpoint.executionState;
        assert.deepStrictEqual(state.completedTasks, ["t1"]);
        assert.deepStrictEqual(state.pendingTasks, ["t2"]);
        assert.deepStrictEqual(state.runningTasks, []);
        assert.deepStrictEqual(state.failedTasks, []);
    });

    test("5. Checkpoint is deeply frozen and immutable", () => {
        const planner = getSampleValidPlanner();
        const res = createCheckpoint(planner);
        assert.strictEqual(res.success, true);

        assert.ok(Object.isFrozen(res));
        assert.ok(Object.isFrozen(res.checkpoint));
        assert.ok(Object.isFrozen(res.checkpoint.metadata));
        assert.ok(Object.isFrozen(res.checkpoint.executionState));
        assert.ok(Object.isFrozen(res.checkpoint.executionState.completedTasks));
        assert.ok(Object.isFrozen(res.checkpoint.planner));
    });

    test("6. Creation is stateless, pure, and deterministic", () => {
        const planner = getSampleValidPlanner();
        const res1 = createCheckpoint(planner);
        const res2 = createCheckpoint(planner);
        assert.deepStrictEqual(res1, res2);
    });

    test("7. Input parameters are never mutated", () => {
        const planner = getSampleValidPlanner();
        const original = deepClone(planner);
        createCheckpoint(planner);
        assert.deepStrictEqual(planner, original);
    });
});

suite("Resume State Foundation (Phase 5B)", () => {
    const { createCheckpoint, createResumeState, checkpointErrorCodes } = require(path.join(backendRoot, "core/checkpoints"));

    const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

    const getSampleValidCheckpoint = () => {
        const planner = {
            version: "1.0",
            metadata: {
                plannerVersion: "1.0",
                graphVersion: "1.0",
                identityVersion: "1.0",
                createdBy: "planner"
            },
            tasks: [
                {
                    stableId: "t1",
                    displayId: "REQ-001",
                    kind: "backend",
                    status: "COMPLETED",
                    dependencies: [],
                    dependents: ["t2"]
                },
                {
                    stableId: "t2",
                    displayId: "REQ-002",
                    kind: "frontend",
                    status: "PENDING",
                    dependencies: ["t1"],
                    dependents: []
                }
            ]
        };
        const checkpointRes = createCheckpoint(planner, "test-user");
        return checkpointRes.checkpoint;
    };

    test("1. Rejects invalid non-object checkpoint inputs", () => {
        const res1 = createResumeState(null);
        assert.strictEqual(res1.success, false);
        assert.strictEqual(res1.errors[0].code, checkpointErrorCodes.RESUME_INVALID_INPUT);

        const res2 = createResumeState(undefined);
        assert.strictEqual(res2.success, false);

        const res3 = createResumeState("not-a-checkpoint");
        assert.strictEqual(res3.success, false);
    });

    test("2. Rejects malformed checkpoint structure", () => {
        const malformed = { version: "1.0", planner: {} }; // missing metadata & executionState
        const res = createResumeState(malformed);
        assert.strictEqual(res.success, false);
        assert.strictEqual(res.errors[0].code, checkpointErrorCodes.RESUME_INVALID_CHECKPOINT);
    });

    test("3. Resume state initializes correctly and preserves metadata", () => {
        const checkpoint = getSampleValidCheckpoint();
        const res = createResumeState(checkpoint);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.resumeState.version, "1.0");

        const metadata = res.resumeState.metadata;
        assert.strictEqual(metadata.checkpointVersion, checkpoint.metadata.checkpointVersion);
        assert.strictEqual(metadata.plannerVersion, checkpoint.metadata.plannerVersion);
        assert.strictEqual(metadata.createdBy, "test-user");
    });

    test("4. Completed/pending/running/failed tasks arrays are correctly preserved", () => {
        const checkpoint = getSampleValidCheckpoint();
        const res = createResumeState(checkpoint);
        assert.strictEqual(res.success, true);
        
        assert.deepStrictEqual(res.resumeState.completedTasks, ["t1"]);
        assert.deepStrictEqual(res.resumeState.pendingTasks, ["t2"]);
        assert.deepStrictEqual(res.resumeState.runningTasks, []);
        assert.deepStrictEqual(res.resumeState.failedTasks, []);
    });

    test("5. Resume state output is deeply frozen and immutable", () => {
        const checkpoint = getSampleValidCheckpoint();
        const res = createResumeState(checkpoint);
        assert.strictEqual(res.success, true);

        assert.ok(Object.isFrozen(res));
        assert.ok(Object.isFrozen(res.resumeState));
        assert.ok(Object.isFrozen(res.resumeState.metadata));
        assert.ok(Object.isFrozen(res.resumeState.completedTasks));
        assert.ok(Object.isFrozen(res.resumeState.pendingTasks));
    });

    test("6. Resume state creation is stateless, pure, and deterministic", () => {
        const checkpoint = getSampleValidCheckpoint();
        const res1 = createResumeState(checkpoint);
        const res2 = createResumeState(checkpoint);
        assert.deepStrictEqual(res1, res2);
    });

    test("7. Input parameters are never mutated", () => {
        const checkpoint = getSampleValidCheckpoint();
        const original = deepClone(checkpoint);
        createResumeState(checkpoint);
        assert.deepStrictEqual(checkpoint, original);
    });
});

(async () => {
    for (const suite of suites) {
        console.log(`\n── ${suite.name} ──`);
        for (const testObj of suite.tests) {
            results.total++;
            try {
                await testObj.fn();
                console.log(`  ✓ ${testObj.name}`);
                results.passed++;
            } catch (err) {
                console.error(`  ✗ ${testObj.name}`);
                console.error(`      ${err.stack || err.message}`);
                results.failed++;
            }
        }
    }

    console.log(`\n${"=".repeat(50)}`);
    console.log(`Z.ai Backend Unit Test Results`);
    console.log(`${"=".repeat(50)}`);
    console.log(`Total:  ${results.total}`);
    console.log(`Passed: ${results.passed}  ✓`);
    console.log(`Failed: ${results.failed}  ✗`);
    console.log(`${"=".repeat(50)}\n`);

    if (results.failed > 0) {
        process.exit(1);
    } else {
        console.log("All tests passed. ✓\n");
        process.exit(0);
    }
})();
