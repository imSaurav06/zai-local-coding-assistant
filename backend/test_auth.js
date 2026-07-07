const axios = require("axios");
const mongoose = require("mongoose");
require("dotenv").config();
const User = require("./models/User");

const testUser = {
    name: "Verification Developer",
    email: "verify_" + Math.random().toString(36).substring(2, 9) + "@zai.dev",
    password: "password123",
};

async function testAll() {
    console.log("================ RUNNING AUTHENTICATION TESTS ================");

    // Connect mongoose to inspect database directly
    await mongoose.connect(process.env.MONGO_URI);
    console.log("[Test] Mongoose connected directly for inspection.");

    let token = "";
    let userId = "";

    // 1. Register a new user
    try {
        console.log(`[Test 1] Registering user: ${testUser.email}`);
        const res = await axios.post("http://localhost:5000/api/auth/register", testUser);
        console.log("[Test 1] Success! Status:", res.status);
        console.log("[Test 1] Response Success:", res.data.success);
        console.log("[Test 1] Token Returned:", !!res.data.token);
        console.log("[Test 1] User Returned:", JSON.stringify(res.data.user));
        
        token = res.data.token;
        userId = res.data.user.id;
    } catch (error) {
        console.error("[Test 1] Failed:", error.response?.status, error.response?.data || error.message);
        process.exit(1);
    }

    // 2. Verify duplicate registration (409 Conflict)
    try {
        console.log("[Test 2] Attempting duplicate registration...");
        await axios.post("http://localhost:5000/api/auth/register", testUser);
        console.error("[Test 2] Error: Registration should have failed with 409!");
        process.exit(1);
    } catch (error) {
        if (error.response?.status === 409) {
            console.log("[Test 2] Success! Correctly returned 409 Conflict.");
        } else {
            console.error("[Test 2] Failed with unexpected status/error:", error.response?.status, error.message);
            process.exit(1);
        }
    }

    // 3. Verify user document is hashed in MongoDB
    try {
        console.log(`[Test 3] Fetching user directly from MongoDB to check password hashing...`);
        const dbUser = await User.findById(userId);
        if (!dbUser) {
            console.error("[Test 3] Error: User not found in DB!");
            process.exit(1);
        }
        console.log("[Test 3] DB Password Hash:", dbUser.password);
        const isPlaintext = dbUser.password === testUser.password;
        const startsWithBcrypt = dbUser.password.startsWith("$2a$") || dbUser.password.startsWith("$2b$");
        if (!isPlaintext && startsWithBcrypt) {
            console.log("[Test 3] Success! Password in MongoDB is a secure bcrypt hash and not plaintext.");
        } else {
            console.error("[Test 3] Error: Password in DB is NOT hashed correctly!", { isPlaintext, startsWithBcrypt });
            process.exit(1);
        }
    } catch (error) {
        console.error("[Test 3] Failed to inspect DB:", error.message);
        process.exit(1);
    }

    // 4. Login with correct credentials
    try {
        console.log("[Test 4] Logging in with correct credentials...");
        const res = await axios.post("http://localhost:5000/api/auth/login", {
            email: testUser.email,
            password: testUser.password,
        });
        console.log("[Test 4] Success! Status:", res.status);
        console.log("[Test 4] Token Returned:", !!res.data.token);
    } catch (error) {
        console.error("[Test 4] Failed:", error.response?.status, error.response?.data || error.message);
        process.exit(1);
    }

    // 5. Login with incorrect password (401 Unauthorized)
    try {
        console.log("[Test 5] Logging in with wrong password...");
        await axios.post("http://localhost:5000/api/auth/login", {
            email: testUser.email,
            password: "wrongpassword",
        });
        console.error("[Test 5] Error: Login should have failed with 401!");
        process.exit(1);
    } catch (error) {
        if (error.response?.status === 401) {
            console.log("[Test 5] Success! Correctly returned 401 Unauthorized.");
        } else {
            console.error("[Test 5] Failed with unexpected error:", error.response?.status, error.message);
            process.exit(1);
        }
    }

    // 6. GET profile with valid token
    try {
        console.log("[Test 6] Fetching profile with valid JWT...");
        const res = await axios.get("http://localhost:5000/api/auth/profile", {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        console.log("[Test 6] Success! Status:", res.status);
        console.log("[Test 6] Profile Returned:", JSON.stringify(res.data.user));
    } catch (error) {
        console.error("[Test 6] Failed:", error.response?.status, error.response?.data || error.message);
        process.exit(1);
    }

    // 7. GET profile with missing or invalid token
    try {
        console.log("[Test 7] Fetching profile with invalid JWT...");
        await axios.get("http://localhost:5000/api/auth/profile", {
            headers: {
                Authorization: `Bearer invalid-token-xyz`,
            },
        });
        console.error("[Test 7] Error: Request should have failed with 401!");
        process.exit(1);
    } catch (error) {
        if (error.response?.status === 401) {
            console.log("[Test 7] Success! Correctly returned 401 Unauthorized.");
        } else {
            console.error("[Test 7] Failed with unexpected error:", error.response?.status, error.message);
            process.exit(1);
        }
    }

    // 8. PUT profile name with valid token
    try {
        console.log("[Test 8] Updating profile name...");
        const res = await axios.put(
            "http://localhost:5000/api/auth/profile",
            { name: "Updated Verification Name" },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            }
        );
        console.log("[Test 8] Success! Status:", res.status);
        console.log("[Test 8] Updated Profile:", JSON.stringify(res.data.user));
        if (res.data.user.name === "Updated Verification Name") {
            console.log("[Test 8] Success! Name verified as updated.");
        } else {
            console.error("[Test 8] Error: Name mismatch in response!");
            process.exit(1);
        }
    } catch (error) {
        console.error("[Test 8] Failed:", error.response?.status, error.response?.data || error.message);
        process.exit(1);
    }

    // 9. Test protected /api/ai/chat returns 401 without token
    try {
        console.log("[Test 9] Querying protected /api/ai/chat without token...");
        await axios.post("http://localhost:5000/api/ai/chat", { prompt: "hi" });
        console.error("[Test 9] Error: Request should have failed with 401!");
        process.exit(1);
    } catch (error) {
        if (error.response?.status === 401) {
            console.log("[Test 9] Success! Correctly returned 401 Unauthorized.");
        } else {
            console.error("[Test 9] Failed with unexpected error:", error.response?.status, error.message);
            process.exit(1);
        }
    }

    // 10. Test protected /api/project/generate returns 401 without token
    try {
        console.log("[Test 10] Querying protected /api/project/generate without token...");
        await axios.post("http://localhost:5000/api/project/generate", { prompt: "scaffold" });
        console.error("[Test 10] Error: Request should have failed with 401!");
        process.exit(1);
    } catch (error) {
        if (error.response?.status === 401) {
            console.log("[Test 10] Success! Correctly returned 401 Unauthorized.");
        } else {
            console.error("[Test 10] Failed with unexpected error:", error.response?.status, error.message);
            process.exit(1);
        }
    }

    console.log("\nALL AUTHENTICATION ENDPOINT TESTS PASSED SUCCESSFULLY!");
    mongoose.disconnect();
}

testAll();
