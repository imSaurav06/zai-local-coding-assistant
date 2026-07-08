const mergeFiles = (scaffoldFiles, generatedFiles) => {
    const mergedMap = new Map();

    // Load scaffold files first
    scaffoldFiles.forEach(file => {
        mergedMap.set(file.name, file.content);
    });

    // Load and overwrite with AI generated files
    generatedFiles.forEach(file => {
        // Clean paths: remove absolute parts, double slashes, lead slashes
        let cleanName = file.name.replace(/\\/g, "/").replace(/^\/+/, "");
        mergedMap.set(cleanName, file.content);
    });

    // Return as array
    return Array.from(mergedMap.entries()).map(([name, content]) => ({
        name,
        content
    }));
};

module.exports = { mergeFiles };
