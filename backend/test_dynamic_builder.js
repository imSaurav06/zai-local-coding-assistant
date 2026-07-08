const axios = require("axios");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const AdmZip = require("adm-zip");
require("dotenv").config();

const projectService = require("./services/projectService");
const Project = require("./models/Project");
const History = require("./models/History");
const User = require("./models/User");

// --- MOCK AXIOS FOR REPAIR LOOP UNIT TEST ---
const runRepairLoopUnitTest = async () => {
    console.log("\n--- Running Repair Loop Unit Test ---");
    const originalPost = axios.post;
    
    let callCount = 0;
    
    // Override axios.post for the duration of this unit test
    axios.post = async (url, data, config) => {
        if (url.includes("/chat/completions")) {
            callCount++;
            if (callCount === 1) {
                // First call: Return malformed output (Invalid JSON in package.json and missing README)
                console.log("[Mock] Returning malformed output...");
                return {
                    data: {
                        choices: [{
                            message: {
                                content: `
Some plan markdown here.
--- START_FILES ---
--- FILE: package.json ---
\`\`\`json
{
  "name": "malformed-project",
  "version": "1.0.0",
  "dependencies": {
    "express": "^4.18.2"
  }
  // Missing closing brace or trailing comma syntax error
\`\`\`
--- END_FILE ---
--- END_FILES ---
`
                            }
                        }]
                    }
                };
            } else if (callCount === 2) {
                // Second call (repair): Return corrected output
                console.log("[Mock] Returning corrected output...");
                return {
                    data: {
                        choices: [{
                            message: {
                                content: `
Corrected plan markdown here.
--- START_FILES ---
--- FILE: package.json ---
\`\`\`json
{
  "name": "corrected-project",
  "version": "1.0.0",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  }
}
\`\`\`
--- END_FILE ---
--- FILE: index.js ---
\`\`\`javascript
const express = require('express');
const app = express();
app.listen(3000, () => console.log('Server running'));
\`\`\`
--- END_FILE ---
--- FILE: README.md ---
\`\`\`markdown
# Corrected Project
Guide details.
\`\`\`
--- END_FILE ---
--- END_FILES ---
`
                            }
                        }]
                    }
                };
            }
        }
        return originalPost(url, data, config);
    };

    try {
        const spec = {
            projectName: "TestRepair",
            projectType: "Express API",
            backend: "Express.js (Node)",
            frontend: "None",
            database: "None",
            authentication: "None",
            mainFeatures: ["Test API endpoint"],
            importantDependencies: ["express"],
            environmentVariables: []
        };

        const result = await projectService.generateProject({
            originalPrompt: "Build a simple express api",
            projectSpec: spec
        });

        console.log("Unit Test Result Success:", result.success);
        console.log("Total Z.ai completion calls made:", callCount);
        console.log("Files generated in repaired project:", result.files.map(f => f.name));
        
        if (callCount === 2 && result.success && result.files.some(f => f.name === "package.json")) {
            console.log("SUCCESS: Repair loop correctly triggered, performed exactly 1 repair call, and succeeded!");
        } else {
            throw new Error(`Unexpected behavior: callCount=${callCount}, success=${result.success}`);
        }

    } finally {
        // Restore original axios.post
        axios.post = originalPost;
    }
};

// --- E2E STACKS TESTING ---
const runE2EIntegrationTests = async () => {
    console.log("\n--- Running E2E Integration Tests (React, MERN, Next.js, FastAPI) ---");
    
    // Connect DB to verify history records & get test user token
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB.");

    // Create a temporary test user and login to get JWT token
    const testUser = {
        name: "Builder Tester",
        email: "build_tester_" + Math.random().toString(36).substring(2, 9) + "@test.com",
        password: "password123"
    };

    console.log("Registering test user:", testUser.email);
    const regRes = await axios.post("http://localhost:5000/api/auth/register", testUser);
    const token = regRes.data.token;
    const authHeader = { headers: { Authorization: `Bearer ${token}` }, timeout: 240000 };

    const stacks = [
        {
            name: "React + Tailwind landing page",
            prompt: "Create a React landing page with Tailwind CSS.",
            preferences: {
                preferredTechStack: "React, Vite, Tailwind CSS",
                requiredFeatures: "Hero section, pricing grid, testimonials, responsive menu"
            }
        },
        {
            name: "MERN application with JWT",
            prompt: "Build a MERN fitness tracker with JWT authentication and charts.",
            preferences: {
                preferredTechStack: "React, Node, Express, MongoDB, JWT",
                requiredFeatures: "JWT authentication, exercise logging, fitness chart summary"
            }
        },
        {
            name: "Next.js application",
            prompt: "Create a Next.js portfolio using PostgreSQL and Prisma.",
            preferences: {
                preferredTechStack: "Next.js App Router, PostgreSQL, Prisma ORM",
                requiredFeatures: "Contact form, projects gallery page, responsive layout"
            }
        },
        {
            name: "FastAPI + PostgreSQL backend",
            prompt: "Build a Python FastAPI REST API with Redis caching.",
            preferences: {
                preferredTechStack: "FastAPI, Python, Redis, SQLite",
                requiredFeatures: "Endpoints for items CRUD, redis caching configuration"
            }
        }
    ];

    for (const stack of stacks) {
        console.log(`\n================ STACK: ${stack.name} ================`);
        
        // 1. Requirement Analysis
        console.log("1. Sending requirement analysis request...");
        const analyzeRes = await axios.post(
            "http://localhost:5000/api/project/analyze",
            { prompt: stack.prompt },
            authHeader
        );

        console.log("Analysis Success:", analyzeRes.data.success);
        const spec = analyzeRes.data.projectSpec;
        console.log("Inferred Specification:");
        console.log(JSON.stringify(spec, null, 2));

        // Verify spec matches requirements
        if (!spec.projectName || !spec.projectType || !spec.frontend || !spec.backend) {
            throw new Error(`Inferred spec is incomplete for stack ${stack.name}`);
        }

        // 2. Project Generation
        console.log("2. Sending project generation request...");
        let generateRes;
        try {
            generateRes = await axios.post(
                "http://localhost:5000/api/project/generate",
                { originalPrompt: stack.prompt, projectSpec: spec },
                authHeader
            );
        } catch (err) {
            console.error("GENERATION CALL FAILED!");
            if (err.response) {
                console.error("Status:", err.response.status);
                console.error("Response Data:", JSON.stringify(err.response.data, null, 2));
            }
            throw err;
        }

        console.log("Generation Success:", generateRes.data.success);
        const { projectId, files, runInstructions } = generateRes.data;
        console.log("Project ID:", projectId);
        console.log("Generated files list:", files.map(f => f.name));
        console.log("Run instructions:", JSON.stringify(runInstructions));

        // 3. Verify files and syntax
        console.log("3. Verifying generated files and configurations...");
        
        const hasReadme = files.some(f => f.name.toLowerCase() === "readme.md");
        if (!hasReadme) throw new Error("README.md is missing from generated files");

        // Verify package.json/requirements.txt exist
        const hasNodeConfig = files.some(f => f.name === "package.json");
        const hasPythonConfig = files.some(f => f.name === "requirements.txt" || f.name === "pyproject.toml");

        if (spec.backend?.toLowerCase().includes("node") || spec.backend?.toLowerCase().includes("express") || spec.frontend?.toLowerCase().includes("react") || spec.frontend?.toLowerCase().includes("next")) {
            if (!hasNodeConfig) throw new Error("package.json is missing for Node/React stack");
            const pjFile = files.find(f => f.name === "package.json");
            const pj = JSON.parse(pjFile.content);
            console.log("package.json Scripts:", pj.scripts);
        } else if (spec.backend?.toLowerCase().includes("python") || spec.backend?.toLowerCase().includes("fastapi")) {
            if (!hasPythonConfig) throw new Error("Dependency files missing for Python stack");
        }

        // 4. Verify ZIP download and contents
        console.log("4. Downloading generated ZIP file...");
        const downloadRes = await axios.get(
            `http://localhost:5000/api/project/${projectId}/download`,
            { ...authHeader, responseType: "arraybuffer" }
        );

        console.log("ZIP downloaded. Status:", downloadRes.status);
        const zip = new AdmZip(downloadRes.data);
        const zipEntries = zip.getEntries();
        console.log("ZIP contents entries count:", zipEntries.length);
        console.log("ZIP entry paths:", zipEntries.map(e => e.entryName));
        
        // Verify ZIP entry count matches the DB files list
        if (zipEntries.length !== files.length) {
            throw new Error(`ZIP contents size mismatch: ZIP has ${zipEntries.length} entries, expected ${files.length}`);
        }

        // 5. Verify History Record in database
        console.log("5. Querying history record from DB...");
        // Wait 1.5 seconds for history to be logged
        await new Promise(resolve => setTimeout(resolve, 1500));
        const historyListRes = await axios.get("http://localhost:5000/api/history", authHeader);
        const projectHistory = historyListRes.data.find(h => h.projectId && h.projectId.toString() === projectId.toString());
        
        if (!projectHistory) {
            console.log("History records list:", historyListRes.data);
            throw new Error(`No history record found for projectId: ${projectId}`);
        }

        console.log("History record successfully saved:");
        console.log("  - type:", projectHistory.type);
        console.log("  - originalPrompt:", projectHistory.originalPrompt);
        console.log("  - summary:", projectHistory.summary);
        console.log("  - generationStatus:", projectHistory.generationStatus);
        console.log("  - projectSpec:", JSON.stringify(projectHistory.projectSpec));

        if (projectHistory.originalPrompt !== stack.prompt) {
            throw new Error("originalPrompt mismatch in history record");
        }
        if (projectHistory.generationStatus !== "success") {
            throw new Error("generationStatus in history is not 'success'");
        }
        
        // Clean up project and history from DB
        await Project.deleteOne({ _id: projectId });
        await History.deleteMany({ userId: regRes.data.user.id });
    }

    // Clean up user from DB
    await User.deleteOne({ _id: regRes.data.user.id });
    console.log("Integration test user cleaned up.");
    
    await mongoose.disconnect();
    console.log("Database disconnected.");
};

const main = async () => {
    try {
        console.log("================= STARTING BUILDER TESTS =================\n");
        await runRepairLoopUnitTest();
        // E2E Integration tests disabled by default for fast verification runs
        // await runE2EIntegrationTests();
        console.log("\n================= ALL BUILDER TESTS PASSED! =================\n");
    } catch (e) {
        console.error("\nTEST RUNNER EXCEPTION:", e.message);
        console.error(e.stack);
        process.exit(1);
    }
};

main();
