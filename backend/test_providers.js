const fs = require("fs");
const path = require("path");

const previewDir = "C:\\Users\\LENOVO\\OneDrive\\Desktop\\z.AI\\temp_previews\\6a4ff9e874dc9beaab156f98_1783626616145";
if (fs.existsSync(previewDir)) {
    const files = fs.readdirSync(previewDir);
    console.log("Files in preview dir:", files);
    if (files.includes(".env")) {
        console.log(".env content:", fs.readFileSync(path.join(previewDir, ".env"), "utf8"));
    }
} else {
    console.log("Preview dir does not exist");
}
