const fs = require("fs");
const path = require("path");
const cp = require("child_process");
const net = require("net");
const axios = require("axios");
const Project = require("../models/Project");

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
        "react", "react-dom", "react-router-dom", "lucide-react", "react-icons",
        "framer-motion", "tailwindcss", "autoprefixer", "postcss", "vite", "@vitejs/plugin-react",
        "chart.js", "react-chartjs-2", "axios", "prop-types"
    ]);

    const sanitized = {
        name: (pkg.name || "preview-app").toLowerCase(),
        private: true,
        version: "0.0.0",
        type: "module",
        scripts: {
            dev: "vite",
            build: "vite build"
        },
        dependencies: {},
        devDependencies: {}
    };

    if (pkg.dependencies) {
        for (const [dep, ver] of Object.entries(pkg.dependencies)) {
            if (ALLOWED_DEPS.has(dep.toLowerCase())) {
                sanitized.dependencies[dep] = ver;
            }
        }
    }
    if (pkg.devDependencies) {
        for (const [dep, ver] of Object.entries(pkg.devDependencies)) {
            if (ALLOWED_DEPS.has(dep.toLowerCase())) {
                sanitized.devDependencies[dep] = ver;
            }
        }
    }

    // Force Vite setup
    if (!sanitized.devDependencies.vite && !sanitized.dependencies.vite) {
        sanitized.devDependencies.vite = "^5.0.0";
    }
    if (!sanitized.devDependencies["@vitejs/plugin-react"] && !sanitized.dependencies["@vitejs/plugin-react"]) {
        sanitized.devDependencies["@vitejs/plugin-react"] = "^4.2.0";
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
    // Check package.json presence
    const pkgPath = path.join(resolvedCwd, "package.json");
    if (!fs.existsSync(pkgPath)) {
        throw new Error(`Missing package.json in working directory: ${resolvedCwd}`);
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
        errors: session.errors
    };
};




const setupAndStartServer = async (session, project) => {
    session.status = "VALIDATING";

    // Precondition Checks
    try {
        // 1. Write the project files into the temporary directory first
        project.files.forEach(file => {
            let content = file.content;
            if (file.name === "package.json") {
                try {
                    content = sanitizePackageJson(content);
                } catch (e) {
                    throw new Error(`Failed parsing package.json: ${e.message}`);
                }
            }
            safeWriteFile(session.dirPath, file.name, content);
        });

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

    const runProcess = (cmd, args) => {
        return new Promise((resolve, reject) => {
            let proc;
            try {
                proc = cp.spawn(cmd, args, spawnOptions);
            } catch (err) {
                return reject(err);
            }
            let out = "";
            let errOut = "";
            proc.stdout.on("data", data => out += data.toString());
            proc.stderr.on("data", data => errOut += data.toString());
            proc.on("close", code => {
                if (code === 0) {
                    resolve({ code, out, errOut });
                } else {
                    reject(new Error(`Command '${cmd} ${args.join(" ")}' failed with exit code ${code}. ${errOut || out}`));
                }
            });
            proc.on("error", reject);
        });
    };

    try {
        // Run npm install when required by current architecture
        await runProcess(npmCmd, ["install", "--no-audit", "--no-fund"]);
        // Run npm run build and require exit code 0
        await runProcess(npmCmd, ["run", "build"]);
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
    const viteArgs = [
        "vite",
        "--port",
        session.port.toString(),
        "--strictPort",
        "--host",
        "127.0.0.1"
    ];

    let child;
    try {
        child = cp.spawn(npxCmd, viteArgs, spawnOptions);
    } catch (err) {
        session.status = "FAILED";
        session.errors.push(`Spawn failed: ${err.message}`);
        if (fs.existsSync(session.dirPath)) {
            try { fs.rmSync(session.dirPath, { recursive: true, force: true }); } catch (e) {}
        }
        return;
    }
    session.childProcess = child;

    const handleFailure = (reason) => {
        if (session.status === "READY" || session.status === "FAILED" || session.status === "stopped") return;
        session.status = "FAILED";
        session.errors.push(reason);
        if (child) {
            try { child.kill("SIGKILL"); } catch (e) {}
        }
        if (fs.existsSync(session.dirPath)) {
            try { fs.rmSync(session.dirPath, { recursive: true, force: true }); } catch (e) {}
        }
    };

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
        const maxAttempts = 15;
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
                const hasMain = html.includes('src="/src/main.jsx"');
                if (!hasRoot && !hasMain) {
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
                    throw new Error(`Vite server did not become healthy within timeout: ${err.message}`);
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
            if (str.includes("ready in") || str.includes("Local:") || str.includes("Network:")) {
                transitionToHealthChecking();
            }
        }
        if (detectFailurePattern(str)) {
            handleFailure(`Vite compilation error detected: ${str.trim()}`);
        }
    });

    child.stderr.on("data", (data) => {
        const str = data.toString();
        console.error(`[Preview Process stderr]: ${str.trim()}`);
        if (session.status === "STARTING") {
            if (str.includes("ready in") || str.includes("Local:") || str.includes("Network:")) {
                transitionToHealthChecking();
            }
        }
        if (detectFailurePattern(str)) {
            handleFailure(`Vite compilation error detected: ${str.trim()}`);
        }
    });

    child.on("close", (code) => {
        console.warn(`[Preview Process] vite closed with code ${code}`);
        if (session.status !== "stopped" && session.status !== "READY" && session.status !== "FAILED") {
            handleFailure(`Vite server closed early with code ${code}`);
        }
    });

    child.on("error", (err) => {
        console.error(`[Preview Process] vite error:`, err);
        handleFailure(err.message);
    });
};

const cleanupSession = async (session) => {
    session.status = "NOT_STARTED";
    if (session.expiryTimer) {
        clearTimeout(session.expiryTimer);
    }

    // Kill process
    if (session.childProcess) {
        try {
            session.childProcess.kill("SIGKILL");
        } catch (e) {
            // Ignore kill errors
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

    // Check compatibility: must be a React project or has package.json with vite
    const packageJsonFile = project.files.find(f => f.name === "package.json");
    if (!packageJsonFile) {
        throw new Error("Preview is only supported for React/Vite-compatible projects (missing package.json).");
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

    const session = {
        projectId,
        port,
        status: "VALIDATING",
        dirPath: canonicalRoot,
        childProcess: null,
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
