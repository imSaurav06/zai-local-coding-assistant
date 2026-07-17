"use strict";

const assert = require("assert");

module.exports = function registerPatchModelTests(suite, test) {
    const {
        createPatch,
        validatePatch,
        isPatch,
        deepFreezePatch,
        patchErrorCodes,
        PATCH_MODEL_VERSION
    } = require("../../../core/repair");

    function getSampleValidConfig() {
        return {
            id: "patch_01",
            repairId: "rep_syntax_01",
            executionId: "exec_123",
            taskId: "task_abc",
            strategy: "AI",
            status: "PENDING",
            operations: [
                {
                    type: "UPDATE_FILE",
                    path: "src/App.jsx",
                    content: "export default function App() { return <div>Hello</div>; }",
                    metadata: { lineCount: 1 }
                }
            ],
            affectedFiles: ["src/App.jsx"],
            metadata: { duration: 150 }
        };
    }

    suite("Patch Domain Model Layer (Phase 10C-2)", () => {
        // ── 1. Successful creation ──
        test("1. createPatch constructs a valid, deeply frozen Patch object", () => {
            const config = getSampleValidConfig();
            const res = createPatch(config);

            assert.strictEqual(res.success, true);
            assert.deepStrictEqual(res.errors, []);
            assert.ok(res.patch);

            // Verify properties
            assert.strictEqual(res.patch.id, "patch_01");
            assert.strictEqual(res.patch.strategy, "AI");
            assert.strictEqual(res.patch.status, "PENDING");
            assert.strictEqual(res.patch.operations[0].type, "UPDATE_FILE");
            assert.strictEqual(res.patch.operations[0].path, "src/App.jsx");

            // Immutability checks
            assert.ok(Object.isFrozen(res.patch));
            assert.ok(Object.isFrozen(res.patch.operations));
            assert.ok(Object.isFrozen(res.patch.operations[0]));
            assert.ok(Object.isFrozen(res.patch.affectedFiles));
            assert.ok(Object.isFrozen(res.patch.metadata));

            assert.strictEqual(isPatch(res.patch), true);
        });

        // ── 2. Invalid inputs ──
        test("2. createPatch rejects invalid inputs (null, undefined, arrays, non-objects)", () => {
            const badInputs = [null, undefined, "not-an-object", [1, 2, 3], () => {}];
            for (const input of badInputs) {
                const res = createPatch(input);
                assert.strictEqual(res.success, false);
                assert.strictEqual(res.patch, null);
                assert.strictEqual(res.errors[0].code, patchErrorCodes.PATCH_INVALID_INPUT);
            }
        });

        // ── 3. Invalid structure ──
        test("3. createPatch rejects missing or invalid canonical fields", () => {
            // Missing id
            const config1 = getSampleValidConfig();
            delete config1.id;
            const res1 = createPatch(config1);
            assert.strictEqual(res1.success, false);
            assert.strictEqual(res1.errors[0].code, patchErrorCodes.PATCH_INVALID_STRUCTURE);
            assert.strictEqual(res1.errors[0].path, "id");

            // Missing operations
            const config2 = getSampleValidConfig();
            delete config2.operations;
            const res2 = createPatch(config2);
            assert.strictEqual(res2.success, false);
            assert.strictEqual(res2.errors[0].code, patchErrorCodes.PATCH_INVALID_STRUCTURE);
            assert.strictEqual(res2.errors[0].path, "operations");
        });

        // ── 4. Unknown properties ──
        test("4. createPatch rejects unknown top-level properties", () => {
            const config = getSampleValidConfig();
            config.extraNonExistentProperty = "hello";

            const res = createPatch(config);
            assert.strictEqual(res.success, false);
            assert.strictEqual(res.errors[0].code, patchErrorCodes.PATCH_UNKNOWN_PROPERTY);
            assert.strictEqual(res.errors[0].path, "extraNonExistentProperty");
        });

        // ── 5. Invalid strategy ──
        test("5. createPatch rejects invalid strategy values", () => {
            const config = getSampleValidConfig();
            config.strategy = "HYBRID_STRATEGY";

            const res = createPatch(config);
            assert.strictEqual(res.success, false);
            assert.strictEqual(res.errors[0].code, patchErrorCodes.PATCH_INVALID_STRATEGY);
            assert.strictEqual(res.errors[0].path, "strategy");
        });

        // ── 6. Invalid status ──
        test("6. createPatch rejects invalid status values", () => {
            const config = getSampleValidConfig();
            config.status = "EXECUTING";

            const res = createPatch(config);
            assert.strictEqual(res.success, false);
            assert.strictEqual(res.errors[0].code, patchErrorCodes.PATCH_INVALID_STATUS);
            assert.strictEqual(res.errors[0].path, "status");
        });

        // ── 7. Invalid operations ──
        test("7. createPatch rejects empty operations array", () => {
            const config = getSampleValidConfig();
            config.operations = []; // empty

            const res = createPatch(config);
            assert.strictEqual(res.success, false);
            assert.strictEqual(res.errors[0].code, patchErrorCodes.PATCH_INVALID_OPERATION);
            assert.strictEqual(res.errors[0].path, "operations");
        });

        test("8. createPatch rejects operations with invalid type or missing path", () => {
            // Invalid type
            const config1 = getSampleValidConfig();
            config1.operations[0].type = "REPLACE_LINE";
            const res1 = createPatch(config1);
            assert.strictEqual(res1.success, false);
            assert.strictEqual(res1.errors[0].code, patchErrorCodes.PATCH_INVALID_OPERATION);
            assert.strictEqual(res1.errors[0].path, "operations[0].type");

            // Missing path
            const config2 = getSampleValidConfig();
            delete config2.operations[0].path;
            const res2 = createPatch(config2);
            assert.strictEqual(res2.success, false);
            assert.strictEqual(res2.errors[0].code, patchErrorCodes.PATCH_INVALID_OPERATION);
            assert.strictEqual(res2.errors[0].path, "operations[0].path");
        });

        // ── 8. Duplicate files ──
        test("9. createPatch rejects duplicate affectedFiles items", () => {
            const config = getSampleValidConfig();
            config.affectedFiles = ["src/App.jsx", "src/App.jsx"]; // duplicate

            const res = createPatch(config);
            assert.strictEqual(res.success, false);
            assert.strictEqual(res.errors[0].code, patchErrorCodes.PATCH_DUPLICATE_FILE);
            assert.strictEqual(res.errors[0].path, "affectedFiles[1]");
        });

        // ── 9. Input non-mutation ──
        test("10. createPatch does not mutate config parameter", () => {
            const config = getSampleValidConfig();
            const originalJson = JSON.stringify(config);

            createPatch(config);

            assert.strictEqual(JSON.stringify(config), originalJson);
        });

        // ── 10. Type guards and deepFreeze ──
        test("11. isPatch returns false for unfrozen or partially structured objects", () => {
            const config = getSampleValidConfig();
            assert.strictEqual(isPatch(config), false); // unfrozen

            const partial = Object.freeze({ id: "partial_id" });
            assert.strictEqual(isPatch(partial), false); // partial
        });

        // ── 11. Deterministic equality ──
        test("12. Deterministic value equality is preserved across multiple instantiations", () => {
            const config1 = getSampleValidConfig();
            const config2 = getSampleValidConfig();

            const p1 = createPatch(config1).patch;
            const p2 = createPatch(config2).patch;

            assert.deepStrictEqual(p1, p2);
        });
    });
};
