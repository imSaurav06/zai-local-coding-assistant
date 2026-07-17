"use strict";

const assert = require("assert");

module.exports = function registerRepairModelTests(suite, test) {
    const {
        createRepairRequest,
        validateRepairRequest,
        isRepairRequest,
        deepFreezeRepairRequest,
        repairErrorCodes,
        REPAIR_MODEL_VERSION
    } = require("../../../core/repair");

    function getSampleValidConfig() {
        return {
            id: "rep_syntax_01",
            executionId: "exec_123",
            taskId: "task_abc",
            type: "SYNTAX",
            severity: "HIGH",
            status: "PENDING",
            reason: "Syntax error on line 42",
            diagnostics: { line: 42, error: "Unexpected identifier" },
            affectedFiles: ["src/App.jsx", "src/index.js"],
            metadata: { attempts: 1 }
        };
    }

    suite("Repair Request Domain Model Layer (Phase 10C-1)", () => {
        // ── 1. Successful creation ──
        test("1. createRepairRequest constructs a valid, deeply frozen RepairRequest object", () => {
            const config = getSampleValidConfig();
            const res = createRepairRequest(config);

            assert.strictEqual(res.success, true);
            assert.deepStrictEqual(res.errors, []);
            assert.ok(res.repairRequest);

            // Verify properties
            assert.strictEqual(res.repairRequest.id, "rep_syntax_01");
            assert.strictEqual(res.repairRequest.type, "SYNTAX");
            assert.strictEqual(res.repairRequest.severity, "HIGH");
            assert.strictEqual(res.repairRequest.status, "PENDING");
            assert.deepStrictEqual(res.repairRequest.affectedFiles, ["src/App.jsx", "src/index.js"]);

            // Immutability checks
            assert.ok(Object.isFrozen(res.repairRequest));
            assert.ok(Object.isFrozen(res.repairRequest.diagnostics));
            assert.ok(Object.isFrozen(res.repairRequest.affectedFiles));
            assert.ok(Object.isFrozen(res.repairRequest.metadata));

            assert.strictEqual(isRepairRequest(res.repairRequest), true);
        });

        // ── 2. Invalid inputs ──
        test("2. createRepairRequest rejects invalid inputs (null, undefined, arrays, non-objects)", () => {
            const badInputs = [null, undefined, "not-an-object", [1, 2, 3], () => {}];
            for (const input of badInputs) {
                const res = createRepairRequest(input);
                assert.strictEqual(res.success, false);
                assert.strictEqual(res.repairRequest, null);
                assert.strictEqual(res.errors[0].code, repairErrorCodes.REPAIR_INVALID_INPUT);
            }
        });

        // ── 3. Invalid structure ──
        test("3. createRepairRequest rejects missing or invalid canonical fields", () => {
            // Missing id
            const config1 = getSampleValidConfig();
            delete config1.id;
            const res1 = createRepairRequest(config1);
            assert.strictEqual(res1.success, false);
            assert.strictEqual(res1.errors[0].code, repairErrorCodes.REPAIR_INVALID_STRUCTURE);
            assert.strictEqual(res1.errors[0].path, "id");

            // Missing reason
            const config2 = getSampleValidConfig();
            delete config2.reason;
            const res2 = createRepairRequest(config2);
            assert.strictEqual(res2.success, false);
            assert.strictEqual(res2.errors[0].code, repairErrorCodes.REPAIR_INVALID_STRUCTURE);
            assert.strictEqual(res2.errors[0].path, "reason");
        });

        // ── 4. Unknown properties ──
        test("4. createRepairRequest rejects unknown top-level properties", () => {
            const config = getSampleValidConfig();
            config.extraNonExistentProperty = "hello";

            const res = createRepairRequest(config);
            assert.strictEqual(res.success, false);
            assert.strictEqual(res.errors[0].code, repairErrorCodes.REPAIR_UNKNOWN_PROPERTY);
            assert.strictEqual(res.errors[0].path, "extraNonExistentProperty");
        });

        // ── 5. Invalid type ──
        test("5. createRepairRequest rejects invalid type values", () => {
            const config = getSampleValidConfig();
            config.type = "UNSUPPORTED_TYPE";

            const res = createRepairRequest(config);
            assert.strictEqual(res.success, false);
            assert.strictEqual(res.errors[0].code, repairErrorCodes.REPAIR_INVALID_TYPE);
            assert.strictEqual(res.errors[0].path, "type");
        });

        // ── 6. Invalid severity ──
        test("6. createRepairRequest rejects invalid severity values", () => {
            const config = getSampleValidConfig();
            config.severity = "VERY_CRITICAL";

            const res = createRepairRequest(config);
            assert.strictEqual(res.success, false);
            assert.strictEqual(res.errors[0].code, repairErrorCodes.REPAIR_INVALID_SEVERITY);
            assert.strictEqual(res.errors[0].path, "severity");
        });

        // ── 7. Invalid status ──
        test("7. createRepairRequest rejects invalid status values", () => {
            const config = getSampleValidConfig();
            config.status = "SUCCESSFUL";

            const res = createRepairRequest(config);
            assert.strictEqual(res.success, false);
            assert.strictEqual(res.errors[0].code, repairErrorCodes.REPAIR_INVALID_STATUS);
            assert.strictEqual(res.errors[0].path, "status");
        });

        // ── 8. Duplicate files ──
        test("8. createRepairRequest rejects duplicate affectedFiles items", () => {
            const config = getSampleValidConfig();
            config.affectedFiles = ["src/App.jsx", "src/App.jsx"]; // duplicate

            const res = createRepairRequest(config);
            assert.strictEqual(res.success, false);
            assert.strictEqual(res.errors[0].code, repairErrorCodes.REPAIR_DUPLICATE_FILE);
            assert.strictEqual(res.errors[0].path, "affectedFiles[1]");
        });

        // ── 9. Input non-mutation ──
        test("9. createRepairRequest does not mutate config parameter", () => {
            const config = getSampleValidConfig();
            const originalJson = JSON.stringify(config);

            createRepairRequest(config);

            assert.strictEqual(JSON.stringify(config), originalJson);
        });

        // ── 10. Type guards and deepFreeze ──
        test("10. isRepairRequest returns false for unfrozen or partially structured objects", () => {
            const config = getSampleValidConfig();
            assert.strictEqual(isRepairRequest(config), false); // unfrozen

            const partial = Object.freeze({ id: "partial_id" });
            assert.strictEqual(isRepairRequest(partial), false); // partial
        });

        // ── 11. Deterministic equality ──
        test("11. Deterministic value equality is preserved across multiple instantiations", () => {
            const config1 = getSampleValidConfig();
            const config2 = getSampleValidConfig();

            const r1 = createRepairRequest(config1).repairRequest;
            const r2 = createRepairRequest(config2).repairRequest;

            assert.deepStrictEqual(r1, r2);
        });
    });
};
