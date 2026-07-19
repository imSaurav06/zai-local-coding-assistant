"use strict";

/**
 * Normalizes backslashes to forward slashes in file paths.
 */
function normalizePath(filePath) {
    if (typeof filePath !== "string") return "";
    return filePath.replace(/\\/g, "/");
}

/**
 * Searches generated files for evidence of a given requirement.
 */
function searchGeneratedFiles(req, generatedFiles) {
    const matchedFiles = [];
    if (!Array.isArray(generatedFiles)) return matchedFiles;

    const kind = req.kind;
    const key = req.semanticKey;
    const payload = req.payload;

    for (const file of generatedFiles) {
        const filePath = normalizePath(file.name || file.path || "");
        const fileContent = file.content || "";
        const fileBaseName = filePath.split("/").pop().toLowerCase();

        let isMatch = false;

        if (kind === "pageRoute" && payload && typeof payload === "object") {
            const pageNameLower = (payload.name || "").toLowerCase();
            const pagePath = payload.path;

            // 1. Match by file name
            if (pageNameLower && fileBaseName.includes(pageNameLower)) {
                isMatch = true;
            }
            // 2. Match by route path reference in content
            else if (pagePath && (fileContent.includes(`"${pagePath}"`) || fileContent.includes(`'${pagePath}'`))) {
                isMatch = true;
            }
        } 
        else if (kind === "component" && payload && typeof payload === "object") {
            const compNameLower = (payload.name || "").toLowerCase();
            if (compNameLower && fileBaseName.includes(compNameLower)) {
                isMatch = true;
            } else if (payload.name && (fileContent.includes(`<${payload.name}`) || fileContent.includes(`import ${payload.name}`))) {
                isMatch = true;
            }
        } 
        else if (kind === "backendApi" && payload && typeof payload === "object") {
            const apiPath = payload.path;
            const apiMethod = (payload.method || "").toLowerCase();

            if (apiPath && fileContent.includes(apiPath)) {
                if (apiMethod && fileContent.toLowerCase().includes(apiMethod)) {
                    isMatch = true;
                } else {
                    isMatch = true;
                }
            }
        } 
        else if (kind === "databaseModel" && payload && typeof payload === "object") {
            const modelNameLower = (payload.name || "").toLowerCase();
            if (modelNameLower && (fileBaseName.includes(modelNameLower) || fileContent.toLowerCase().includes(`schema`) && fileContent.toLowerCase().includes(modelNameLower))) {
                isMatch = true;
            }
        }
        else if (kind === "designRequirements" && typeof key === "string") {
            const keyLower = key.toLowerCase();
            if (fileContent.toLowerCase().includes(keyLower) || fileBaseName.includes(keyLower) || fileBaseName.includes("css") || fileBaseName.includes("style")) {
                isMatch = true;
            }
        }
        else {
            // General semantic match against content or file name
            if (typeof key === "string" && key.trim() !== "") {
                const keyLower = key.toLowerCase();
                if (fileBaseName.includes(keyLower) || fileContent.toLowerCase().includes(keyLower)) {
                    isMatch = true;
                }
            }
        }

        if (isMatch) {
            matchedFiles.push({
                path: filePath,
                size: fileContent.length
            });
        }
    }

    return matchedFiles;
}

/**
 * Searches structural contract specifications for evidence of a given requirement.
 */
function searchContracts(req, contracts) {
    const matchedContracts = [];
    if (!contracts || typeof contracts !== "object") return matchedContracts;

    const kind = req.kind;
    const payload = req.payload;

    if (kind === "backendApi" && payload && typeof payload === "object" && Array.isArray(contracts.apiEndpoints)) {
        const match = contracts.apiEndpoints.find(e => 
            (e.method || "").toUpperCase() === (payload.method || "").toUpperCase() && 
            e.path === payload.path
        );
        if (match) {
            matchedContracts.push({ type: "apiEndpoint", detail: match });
        }
    } 
    else if (kind === "databaseModel" && payload && typeof payload === "object" && Array.isArray(contracts.databaseSchemas)) {
        const match = contracts.databaseSchemas.find(s => s.name === payload.name);
        if (match) {
            matchedContracts.push({ type: "databaseSchema", detail: match });
        }
    }

    // Check general folderStructure match
    if (Array.isArray(contracts.folderStructure)) {
        const nameMatch = req.semanticKey ? req.semanticKey.toLowerCase() : "";
        const folderMatches = contracts.folderStructure.filter(path => 
            nameMatch && normalizePath(path).toLowerCase().includes(nameMatch)
        );
        for (const fm of folderMatches) {
            matchedContracts.push({ type: "folderStructure", detail: fm });
        }
    }

    return matchedContracts;
}

/**
 * Collects verification issues and repairs related to the matched files of a requirement.
 */
function collectProcessEvidence(matchedFiles, verificationReport, repairHistory) {
    const verificationIssues = [];
    const repairs = [];

    const filePaths = new Set(matchedFiles.map(f => f.path));

    // Collect verification issues targeting matched files
    if (verificationReport && Array.isArray(verificationReport.errors)) {
        for (const err of verificationReport.errors) {
            const errPath = normalizePath(err.path || err.filePath || "");
            if (filePaths.has(errPath)) {
                verificationIssues.push(err);
            }
        }
    }

    // Collect repair history events targeting matched files
    if (Array.isArray(repairHistory)) {
        for (const event of repairHistory) {
            const eventPath = normalizePath(event.path || event.filePath || "");
            if (filePaths.has(eventPath)) {
                repairs.push(event);
            }
        }
    }

    return { verificationIssues, repairs };
}

/**
 * Collects all evidence for requirements.
 */
function collectEvidence(requirements, generatedFiles, contracts, verificationReport, repairHistory) {
    const evidenceMap = {};

    for (const req of requirements) {
        const matchedFiles = searchGeneratedFiles(req, generatedFiles);
        const matchedContracts = searchContracts(req, contracts);
        const { verificationIssues, repairs } = collectProcessEvidence(matchedFiles, verificationReport, repairHistory);

        // A requirement is satisfied if:
        // 1. Evidence exists (at least one matched file or structural contract is present)
        // 2. Verified: No critical verification issues remain outstanding on the matched files (if verification is passed/present)
        const hasEvidence = matchedFiles.length > 0 || matchedContracts.length > 0;
        const hasUnresolvedErrors = verificationIssues.some(issue => issue.severity === "ERROR" || !issue.severity);
        const satisfied = hasEvidence && !hasUnresolvedErrors;

        evidenceMap[req.stableId] = {
            stableId: req.stableId,
            displayId: req.displayId,
            kind: req.kind,
            semanticKey: req.semanticKey,
            satisfied,
            files: matchedFiles,
            contracts: matchedContracts,
            verificationIssues,
            repairs
        };
    }

    return evidenceMap;
}

module.exports = {
    collectEvidence,
    normalizePath
};
