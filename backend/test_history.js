const axios = require("axios");
const mongoose = require("mongoose");
require("dotenv").config();
const User = require("./models/User");
const History = require("./models/History");

async function runTests() {
    console.log("================ RUNNING HISTORY ENDPOINT TESTS ================");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("[Test] Connected to MongoDB Atlas.");

    // Create two test users
    const userA = {
        name: "User A",
        email: "usera_" + Math.random().toString(36).substring(2, 9) + "@test.com",
        password: "password123",
    };

    const userB = {
        name: "User B",
        email: "userb_" + Math.random().toString(36).substring(2, 9) + "@test.com",
        password: "password123",
    };

    let tokenA = "";
    let tokenB = "";
    let userIdA = "";
    let userIdB = "";

    // Register User A
    try {
        const res = await axios.post("http://localhost:5000/api/auth/register", userA);
        tokenA = res.data.token;
        userIdA = res.data.user.id;
        console.log("[Setup] Registered User A:", userA.email);
    } catch (e) {
        console.error("Failed to register user A:", e.message);
        process.exit(1);
    }

    // Register User B
    try {
        const res = await axios.post("http://localhost:5000/api/auth/register", userB);
        tokenB = res.data.token;
        userIdB = res.data.user.id;
        console.log("[Setup] Registered User B:", userB.email);
    } catch (e) {
        console.error("Failed to register user B:", e.message);
        process.exit(1);
    }

    // Test 1: Unauthenticated request should fail (401)
    try {
        console.log("[Test 1] POST /api/history without token...");
        await axios.post("http://localhost:5000/api/history", {
            prompt: "hello",
            response: "world",
            type: "chat",
            model: "test-model",
        });
        console.error("[Test 1] Error: Did not return 401!");
        process.exit(1);
    } catch (error) {
        if (error.response?.status === 401) {
            console.log("[Test 1] Success! Correctly returned 401 Unauthorized.");
        } else {
            console.error("[Test 1] Failed with status:", error.response?.status, error.message);
            process.exit(1);
        }
    }

    // Test 2: Create valid history record (201)
    let recordIdA = "";
    try {
        console.log("[Test 2] POST /api/history with User A token...");
        const res = await axios.post(
            "http://localhost:5000/api/history",
            {
                prompt: "User A prompt",
                response: "User A response text",
                type: "chat",
                model: "glm-4.5-flash",
            },
            {
                headers: { Authorization: `Bearer ${tokenA}` },
            }
        );
        console.log("[Test 2] Success! Status:", res.status);
        console.log("[Test 2] Returned record ID:", res.data.id || res.data._id);
        recordIdA = res.data.id || res.data._id;
    } catch (error) {
        console.error("[Test 2] Failed:", error.response?.status, error.response?.data || error.message);
        process.exit(1);
    }

    // Test 3: Oversized payload (413)
    try {
        console.log("[Test 3] POST /api/history with oversized prompt...");
        const hugePrompt = "a".repeat(50001); // 50KB limit + 1
        await axios.post(
            "http://localhost:5000/api/history",
            {
                prompt: hugePrompt,
                response: "Small response",
                type: "chat",
                model: "glm-4.5-flash",
            },
            {
                headers: { Authorization: `Bearer ${tokenA}` },
            }
        );
        console.error("[Test 3] Error: Did not return 413!");
        process.exit(1);
    } catch (error) {
        if (error.response?.status === 413) {
            console.log("[Test 3] Success! Correctly returned 413 Payload Too Large.");
        } else {
            console.error("[Test 3] Failed with status:", error.response?.status, error.message);
            process.exit(1);
        }
    }

    // Test 4: Cross-user access (User B trying to GET User A's history record -> 403)
    try {
        console.log("[Test 4] GET /api/history/:id of User A using User B's token...");
        await axios.get(`http://localhost:5000/api/history/${recordIdA}`, {
            headers: { Authorization: `Bearer ${tokenB}` },
        });
        console.error("[Test 4] Error: Did not return 403!");
        process.exit(1);
    } catch (error) {
        if (error.response?.status === 403) {
            console.log("[Test 4] Success! Correctly returned 403 Forbidden.");
        } else {
            console.error("[Test 4] Failed with status:", error.response?.status, error.message);
            process.exit(1);
        }
    }

    // Test 5: Cross-user deletion (User B trying to DELETE User A's history record -> 403)
    try {
        console.log("[Test 5] DELETE /api/history/:id of User A using User B's token...");
        await axios.delete(`http://localhost:5000/api/history/${recordIdA}`, {
            headers: { Authorization: `Bearer ${tokenB}` },
        });
        console.error("[Test 5] Error: Did not return 403!");
        process.exit(1);
    } catch (error) {
        if (error.response?.status === 403) {
            console.log("[Test 5] Success! Correctly returned 403 Forbidden.");
        } else {
            console.error("[Test 5] Failed with status:", error.response?.status, error.message);
            process.exit(1);
        }
    }

    // Test 6: Capping at 50 records (Insert 55 records for User B, verify only 50 remain)
    try {
        console.log("[Test 6] Inserting 55 history records for User B...");
        for (let i = 1; i <= 55; i++) {
            await axios.post(
                "http://localhost:5000/api/history",
                {
                    prompt: `User B Prompt #${i}`,
                    response: `User B Response #${i}`,
                    type: "code",
                    model: "glm-4.5-flash",
                },
                {
                    headers: { Authorization: `Bearer ${tokenB}` },
                }
            );
        }
        
        console.log("[Test 6] Verifying User B history count...");
        const res = await axios.get("http://localhost:5000/api/history", {
            headers: { Authorization: `Bearer ${tokenB}` },
        });
        
        console.log("[Test 6] User B Total Records in DB:", res.data.length);
        if (res.data.length === 50) {
            console.log("[Test 6] Success! Exceeded records were auto-deleted, count is capped at 50.");
            
            // Verify that the oldest ones (e.g. Prompt #1) were deleted, and newest (Prompt #55) is present
            const prompts = res.data.map(item => item.prompt);
            const containsOldest = prompts.includes("User B Prompt #1");
            const containsNewest = prompts.includes("User B Prompt #55");
            console.log("[Test 6] Contains oldest (Prompt #1):", containsOldest);
            console.log("[Test 6] Contains newest (Prompt #55):", containsNewest);
            
            if (!containsOldest && containsNewest) {
                console.log("[Test 6] Success! Verification of LIFO/FIFO cleanup order passed.");
            } else {
                console.error("[Test 6] Error: Retention queue order incorrect.");
                process.exit(1);
            }
        } else {
            console.error(`[Test 6] Error: Found ${res.data.length} records instead of 50.`);
            process.exit(1);
        }
    } catch (error) {
        console.error("[Test 6] Failed:", error.response?.status, error.response?.data || error.message);
        process.exit(1);
    }

    console.log("\nALL HISTORY ENDPOINT TESTS PASSED SUCCESSFULLY!");
    await mongoose.disconnect();
}

runTests();
