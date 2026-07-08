/**
 * Auth, Authorization & Download Integration Tests
 * Runs against the live backend at http://localhost:5000 and connects to MongoDB directly.
 * Verifies register, login, invalid/missing JWT rejection, history access, and strict cross-user project/ZIP/preview isolation.
 */
require("dotenv").config();
const axios = require("axios");
const assert = require("assert");
const mongoose = require("mongoose");
const Project = require("./models/Project");
const User = require("./models/User");

const BASE_URL = "http://localhost:5000";
const timestamp = Date.now();
const TEST_USER = { name: `Test User ${timestamp}`, email: `testuser_${timestamp}@e2e.test`, password: "TestPass@123!" };
const TEST_USER2 = { name: `Test User2 ${timestamp}`, email: `testuser2_${timestamp}@e2e.test`, password: "TestPass@456!" };

let token1 = null;
let token2 = null;
let user1Id = null;
let user2Id = null;
let projectId = null;

const run = async () => {
    console.log("================= STARTING AUTH & AUTHORIZATION INTEGRATION TESTS =================\n");

    // Connect to database to clean up users and insert mock project directly
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB for direct database checks.");

    // ---- 1. Register User 1
    console.log("1. Testing registration...");
    const reg1 = await axios.post(`${BASE_URL}/api/auth/register`, TEST_USER);
    assert.strictEqual(reg1.status, 201, "Registration should return 201");
    assert.ok(reg1.data.token, "Registration should return a token");
    token1 = reg1.data.token;
    user1Id = reg1.data.user.id;
    console.log("   - Register user: PASS");

    // ---- 2. Register User 2
    const reg2 = await axios.post(`${BASE_URL}/api/auth/register`, TEST_USER2);
    assert.strictEqual(reg2.status, 201);
    token2 = reg2.data.token;
    user2Id = reg2.data.user.id;
    console.log("   - Register second user: PASS");

    // ---- 3. Login User 1
    console.log("\n2. Testing login...");
    const login1 = await axios.post(`${BASE_URL}/api/auth/login`, { email: TEST_USER.email, password: TEST_USER.password });
    assert.strictEqual(login1.status, 200, "Login should return 200");
    assert.ok(login1.data.token, "Login should return a token");
    token1 = login1.data.token; // Refresh token
    console.log("   - Login user: PASS");

    // ---- 4. Protected route rejection with invalid JWT
    console.log("\n3. Testing invalid JWT rejection...");
    try {
        await axios.get(`${BASE_URL}/api/history`, {
            headers: { Authorization: "Bearer invalid.jwt.token" }
        });
        assert.fail("Should have thrown 401/403");
    } catch (err) {
        assert.ok(err.response && (err.response.status === 401 || err.response.status === 403),
            `Expected 401/403, got ${err.response?.status}`);
        console.log("   - Invalid JWT rejected: PASS");
    }

    // ---- 5. Protected route rejection with no JWT
    try {
        await axios.get(`${BASE_URL}/api/history`);
        assert.fail("Should have thrown 401/403");
    } catch (err) {
        assert.ok(err.response && (err.response.status === 401 || err.response.status === 403),
            `Expected 401/403, got ${err.response?.status}`);
        console.log("   - Missing JWT rejected: PASS");
    }

    // ---- 6. History endpoint accessible with valid JWT
    console.log("\n4. Testing authenticated route access...");
    const histResp = await axios.get(`${BASE_URL}/api/history`, {
        headers: { Authorization: `Bearer ${token1}` }
    });
    assert.strictEqual(histResp.status, 200, "History endpoint should be accessible");
    console.log("   - Authenticated history access: PASS");

    // ---- 7. Create project directly in MongoDB to avoid external AI API credits
    console.log("\n5. Creating mock project directly in database for user1...");
    const project = await Project.create({
        userId: user1Id,
        projectName: "AuthMockProject",
        projectType: "React Landing Page",
        files: [
            { name: "package.json", content: JSON.stringify({ name: "mock-project", private: true, dependencies: { react: "^18.2.0" } }) },
            { name: "index.html", content: "<html><body><div id=\"root\"></div></body></html>" }
        ],
        generationStatus: "success",
        originalPrompt: "Create a simple React mock landing page"
    });
    projectId = project._id.toString();
    console.log(`   - Project created directly: PASS (ID: ${projectId})`);

    // ---- 8. Project ownership: user2 cannot access user1's project
    console.log("\n6. Testing project ownership isolation...");
    try {
        await axios.get(`${BASE_URL}/api/project/${projectId}`, {
            headers: { Authorization: `Bearer ${token2}` }
        });
        assert.fail("Should have rejected cross-user access to project");
    } catch (err) {
        assert.ok(
            err.response && (err.response.status === 403 || err.response.status === 404),
            `Expected 403 or 404, got ${err.response?.status}`
        );
        console.log("   - Cross-user project access rejected: PASS");
    }

    // ---- 9. Preview ownership: user2 cannot start preview of user1's project
    console.log("\n7. Testing unauthorized preview access rejection...");
    try {
        await axios.post(
            `${BASE_URL}/api/project/${projectId}/preview`,
            {},
            { headers: { Authorization: `Bearer ${token2}` } }
        );
        assert.fail("Should have rejected unauthorized preview access");
    } catch (err) {
        assert.ok(
            err.response && (err.response.status === 403 || err.response.status === 404),
            `Expected 403 or 404, got ${err.response?.status}`
        );
        console.log("   - Unauthorized preview access rejected: PASS");
    }

    // ---- 10. Download ZIP (user1 owns the project)
    console.log("\n8. Testing ZIP download...");
    try {
        const dlResp = await axios.get(
            `${BASE_URL}/api/project/${projectId}/download`,
            {
                headers: { Authorization: `Bearer ${token1}` },
                responseType: "arraybuffer",
                timeout: 30000
            }
        );
        assert.strictEqual(dlResp.status, 200, "Download should return 200");
        assert.ok(dlResp.headers["content-type"]?.includes("zip") ||
                  dlResp.headers["content-disposition"]?.includes(".zip"),
            "Response should be a ZIP file");
        const zipBytes = dlResp.data.byteLength;
        assert.ok(zipBytes > 100, `ZIP too small: ${zipBytes} bytes`);
        console.log(`   - ZIP download: PASS (${zipBytes} bytes)`);
    } catch (err) {
        if (err.response) {
            console.error(`   - ZIP download FAILED: HTTP ${err.response.status}`, 
                err.response.data?.toString?.().slice(0, 200));
        } else {
            console.error("   - ZIP download FAILED:", err.message);
        }
        throw err;
    }

    // ---- 11. ZIP download rejected for user2
    console.log("\n9. Testing cross-user ZIP download rejection...");
    try {
        await axios.get(
            `${BASE_URL}/api/project/${projectId}/download`,
            {
                headers: { Authorization: `Bearer ${token2}` },
                responseType: "arraybuffer"
            }
        );
        assert.fail("Should have rejected unauthorized ZIP download");
    } catch (err) {
        assert.ok(
            err.response && (err.response.status === 403 || err.response.status === 404),
            `Expected 403/404, got ${err.response?.status}`
        );
        console.log("   - Cross-user ZIP download rejected: PASS");
    }

    // Clean up mock project and users from database
    await Project.deleteOne({ _id: projectId });
    await User.deleteMany({ email: { $in: [TEST_USER.email, TEST_USER2.email] } });
    console.log("\nDatabase cleaned up successfully.");

    await mongoose.connection.close();
    console.log("\n================= AUTH & AUTHORIZATION TESTS PASSED =================");
    process.exit(0);
};

run().catch(async (err) => {
    console.error("FATAL TEST ERROR:", err.message);
    if (err.response) {
        console.error("Response status:", err.response.status);
        console.error("Response data:", JSON.stringify(err.response.data).slice(0, 500));
    }
    if (projectId) {
        await Project.deleteOne({ _id: projectId });
    }
    await User.deleteMany({ email: { $in: [TEST_USER.email, TEST_USER2.email] } });
    await mongoose.connection.close();
    process.exit(1);
});
