// ─────────────────────────────────────────────────────────────────────────────
// SCAFFOLD REGISTRY
// Generates deterministic base infrastructure files before AI generation runs.
// Delegate directly to the extensible stackProfiles engine.
// ─────────────────────────────────────────────────────────────────────────────

const { profiles } = require("./stackProfiles");

const generateScaffoldFiles = (adapterName, projectSpec) => {
    const profile = profiles[adapterName] || profiles["vanilla"];
    return profile.getScaffoldFiles(projectSpec);
};

module.exports = { generateScaffoldFiles };
