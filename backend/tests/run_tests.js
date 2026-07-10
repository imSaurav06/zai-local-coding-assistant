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
