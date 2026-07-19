"use strict";

const assert = require("assert");

module.exports = function registerRepairPipelineTests(suite, test) {
    const {
        createRepairRequest,
        createRepairPipeline,
        validateRepairPipelineResult,
        isRepairPipelineResult,
        repairPipelineErrorCodes,
        REPAIR_PIPELINE_VERSION
    } = require("../../../core/repair");

    const verification = require("../../../core/verification");
    const originalRun = verification.runVerification;

    function getValidRepairRequest(type = "SYNTAX", severity = "HIGH") {
        const config = {
            id: "rep_syntax_01",
            executionId: "exec_123",
            taskId: "task_abc",
            type,
            severity,
            status: "PENDING",
            reason: "Mock reason text",
            diagnostics: {},
            affectedFiles: ["src/App.jsx"],
            metadata: {}
        };
        return createRepairRequest(config).repairRequest;
    }

    suite("Repair Pipeline Model Layer (Phase 10C-4)", () => {
        
        test("z. Restore verification runVerification", () => {
            verification.runVerification = originalRun;
        });

        // ── 1. Successful pipeline execution ──
        test("1. execute() successfully coordinates RepairPlanner and Patch models", async () => {
            const req = getValidRepairRequest("SYNTAX", "HIGH");
            const pipeline = createRepairPipeline();

            verification.runVerification = () => {
                return {
                    success: true,
                    errors: [],
                    warnings: []
                };
            };

            const result = await pipeline.execute(req);

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.status, "SUCCESS");
            
            // Check request, plan, and patch exist and are valid
            assert.strictEqual(result.repairRequest, req);
            assert.ok(result.repairPlan);
            assert.ok(result.patch);
            assert.ok(result.verificationResult);

            // Immutability checks
            assert.ok(Object.isFrozen(result));
            assert.ok(Object.isFrozen(result.repairPlan));
            assert.ok(Object.isFrozen(result.patch));

            assert.strictEqual(isRepairPipelineResult(result), true);
        });

        // ── 2. Invalid RepairRequest ──
        test("2. execute() throws REPAIR_PIPELINE_INVALID_INPUT for invalid requests", async () => {
            const pipeline = createRepairPipeline();
            const badInputs = [null, undefined, {}, { id: "bad_req" }];
            
            for (const input of badInputs) {
                await assert.rejects(async () => {
                    await pipeline.execute(input);
                }, (err) => {
                    return err.code === repairPipelineErrorCodes.REPAIR_PIPELINE_INVALID_INPUT;
                });
            }
        });

        // ── 3. Planner failure propagation ──
        test("3. execute() handles and throws planner failures", async () => {
            const pipeline = createRepairPipeline();
            const req = getValidRepairRequest();
            
            const repairPlanner = require("../../../core/repair/repairPlanner");
            const originalCreate = repairPlanner.createRepairPlan;
            
            repairPlanner.createRepairPlan = () => {
                return {
                    success: false,
                    errors: [{ code: "MOCK_PLANNER_FAIL", message: "Planner failed" }]
                };
            };

            try {
                await assert.rejects(async () => {
                    await pipeline.execute(req);
                }, (err) => {
                    return err.code === repairPipelineErrorCodes.REPAIR_PIPELINE_PLANNER_FAILED;
                });
            } finally {
                repairPlanner.createRepairPlan = originalCreate;
            }
        });

        // ── 4. Patch validation failure ──
        test("4. execute() handles and throws patch validation failures", async () => {
            const pipeline = createRepairPipeline();
            const req = getValidRepairRequest();

            const patchModel = require("../../../core/repair/patchModel");
            const originalCreate = patchModel.createPatch;

            patchModel.createPatch = () => {
                return {
                    success: false,
                    errors: [{ code: "MOCK_PATCH_FAIL", message: "Patch failed" }]
                };
            };

            try {
                await assert.rejects(async () => {
                    await pipeline.execute(req);
                }, (err) => {
                    return err.code === repairPipelineErrorCodes.REPAIR_PIPELINE_PATCH_FAILED;
                });
            } finally {
                patchModel.createPatch = originalCreate;
            }
        });

        // ── 5. Input non-mutation ──
        test("5. execute() does not mutate input parameters", async () => {
            const req = getValidRepairRequest();
            const originalJson = JSON.stringify(req);

            const pipeline = createRepairPipeline();
            verification.runVerification = () => ({ success: true });

            await pipeline.execute(req);

            assert.strictEqual(JSON.stringify(req), originalJson);
        });

        // ── 6. Type guards and deepFreeze ──
        test("6. isRepairPipelineResult returns false for unfrozen or partially structured objects", async () => {
            const req = getValidRepairRequest();
            const pipeline = createRepairPipeline();
            verification.runVerification = () => ({ success: true });

            const result = await pipeline.execute(req);

            const unfrozen = JSON.parse(JSON.stringify(result));
            assert.strictEqual(isRepairPipelineResult(unfrozen), false);

            const partial = Object.freeze({ success: true });
            assert.strictEqual(isRepairPipelineResult(partial), false);
        });

        // ── 7. Deterministic equality ──
        test("7. Deterministic value equality is preserved across multiple pipeline execution runs", async () => {
            const req1 = getValidRepairRequest();
            const req2 = getValidRepairRequest();

            const pipeline = createRepairPipeline();
            verification.runVerification = () => ({ success: true, errors: [], warnings: [] });

            const res1 = await pipeline.execute(req1);
            const res2 = await pipeline.execute(req2);

            assert.deepStrictEqual(res1, res2);
        });

        test("z. Restore verification runVerification", () => {
            verification.runVerification = originalRun;
        });
    });
};
