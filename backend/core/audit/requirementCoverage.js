"use strict";

const { normalizePath } = require("./requirementEvidence");

/**
 * Calculates requirement coverage and statistics.
 *
 * @param {Object} evidenceMap Map of stableId to evidence details
 * @param {Array} requirements Extracted requirements list
 * @param {Array} generatedFiles List of all generated files
 */
function calculateCoverage(evidenceMap, requirements, generatedFiles) {
    const total = requirements.length;
    let satisfied = 0;
    let failed = 0;

    const byKind = {};
    const missingRequirements = [];
    const matchedFilePaths = new Set();

    for (const req of requirements) {
        const evidence = evidenceMap[req.stableId] || { satisfied: false, files: [] };
        
        if (evidence.satisfied) {
            satisfied++;
        } else {
            failed++;
            missingRequirements.push({
                stableId: req.stableId,
                displayId: req.displayId,
                kind: req.kind,
                semanticKey: req.semanticKey,
                sourcePath: req.sourcePath
            });
        }

        // Record all matched files
        if (Array.isArray(evidence.files)) {
            for (const f of evidence.files) {
                matchedFilePaths.add(normalizePath(f.path));
            }
        }

        // Track stats by kind
        const kind = req.kind;
        if (!byKind[kind]) {
            byKind[kind] = { total: 0, satisfied: 0, percentage: 0 };
        }
        byKind[kind].total++;
        if (evidence.satisfied) {
            byKind[kind].satisfied++;
        }
    }

    // Compute percentage per kind
    for (const kind of Object.keys(byKind)) {
        const stats = byKind[kind];
        stats.percentage = stats.total > 0 ? parseFloat(((stats.satisfied / stats.total) * 100).toFixed(2)) : 100;
    }

    const percentage = total > 0 ? parseFloat(((satisfied / total) * 100).toFixed(2)) : 100;

    // Identify orphan files (files not mapped to any requirement evidence)
    const orphanArtifacts = [];
    if (Array.isArray(generatedFiles)) {
        for (const file of generatedFiles) {
            const filePath = normalizePath(file.name || file.path || "");
            if (filePath && !matchedFilePaths.has(filePath)) {
                // Do not mark standard layout configs/readme as orphans if they are expected scaffolds
                const baseName = filePath.split("/").pop().toLowerCase();
                const isCommonScaffold = baseName === "readme.md" || baseName === "package.json" || baseName === "vite.config.js" || baseName === "index.html";
                if (!isCommonScaffold) {
                    orphanArtifacts.push({
                        path: filePath,
                        size: (file.content || "").length
                    });
                }
            }
        }
    }

    const statistics = {
        totalRequirements: total,
        satisfiedRequirements: satisfied,
        failedRequirements: failed,
        coveragePercentage: percentage,
        byKind
    };

    return {
        coverage: percentage,
        statistics,
        missingRequirements,
        orphanArtifacts
    };
}

module.exports = {
    calculateCoverage
};
