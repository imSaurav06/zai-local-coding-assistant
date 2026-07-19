"use strict";

const assert = require("assert");

module.exports = function registerDifferentialValidatorTests(suite, test) {
    const {
        createDifferentialValidator,
        validateReport,
        DIFFERENTIAL_VALIDATOR_VERSION,
        differentialValidationErrorCodes
    } = require("../../../core/runtime");

    function getSampleOutput(custom = {}) {
        const base = {
            success: true,
            runtime: "LEGACY",
            version: "1.0",
            result: {
                files: [
                    { name: "src/App.jsx", content: "import React from 'react'; export default function App() {}" },
                    { name: "package.json", content: '{"name": "test-app"}' }
                ],
                runInstructions: "npm start",
                summary: "Generation succeeded",
                model: "glm-5.2",
                projectSpec: {
                    projectName: "TestProj",
                    projectType: "react-vite",
                    frontend: "React",
                    backend: "None",
                    database: "None",
                    authentication: "None",
                    designRequirements: "None"
                }
            },
            metadata: {
                executionId: "exec_123",
                timestamp: "2026-07-18T00:00:00Z",
                createdAt: "2026-07-18T00:00:00Z",
                repaired: false,
                verificationResult: {
                    status: "PASSED"
                },
                checkpoint: {
                    status: "SUCCESS"
                }
            }
        };

        // Deep merge/assign custom overrides
        if (custom.result) {
            Object.assign(base.result, custom.result);
        }
        if (custom.metadata) {
            Object.assign(base.metadata, custom.metadata);
        }
        if (custom.runtime) {
            base.runtime = custom.runtime;
        }
        if (custom.success !== undefined) {
            base.success = custom.success;
        }
        return base;
    }

    suite("Differential Validator Layer (Phase 11B-7A)", () => {
        
        test("1. generateReport() returns success for identical outputs", () => {
            const out1 = getSampleOutput({ runtime: "LEGACY" });
            const out2 = getSampleOutput({ runtime: "MODULAR" });

            const validator = createDifferentialValidator();
            const report = validator.generateReport(out1, out2);

            assert.strictEqual(report.comparisonStatus, "PASSED");
            assert.strictEqual(report.differences.length, 0);
            assert.ok(report.matchedFields.length > 0);
        });

        test("2. generateReport() ignores non-functional differences (runtime, duration, metrics, timestamps, IDs)", () => {
            const out1 = getSampleOutput({
                runtime: "LEGACY",
                metadata: {
                    executionId: "exec_legacy_1",
                    timestamp: "2026-07-18T01:00:00Z",
                    createdAt: "2026-07-18T01:00:00Z",
                    duration: 1500,
                    metrics: { cpu: 12 }
                }
            });
            const out2 = getSampleOutput({
                runtime: "MODULAR",
                metadata: {
                    executionId: "exec_modular_2",
                    timestamp: "2026-07-18T02:00:00Z",
                    createdAt: "2026-07-18T02:00:00Z",
                    duration: 900,
                    metrics: { cpu: 8 }
                }
            });

            const validator = createDifferentialValidator();
            const report = validator.generateReport(out1, out2);

            assert.strictEqual(report.comparisonStatus, "PASSED");
            assert.strictEqual(report.differences.length, 0);
        });

        test("3. generateReport() rejects unknown runtime in target responses", () => {
            const out1 = getSampleOutput({ runtime: "INVALID_LEGACY" });
            const out2 = getSampleOutput({ runtime: "MODULAR" });

            const validator = createDifferentialValidator();
            assert.throws(() => {
                validator.generateReport(out1, out2);
            }, (err) => {
                return err.code === differentialValidationErrorCodes.DIFFERENTIAL_VALIDATION_FAILED;
            });
        });

        test("4. generateReport() rejects invalid comparison targets", () => {
            const validator = createDifferentialValidator();
            assert.throws(() => {
                validator.generateReport(null, {});
            }, (err) => {
                return err.code === differentialValidationErrorCodes.DIFFERENTIAL_VALIDATION_FAILED;
            });

            assert.throws(() => {
                validator.generateReport({}, "string");
            }, (err) => {
                return err.code === differentialValidationErrorCodes.DIFFERENTIAL_VALIDATION_FAILED;
            });
        });

        test("5. createDifferentialValidator() rejects unknown custom ignored fields", () => {
            assert.throws(() => {
                createDifferentialValidator({ ignoredFields: ["some_unknown_field"] });
            }, (err) => {
                return err.code === differentialValidationErrorCodes.DIFFERENTIAL_VALIDATION_FAILED;
            });
        });

        test("6. generateReport() correctly handles custom allowed ignored fields", () => {
            const out1 = getSampleOutput({
                runtime: "LEGACY",
                metadata: { duration: 1500 }
            });
            const out2 = getSampleOutput({
                runtime: "MODULAR",
                metadata: { duration: 900 }
            });

            const validator = createDifferentialValidator({ ignoredFields: ["duration"] });
            const report = validator.generateReport(out1, out2);
            assert.strictEqual(report.comparisonStatus, "PASSED");
        });

        test("7. generateReport() detects execution status mismatch", () => {
            const out1 = getSampleOutput({ runtime: "LEGACY", success: true });
            const out2 = getSampleOutput({ runtime: "MODULAR", success: false });

            const validator = createDifferentialValidator();
            const report = validator.generateReport(out1, out2);

            assert.strictEqual(report.comparisonStatus, "FAILED");
            try {
                assert.ok(report.differences.some(d => d.path === ".success"));
            } catch (err) {
                console.error("DEBUG TEST 7 DIFFERENCES:", report.differences);
                throw err;
            }
        });

        test("8. generateReport() detects differences in verification, repair, checkpoints, stats and files", () => {
            const out1 = getSampleOutput({
                runtime: "LEGACY",
                metadata: {
                    repaired: false,
                    verificationResult: { status: "PASSED" },
                    checkpoint: { status: "SUCCESS" }
                }
            });
            const out2 = getSampleOutput({
                runtime: "MODULAR",
                metadata: {
                    repaired: true,
                    verificationResult: { status: "FAILED" },
                    checkpoint: { status: "FAILED" }
                }
            });
            out2.result.files = [
                { name: "src/App.jsx", content: "import React from 'react'; export default function App() { return 1; }" }
            ];

            const validator = createDifferentialValidator();
            const report = validator.generateReport(out1, out2);

            assert.strictEqual(report.comparisonStatus, "FAILED");
            try {
                assert.ok(report.differences.some(d => d.type === "FILE_COUNT_MISMATCH"));
                assert.ok(report.differences.some(d => d.type === "CONTENT_MISMATCH"));
                assert.ok(report.differences.some(d => d.path === ".metadata.repaired"));
                assert.ok(report.differences.some(d => d.path === ".metadata.verificationResult.status"));
                assert.ok(report.differences.some(d => d.path === ".metadata.checkpoint.status"));
            } catch (err) {
                console.error("DEBUG TEST 8 DIFFERENCES:", report.differences);
                throw err;
            }
        });

        test("9. validateReport() rejects corrupted validation reports", () => {
            assert.throws(() => {
                validateReport(null);
            }, (err) => {
                return err.code === differentialValidationErrorCodes.DIFFERENTIAL_REPORT_INVALID;
            });

            assert.throws(() => {
                validateReport({});
            }, (err) => {
                return err.code === differentialValidationErrorCodes.DIFFERENTIAL_REPORT_INVALID;
            });

            assert.throws(() => {
                validateReport({
                    comparisonStatus: "INVALID",
                    matchedFields: [],
                    ignoredFields: [],
                    differences: [],
                    warnings: [],
                    statistics: {},
                    runtimeVersions: {}
                });
            }, (err) => {
                return err.code === differentialValidationErrorCodes.DIFFERENTIAL_REPORT_INVALID;
            });
        });

        test("10. validateReport() accepts well-formed validation reports", () => {
            const wellFormedReport = {
                comparisonStatus: "PASSED",
                matchedFields: ["fieldA"],
                ignoredFields: ["fieldB"],
                differences: [],
                warnings: [],
                statistics: {
                    totalCompared: 1,
                    totalMatched: 1,
                    totalIgnored: 1,
                    totalDifferences: 0
                },
                runtimeVersions: {
                    LEGACY: "1.0",
                    MODULAR: "1.0"
                }
            };

            assert.ok(validateReport(wellFormedReport));
        });

        test("11. reports from generateReport are deeply frozen", () => {
            const out1 = getSampleOutput({ runtime: "LEGACY" });
            const out2 = getSampleOutput({ runtime: "MODULAR" });

            const validator = createDifferentialValidator();
            const report = validator.generateReport(out1, out2);

            assert.ok(Object.isFrozen(report));
            assert.ok(Object.isFrozen(report.matchedFields));
            assert.ok(Object.isFrozen(report.ignoredFields));
            assert.ok(Object.isFrozen(report.differences));
            assert.ok(Object.isFrozen(report.warnings));
            assert.ok(Object.isFrozen(report.statistics));
            assert.ok(Object.isFrozen(report.runtimeVersions));
        });

        test("12. exposes expected version and constants", () => {
            assert.strictEqual(DIFFERENTIAL_VALIDATOR_VERSION, "1.0");
        });
    });
};
