const fs = require("fs");
const path = require("path");
const cp = require("child_process");
const net = require("net");
const http = require("net"); // We will also require http below for static server
const httpModule = require("http");
const axios = require("axios");
const Project = require("../models/Project");
const stackProfiles = require("./stackProfiles");

const activePreviews = new Map();
const PREVIEWS_ROOT = path.resolve(__dirname, "../../temp_previews");

// Ensure previews root directory exists
if (!fs.existsSync(PREVIEWS_ROOT)) {
    fs.mkdirSync(PREVIEWS_ROOT, { recursive: true });
}

// Get free port helper
const getFreePort = () => {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.unref();
        server.on("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const { port } = server.address();
            server.close(() => resolve(port));
        });
    });
};

// Path safety helper
const safeWriteFile = (root, relativePath, content) => {
    if (relativePath.includes("\0")) {
        throw new Error("Null byte detected in path.");
    }
    // Resolve absolute path
    const absolutePath = path.resolve(root, relativePath);
    // Escape check
    if (!absolutePath.startsWith(root)) {
        throw new Error("Path traversal attempt detected.");
    }
    // Directory check
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    // Write content
    fs.writeFileSync(absolutePath, content, "utf8");
};

// Allowlisted package.json sanitizer
const sanitizePackageJson = (content) => {
    const pkg = JSON.parse(content);
    const ALLOWED_DEPS = new Set([
        // React ecosystem
        "react", "react-dom", "react-router-dom", "react-router",
        // UI & icons
        "lucide-react", "react-icons", "@heroicons/react", "@radix-ui/react-icons",
        // Animation & styling
        "framer-motion", "tailwindcss", "autoprefixer", "postcss", "styled-components",
        "@emotion/react", "@emotion/styled",
        // Vite & build tools
        "vite", "@vitejs/plugin-react", "@vitejs/plugin-react-swc",
        // Next.js dependencies
        "next",
        // Data fetching & state
        "axios", "swr", "@tanstack/react-query",
        // Charts & visualization
        "chart.js", "react-chartjs-2", "recharts", "d3",
        // Utilities
        "prop-types", "clsx", "classnames", "date-fns", "lodash",
        // Forms
        "react-hook-form", "formik", "yup", "zod",
        // Types (devDeps)
        "@types/react", "@types/react-dom", "@types/node", "@types/lodash", "@types/d3",
        // Other common React deps
        "react-hot-toast", "react-toastify", "sonner", "react-modal",
        "react-select", "react-dropzone", "react-markdown", "remark-gfm",
        // TypeScript (if used)
        "typescript",
        // Backend dependencies (for MERN package.json)
        "express", "mongoose", "dotenv", "cors", "jsonwebtoken", "bcryptjs", "bcrypt",
        "multer", "helmet", "morgan", "express-validator", "express-async-handler", "colors"
    ]);

    const sanitized = {
        name: (pkg.name || "preview-app").toLowerCase(),
        private: true,
        version: "0.0.0",
        type: pkg.type || (pkg.main ? undefined : "module"),
        scripts: {
            dev: pkg.scripts?.dev || "vite",
            build: pkg.scripts?.build || "vite build",
            preview: pkg.scripts?.preview || "vite preview",
            start: pkg.scripts?.start || (pkg.main ? `node ${pkg.main}` : undefined)
        },
        dependencies: {},
        devDependencies: {}
    };

    if (pkg.dependencies) {
        for (const [dep, ver] of Object.entries(pkg.dependencies)) {
            if (ALLOWED_DEPS.has(dep) || ALLOWED_DEPS.has(dep.toLowerCase())) {
                sanitized.dependencies[dep] = ver;
            }
        }
    }
    if (pkg.devDependencies) {
        for (const [dep, ver] of Object.entries(pkg.devDependencies)) {
            if (ALLOWED_DEPS.has(dep) || ALLOWED_DEPS.has(dep.toLowerCase())) {
                sanitized.devDependencies[dep] = ver;
            }
        }
    }

    // Force Vite setup only if NOT a backend app or Next.js app
    if (!pkg.main && !pkg.dependencies?.next) {
        if (!sanitized.devDependencies.vite && !sanitized.dependencies.vite) {
            sanitized.devDependencies.vite = "^5.0.0";
        }
        if (!sanitized.devDependencies["@vitejs/plugin-react"] && !sanitized.dependencies["@vitejs/plugin-react"]) {
            sanitized.devDependencies["@vitejs/plugin-react"] = "^4.2.0";
        }
    }

    return JSON.stringify(sanitized, null, 2);
};

// Env sanitizer
const getSanitizedEnv = () => {
    const safeKeys = ["PATH", "SYSTEMROOT", "TEMP", "TMP", "USERPROFILE", "HOME", "COMSPEC", "PATHEXT"];
    const safeEnv = {};
    for (const key of safeKeys) {
        // Case insensitive lookup
        const actualKey = Object.keys(process.env).find(k => k.toUpperCase() === key.toUpperCase());
        if (actualKey && process.env[actualKey] !== undefined) {
            safeEnv[key] = String(process.env[actualKey]);
        }
    }
    // Safe fallbacks
    if (!safeEnv.PATH) {
        safeEnv.PATH = process.env.PATH || "";
    }
    if (process.platform === "win32" && !safeEnv.SYSTEMROOT) {
        safeEnv.SYSTEMROOT = process.env.SystemRoot || process.env.SYSTEMROOT || "C:\\Windows";
    }
    return safeEnv;
};

// Cwd validator
const validateCwd = (cwd) => {
    if (!cwd) {
        throw new Error("Working directory (cwd) is not specified.");
    }
    const resolvedCwd = path.resolve(cwd);
    if (!fs.existsSync(resolvedCwd)) {
        throw new Error(`Working directory (cwd) does not exist: ${resolvedCwd}`);
    }
    const stat = fs.statSync(resolvedCwd);
    if (!stat.isDirectory()) {
        throw new Error(`Working directory (cwd) is not a directory: ${resolvedCwd}`);
    }
    // Check if within PREVIEWS_ROOT (canonical path safety check)
    if (!resolvedCwd.startsWith(PREVIEWS_ROOT)) {
        throw new Error(`Security Violation: working directory is outside the allowed previews root folder: ${resolvedCwd}`);
    }
    // Check package.json presence (at root or frontend/ package.json for MERN)
    const pkgPath = path.join(resolvedCwd, "package.json");
    const frontendPkgPath = path.join(resolvedCwd, "frontend", "package.json");
    const indexHtmlPath = path.join(resolvedCwd, "index.html"); // for Vanilla
    if (!fs.existsSync(pkgPath) && !fs.existsSync(frontendPkgPath) && !fs.existsSync(indexHtmlPath)) {
        throw new Error(`Missing project entry file in working directory: ${resolvedCwd}`);
    }
};

// Spawn diagnostics logger
const logSpawnDiagnostics = (executable, args, cwd, env, error) => {
    let cwdExists = false;
    let pkgExists = false;
    try {
        cwdExists = fs.existsSync(cwd);
        if (cwdExists) {
            pkgExists = fs.existsSync(path.join(cwd, "package.json"));
        }
    } catch (e) {}

    const sanitizedKeys = Object.keys(env || {});
    const pathAvailable = !!(env && (env.PATH || env.Path || env.path));

    console.error("[Preview Service] Spawn diagnostics:", {
        platform: process.platform,
        executable,
        args,
        cwd,
        cwdExists,
        packageJsonExists: pkgExists,
        sanitizedEnvKeys: sanitizedKeys,
        pathAvailable,
        errorMessage: error?.message || "none"
    });
};

const getSessionMetadata = (session) => {
    return {
        projectId: session.projectId,
        status: session.status,
        port: session.port,
        url: session.status === "READY" ? `http://localhost:${session.port}` : null,
        errors: session.errors,
        timeoutMs: session.previewTimeoutMs || 90000
    };
};

const startStaticServer = (dirPath, port) => {
    const mimeTypes = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'text/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon'
    };

    const server = httpModule.createServer((req, res) => {
        // Resolve target file path (prevent directory traversal)
        let safeUrl = req.url.split('?')[0];
        if (safeUrl === '/') {
            safeUrl = '/index.html';
        }
        const filePath = path.join(dirPath, safeUrl);
        const resolvedPath = path.resolve(filePath);

        if (!resolvedPath.startsWith(dirPath)) {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            return res.end('403 Forbidden');
        }

        const ext = path.extname(resolvedPath).toLowerCase();
        const contentType = mimeTypes[ext] || 'application/octet-stream';

        fs.readFile(resolvedPath, (err, content) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    res.writeHead(404, { 'Content-Type': 'text/html' });
                    res.end('<h1>404 Not Found</h1>', 'utf-8');
                } else {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end(`500 Internal Error: ${err.code}`);
                }
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content, 'utf-8');
            }
        });
    });

    server.listen(port, "127.0.0.1");
    return server;
};

const setupAndStartServer = async (session, project) => {
    session.status = "VALIDATING";

    const profile = stackProfiles.detectProfile(project.projectSpec || {});
    const isMern = profile.name === "mern";

    let child = null;
    let backendChild = null;
    let backendPort = null;
    if (isMern) {
        backendPort = await getFreePort();
        session.backendPort = backendPort;
    }

    // Precondition Checks
    try {
        // 1. Write the project files into the temporary directory first
        project.files.forEach(file => {
            let content = file.content;
            if (file.name === "package.json" || file.name === "frontend/package.json" || file.name === "backend/package.json") {
                try {
                    content = sanitizePackageJson(content);
                } catch (e) {
                    throw new Error(`Failed parsing ${file.name}: ${e.message}`);
                }
            }
            if (isMern && file.name === "frontend/vite.config.js" && backendPort) {
                // Replace proxy target port 5000 with our dynamically allocated backendPort
                content = content.replace(/http:\/\/localhost:5000/g, `http://localhost:${backendPort}`);
                content = content.replace(/127\.0\.0\.1:5000/g, `127.0.0.1:${backendPort}`);
                content = content.replace(/:5000/g, `:${backendPort}`);
            }
            safeWriteFile(session.dirPath, file.name, content);
        });

        // Write custom environment files for MERN
        if (isMern && backendPort) {
            const envContent = `PORT=${backendPort}
MONGO_URI=${process.env.MONGO_URI || "mongodb://127.0.0.1:27017/portfolio-test"}
JWT_SECRET=${process.env.JWT_SECRET || "super_secret_jwt_key_12345"}
NODE_ENV=development
`;
            safeWriteFile(session.dirPath, "backend/.env", envContent);

            const frontendEnvContent = `VITE_API_URL=/api
`;
            safeWriteFile(session.dirPath, "frontend/.env", frontendEnvContent);
        }

        // 2. Validate workspace path exists and is secure
        validateCwd(session.dirPath);

        // 3. Run Generated Content Guard
        const { applyContentGuard } = require("./generationOrchestrator");
        const guardErrors = applyContentGuard(project.files);
        if (guardErrors.length > 0) {
            throw new Error(`Content Guard: ${guardErrors.join("; ")}`);
        }

        // 4. Run JS/JSX syntax validation
        const { validateSyntax } = require("../utils/syntaxValidator");
        const syntaxErrors = validateSyntax(project.files);
        if (syntaxErrors.length > 0) {
            const syntaxMsgs = syntaxErrors.map(e => `${e.filePath}: ${e.reason}`);
            throw new Error(`Syntax Error: ${syntaxMsgs.join("; ")}`);
        }

        // 5. Run existing stack-aware project validation
        const { validateProjectFiles } = require("./validationProfiles");
        const projectErrors = validateProjectFiles(project.files, project.projectSpec || {});
        if (projectErrors.length > 0) {
            throw new Error(`Project integrity validation failed: ${projectErrors.join("; ")}`);
        }
    } catch (err) {
        session.status = "FAILED";
        session.errors.push(err.message);
        // Clean up temporary workspace directory
        if (fs.existsSync(session.dirPath)) {
            try { fs.rmSync(session.dirPath, { recursive: true, force: true }); } catch (e) {}
        }
        return;
    }

    session.status = "BUILDING";

    const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
    const spawnEnv = getSanitizedEnv();
    const spawnOptions = {
        cwd: session.dirPath,
        env: spawnEnv,
        shell: process.platform === "win32"
    };

    const runProcess = (cmd, args, subCwd = session.dirPath) => {
        return new Promise((resolve, reject) => {
            let proc;
            try {
                proc = cp.spawn(cmd, args, {
                    ...spawnOptions,
                    cwd: subCwd
                });
            } catch (err) {
                return reject(err);
            }
            let out = "";
            let errOut = "";
            let finished = false;
            proc.stdout.on("data", data => out += data.toString());
            proc.stderr.on("data", data => errOut += data.toString());
            
            const handleFinish = (code) => {
                if (finished) return;
                finished = true;
                if (code === 0 || code === null) {
                    resolve({ code: code || 0, out, errOut });
                } else {
                    reject(new Error(`Command '${cmd} ${args.join(" ")}' in '${subCwd}' failed with exit code ${code}. ${errOut || out}`));
                }
            };

            proc.on("exit", code => handleFinish(code));
            proc.on("close", code => handleFinish(code));
            proc.on("error", err => {
                if (finished) return;
                finished = true;
                reject(err);
            });
        });
    };

    try {
        const installSteps = profile.buildStrategy?.install || [];
        for (const step of installSteps) {
            const parts = step.cmd.split(" ");
            const baseCmd = parts[0];
            const args = parts.slice(1);
            let executable = baseCmd;
            if (baseCmd === "npm") executable = npmCmd;
            else if (baseCmd === "pip") executable = process.platform === "win32" ? "pip.exe" : "pip";

            console.log(`[Preview Service] Running install step '${step.cmd}' in '${step.dir}'...`);
            await runProcess(executable, args, path.join(session.dirPath, step.dir));
        }

        const buildSteps = profile.buildStrategy?.build || [];
        for (const step of buildSteps) {
            const parts = step.cmd.split(" ");
            const baseCmd = parts[0];
            const args = parts.slice(1);
            let executable = baseCmd;
            if (baseCmd === "npm") executable = npmCmd;

            console.log(`[Preview Service] Running build step '${step.cmd}' in '${step.dir}'...`);
            await runProcess(executable, args, path.join(session.dirPath, step.dir));
        }
    } catch (err) {
        session.status = "FAILED";
        session.errors.push(err.message);
        // Clean up temporary workspace directory
        if (fs.existsSync(session.dirPath)) {
            try { fs.rmSync(session.dirPath, { recursive: true, force: true }); } catch (e) {}
        }
        return;
    }

    session.status = "STARTING";

    const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
    const handleFailure = (reason) => {
        if (session.status === "READY" || session.status === "FAILED" || session.status === "stopped") return;
        session.status = "FAILED";
        session.errors.push(reason);
        if (child) {
            try { child.kill("SIGKILL"); } catch (e) {}
        }
        if (backendChild) {
            try { backendChild.kill("SIGKILL"); } catch (e) {}
        }
        if (session.staticServer) {
            try { session.staticServer.close(); } catch (e) {}
        }
        if (fs.existsSync(session.dirPath)) {
            try { fs.rmSync(session.dirPath, { recursive: true, force: true }); } catch (e) {}
        }
    };

    const runBackendReadinessPolling = async () => {
        session.status = "STARTING";
        const url = `http://127.0.0.1:${session.port}/health`;
        let attempt = 0;
        const deadlineMs = profile.previewTimeoutMs || 180000;
        const intervalMs = 1000;
        const maxAttempts = Math.ceil(deadlineMs / intervalMs);

        while (attempt < maxAttempts) {
            if (session.status === "FAILED" || session.status === "stopped") {
                return;
            }

            if (backendChild && backendChild.exitCode !== null) {
                handleFailure(`Backend process exited early with code ${backendChild.exitCode}`);
                return;
            }

            try {
                // Poll configured health endpoint or base url
                await axios.get(url, {
                    timeout: 1000,
                    validateStatus: () => true
                });

                session.status = "READY";
                console.log(`[Preview Service] Backend readiness check succeeded. Live Preview is READY!`);
                return;
            } catch (err) {
                attempt++;
                if (attempt >= maxAttempts) {
                    handleFailure(`Backend server did not become healthy within timeout: ${err.message}`);
                    return;
                }
                await new Promise(r => setTimeout(r, intervalMs));
            }
        }
    };

    // ── STATIC SERVER (Vanilla HTML) ──
    if (profile.previewStrategy.type === "static") {
        console.log(`[Preview Service] Starting in-process static server on port ${session.port}...`);
        try {
            session.staticServer = startStaticServer(session.dirPath, session.port);
            session.status = "READY";
            console.log(`[Preview Service] Static server started successfully. Preview is READY!`);
            return;
        } catch (e) {
            handleFailure(`Failed starting static server: ${e.message}`);
            return;
        }
    }

    // Spawn backend server if MERN
    if (profile.previewStrategy.type === "mern" && backendPort) {
        console.log(`[Preview Service] Starting MERN backend server on port ${backendPort}...`);
        const nodeCmd = process.platform === "win32" ? "node.exe" : "node";
        const backendEnv = {
            ...process.env,
            ...getSanitizedEnv(),
            MONGO_URI: process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/z-ai-preview",
            MONGODB_URI: process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/z-ai-preview",
            PORT: backendPort.toString()
        };

        try {
            backendChild = cp.spawn(nodeCmd, ["server.js"], {
                cwd: path.join(session.dirPath, "backend"),
                env: backendEnv,
                shell: process.platform === "win32"
            });
            session.backendProcess = backendChild;

            backendChild.stdout.on("data", (data) => {
                console.log(`[Backend Process stdout]: ${data.toString().trim()}`);
            });
            backendChild.stderr.on("data", (data) => {
                console.error(`[Backend Process stderr]: ${data.toString().trim()}`);
            });
            backendChild.on("close", (code) => {
                console.warn(`[Backend Process] backend server closed with code ${code}`);
                if (session.status !== "stopped" && session.status !== "READY" && session.status !== "FAILED") {
                    handleFailure(`MERN Backend server closed early with code ${code}`);
                }
            });
            backendChild.on("error", (err) => {
                console.error(`[Backend Process] backend error:`, err);
                handleFailure(`MERN Backend process error: ${err.message}`);
            });
        } catch (err) {
            session.status = "FAILED";
            session.errors.push(`Failed to spawn MERN backend: ${err.message}`);
            if (fs.existsSync(session.dirPath)) {
                try { fs.rmSync(session.dirPath, { recursive: true, force: true }); } catch (e) {}
            }
            return;
        }
    }

    // Spawn regular backend (express, fastapi)
    if (profile.previewStrategy.type === "node" || profile.previewStrategy.type === "fastapi") {
        console.log(`[Preview Service] Starting single-tier backend on port ${session.port}...`);
        const parts = profile.previewStrategy.backendStart.split(" ");
        let executable = parts[0];
        if (executable === "node") executable = process.platform === "win32" ? "node.exe" : "node";
        else if (executable === "python") executable = process.platform === "win32" ? "python.exe" : "python";
        else if (executable === "uvicorn") executable = process.platform === "win32" ? "uvicorn.exe" : "uvicorn";

        const args = parts.slice(1);
        if (profile.previewStrategy.type === "fastapi") {
            args.push("--port", session.port.toString(), "--host", "127.0.0.1");
        }

        const backendEnv = {
            ...process.env,
            ...getSanitizedEnv(),
            MONGO_URI: process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/z-ai-preview",
            MONGODB_URI: process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/z-ai-preview",
            PORT: session.port.toString()
        };

        try {
            backendChild = cp.spawn(executable, args, {
                cwd: path.join(session.dirPath, profile.previewStrategy.backendDir || "."),
                env: backendEnv,
                shell: process.platform === "win32"
            });
            session.backendProcess = backendChild;

            backendChild.stdout.on("data", (data) => {
                console.log(`[Backend Process stdout]: ${data.toString().trim()}`);
            });
            backendChild.stderr.on("data", (data) => {
                console.error(`[Backend Process stderr]: ${data.toString().trim()}`);
            });
            backendChild.on("close", (code) => {
                console.warn(`[Backend Process] server closed with code ${code}`);
                if (session.status !== "stopped" && session.status !== "READY" && session.status !== "FAILED") {
                    handleFailure(`Backend server closed early with code ${code}`);
                }
            });
            backendChild.on("error", (err) => {
                console.error(`[Backend Process] backend error:`, err);
                handleFailure(`Backend process error: ${err.message}`);
            });

            // Transition to healthcheck directly for node/fastapi backend
            runBackendReadinessPolling().catch(err => {
                handleFailure(err.message);
            });
            return;
        } catch (err) {
            session.status = "FAILED";
            session.errors.push(`Failed to spawn backend: ${err.message}`);
            if (fs.existsSync(session.dirPath)) {
                try { fs.rmSync(session.dirPath, { recursive: true, force: true }); } catch (e) {}
            }
            return;
        }
    }

    // Spawn frontend server (Vite, Next.js)
    const frontendCwd = isMern ? path.join(session.dirPath, "frontend") : session.dirPath;
    let args = [];
    if (profile.previewStrategy.type === "next") {
        args = ["next", "dev", "--port", session.port.toString()];
    } else {
        // default: vite
        args = ["vite", "--port", session.port.toString(), "--strictPort", "--host", "127.0.0.1"];
    }

    try {
        child = cp.spawn(npxCmd, args, {
            ...spawnOptions,
            cwd: frontendCwd
        });
    } catch (err) {
        session.status = "FAILED";
        session.errors.push(`Spawn failed: ${err.message}`);
        if (backendChild) {
            try { backendChild.kill("SIGKILL"); } catch (e) {}
        }
        if (fs.existsSync(session.dirPath)) {
            try { fs.rmSync(session.dirPath, { recursive: true, force: true }); } catch (e) {}
        }
        return;
    }
    session.childProcess = child;

    const detectFailurePattern = (str) => {
        const lower = str.toLowerCase();
        return lower.includes("vite compilation error") ||
               lower.includes("babel parser error") ||
               lower.includes("plugin:vite:react-babel") ||
               lower.includes("failed to resolve import") ||
               lower.includes("internal server error") ||
               lower.includes("syntaxerror") ||
               (lower.includes("syntax error") && !lower.includes("no syntax errors"));
    };

    const runDeepHealthCheck = async () => {
        const url = `http://127.0.0.1:${session.port}`;
        let attempt = 0;
        const maxAttempts = 40;
        while (attempt < maxAttempts) {
            if (session.status === "FAILED" || session.status === "stopped") {
                return;
            }
            try {
                const response = await axios.get(url, {
                    timeout: 2000,
                    headers: { 'Accept': 'text/html' }
                });

                if (response.status !== 200) {
                    throw new Error(`Health check returned non-200 status code: ${response.status}`);
                }

                const html = response.data;

                if (html.includes("vite-error-overlay") ||
                    html.includes("vite-error") ||
                    html.includes("Vite Error") ||
                    html.includes("Internal Server Error") ||
                    html.includes("Failed to resolve import")) {
                    throw new Error("Vite error overlay detected in health check response.");
                }

                const hasRoot = html.includes('id="root"');
                const hasMain = html.includes('src="/src/main.jsx"') || html.includes('src="/src/main.js"') || html.includes('src="/_next/');
                if (!hasRoot && !hasMain && profile.previewStrategy.type !== "next") {
                    throw new Error("HTML response missing deterministic entry marker (id='root' or src='/src/main.jsx').");
                }

                // Reachable ONLY from HEALTH_CHECKING
                if (session.status === "HEALTH_CHECKING") {
                    session.status = "READY";
                    console.log(`[Preview Service] Health check succeeded. Live Preview is READY!`);
                }
                return;
            } catch (err) {
                if (err.message.includes("Vite error overlay") || err.message.includes("missing deterministic entry marker") || err.message.includes("non-200")) {
                    throw err;
                }
                attempt++;
                if (attempt >= maxAttempts) {
                    throw new Error(`Frontend server did not become healthy within timeout: ${err.message}`);
                }
                await new Promise(r => setTimeout(r, 500));
            }
        }
    };

    const transitionToHealthChecking = async () => {
        if (session.status !== "STARTING") return;
        session.status = "HEALTH_CHECKING";
        try {
            await runDeepHealthCheck();
        } catch (err) {
            handleFailure(err.message);
        }
    };

    child.stdout.on("data", (data) => {
        const str = data.toString();
        console.log(`[Preview Process stdout]: ${str.trim()}`);
        if (session.status === "STARTING") {
            if (str.includes("ready in") || str.includes("Local:") || str.includes("Network:") || str.includes("started server")) {
                transitionToHealthChecking();
            }
        }
        if (detectFailurePattern(str)) {
            handleFailure(`Frontend compilation error detected: ${str.trim()}`);
        }
    });

    child.stderr.on("data", (data) => {
        const str = data.toString();
        console.error(`[Preview Process stderr]: ${str.trim()}`);
        if (session.status === "STARTING") {
            if (str.includes("ready in") || str.includes("Local:") || str.includes("Network:") || str.includes("started server")) {
                transitionToHealthChecking();
            }
        }
        if (detectFailurePattern(str)) {
            handleFailure(`Frontend compilation error detected: ${str.trim()}`);
        }
    });

    child.on("close", (code) => {
        console.warn(`[Preview Process] frontend closed with code ${code}`);
        if (session.status !== "stopped" && session.status !== "READY" && session.status !== "FAILED") {
            handleFailure(`Vite server closed early with code ${code}`);
        }
    });

    child.on("error", (err) => {
        console.error(`[Preview Process] frontend error:`, err);
        handleFailure(err.message);
    });
};

const cleanupSession = async (session) => {
    session.status = "NOT_STARTED";
    if (session.expiryTimer) {
        clearTimeout(session.expiryTimer);
    }

    // Kill processes
    if (session.childProcess) {
        try {
            session.childProcess.kill("SIGKILL");
        } catch (e) {
            // Ignore kill errors
        }
    }
    if (session.backendProcess) {
        try {
            session.backendProcess.kill("SIGKILL");
        } catch (e) {
            // Ignore kill errors
        }
    }
    if (session.staticServer) {
        try {
            session.staticServer.close();
        } catch (e) {
            // Ignore static server close errors
        }
    }

    // Delete temp folder recursively (with retries on Windows to allow file handles to be released)
    if (session.dirPath && fs.existsSync(session.dirPath)) {
        const removeDir = (dir, attempt = 1) => {
            try {
                fs.rmSync(dir, { recursive: true, force: true });
            } catch (e) {
                if (attempt < 4) {
                    setTimeout(() => removeDir(dir, attempt + 1), 500 * attempt);
                } else {
                    console.error(`Failed to delete preview dir after multiple attempts: ${e.message}`);
                }
            }
        };
        removeDir(session.dirPath);
    }

    activePreviews.delete(session.projectId);
};

const resetExpiryTimer = (projectId) => {
    const session = activePreviews.get(projectId);
    if (!session) return;

    if (session.expiryTimer) {
        clearTimeout(session.expiryTimer);
    }

    // 10 minutes expiry timer
    session.expiryTimer = setTimeout(() => {
        console.warn(`[Preview Service] Session expired for ${projectId} due to inactivity.`);
        cleanupSession(session);
    }, 600000);
};

const startPreview = async (projectId, userId) => {
    // 1. Ownership & Project verify
    const project = await Project.findById(projectId);
    if (!project) {
        throw new Error("Project not found");
    }
    if (project.userId.toString() !== userId.toString()) {
        const forbiddenErr = new Error("Forbidden");
        forbiddenErr.status = 403;
        throw forbiddenErr;
    }

    // Check compatibility: must have package.json or frontend/package.json or index.html for Vanilla
    const packageJsonFile = project.files.find(f => f.name === "package.json" || f.name === "frontend/package.json" || f.name === "index.html");
    if (!packageJsonFile) {
        throw new Error("Preview is only supported for compatible projects (missing entry package.json or index.html).");
    }

    // 2. Duplicate start check
    if (activePreviews.has(projectId)) {
        const session = activePreviews.get(projectId);
        session.lastActive = Date.now();
        resetExpiryTimer(projectId);
        return getSessionMetadata(session);
    }

    // 3. Initiate new preview session
    const port = await getFreePort();
    const folderName = `${projectId}_${Date.now()}`;
    const dirPath = path.join(PREVIEWS_ROOT, folderName);
    fs.mkdirSync(dirPath, { recursive: true });

    // Canonical dir path
    const canonicalRoot = fs.realpathSync(dirPath);

    const profile = stackProfiles.detectProfile(project.projectSpec || {});
    const session = {
        projectId,
        port,
        status: "VALIDATING",
        dirPath: canonicalRoot,
        childProcess: null,
        backendProcess: null,
        staticServer: null,
        previewTimeoutMs: profile.previewTimeoutMs || 90000,
        lastActive: Date.now(),
        errors: [],
        expiryTimer: null
    };

    activePreviews.set(projectId, session);
    resetExpiryTimer(projectId);

    // Setup files in background
    setupAndStartServer(session, project).catch(err => {
        console.error(`[Preview Service] Background setup failed for ${projectId}:`, err.message);
        session.status = "FAILED";
        session.errors.push(err.message);
    });

    return getSessionMetadata(session);
};

const getPreviewStatus = async (projectId, userId) => {
    const session = activePreviews.get(projectId);
    if (!session) {
        return { status: "NOT_STARTED" };
    }
    // Verify ownership
    const project = await Project.findById(projectId);
    if (!project || project.userId.toString() !== userId.toString()) {
        const forbiddenErr = new Error("Forbidden");
        forbiddenErr.status = 403;
        throw forbiddenErr;
    }

    session.lastActive = Date.now();
    resetExpiryTimer(projectId);
    return getSessionMetadata(session);
};

const stopPreview = async (projectId, userId) => {
    const session = activePreviews.get(projectId);
    if (!session) {
        return { status: "NOT_STARTED" };
    }
    // Verify ownership
    const project = await Project.findById(projectId);
    if (!project || project.userId.toString() !== userId.toString()) {
        const forbiddenErr = new Error("Forbidden");
        forbiddenErr.status = 403;
        throw forbiddenErr;
    }

    await cleanupSession(session);
    return { status: "NOT_STARTED" };
};

// Cleanup all active previews on backend shutdown
const cleanupAll = () => {
    console.log("[Preview Service] Cleaning up all active preview sessions...");
    for (const session of activePreviews.values()) {
        if (session.childProcess) {
            try {
                session.childProcess.kill("SIGKILL");
            } catch (e) {}
        }
        if (session.backendProcess) {
            try {
                session.backendProcess.kill("SIGKILL");
            } catch (e) {}
        }
        if (session.staticServer) {
            try {
                session.staticServer.close();
            } catch (e) {}
        }
        if (session.dirPath && fs.existsSync(session.dirPath)) {
            try {
                fs.rmSync(session.dirPath, { recursive: true, force: true });
            } catch (e) {}
        }
    }
    activePreviews.clear();
};

process.on("exit", cleanupAll);
process.on("SIGINT", () => {
    cleanupAll();
    process.exit();
});
process.on("SIGTERM", () => {
    cleanupAll();
    process.exit();
});

module.exports = {
    startPreview,
    getPreviewStatus,
    stopPreview,
    cleanupAll,
    activePreviews,
    sanitizePackageJson
};
