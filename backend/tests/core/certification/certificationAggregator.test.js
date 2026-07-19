"use strict";

const assert = require("assert");

module.exports = function registerCertificationAggregatorTests(suite, test) {
    const { aggregateCertification } = require("../../../core/certification/certificationAggregator");

    suite("Certification Aggregator (Phase 13E)", () => {
        test("1. Aggregates clean passing subsystem outputs cleanly", () => {
            const input = {
                audit: { passed: true, score: 100 },
                release: { qualified: true, score: 100, level: "RELEASE_CANDIDATE" },
                readiness: { ready: true, score: 100 },
                benchmark: { suitePassed: true, averageScore: 95, grade: "A" }
            };

            const result = aggregateCertification(input);

            assert.strictEqual(result.overallPassed, true);
            assert.strictEqual(result.subsystems.audit.passed, true);
            assert.strictEqual(result.subsystems.audit.score, 100);
            assert.strictEqual(result.subsystems.release.qualified, true);
            assert.strictEqual(result.subsystems.release.score, 100);
            assert.strictEqual(result.subsystems.readiness.ready, true);
            assert.strictEqual(result.subsystems.readiness.score, 100);
            assert.strictEqual(result.subsystems.benchmark.passed, true);
            assert.strictEqual(result.subsystems.benchmark.score, 95);
            assert.ok(Object.isFrozen(result));
        });

        test("2. Marks overallPassed as false if any single subsystem fails", () => {
            const input = {
                audit: { passed: true, score: 100 },
                release: { qualified: false, score: 60, level: "NOT_READY" }, // failed release
                readiness: { ready: true, score: 100 },
                benchmark: { suitePassed: true, averageScore: 95 }
            };

            const result = aggregateCertification(input);

            assert.strictEqual(result.overallPassed, false);
            assert.strictEqual(result.subsystems.release.qualified, false);
        });

        test("3. Handles missing or empty subsystem objects safely", () => {
            const result = aggregateCertification({});

            assert.strictEqual(result.overallPassed, false);
            assert.strictEqual(result.subsystems.audit.passed, false);
            assert.strictEqual(result.subsystems.release.qualified, false);
            assert.strictEqual(result.subsystems.readiness.ready, false);
            assert.strictEqual(result.subsystems.benchmark.passed, false);
        });
    });
};
