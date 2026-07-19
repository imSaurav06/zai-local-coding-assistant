"use strict";

const { benchmarkSuiteErrorCodes } = require("./benchmarkSuiteErrors");
const { normalizeBenchmarkScenario } = require("./benchmarkScenario");

function createError(message, code) {
    const err = new Error(message);
    err.code = code;
    return err;
}

// In-memory catalog of benchmark definitions (metadata only)
const catalog = new Map();

/**
 * Register official reference benchmarks (metadata definitions only).
 */
const OFFICIAL_REFERENCE_BENCHMARKS = [
    {
        id: "learnsphere",
        name: "LearnSphere",
        category: "REFERENCE",
        complexity: { level: "ENTERPRISE", estimatedModules: 20, estimatedRequirements: 50, estimatedWorkers: 3, estimatedArtifacts: 100 },
        input: {
            projectSpec: {
                schemaVersion: "1.0",
                projectName: "LearnSphere LMS",
                projectType: "Enterprise LMS",
                frontend: "React (Vite) 18.2",
                backend: "Node.js (Express)",
                pagesAndRoutes: [{ path: "/", name: "Dashboard" }, { path: "/courses", name: "Courses" }],
                components: [{ name: "CourseCard" }, { name: "AnalyticsPanel" }],
                architectureConstraints: ["Multi-Tenant", "Role-Based Access Control"]
            }
        }
    },
    {
        id: "crud-application",
        name: "CRUD Application",
        category: "REFERENCE",
        complexity: { level: "MEDIUM", estimatedModules: 5, estimatedRequirements: 10, estimatedWorkers: 2, estimatedArtifacts: 20 },
        input: {
            projectSpec: {
                schemaVersion: "1.0",
                projectName: "Task Manager CRUD",
                projectType: "MERN Application",
                frontend: "React (Vite) 18.2",
                pagesAndRoutes: [{ path: "/", name: "Tasks" }],
                components: [{ name: "TaskCard" }],
                architectureConstraints: ["REST API"]
            }
        }
    },
    {
        id: "admin-dashboard",
        name: "Admin Dashboard",
        category: "REFERENCE",
        complexity: { level: "MEDIUM", estimatedModules: 8, estimatedRequirements: 15, estimatedWorkers: 2, estimatedArtifacts: 30 },
        input: {
            projectSpec: {
                schemaVersion: "1.0",
                projectName: "Admin Analytics Dashboard",
                projectType: "React Dashboard",
                frontend: "React (Vite) 18.2",
                pagesAndRoutes: [{ path: "/", name: "Overview" }, { path: "/analytics", name: "Metrics" }],
                components: [{ name: "Sidebar" }, { name: "MetricWidget" }],
                architectureConstraints: ["Client-side SPA"]
            }
        }
    },
    {
        id: "e-commerce-store",
        name: "E-Commerce Store",
        category: "REFERENCE",
        complexity: { level: "HIGH", estimatedModules: 12, estimatedRequirements: 25, estimatedWorkers: 3, estimatedArtifacts: 50 },
        input: {
            projectSpec: {
                schemaVersion: "1.0",
                projectName: "E-Commerce Store",
                projectType: "Fullstack E-Commerce",
                frontend: "Next.js 14",
                pagesAndRoutes: [{ path: "/", name: "Storefront" }, { path: "/cart", name: "Checkout" }],
                components: [{ name: "ProductGrid" }, { name: "CartDrawer" }],
                architectureConstraints: ["Server-Side Rendering"]
            }
        }
    },
    {
        id: "portfolio-website",
        name: "Portfolio Website",
        category: "REFERENCE",
        complexity: { level: "LOW", estimatedModules: 3, estimatedRequirements: 5, estimatedWorkers: 1, estimatedArtifacts: 10 },
        input: {
            projectSpec: {
                schemaVersion: "1.0",
                projectName: "Personal Portfolio",
                projectType: "React Landing Page",
                frontend: "React (Vite) 18.2",
                pagesAndRoutes: [{ path: "/", name: "Home" }],
                components: [{ name: "Hero" }, { name: "Projects" }],
                architectureConstraints: ["Single Page Application"]
            }
        }
    }
];

// Initialize reference catalog
OFFICIAL_REFERENCE_BENCHMARKS.forEach(item => {
    const normalized = normalizeBenchmarkScenario(item);
    catalog.set(normalized.id.toLowerCase(), normalized);
});

/**
 * Registers a benchmark scenario into the catalog.
 *
 * @param {Object} scenario Raw scenario object
 * @returns {Object} Normalized registered scenario
 */
function registerBenchmarkScenario(scenario) {
    const normalized = normalizeBenchmarkScenario(scenario);
    catalog.set(normalized.id.toLowerCase(), normalized);
    return normalized;
}

/**
 * Look up a registered benchmark by ID.
 *
 * @param {string} id Benchmark ID
 * @returns {Object|null} Registered scenario or null if not found
 */
function getRegisteredBenchmark(id) {
    if (!id || typeof id !== "string") return null;
    return catalog.get(id.trim().toLowerCase()) || null;
}

/**
 * Resolves a scenario parameter (either a registered ID or a scenario object).
 *
 * @param {string|Object} scenarioOrId Scenario ID or scenario object
 * @returns {Object} Normalized benchmark scenario
 */
function resolveBenchmarkScenario(scenarioOrId) {
    if (typeof scenarioOrId === "string") {
        const found = getRegisteredBenchmark(scenarioOrId);
        if (!found) {
            throw createError(
                `Benchmark scenario with ID '${scenarioOrId}' is not registered in catalog.`,
                benchmarkSuiteErrorCodes.UNKNOWN_BENCHMARK
            );
        }
        return found;
    }

    if (scenarioOrId && typeof scenarioOrId === "object") {
        // If it specifies a registered ID that exists in catalog, resolve it merged
        if (typeof scenarioOrId.id === "string" && catalog.has(scenarioOrId.id.trim().toLowerCase())) {
            const registered = catalog.get(scenarioOrId.id.trim().toLowerCase());
            // Merge custom input if provided over registered template
            const merged = {
                ...registered,
                ...scenarioOrId,
                input: { ...registered.input, ...(scenarioOrId.input || {}) }
            };
            return normalizeBenchmarkScenario(merged);
        }
        return normalizeBenchmarkScenario(scenarioOrId);
    }

    throw createError(
        "Invalid benchmark scenario parameter. Expected scenario object or string ID.",
        benchmarkSuiteErrorCodes.INVALID_SCENARIO
    );
}

/**
 * Lists all registered benchmark scenarios, optionally filtered by category.
 *
 * @param {string} [category] Category filter ("REFERENCE", "USER", "CUSTOM")
 * @returns {Array} List of scenario metadata objects
 */
function listRegisteredBenchmarks(category) {
    const all = Array.from(catalog.values());
    if (category && typeof category === "string") {
        const targetCategory = category.trim().toUpperCase();
        return Object.freeze(all.filter(s => s.category === targetCategory));
    }
    return Object.freeze(all);
}

module.exports = {
    registerBenchmarkScenario,
    getRegisteredBenchmark,
    resolveBenchmarkScenario,
    listRegisteredBenchmarks,
    OFFICIAL_REFERENCE_BENCHMARKS
};
