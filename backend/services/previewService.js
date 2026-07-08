const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
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
            dev: "vite"
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
        url: session.status === "ready" ? `http://localhost:${session.port}` : null,
        errors: session.errors
    };
};

const pollServerHealth = async (session) => {
    const url = `http://127.0.0.1:${session.port}`;
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max wait

    while (attempts < maxAttempts) {
        // Exit if stdout/stderr already signaled ready, or if stopped/failed
        if (session.status === "ready" || session.status === "stopped" || session.status === "failed") {
            return;
        }

        try {
            await axios.get(url, { timeout: 1000 });
            // Health check success
            session.status = "ready";
            console.log(`[Preview Service] Port ${session.port} is healthy. Preview is ready!`);
            return;
        } catch (e) {
            attempts++;
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    // Health check failed — but check if stdout already marked ready before failing
    if (session.status === "starting-server") {
        session.status = "failed";
        session.errors.push("Vite server failed to start/respond within 30s");
        if (session.childProcess) {
            session.childProcess.kill("SIGKILL");
        }
    }
};

const setupAndStartServer = async (session, project) => {
    // Write files
    project.files.forEach(file => {
        let content = file.content;
        if (file.name === "package.json") {
            try {
                content = sanitizePackageJson(content);
            } catch (e) {
                console.error("Failed parsing package.json:", e.message);
            }
        }
        safeWriteFile(session.dirPath, file.name, content);
    });

    // Validate cwd and package.json presence
    try {
        validateCwd(session.dirPath);
    } catch (err) {
        console.error(`[Preview Service] Cwd validation failed: ${err.message}`);
        session.status = "failed";
        session.errors.push(err.message);
        return;
    }

    session.status = "installing";

    // Run npm install using spawn
    const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
    const spawnEnv = getSanitizedEnv();
    const spawnOptions = {
        cwd: session.dirPath,
        env: spawnEnv,
        shell: process.platform === "win32"
    };

    let installProcess;
    try {
        installProcess = spawn(npmCmd, ["install", "--no-audit", "--no-fund"], spawnOptions);
    } catch (err) {
        logSpawnDiagnostics(npmCmd, ["install", "--no-audit", "--no-fund"], session.dirPath, spawnEnv, err);
        session.status = "failed";
        session.errors.push(`Spawn failed: ${err.message}`);
        return;
    }

    installProcess.stderr.on("data", (data) => {
        const str = data.toString();
        if (session.errors.length < 50) {
            session.errors.push(str);
        }
    });

    installProcess.on("error", (err) => {
        logSpawnDiagnostics(npmCmd, ["install", "--no-audit", "--no-fund"], session.dirPath, spawnEnv, err);
    });

    try {
        await new Promise((resolve, reject) => {
            // 120 seconds timeout for npm install
            const timeout = setTimeout(() => {
                installProcess.kill("SIGKILL");
                reject(new Error("npm install timed out after 120s"));
            }, 120000);

            installProcess.on("close", (code) => {
                clearTimeout(timeout);
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`npm install failed with exit code ${code}`));
                }
            });
            installProcess.on("error", (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });
    } catch (err) {
        session.status = "failed";
        session.errors.push(err.message);
        return;
    }

    // Start Vite server
    session.status = "starting-server";
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
        child = spawn(npxCmd, viteArgs, spawnOptions);
    } catch (err) {
        logSpawnDiagnostics(npxCmd, viteArgs, session.dirPath, spawnEnv, err);
        session.status = "failed";
        session.errors.push(`Spawn failed: ${err.message}`);
        return;
    }

    session.childProcess = child;

    // Detect Vite's ready signal from stdout (primary signal on Windows).
    // Vite prints "ready in" or "Local:" when the dev server is up.
    child.stdout.on("data", (data) => {
        const str = data.toString();
        console.log(`[Preview Process stdout]: ${str.trim()}`);
        if ((str.includes("ready in") || str.includes("Local:")) && session.status === "starting-server") {
            console.log(`[Preview Service] Vite reported ready via stdout. Port ${session.port} is live.`);
            session.status = "ready";
        }
    });

    child.stderr.on("data", (data) => {
        const str = data.toString();
        // Vite sometimes outputs its ready banner to stderr on Windows
        if ((str.includes("ready in") || str.includes("Local:")) && session.status === "starting-server") {
            console.log(`[Preview Service] Vite reported ready via stderr. Port ${session.port} is live.`);
            session.status = "ready";
        } else {
            if (session.errors.length < 50) {
                session.errors.push(str);
            }
            console.error(`[Preview Process stderr]: ${str.trim()}`);
        }
    });

    child.on("close", (code) => {
        console.warn(`[Preview Process] vite closed with code ${code}`);
        if (session.status !== "stopped") {
            session.status = "failed";
            session.errors.push(`Vite server closed with code ${code}`);
        }
    });

    child.on("error", (err) => {
        console.error(`[Preview Process] vite error:`, err);
        session.status = "failed";
        session.errors.push(err.message);
    });

    // Poll server health using Axios — also marks ready if HTTP responds.
    // If stdout already marked ready, this exits quickly on first successful check.
    await pollServerHealth(session);
};

const cleanupSession = async (session) => {
    session.status = "stopped";
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
        status: "preparing",
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
        session.status = "failed";
        session.errors.push(err.message);
    });

    return getSessionMetadata(session);
};

const getPreviewStatus = async (projectId, userId) => {
    const session = activePreviews.get(projectId);
    if (!session) {
        return { status: "idle" };
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
        return { status: "stopped" };
    }
    // Verify ownership
    const project = await Project.findById(projectId);
    if (!project || project.userId.toString() !== userId.toString()) {
        const forbiddenErr = new Error("Forbidden");
        forbiddenErr.status = 403;
        throw forbiddenErr;
    }

    await cleanupSession(session);
    return { status: "stopped" };
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
    activePreviews
};
