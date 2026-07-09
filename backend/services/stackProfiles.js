const path = require("path");

// Helper to sanitize component name
const getCleanName = (name) => name.replace(/[^a-zA-Z0-9_-]/g, "");

// Common JSX syntax checking logic (moved from validationProfiles)
const validateJsxSyntax = (files) => {
    const errors = [];
    for (const file of files) {
        const filePath = file.name.replace(/\\/g, "/");
        if (filePath.endsWith(".jsx") || filePath.endsWith(".tsx")) {
            // Detect <{expr pattern — invalid dynamic component shorthand
            if (/<\{/.test(file.content)) {
                errors.push(
                    `File '${filePath}' contains invalid JSX syntax '<{...}'. ` +
                    `Dynamic components must be assigned to a capitalized variable: ` +
                    `const DynComp = myProp; return <DynComp />;`
                );
            }
            // Detect invalid closing tags with extra text or attributes (e.g., </h1 testing>)
            const invalidClosingTagRegex = /<\/([a-zA-Z0-9]+)\s+[^>]+>/g;
            let match;
            while ((match = invalidClosingTagRegex.exec(file.content)) !== null) {
                errors.push(
                    `File '${filePath}' contains invalid JSX closing tag '${match[0]}'. Closing tags must not contain attributes or extra text.`
                );
            }
        }
    }
    return errors;
};

const profiles = {
    "mern": {
        name: "mern",
        detect: (projectSpec) => {
            const tech = (
                (projectSpec.frontend || "") + " " +
                (projectSpec.backend || "") + " " +
                (projectSpec.database || "") + " " +
                (projectSpec.projectType || "")
            ).toLowerCase();
            const hasReact = tech.includes("react");
            const hasExpress = tech.includes("express");
            const hasMongo = tech.includes("mongo");
            const isMernType = tech.includes("mern");
            return (hasReact && hasExpress && hasMongo) || isMernType;
        },
        getFolderStructure: (projectSpec) => {
            const paths = [
                "frontend/src/main.jsx",
                "frontend/src/App.jsx",
                "frontend/src/index.css",
                "backend/server.js",
                "backend/app.js",
                "backend/middleware/authMiddleware.js",
                "backend/middleware/errorMiddleware.js",
                "backend/utils/generateToken.js"
            ];
            if (projectSpec.components) {
                projectSpec.components.forEach(c => {
                    const clean = getCleanName(c.name);
                    if (/navbar|footer|header|layout/i.test(clean)) {
                        paths.push(`frontend/src/components/layout/${clean}.jsx`);
                    } else if (/loader|error|protected|spinner|modal|alert/i.test(clean)) {
                        paths.push(`frontend/src/components/common/${clean}.jsx`);
                    } else {
                        paths.push(`frontend/src/components/${clean}.jsx`);
                    }
                });
            }
            if (projectSpec.pagesAndRoutes) {
                projectSpec.pagesAndRoutes.forEach(p => {
                    paths.push(`frontend/src/pages/${getCleanName(p.name)}.jsx`);
                });
            }
            if (projectSpec.databaseModels) {
                projectSpec.databaseModels.forEach(m => {
                    const clean = getCleanName(m.name);
                    paths.push(`backend/models/${clean}.js`);
                    paths.push(`backend/controllers/${clean.toLowerCase()}Controller.js`);
                    if (clean.toLowerCase() !== "user") {
                        paths.push(`backend/routes/${clean.toLowerCase()}Routes.js`);
                        paths.push(`frontend/src/services/${clean.toLowerCase()}Service.js`);
                    }
                });
            }
            paths.push("backend/controllers/authController.js");
            paths.push("backend/routes/authRoutes.js");
            paths.push("frontend/src/context/AuthContext.jsx");
            paths.push("frontend/src/hooks/useAuth.js");
            paths.push("frontend/src/services/api.js");
            paths.push("frontend/src/services/authService.js");
            return paths;
        },
        getScaffoldFiles: (projectSpec) => {
            const projName = (projectSpec.projectName || "project").toLowerCase().replace(/\s+/g, "-");
            return [
                {
                    name: ".gitignore",
                    content: `# Node.js\nnode_modules/\nnpm-debug.log*\n.env\n.env.local\n\n# Build outputs\nfrontend/dist/\nfrontend/.vite/\n\n# Logs\nlogs/\n*.log\n`
                },
                {
                    name: "frontend/package.json",
                    content: JSON.stringify({
                        name: `${projName}-frontend`,
                        private: true,
                        version: "0.0.0",
                        type: "module",
                        scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
                        dependencies: {
                            react: "^18.2.0",
                            "react-dom": "^18.2.0",
                            "react-router-dom": "^6.20.0",
                            axios: "^1.6.0",
                            "react-icons": "^4.12.0",
                            ...(projectSpec.importantDependencies || []).reduce((acc, dep) => {
                                const d = dep.toLowerCase();
                                if (!["react", "react-dom", "vite", "tailwindcss", "@vitejs/plugin-react",
                                      "react-router-dom", "axios", "react-icons"].includes(d) &&
                                    !["express", "mongoose", "jsonwebtoken", "bcryptjs", "bcrypt",
                                      "dotenv", "cors", "nodemon"].includes(d)) {
                                    acc[dep] = "latest";
                                }
                                return acc;
                            }, {})
                        },
                        devDependencies: {
                            "@vitejs/plugin-react": "^4.2.0",
                            autoprefixer: "^10.4.0",
                            postcss: "^8.4.0",
                            tailwindcss: "^3.4.0",
                            vite: "^5.0.0"
                        }
                    }, null, 2)
                },
                {
                    name: "frontend/vite.config.js",
                    content: `import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\n\nexport default defineConfig({\n  plugins: [react()],\n  server: {\n    port: 5173,\n    proxy: {\n      '/api': {\n        target: 'http://localhost:5000',\n        changeOrigin: true,\n      },\n    },\n  },\n})`
                },
                {
                    name: "frontend/tailwind.config.js",
                    content: `/** @type {import('tailwindcss').Config} */\nexport default {\n  content: [\n    "./index.html",\n    "./src/**/*.{js,ts,jsx,tsx}",\n  ],\n  theme: {\n    extend: {},\n  },\n  plugins: [],\n}`
                },
                {
                    name: "frontend/postcss.config.js",
                    content: `export default {\n  plugins: {\n    tailwindcss: {},\n    autoprefixer: {},\n  },\n}`
                },
                {
                    name: "frontend/index.html",
                    content: `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>${projectSpec.projectName}</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.jsx"></script>\n  </body>\n</html>`
                },
                {
                    name: "frontend/.env.example",
                    content: "VITE_API_URL=http://localhost:5000/api\n"
                },
                {
                    name: "backend/package.json",
                    content: JSON.stringify({
                        name: `${projName}-backend`,
                        version: "1.0.0",
                        description: `Backend API server for ${projectSpec.projectName}`,
                        main: "server.js",
                        scripts: { start: "node server.js", dev: "nodemon server.js" },
                        dependencies: {
                            express: "^4.18.2",
                            mongoose: "^8.0.0",
                            dotenv: "^16.3.1",
                            cors: "^2.8.5",
                            jsonwebtoken: "^9.0.2",
                            bcryptjs: "^2.4.3",
                            ...(projectSpec.importantDependencies || []).reduce((acc, dep) => {
                                const d = dep.toLowerCase();
                                if (["express", "mongoose", "dotenv", "cors", "jsonwebtoken", "bcryptjs",
                                     "bcrypt", "multer", "helmet", "morgan", "express-validator",
                                     "express-async-handler", "colors"].includes(d)) {
                                    acc[dep] = "latest";
                                }
                                return acc;
                            }, {})
                        },
                        devDependencies: {
                            nodemon: "^3.0.1"
                        }
                    }, null, 2)
                },
                {
                    name: "backend/.env.example",
                    content: "PORT=5000\nMONGO_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/portfolio?retryWrites=true&w=majority\nJWT_SECRET=your_super_secret_jwt_key_here_change_in_production\nNODE_ENV=development\n"
                },
                {
                    name: "backend/config/db.js",
                    content: `const mongoose = require('mongoose');\n\nconst connectDB = async () => {\n    try {\n        const conn = await mongoose.connect(process.env.MONGO_URI);\n        console.log(\`MongoDB Connected: \${conn.connection.host}\`);\n    } catch (error) {\n        console.error(\`MongoDB Connection Error: \${error.message}\`);\n        process.exit(1);\n    }\n};\n\nmodule.exports = connectDB;\n`
                },
                {
                    name: "backend/routes/healthRoutes.js",
                    content: `const express = require('express');\nconst router = express.Router();\n\nrouter.get('/', (req, res) => {\n    res.json({\n        success: true,\n        status: 'OK',\n        message: 'Server is running',\n        timestamp: new Date().toISOString(),\n        environment: process.env.NODE_ENV || 'development'\n    });\n});\n\nmodule.exports = router;\n`
                }
            ];
        },
        validate: (files, projectSpec) => {
            const errors = [];
            const required = [
                "frontend/src/main.jsx",
                "frontend/src/App.jsx",
                "frontend/src/index.css",
                "backend/server.js",
                "backend/package.json",
                "frontend/package.json",
                "backend/.env.example"
            ];
            required.forEach(rf => {
                if (!files.some(f => f.name === rf)) errors.push(`Missing required MERN file '${rf}'.`);
            });
            const html = files.find(f => f.name === "frontend/index.html");
            if (html && !/src\/main\.(jsx|js)/i.test(html.content)) {
                errors.push("frontend/index.html does not reference src/main.jsx entry point.");
            }
            const main = files.find(f => f.name === "frontend/src/main.jsx");
            if (main && !(/import\s+App/i.test(main.content) || main.content.includes("require('./App"))) {
                errors.push("frontend/src/main.jsx does not import the root App component.");
            }
            const app = files.find(f => f.name === "frontend/src/App.jsx");
            if (app && app.content.replace(/\s+/g, "").length < 90) {
                errors.push("frontend/src/App.jsx only contains boilerplate/placeholder code.");
            }
            const css = files.find(f => f.name === "frontend/src/index.css");
            if (css && !(/@tailwind|@import\s+['"]tailwindcss['"]/i.test(css.content))) {
                errors.push("frontend/src/index.css is missing Tailwind CSS directives (@tailwind base/components/utilities).");
            }
            errors.push(...validateJsxSyntax(files.filter(f => f.name.startsWith("frontend/"))));
            return errors;
        },
        buildStrategy: {
            install: [
                { dir: "backend", cmd: "npm install" },
                { dir: "frontend", cmd: "npm install" }
            ],
            build: [
                { dir: "frontend", cmd: "npm run build" }
            ]
        },
        previewStrategy: {
            type: "mern",
            backendStart: "node server.js",
            frontendStart: "vite",
            frontendDir: "frontend",
            backendDir: "backend",
            defaultBackendPort: 5000,
            defaultFrontendPort: 5173
        }
    },
    "react-vite": {
        name: "react-vite",
        detect: (projectSpec) => {
            const tech = (
                (projectSpec.frontend || "") + " " +
                (projectSpec.backend || "") + " " +
                (projectSpec.projectType || "")
            ).toLowerCase();
            return (tech.includes("react") || tech.includes("vite")) && !tech.includes("next") && !tech.includes("express") && !tech.includes("node");
        },
        getFolderStructure: (projectSpec) => {
            const paths = ["src/main.jsx", "src/App.jsx", "src/index.css"];
            if (projectSpec.components) {
                projectSpec.components.forEach(c => {
                    paths.push(`src/components/${getCleanName(c.name)}.jsx`);
                });
            }
            if (projectSpec.pagesAndRoutes) {
                projectSpec.pagesAndRoutes.forEach(p => {
                    paths.push(`src/pages/${getCleanName(p.name)}.jsx`);
                });
            }
            return paths;
        },
        getScaffoldFiles: (projectSpec) => {
            const projName = (projectSpec.projectName || "project").toLowerCase().replace(/\s+/g, "-");
            return [
                {
                    name: "package.json",
                    content: JSON.stringify({
                        name: projName,
                        private: true,
                        version: "0.0.0",
                        type: "module",
                        scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
                        dependencies: {
                            react: "^18.2.0",
                            "react-dom": "^18.2.0",
                            "lucide-react": "^0.263.1",
                            "framer-motion": "^11.0.0",
                            ...(projectSpec.importantDependencies || []).reduce((acc, dep) => {
                                const d = dep.toLowerCase();
                                if (!["react", "react-dom", "vite", "tailwindcss", "lucide-react", "framer-motion"].includes(d)) {
                                    acc[dep] = "latest";
                                }
                                return acc;
                            }, {})
                        },
                        devDependencies: {
                            "@types/react": "^18.2.0",
                            "@types/react-dom": "^18.2.0",
                            "@vitejs/plugin-react": "^4.2.0",
                            autoprefixer: "^10.4.0",
                            postcss: "^8.4.0",
                            tailwindcss: "^3.3.0",
                            vite: "^5.0.0"
                        }
                    }, null, 2)
                },
                {
                    name: "vite.config.js",
                    content: `import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\n\nexport default defineConfig({\n  plugins: [react()],\n})`
                },
                {
                    name: "tailwind.config.js",
                    content: `/** @type {import('tailwindcss').Config} */\nexport default {\n  content: [\n    "./index.html",\n    "./src/**/*.{js,ts,jsx,tsx}",\n  ],\n  theme: {\n    extend: {},\n  },\n  plugins: [],\n}`
                },
                {
                    name: "postcss.config.js",
                    content: `export default {\n  plugins: {\n    tailwindcss: {},\n    autoprefixer: {},\n  },\n}`
                },
                {
                    name: "index.html",
                    content: `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>${projectSpec.projectName}</title>\n  </head>\n  <body class="bg-gray-900 text-white">\n    <div id="root"></div>\n    <script type="module" src="/src/main.jsx"></script>\n  </body>\n</html>`
                }
            ];
        },
        validate: (files, projectSpec) => {
            const errors = [];
            const required = ["package.json", "index.html", "vite.config.js", "src/main.jsx", "src/App.jsx", "src/index.css"];
            required.forEach(rf => {
                if (!files.some(f => f.name === rf)) errors.push(`Missing required file '${rf}'.`);
            });
            const html = files.find(f => f.name === "index.html");
            if (html && !/src\/main\.(jsx|js)/i.test(html.content)) {
                errors.push("index.html does not reference a valid entry path (expected src/main.jsx or src/main.js).");
            }
            const main = files.find(f => f.name === "src/main.jsx" || f.name === "src/main.js");
            if (main && !(/import\s+App/i.test(main.content) || main.content.includes("require('./App"))) {
                errors.push("Entry module does not import the root application component 'App'.");
            }
            const app = files.find(f => f.name === "src/App.jsx");
            if (app && app.content.replace(/\s+/g, "").length < 90) {
                errors.push("src/App.jsx only contains boilerplate/placeholder code and lacks implementation of the requested project.");
            }
            errors.push(...validateJsxSyntax(files));
            return errors;
        },
        buildStrategy: {
            install: [{ dir: ".", cmd: "npm install" }],
            build: [{ dir: ".", cmd: "npm run build" }]
        },
        previewStrategy: {
            type: "vite",
            frontendStart: "vite",
            frontendDir: ".",
            defaultFrontendPort: 5173
        }
    },
    "nextjs": {
        name: "nextjs",
        detect: (projectSpec) => {
            const tech = (
                (projectSpec.frontend || "") + " " +
                (projectSpec.projectType || "")
            ).toLowerCase();
            return tech.includes("next");
        },
        getFolderStructure: (projectSpec) => {
            const paths = ["app/page.jsx", "app/layout.jsx", "app/globals.css"];
            if (projectSpec.components) {
                projectSpec.components.forEach(c => {
                    paths.push(`components/${getCleanName(c.name)}.jsx`);
                });
            }
            if (projectSpec.pagesAndRoutes) {
                projectSpec.pagesAndRoutes.forEach(p => {
                    paths.push(`app/${getCleanName(p.name).toLowerCase()}/page.jsx`);
                });
            }
            return paths;
        },
        getScaffoldFiles: (projectSpec) => {
            const projName = (projectSpec.projectName || "project").toLowerCase().replace(/\s+/g, "-");
            return [
                {
                    name: "package.json",
                    content: JSON.stringify({
                        name: projName,
                        version: "0.1.0",
                        private: true,
                        scripts: { dev: "next dev", build: "next build", start: "next start" },
                        dependencies: {
                            next: "^14.0.0",
                            react: "^18.2.0",
                            "react-dom": "^18.2.0",
                            ...(projectSpec.importantDependencies || []).reduce((acc, dep) => {
                                if (!["next", "react", "react-dom"].includes(dep.toLowerCase())) {
                                    acc[dep] = "latest";
                                }
                                return acc;
                            }, {})
                        },
                        devDependencies: {
                            "@types/node": "^20",
                            "@types/react": "^18",
                            "@types/react-dom": "^18",
                            autoprefixer: "^10.0.1",
                            postcss: "^8",
                            tailwindcss: "^3.3.0",
                            typescript: "^5"
                        }
                    }, null, 2)
                },
                {
                    name: "tailwind.config.js",
                    content: `module.exports = {\n  content: [\n    './pages/**/*.{js,ts,jsx,tsx,mdx}',\n    './components/**/*.{js,ts,jsx,tsx,mdx}',\n    './app/**/*.{js,ts,jsx,tsx,mdx}',\n  ],\n  theme: {\n    extend: {},\n  },\n  plugins: [],\n}`
                },
                {
                    name: "postcss.config.js",
                    content: `module.exports = {\n  plugins: {\n    tailwindcss: {},\n    autoprefixer: {},\n  },\n}`
                },
                {
                    name: "next.config.js",
                    content: `/** @type {import('next').NextConfig} */\nconst nextConfig = {\n  eslint: {\n    ignoreDuringBuilds: true,\n  },\n  typescript: {\n    ignoreBuildErrors: true,\n  },\n};\nmodule.exports = nextConfig;\n`
                }
            ];
        },
        validate: (files, projectSpec) => {
            const errors = [];
            const required = ["package.json", "next.config.js", "app/page.jsx", "app/layout.jsx"];
            required.forEach(rf => {
                if (!files.some(f => f.name === rf)) errors.push(`Missing required Next.js file '${rf}'.`);
            });
            return errors;
        },
        buildStrategy: {
            install: [{ dir: ".", cmd: "npm install" }],
            build: [{ dir: ".", cmd: "npm run build" }]
        },
        previewStrategy: {
            type: "next",
            frontendStart: "next dev",
            frontendDir: ".",
            defaultFrontendPort: 3000
        }
    },
    "express": {
        name: "express",
        detect: (projectSpec) => {
            const tech = (
                (projectSpec.backend || "") + " " +
                (projectSpec.projectType || "")
            ).toLowerCase();
            return (tech.includes("express") || tech.includes("node") || tech.includes("api")) && !tech.includes("react") && !tech.includes("fastapi") && !tech.includes("python");
        },
        getFolderStructure: (projectSpec) => {
            const paths = ["server.js", ".env.example"];
            if (projectSpec.databaseModels) {
                projectSpec.databaseModels.forEach(m => {
                    paths.push(`models/${getCleanName(m.name)}.js`);
                });
            }
            return paths;
        },
        getScaffoldFiles: (projectSpec) => {
            const projName = (projectSpec.projectName || "project").toLowerCase().replace(/\s+/g, "-");
            return [
                {
                    name: "package.json",
                    content: JSON.stringify({
                        name: projName,
                        version: "1.0.0",
                        main: "server.js",
                        scripts: { start: "node server.js", dev: "nodemon server.js" },
                        dependencies: {
                            express: "^4.18.2",
                            dotenv: "^16.3.1",
                            cors: "^2.8.5",
                            ...(projectSpec.importantDependencies || []).reduce((acc, dep) => {
                                if (!["express", "dotenv", "cors"].includes(dep.toLowerCase())) {
                                    acc[dep] = "latest";
                                }
                                return acc;
                            }, {})
                        },
                        devDependencies: {
                            nodemon: "^3.0.1"
                        }
                    }, null, 2)
                },
                {
                    name: ".env.example",
                    content: (projectSpec.environmentVariables || []).map(v => `${v}=placeholder_value`).join("\n") || "PORT=5000\n"
                }
            ];
        },
        validate: (files, projectSpec) => {
            const errors = [];
            const required = ["package.json", "server.js"];
            required.forEach(rf => {
                if (!files.some(f => f.name === rf)) errors.push(`Missing required Express file '${rf}'.`);
            });
            return errors;
        },
        buildStrategy: {
            install: [{ dir: ".", cmd: "npm install" }],
            build: []
        },
        previewStrategy: {
            type: "node",
            backendStart: "node server.js",
            backendDir: ".",
            defaultBackendPort: 5000
        }
    },
    "fastapi": {
        name: "fastapi",
        detect: (projectSpec) => {
            const tech = (
                (projectSpec.backend || "") + " " +
                (projectSpec.projectType || "")
            ).toLowerCase();
            return tech.includes("fastapi") || tech.includes("python");
        },
        getFolderStructure: (projectSpec) => {
            return ["main.py", "requirements.txt", ".env.example"];
        },
        getScaffoldFiles: (projectSpec) => {
            return [
                {
                    name: "requirements.txt",
                    content: [
                        "fastapi>=0.100.0",
                        "uvicorn>=0.22.0",
                        ...(projectSpec.importantDependencies || []).filter(dep => !["fastapi", "uvicorn"].includes(dep.toLowerCase()))
                    ].join("\n") + "\n"
                },
                {
                    name: ".env.example",
                    content: (projectSpec.environmentVariables || []).map(v => `${v}=placeholder_value`).join("\n") || "PORT=8000\n"
                }
            ];
        },
        validate: (files, projectSpec) => {
            const errors = [];
            const required = ["requirements.txt", "main.py"];
            required.forEach(rf => {
                if (!files.some(f => f.name === rf)) errors.push(`Missing required FastAPI file '${rf}'.`);
            });
            return errors;
        },
        buildStrategy: {
            install: [{ dir: ".", cmd: "pip install -r requirements.txt" }],
            build: []
        },
        previewStrategy: {
            type: "fastapi",
            backendStart: "uvicorn main:app",
            backendDir: ".",
            defaultBackendPort: 8000
        }
    },
    "vanilla": {
        name: "vanilla",
        detect: (projectSpec) => {
            return true; // Fallback profile
        },
        getFolderStructure: (projectSpec) => {
            const paths = ["index.html", "style.css", "script.js"];
            if (projectSpec.pagesAndRoutes) {
                projectSpec.pagesAndRoutes.forEach(p => {
                    paths.push(`${getCleanName(p.name).toLowerCase()}.html`);
                });
            }
            return paths;
        },
        getScaffoldFiles: (projectSpec) => {
            return [
                {
                    name: "index.html",
                    content: `<!DOCTYPE html>\n<html>\n<head>\n  <title>${projectSpec.projectName}</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <h1>Welcome to ${projectSpec.projectName}</h1>\n  <script src="script.js"></script>\n</body>\n</html>`
                },
                {
                    name: "style.css",
                    content: "body {\n  font-family: sans-serif;\n  background: #0f172a;\n  color: #f8fafc;\n  padding: 2rem;\n}\nh1 {\n  color: #38bdf8;\n}\n"
                },
                {
                    name: "script.js",
                    content: "console.log('Vanilla website running...');\n"
                }
            ];
        },
        validate: (files, projectSpec) => {
            const errors = [];
            const required = ["index.html"];
            required.forEach(rf => {
                if (!files.some(f => f.name === rf)) errors.push(`Missing required file '${rf}'.`);
            });
            return errors;
        },
        buildStrategy: {
            install: [],
            build: []
        },
        previewStrategy: {
            type: "static",
            frontendDir: ".",
            defaultFrontendPort: 8080
        }
    },
    "dynamic": {
        name: "dynamic",
        detect: (projectSpec) => false,
        getFolderStructure: (projectSpec) => {
            const paths = ["README.md"];
            const backend = ((projectSpec && projectSpec.backend) || "").toLowerCase();
            if (backend.includes("django")) {
                paths.push("manage.py", "requirements.txt");
            } else if (backend.includes("flask")) {
                paths.push("app.py", "requirements.txt");
            } else if (backend.includes("rails")) {
                paths.push("Gemfile", "config/routes.rb");
            } else if (backend.includes("go")) {
                paths.push("go.mod", "main.go");
            } else if (backend.includes("rust")) {
                paths.push("Cargo.toml", "src/main.rs");
            } else {
                paths.push("package.json", "index.html");
            }
            return paths;
        },
        getScaffoldFiles: (projectSpec) => {
            const backend = ((projectSpec && projectSpec.backend) || "").toLowerCase();
            if (backend.includes("django")) {
                return [
                    { name: "requirements.txt", content: "django>=4.0\n" },
                    { name: "manage.py", content: "#!/usr/bin/env python\n# Django entry\n" }
                ];
            } else if (backend.includes("flask")) {
                return [
                    { name: "requirements.txt", content: "flask>=2.0\n" },
                    { name: "app.py", content: "# Flask app\n" }
                ];
            } else if (backend.includes("rails")) {
                return [
                    { name: "Gemfile", content: "source 'https://rubygems.org'\ngem 'rails'\n" }
                ];
            } else if (backend.includes("go")) {
                return [
                    { name: "go.mod", content: "module main\ngo 1.18\n" },
                    { name: "main.go", content: "package main\nimport \"fmt\"\nfunc main() {\n\tfmt.Println(\"Go Running\")\n}\n" }
                ];
            } else if (backend.includes("rust")) {
                return [
                    { name: "Cargo.toml", content: "[package]\nname = \"rust-app\"\nversion = \"0.1.0\"\n" },
                    { name: "src/main.rs", content: "fn main() {\n    println!(\"Rust Running\");\n}\n" }
                ];
            } else {
                return [
                    { name: "package.json", content: "{\n  \"name\": \"dynamic-app\",\n  \"version\": \"1.0.0\"\n}\n" },
                    { name: "index.html", content: "<!DOCTYPE html><html><body>Dynamic Fallback App</body></html>\n" }
                ];
            }
        },
        validate: (files, projectSpec) => {
            const errors = [];
            return errors;
        },
        buildStrategy: {
            install: [],
            build: []
        },
        previewStrategy: {
            type: "static",
            frontendDir: ".",
            defaultFrontendPort: 8080
        }
    }
};

const detectProfile = (projectSpec) => {
    // Order of check matching
    const order = ["mern", "react-vite", "nextjs", "express", "fastapi"];
    let matchedKey = null;
    for (const key of order) {
        if (profiles[key].detect(projectSpec)) {
            matchedKey = key;
            break;
        }
    }

    if (!matchedKey) {
        const hasBackend = (projectSpec && projectSpec.backend && projectSpec.backend !== "None" && projectSpec.backend !== "");
        const hasDatabase = (projectSpec && projectSpec.database && projectSpec.database !== "None" && projectSpec.database !== "");

        if (!hasBackend && !hasDatabase) {
            matchedKey = "vanilla";
        } else {
            matchedKey = "dynamic";
        }
    }

    const matchedProfile = profiles[matchedKey];

    // Attach profile-specific preview timeout
    let timeoutMs = 90000; // Default
    if (matchedKey === "nextjs") timeoutMs = 240000;
    else if (matchedKey === "mern") timeoutMs = 180000;
    else if (matchedKey === "react-vite") timeoutMs = 150000;
    else if (matchedKey === "express") timeoutMs = 120000;
    else if (matchedKey === "fastapi") timeoutMs = 120000;
    else if (matchedKey === "vanilla") timeoutMs = 60000;

    return {
        ...matchedProfile,
        name: matchedKey,
        previewTimeoutMs: timeoutMs
    };
};

module.exports = {
    profiles,
    detectProfile,
    validateJsxSyntax
};
