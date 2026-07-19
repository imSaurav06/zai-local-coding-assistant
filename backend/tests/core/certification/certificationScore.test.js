"use strict";

const assert = require("assert");

module.exports = function registerCertificationScoreTests(suite, test) {
    const { calculateEngineeringScore, resolveGrade } = require("../../../core/certification/certificationScore");

    suite("Certification Score Calculator (Phase 13E)", () => {
        test("1. Resolves letter grades accurately according to threshold specifications", () => {
            assert.strictEqual(resolveGrade(100), "A+");
            assert.strictEqual(resolveGrade(97), "A+");
            assert.strictEqual(resolveGrade(96), "A");
            assert.strictEqual(resolveGrade(93), "A");
            assert.strictEqual(resolveGrade(92), "B");
            assert.strictEqual(resolveGrade(85), "B");
            assert.strictEqual(resolveGrade(84), "C");
            assert.strictEqual(resolveGrade(75), "C");
            assert.strictEqual(resolveGrade(74), "D");
            assert.strictEqual(resolveGrade(70), "D");
            assert.strictEqual(resolveGrade(69), "F");
            assert.strictEqual(resolveGrade(0), "F");
        });

        test("2. Calculates weighted engineering score accurately (Audit: 30%, Release: 25%, Readiness: 20%, Benchmark: 25%)", () => {
            const subsystems = {
                audit: { score: 100 },     // 100 * 0.30 = 30
                release: { score: 100 },   // 100 * 0.25 = 25
                readiness: { score: 100 }, // 100 * 0.20 = 20
                benchmark: { score: 100 }  // 100 * 0.25 = 25
            };

            const result = calculateEngineeringScore(subsystems);

            assert.strictEqual(result.engineeringScore, 100);
            assert.strictEqual(result.grade, "A+");
        });

        test("3. Computes partial weighted scores correctly", () => {
            const subsystems = {
                audit: { score: 90 },     // 90 * 0.30 = 27
                release: { score: 80 },   // 80 * 0.25 = 20
                readiness: { score: 100 }, // 100 * 0.20 = 20
                benchmark: { score: 80 }  // 80 * 0.25 = 20
            };

            // Total = 27 + 20 + 20 + 20 = 87 -> Grade B
            const result = calculateEngineeringScore(subsystems);

            assert.strictEqual(result.engineeringScore, 87);
            assert.strictEqual(result.grade, "B");
        });

        test("4. Returns 0 and Grade F for null or empty input subsystems", () => {
            const res1 = calculateEngineeringScore(null);
            assert.strictEqual(res1.engineeringScore, 0);
            assert.strictEqual(res1.grade, "F");

            const res2 = calculateEngineeringScore({});
            assert.strictEqual(res2.engineeringScore, 0);
            assert.strictEqual(res2.grade, "F");
        });
    });
};
