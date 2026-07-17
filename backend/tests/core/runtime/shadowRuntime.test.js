"use strict";

const assert = require("assert");

module.exports = function registerShadowRuntimeTests(suite, test) {
    const {
        createExecutionRuntimeAdapter,
        createShadowRuntime,
        executeShadow,
        SHADOW_RUNTIME_VERSION,
        shadowRuntimeErrorCodes
    } = require("../../../core/runtime");

    function getSampleRequest() {
        return {
            projectSpec: {
                projectName: "FitnessApp",
                projectType: "react-vite",
                frontend: "React",
                backend: "None",
                database: "None",
                authentication: "None",
                designRequirements: "None"
            },
            metadata: {
                originalPrompt: "Create a fitness app landing page"
            }
        };
    }

    suite("Shadow Runtime Layer (Phase 11A-7)", () => {
        // Clear mocks after each test
        test("z. Clean mocks", () => {
            global.__shadowModularMock = null;
            global.__throwShadowErrors = null;
            global.__throwParityMismatchInTest = null;
        });

        // ── 1. Shadow Disabled ──
        test("1. executeShadow() returns null immediately when enableShadowRuntime is false", async () => {
            global.__shadowModularMock = null;
            global.__throwShadowErrors = false;
            global.__throwParityMismatchInTest = false;

            const adapter = createExecutionRuntimeAdapter({ enableShadowRuntime: false });
            const request = getSampleRequest();
            const legacyResponse = { result: { files: [] } };

            const res = await executeShadow(adapter, request, legacyResponse);
            assert.strictEqual(res, null);
        });

        // ── 2. Shadow Enabled (Mock Modular output) ──
        test("2. executeShadow() returns modular output when enableShadowRuntime is true", async () => {
            global.__throwShadowErrors = false;
            global.__throwParityMismatchInTest = false;

            const adapter = createExecutionRuntimeAdapter({ enableShadowRuntime: true });
            const request = getSampleRequest();
            const legacyResponse = { result: { files: [{ name: "A.js", content: "a" }] } };

            global.__shadowModularMock = (req, legacy) => {
                return {
                    result: {
                        files: [{ name: "A.js", content: "a" }],
                        projectSpec: req.projectSpec
                    }
                };
            };

            const res = await executeShadow(adapter, request, legacyResponse);
            assert.ok(res);
            assert.strictEqual(res.result.files[0].content, "a");
            assert.strictEqual(res.result.projectSpec.projectName, "FitnessApp");
        });

        // ── 3. Parity Validation Hook ──
        test("3. executeShadow() runs parity check and throws when throwParityMismatchInTest is configured", async () => {
            global.__throwShadowErrors = false;
            global.__throwParityMismatchInTest = true;

            const adapter = createExecutionRuntimeAdapter({ enableShadowRuntime: true, enableParityValidation: true });
            const request = getSampleRequest();
            const legacyResponse = {
                result: {
                    files: [{ name: "A.js", content: "legacy" }],
                    runInstructions: "npm start",
                    summary: "Succeeded",
                    model: "glm-5.2",
                    projectSpec: request.projectSpec
                },
                metadata: {
                    verificationResult: { status: "PASSED" }
                }
            };

            global.__shadowModularMock = (req, legacy) => {
                return {
                    result: {
                        files: [{ name: "A.js", content: "different modular content" }],
                        runInstructions: "npm start",
                        summary: "Succeeded",
                        model: "glm-5.2",
                        projectSpec: req.projectSpec
                    },
                    metadata: {
                        verificationResult: { status: "PASSED" }
                    }
                };
            };

            await assert.rejects(async () => {
                await executeShadow(adapter, request, legacyResponse);
            }, (err) => {
                return err.code === "PARITY_VALIDATION_FAILED" && err.report.success === false;
            });
        });

        // ── 4. Error Isolation & Translation ──
        test("4. executeShadow() catches internal exception, logs it, and returns null to keep legacy run safe", async () => {
            global.__throwParityMismatchInTest = false;
            global.__throwShadowErrors = false;

            const adapter = createExecutionRuntimeAdapter({ enableShadowRuntime: true });
            const request = getSampleRequest();
            const legacyResponse = { result: { files: [] } };

            global.__shadowModularMock = () => {
                throw new Error("Out of memory in shadow thread");
            };

            // Must NOT throw
            const res = await executeShadow(adapter, request, legacyResponse);
            assert.strictEqual(res, null);
        });

        test("5. executeShadow() throws SHADOW_RUNTIME_FAILED when throwShadowErrors is enabled in test mode", async () => {
            global.__throwParityMismatchInTest = false;
            global.__throwShadowErrors = true;

            const adapter = createExecutionRuntimeAdapter({ enableShadowRuntime: true });
            const request = getSampleRequest();
            const legacyResponse = { result: { files: [] } };

            global.__shadowModularMock = () => {
                throw new Error("Out of memory in shadow thread");
            };

            await assert.rejects(async () => {
                await executeShadow(adapter, request, legacyResponse);
            }, (err) => {
                return err.code === shadowRuntimeErrorCodes.SHADOW_RUNTIME_FAILED;
            });
        });

        // ── 5. Immutability / Deep Freeze ──
        test("6. executeShadow() returns deeply frozen output", async () => {
            global.__throwParityMismatchInTest = false;
            global.__throwShadowErrors = false;

            const adapter = createExecutionRuntimeAdapter({ enableShadowRuntime: true });
            const request = getSampleRequest();
            const legacyResponse = { result: { files: [] } };

            global.__shadowModularMock = () => {
                return { result: { files: [{ name: "B.js" }] } };
            };

            const res = await executeShadow(adapter, request, legacyResponse);
            assert.ok(Object.isFrozen(res));
            assert.ok(Object.isFrozen(res.result));
            assert.ok(Object.isFrozen(res.result.files));
        });

        // ── 6. Public API ──
        test("7. exposes expected version and functions", () => {
            assert.strictEqual(SHADOW_RUNTIME_VERSION, "1.0");
            const shadow = createShadowRuntime();
            assert.ok(shadow.executeShadow);
        });
    });
};
