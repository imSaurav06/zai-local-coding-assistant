// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT BUILDER
// Produces shared contracts and dynamic project manifests using stack profiles.
// These are the authoritative file paths that AI must follow.
// ─────────────────────────────────────────────────────────────────────────────

const { detectProfile, profiles } = require("./stackProfiles");

const isMernStack = (projectSpec) => {
    return profiles.mern.detect(projectSpec);
};

const buildSharedContracts = (projectSpec) => {
    const profile = detectProfile(projectSpec);
    const folderStructure = profile.getFolderStructure(projectSpec);

    return {
        folderStructure,
        apiEndpoints: projectSpec.backendApis || [],
        databaseSchemas: projectSpec.databaseModels || [],
        environmentVariables: projectSpec.environmentVariables || [],
        dependencies: projectSpec.importantDependencies || [],
        stackProfile: profile.name,
        isMern: profile.name === "mern"
    };
};

/**
 * Constructs a normalized, dynamic project manifest consumed by later pipeline stages.
 */
const buildProjectManifest = (originalPrompt, projectSpec) => {
    const profile = detectProfile(projectSpec);
    const expectedFiles = profile.getFolderStructure(projectSpec);
    const scaffoldFiles = profile.getScaffoldFiles(projectSpec);
    const deterministicFiles = scaffoldFiles.map(f => f.name);
    const aiGeneratedFiles = expectedFiles.filter(f => !deterministicFiles.includes(f));

    return {
        projectName: projectSpec.projectName || "project",
        projectType: projectSpec.projectType || "Web Application",
        stackProfile: profile.name,
        frontend: projectSpec.frontend || "None",
        backend: projectSpec.backend || "None",
        database: projectSpec.database || "None",
        authentication: projectSpec.authentication || "None",
        features: projectSpec.features || [],
        pagesAndRoutes: projectSpec.pagesAndRoutes || [],
        components: projectSpec.components || [],
        backendApis: projectSpec.backendApis || [],
        databaseModels: projectSpec.databaseModels || [],
        dependencies: projectSpec.importantDependencies || [],
        environmentVariables: projectSpec.environmentVariables || [],
        expectedFiles,
        deterministicFiles,
        aiGeneratedFiles,
        validationRules: {
            requiredFiles: expectedFiles,
            profileName: profile.name
        },
        buildStrategy: profile.buildStrategy,
        previewStrategy: profile.previewStrategy
    };
};

module.exports = {
    buildSharedContracts,
    buildProjectManifest,
    isMernStack
};
