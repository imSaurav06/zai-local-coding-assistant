const planGeneration = (projectSpec) => {
    const tech = ((projectSpec.frontend || "") + " " + (projectSpec.backend || "") + " " + (projectSpec.database || "")).toLowerCase();
    
    // 1. Analyze parameters
    let scaffoldAdapter = null;
    let scaffoldCoverage = 0.0; // 0.0 to 1.0
    if (tech.includes("react") || tech.includes("vite")) {
        scaffoldAdapter = "react-vite";
        scaffoldCoverage = 0.8;
    } else if (tech.includes("next")) {
        scaffoldAdapter = "nextjs";
        scaffoldCoverage = 0.7;
    } else if (tech.includes("fastapi")) {
        scaffoldAdapter = "fastapi";
        scaffoldCoverage = 0.6;
    } else if (tech.includes("express")) {
        scaffoldAdapter = "express";
        scaffoldCoverage = 0.7;
    }

    const pagesCount = projectSpec.pagesAndRoutes?.length || 0;
    const compsCount = projectSpec.components?.length || 0;
    const apisCount = projectSpec.backendApis?.length || 0;
    const modelsCount = projectSpec.databaseModels?.length || 0;
    
    // Heuristics for estimated file output count
    const baseFiles = scaffoldAdapter ? 4 : 2; // package.json, config etc.
    const customFiles = pagesCount + compsCount + modelsCount + (apisCount > 0 ? 1 : 0);
    const totalFilesEstimate = baseFiles + customFiles;

    // Estimate output size in tokens (assume ~300 tokens per custom source file, ~200 per config file)
    const estimatedOutputTokens = (customFiles * 300) + (baseFiles * 200);

    // Complexity mapping
    let complexity = "low";
    if (customFiles > 5 || projectSpec.integrations?.length > 0) {
        complexity = "moderate";
    }
    if (customFiles > 14 || estimatedOutputTokens > 5000) {
        complexity = "high";
    }

    // Coupling analysis
    // High coupling: standard full-stack, mixed layers, database schema dependencies
    let dependencyCoupling = "low";
    if ((projectSpec.backend && projectSpec.backend !== "None" && projectSpec.frontend && projectSpec.frontend !== "None") || modelsCount > 0) {
        dependencyCoupling = "high";
    }

    // Determine deterministic infrastructure files
    const deterministicFiles = [];
    if (scaffoldAdapter === "react-vite") {
        deterministicFiles.push("package.json", "vite.config.js", "tailwind.config.js", "postcss.config.js", "index.html");
    } else if (scaffoldAdapter === "express") {
        deterministicFiles.push("package.json", ".env.example");
    } else if (scaffoldAdapter === "fastapi") {
        deterministicFiles.push("requirements.txt", ".env.example");
    } else if (scaffoldAdapter === "nextjs") {
        deterministicFiles.push("package.json", "tailwind.config.js", "postcss.config.js", "next.config.js");
    }

    // 2. Select strategy based on coupling, token size, and scaffolding
    let strategy = "DIRECT";
    let tokenBudget = 3000;
    
    // Choose Direct or Scaffold_AI if it fits safely in context & budget
    if (scaffoldCoverage > 0.5) {
        strategy = "SCAFFOLD_AI";
    }

    // Analyze independent generation units count
    const independentUnitsCount = compsCount + pagesCount;

    // Determine strategy overrides
    if (complexity === "high" && estimatedOutputTokens > 5000) {
        if (dependencyCoupling === "low" && independentUnitsCount >= 2) {
            strategy = "PARALLEL";
        } else {
            strategy = "CHUNKED";
        }
    } else if (complexity === "moderate") {
        // Stay within 2 primary AI calls budget: prefer SCAFFOLD_AI or DIRECT
        if (scaffoldCoverage > 0.5) {
            strategy = "SCAFFOLD_AI";
        } else {
            strategy = "DIRECT";
        }
    } else {
        // Small project: max 1 primary AI call
        if (scaffoldCoverage > 0.5) {
            strategy = "SCAFFOLD_AI";
        } else {
            strategy = "DIRECT";
        }
    }

    // Set token budget & adaptive timeouts base
    if (strategy === "DIRECT" || strategy === "SCAFFOLD_AI") {
        tokenBudget = Math.min(Math.max(estimatedOutputTokens, 2000), 5000);
    } else {
        tokenBudget = 2500; // per-unit budget
    }

    // Generation Units
    const generationUnits = [];
    if (strategy === "DIRECT" || strategy === "SCAFFOLD_AI") {
        // Single consolidated source generation unit
        generationUnits.push({
            id: "all_source_files",
            description: "Generate all project custom implementation source files consolidated in one call",
            dependencies: [],
            estimatedTokens: estimatedOutputTokens
        });
    } else {
        // Chunked or Parallel - multi-call units
        generationUnits.push({
            id: "core_entry",
            description: "Generate core entry files and setup main configurations",
            dependencies: []
        });
        
        if (projectSpec.databaseModels && projectSpec.databaseModels.length > 0) {
            generationUnits.push({
                id: "db_models",
                description: "Generate database schemas and models",
                type: "models",
                dependencies: []
            });
        }

        if (projectSpec.pagesAndRoutes) {
            projectSpec.pagesAndRoutes.forEach(page => {
                generationUnits.push({
                    id: `page_${page.name.replace(/\s+/g, "")}`,
                    description: `Generate page: ${page.name}`,
                    type: "page",
                    meta: page,
                    dependencies: ["core_entry"]
                });
            });
        }

        if (projectSpec.components) {
            projectSpec.components.forEach(comp => {
                generationUnits.push({
                    id: `component_${comp.name.replace(/\s+/g, "")}`,
                    description: `Generate component: ${comp.name}`,
                    type: "component",
                    meta: comp,
                    dependencies: ["core_entry"]
                });
            });
        }
    }

    // Grouping for execution
    const parallelGroups = [];
    const visited = new Set();
    let remaining = [...generationUnits];
    
    while (remaining.length > 0) {
        const group = remaining.filter(u => u.dependencies.every(d => visited.has(d)));
        if (group.length === 0) {
            parallelGroups.push(remaining);
            break;
        }
        parallelGroups.push(group);
        group.forEach(u => visited.add(u.id));
        remaining = remaining.filter(u => !visited.has(u.id));
    }

    return {
        strategy,
        complexity,
        estimatedOutputSize: estimatedOutputTokens,
        scaffoldAdapter,
        deterministicFiles,
        generationUnits,
        parallelGroups,
        validationProfile: scaffoldAdapter || "generic",
        tokenBudget,
        repairPolicy: {
            maxAttempts: 2
        }
    };
};

module.exports = { planGeneration };
