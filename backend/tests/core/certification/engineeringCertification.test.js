"use strict";

const assert = require("assert");

module.exports = function registerEngineeringCertificationTests(suite, test) {
    const { certifyEngineering } = require("../../../core/certification/engineeringCertification");
    const { certificationErrorCodes } = require("../../../core/certification/certificationErrors");

    suite("Engineering Certification Framework Public API (Phase 13E)", () => {
        test("1. Rejects invalid or non-object inputs with INVALID_INPUT error code", () => {
            assert.throws(() => certifyEngineering(null), (err) => err.code === certificationErrorCodes.INVALID_INPUT);
            assert.throws(() => certifyEngineering(undefined), (err) => err.code === certificationErrorCodes.INVALID_INPUT);
            assert.throws(() => certifyEngineering([]), (err) => err.code === certificationErrorCodes.INVALID_INPUT);
        });

        test("2. Rejects missing or invalid subsystem outputs with dedicated error codes", () => {
            const validSub = { passed: true, qualified: true, ready: true, score: 100 };

            assert.throws(() => certifyEngineering({ release: validSub, readiness: validSub, benchmark: validSub }),
                (err) => err.code === certificationErrorCodes.INVALID_AUDIT_RESULT
            );

            assert.throws(() => certifyEngineering({ audit: validSub, readiness: validSub, benchmark: validSub }),
                (err) => err.code === certificationErrorCodes.INVALID_RELEASE_RESULT
            );

            assert.throws(() => certifyEngineering({ audit: validSub, release: validSub, benchmark: validSub }),
                (err) => err.code === certificationErrorCodes.INVALID_READINESS_RESULT
            );

            assert.throws(() => certifyEngineering({ audit: validSub, release: validSub, readiness: validSub }),
                (err) => err.code === certificationErrorCodes.INVALID_BENCHMARK_RESULT
            );
        });

        test("3. Certifies platform cleanly when all subsystem evidence outputs pass with high scores", () => {
            const input = {
                audit: { passed: true, score: 100, certification: { passed: true, overallScore: 100 } },
                release: { qualified: true, score: 100, level: "RELEASE_CANDIDATE" },
                readiness: { ready: true, score: 100 },
                benchmark: { suitePassed: true, averageScore: 96, grade: "A" }
            };

            const result = certifyEngineering(input);

            assert.strictEqual(result.certified, true);
            assert.strictEqual(result.engineeringScore, 99); // (100*0.3 + 100*0.25 + 100*0.2 + 96*0.25) = 30 + 25 + 20 + 24 = 99
            assert.strictEqual(result.grade, "A+");
            assert.strictEqual(result.overallPassed, true);
            assert.ok(result.subsystems);
            assert.ok(result.summary);
            assert.ok(result.report);

            assert.ok(Object.isFrozen(result));
            assert.ok(Object.isFrozen(result.subsystems));
            assert.ok(Object.isFrozen(result.report));
        });

        test("4. Fails certification when any subsystem fails", () => {
            const input = {
                audit: { passed: true, score: 100 },
                release: { qualified: true, score: 100, level: "RELEASE_CANDIDATE" },
                readiness: { ready: false, score: 50 }, // readiness failed!
                benchmark: { suitePassed: true, averageScore: 96, grade: "A" }
            };

            const result = certifyEngineering(input);

            assert.strictEqual(result.certified, false);
            assert.strictEqual(result.overallPassed, false);
        });

        test("5. Result contract is deeply frozen and immutable", () => {
            const input = {
                audit: { passed: true, score: 100 },
                release: { qualified: true, score: 100 },
                readiness: { ready: true, score: 100 },
                benchmark: { suitePassed: true, averageScore: 100 }
            };

            const result = certifyEngineering(input);

            assert.ok(Object.isFrozen(result));
            assert.ok(Object.isFrozen(result.subsystems));
            assert.ok(Object.isFrozen(result.report));
            assert.throws(() => { result.certified = false; }, TypeError);
        });
    });
};
