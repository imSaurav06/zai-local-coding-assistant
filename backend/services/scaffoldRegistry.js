const generateScaffoldFiles = (adapterName, projectSpec) => {
    const files = [];

    if (adapterName === "react-vite") {
        files.push({
            name: "package.json",
            content: JSON.stringify({
                name: (projectSpec.projectName || "project").toLowerCase(),
                private: true,
                version: "0.0.0",
                type: "module",
                scripts: {
                    dev: "vite",
                    build: "vite build",
                    preview: "vite preview"
                },
                dependencies: {
                    react: "^18.2.0",
                    "react-dom": "^18.2.0",
                    ...(projectSpec.importantDependencies || []).reduce((acc, dep) => {
                        if (!["react", "react-dom", "vite", "tailwindcss"].includes(dep.toLowerCase())) {
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
        });

        files.push({
            name: "vite.config.js",
            content: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})`
        });

        files.push({
            name: "tailwind.config.js",
            content: `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}`
        });

        files.push({
            name: "postcss.config.js",
            content: `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`
        });

        files.push({
            name: "index.html",
            content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectSpec.projectName}</title>
  </head>
  <body class="bg-gray-900 text-white">
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`
        });
    } else if (adapterName === "express") {
        files.push({
            name: "package.json",
            content: JSON.stringify({
                name: (projectSpec.projectName || "project").toLowerCase(),
                version: "1.0.0",
                main: "server.js",
                scripts: {
                    start: "node server.js",
                    dev: "nodemon server.js"
                },
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
        });

        files.push({
            name: ".env.example",
            content: (projectSpec.environmentVariables || []).map(v => `${v}=placeholder_value`).join("\n") || "PORT=5000\n"
        });
    } else if (adapterName === "fastapi") {
        files.push({
            name: "requirements.txt",
            content: [
                "fastapi>=0.100.0",
                "uvicorn>=0.22.0",
                ...(projectSpec.importantDependencies || []).filter(dep => !["fastapi", "uvicorn"].includes(dep.toLowerCase()))
            ].join("\n")
        });

        files.push({
            name: ".env.example",
            content: (projectSpec.environmentVariables || []).map(v => `${v}=placeholder_value`).join("\n") || "PORT=8000\n"
        });
    }

    return files;
};

module.exports = { generateScaffoldFiles };
