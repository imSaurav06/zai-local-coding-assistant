"use strict";

const assert = require("assert");

module.exports = function registerPipelineAuditTests(suite, test) {
    const { validatePipeline } = require("../../../core/audit/pipelineAudit");

    suite("Pipeline Audit Engine (Phase 12C)", () => {
        test("1. Successfully validates standard execution stage sequencing", () => {
            const executionMetadata = {
                stages: ["PLAN", "GENERATE", "VERIFY"],
                startTime: "2026-07-19T10:00:00Z",
                endTime: "2026-07-19T10:05:00Z",
                steps: [
                    { name: "task_plan", status: "COMPLETED" },
                    { name: "task_generate", status: "COMPLETED" }
                ]
            };

            const result = validatePipeline(executionMetadata);

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.errors.length, 0);
            assert.strictEqual(result.warnings.length, 0);
        });

        test("2. Detects step failure or out-of-order execution stages", () => {
            const executionMetadata = {
                stages: ["GENERATE", "PLAN", "VERIFY"], // Out of order!
                startTime: "2026-07-19T10:00:00Z",
                endTime: "2026-07-19T09:00:00Z", // End time is before start time!
                steps: [
                    { name: "task_generate", status: "FAILED" }
                ]
            };

            const result = validatePipeline(executionMetadata);

            assert.strictEqual(result.success, false);
            assert.ok(result.errors.some(e => e.includes("must execute before")));
            assert.ok(result.errors.some(e => e.includes("cannot be before start time")));
            assert.ok(result.errors.some(e => e.includes("failed during execution")));
        });
    });
};
