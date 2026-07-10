const SCHEMA_VERSION = "1.0";

const REQUIRED_TOP_LEVEL_FIELDS = [
    "schemaVersion",
    "projectName",
    "projectType",
    "frontend",
    "backend",
    "database",
    "authentication",
    "designRequirements",
    "pagesAndRoutes",
    "components",
    "backendApis",
    "databaseModels",
    "integrations",
    "importantDependencies",
    "environmentVariables",
    "architectureConstraints",
    "runBuildRequirements",
    "deploymentRequirements",
    "assumptions"
];

const NESTED_FIELDS = {
    pagesAndRoutes: ["path", "name", "description"],
    components: ["name", "purpose"],
    backendApis: ["method", "path", "purpose"],
    databaseModels: ["name", "fields"],
    runBuildRequirements: ["runScript", "buildScript"]
};

const ALLOWED_HTTP_METHODS = [
    "GET",
    "POST",
    "PUT",
    "DELETE",
    "PATCH",
    "OPTIONS",
    "HEAD"
];

module.exports = {
    SCHEMA_VERSION,
    REQUIRED_TOP_LEVEL_FIELDS,
    NESTED_FIELDS,
    ALLOWED_HTTP_METHODS
};
