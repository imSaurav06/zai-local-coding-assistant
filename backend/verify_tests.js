const axios = require('axios');

async function runTest(testNum, payload) {
    console.log(`\n================ RUNNING TEST ${testNum} ================`);
    console.log("Payload:", JSON.stringify(payload));
    console.time(`Test ${testNum} Time`);
    try {
        const response = await axios.post('http://localhost:5000/api/project/generate', payload);
        console.timeEnd(`Test ${testNum} Time`);
        console.log(`Test ${testNum} Success! Status:`, response.status);
        console.log("Response Keys:", Object.keys(response.data));
        console.log("success:", response.data.success);
        console.log("model:", response.data.model);
        console.log("Result length:", response.data.result?.length);
        console.log("Result preview (first 300 chars):");
        console.log(response.data.result?.substring(0, 300));
        console.log("-----------------------------------------");
        return response.data;
    } catch (error) {
        console.timeEnd(`Test ${testNum} Time`);
        console.error(`Test ${testNum} Failed:`, error.message);
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", error.response.data);
        }
        throw error;
    }
}

async function main() {
    try {
        const res1 = await runTest(1, {
            prompt: "Create a simple React landing page for a gym website"
        });

        const res2 = await runTest(2, {
            prompt: "Generate a complete folder structure for a MERN SaaS dashboard"
        });

        console.log("\n================ VERIFICATION ================");
        if (res1.success && res2.success) {
            console.log("1. Both requests returned success: true");
        } else {
            console.log("1. ERROR: One or both requests failed success check");
        }

        if (res1.model && res2.model) {
            console.log(`2. Model names returned: "${res1.model}" and "${res2.model}"`);
        } else {
            console.log("2. ERROR: Model name not returned");
        }

        if (res1.result !== res2.result) {
            console.log("3. Output results are different (Correct)");
        } else {
            console.log("3. ERROR: Output results are identical!");
        }

        const prompt1Match = res1.result.toLowerCase().includes("gym") || res1.result.toLowerCase().includes("fit");
        const prompt2Match = res2.result.toLowerCase().includes("mern") || res2.result.toLowerCase().includes("saas") || res2.result.toLowerCase().includes("dashboard");

        console.log(`4. Test 1 relevant to prompt (contains gym/fit): ${prompt1Match}`);
        console.log(`5. Test 2 relevant to prompt (contains mern/saas/dashboard): ${prompt2Match}`);

        const hasAcmeSaaS1 = res1.result.includes("AcmeSaaS");
        const hasAcmeSaaS2 = res2.result.includes("AcmeSaaS");
        console.log(`6. Test 1 contains AcmeSaaS: ${hasAcmeSaaS1}`);
        console.log(`7. Test 2 contains AcmeSaaS: ${hasAcmeSaaS2}`);

    } catch (e) {
        console.error("Verification failed with error", e.message);
    }
}

main();
