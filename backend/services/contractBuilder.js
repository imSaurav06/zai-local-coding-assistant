const buildSharedContracts = (projectSpec) => {
    const contracts = {
        folderStructure: [],
        apiEndpoints: [],
        databaseSchemas: [],
        environmentVariables: projectSpec.environmentVariables || [],
        dependencies: projectSpec.importantDependencies || []
    };

    // Build API contracts
    if (projectSpec.backendApis) {
        contracts.apiEndpoints = projectSpec.backendApis.map(api => ({
            method: api.method,
            path: api.path,
            purpose: api.purpose
        }));
    }

    // Build database models schema
    if (projectSpec.databaseModels) {
        contracts.databaseSchemas = projectSpec.databaseModels.map(model => ({
            name: model.name,
            fields: model.fields
        }));
    }

    // Inferred Folder Layout
    if (projectSpec.frontend && projectSpec.frontend !== "None") {
        contracts.folderStructure.push(
            "src/main.jsx",
            "src/App.jsx",
            "src/index.css"
        );
        if (projectSpec.components) {
            projectSpec.components.forEach(c => {
                const cleanName = c.name.replace(/[^a-zA-Z0-9_-]/g, "");
                contracts.folderStructure.push(`src/components/${cleanName}.jsx`);
            });
        }
        if (projectSpec.pagesAndRoutes) {
            projectSpec.pagesAndRoutes.forEach(p => {
                const cleanName = p.name.replace(/[^a-zA-Z0-9_-]/g, "");
                contracts.folderStructure.push(`src/pages/${cleanName}.jsx`);
            });
        }
    }
    
    if (projectSpec.backend && projectSpec.backend !== "None") {
        contracts.folderStructure.push("server.js");
        if (projectSpec.databaseModels) {
            projectSpec.databaseModels.forEach(m => {
                const cleanName = m.name.replace(/[^a-zA-Z0-9_-]/g, "");
                contracts.folderStructure.push(`models/${cleanName}.js`);
            });
        }
    }

    return contracts;
};

module.exports = { buildSharedContracts };
