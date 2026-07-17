"use strict";

const assert = require("assert");

module.exports = function registerRepairPlannerTests(suite, test) {
    const {
        createRepairRequest,
        createRepairPlan,
        validateRepairPlan,
        isRepairPlan,
        repairPlannerErrorCodes,
        REPAIR_PLANNER_VERSION
    } = require("../../../core/repair");

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

    suite("Repair Planner Model Layer (Phase 10C-3)", () => {
        // ── 1. Plan creation & default mappings ──
        test("1. createRepairPlan constructs a valid, deeply frozen RepairPlan from RepairRequest", () => {
            const req = getValidRepairRequest("SYNTAX", "HIGH");
            const res = createRepairPlan(req);

            assert.strictEqual(res.success, true);
            assert.deepStrictEqual(res.errors, []);
            assert.ok(res.repairPlan);

            // Check details
            assert.strictEqual(res.repairPlan.id, "plan_rep_syntax_01");
            assert.strictEqual(res.repairPlan.repairId, "rep_syntax_01");
            assert.strictEqual(res.repairPlan.strategy, "DETERMINISTIC");
            assert.strictEqual(res.repairPlan.priority, "HIGH");
            assert.strictEqual(res.repairPlan.steps.length, 5);

            // Immutability checks
            assert.ok(Object.isFrozen(res.repairPlan));
            assert.ok(Object.isFrozen(res.repairPlan.steps));
            assert.ok(Object.isFrozen(res.repairPlan.steps[0]));

            assert.strictEqual(isRepairPlan(res.repairPlan), true);
        });

        // ── 2. Strategy Mapping ──
        test("2. Strategy is mapped to DETERMINISTIC or AI depending on request type", () => {
            // SYNTAX -> DETERMINISTIC
            const syntaxReq = getValidRepairRequest("SYNTAX");
            assert.strictEqual(createRepairPlan(syntaxReq).repairPlan.strategy, "DETERMINISTIC");

            // COMPILATION -> DETERMINISTIC
            const compReq = getValidRepairRequest("COMPILATION");
            assert.strictEqual(createRepairPlan(compReq).repairPlan.strategy, "DETERMINISTIC");

            // RUNTIME -> AI
            const runtimeReq = getValidRepairRequest("RUNTIME");
            assert.strictEqual(createRepairPlan(runtimeReq).repairPlan.strategy, "AI");

            // VERIFICATION -> AI
            const verifyReq = getValidRepairRequest("VERIFICATION");
            assert.strictEqual(createRepairPlan(verifyReq).repairPlan.strategy, "AI");
        });

        // ── 3. Invalid RepairRequest ──
        test("3. createRepairPlan rejects invalid RepairRequests", () => {
            const badInputs = [null, undefined, {}, { id: "not-a-real-request" }];
            for (const input of badInputs) {
                const res = createRepairPlan(input);
                assert.strictEqual(res.success, false);
                assert.strictEqual(res.repairPlan, null);
                assert.strictEqual(res.errors[0].code, repairPlannerErrorCodes.REPAIR_PLAN_INVALID_INPUT);
            }
        });

        // ── 4. Invalid priority ──
        test("4. validateRepairPlan rejects invalid priority values", () => {
            const req = getValidRepairRequest();
            const plan = createRepairPlan(req).repairPlan;

            // Clone and mutate to bypass createRepairPlan builder
            const planConfig = JSON.parse(JSON.stringify(plan));
            planConfig.priority = "VERY_HIGH";

            const val = validateRepairPlan(planConfig);
            assert.strictEqual(val.success, false);
            assert.strictEqual(val.errors[0].code, repairPlannerErrorCodes.REPAIR_PLAN_INVALID_PRIORITY);
        });

        // ── 5. Invalid step ──
        test("5. validateRepairPlan rejects empty steps or steps with invalid types", () => {
            const req = getValidRepairRequest();
            const plan = createRepairPlan(req).repairPlan;

            // Empty steps
            const planConfig1 = JSON.parse(JSON.stringify(plan));
            planConfig1.steps = [];
            const val1 = validateRepairPlan(planConfig1);
            assert.strictEqual(val1.success, false);
            assert.strictEqual(val1.errors[0].code, repairPlannerErrorCodes.REPAIR_PLAN_INVALID_STEP);

            // Invalid step type
            const planConfig2 = JSON.parse(JSON.stringify(plan));
            planConfig2.steps = [{ type: "COMPROMISE_SECURITY" }];
            const val2 = validateRepairPlan(planConfig2);
            assert.strictEqual(val2.success, false);
            assert.strictEqual(val2.errors[0].code, repairPlannerErrorCodes.REPAIR_PLAN_INVALID_STEP);
        });

        // ── 6. Duplicate steps ──
        test("6. validateRepairPlan rejects duplicate step types", () => {
            const req = getValidRepairRequest();
            const plan = createRepairPlan(req).repairPlan;

            const planConfig = JSON.parse(JSON.stringify(plan));
            planConfig.steps = [
                { type: "ANALYZE" },
                { type: "ANALYZE" } // duplicate
            ];

            const val = validateRepairPlan(planConfig);
            assert.strictEqual(val.success, false);
            assert.strictEqual(val.errors[0].code, repairPlannerErrorCodes.REPAIR_PLAN_DUPLICATE_STEP);
            assert.strictEqual(val.errors[0].path, "steps[1].type");
        });

        // ── 7. Input non-mutation ──
        test("7. createRepairPlan does not mutate the input RepairRequest", () => {
            const req = getValidRepairRequest();
            const originalJson = JSON.stringify(req);

            createRepairPlan(req);

            assert.strictEqual(JSON.stringify(req), originalJson);
        });

        // ── 8. Type guards and deepFreeze ──
        test("8. isRepairPlan returns false for unfrozen or partially structured objects", () => {
            const req = getValidRepairRequest();
            const plan = createRepairPlan(req).repairPlan;

            // Unfrozen object
            const unfrozen = JSON.parse(JSON.stringify(plan));
            assert.strictEqual(isRepairPlan(unfrozen), false);

            const partial = Object.freeze({ id: "partial_plan" });
            assert.strictEqual(isRepairPlan(partial), false);
        });

        // ── 9. Deterministic equality ──
        test("9. Deterministic value equality is preserved across multiple plan instantiations", () => {
            const req1 = getValidRepairRequest();
            const req2 = getValidRepairRequest();

            const p1 = createRepairPlan(req1).repairPlan;
            const p2 = createRepairPlan(req2).repairPlan;

            assert.deepStrictEqual(p1, p2);
        });
    });
};
