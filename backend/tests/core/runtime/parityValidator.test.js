"use strict";

const assert = require("assert");

module.exports = function registerParityValidatorTests(suite, test) {
    const {
        createParityValidator,
        validateParity,
        generateParityReport,
        PARITY_VALIDATOR_VERSION,
        parityValidatorErrorCodes
    } = require("../../../core/runtime");

    function getSampleOutput(custom = {}) {
        const base = {
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
                repaired: false,
                verificationResult: {
                    status: "PASSED"
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
        return base;
    }

    suite("Parity Validator Layer (Phase 11A-7)", () => {
        // ── 1. Equal Outputs ──
        test("1. validateParity() returns success: true for matching outputs", () => {
            const out1 = getSampleOutput();
            const out2 = getSampleOutput();

            const res = validateParity(out1, out2);
            assert.strictEqual(res.success, true);
            assert.strictEqual(res.differences.length, 0);
        });

        // ── 2. Ignored Fields ──
        test("2. validateParity() ignores differences in timestamps, request IDs, and duration", () => {
            const out1 = getSampleOutput({
                metadata: {
                    executionId: "exec_legacy_1",
                    timestamp: "2026-07-18T01:00:00Z",
                    duration: 1500
                }
            });
            const out2 = getSampleOutput({
                metadata: {
                    executionId: "exec_modular_2",
                    timestamp: "2026-07-18T02:00:00Z",
                    duration: 900
                }
            });

            const res = validateParity(out1, out2);
            assert.strictEqual(res.success, true);
        });

        // ── 3. Content & Structural Mismatches ──
        test("3. validateParity() identifies file count and path differences", () => {
            const out1 = getSampleOutput();
            const out2 = getSampleOutput({
                result: {
                    files: [
                        { name: "src/App.jsx", content: "import React from 'react'; export default function App() {}" }
                    ]
                }
            });

            const res = validateParity(out1, out2);
            assert.strictEqual(res.success, false);
            assert.ok(res.differences.some(d => d.type === "FILE_COUNT_MISMATCH"));
            assert.ok(res.differences.some(d => d.type === "PATH_MISMATCH_MISSING_IN_MODULAR"));
        });

        test("4. validateParity() identifies file content, imports, and exports mismatches", () => {
            const out1 = getSampleOutput();
            const out2 = getSampleOutput({
                result: {
                    files: [
                        { name: "src/App.jsx", content: "import { useState } from 'react'; export const count = 1;" },
                        { name: "package.json", content: '{"name": "test-app"}' }
                    ]
                }
            });

            const res = validateParity(out1, out2);
            assert.strictEqual(res.success, false);
            assert.ok(res.differences.some(d => d.type === "CONTENT_MISMATCH"));
            assert.ok(res.differences.some(d => d.type === "IMPORTS_MISMATCH"));
            assert.ok(res.differences.some(d => d.type === "EXPORTS_MISMATCH"));
        });

        // ── 4. Metadata Mismatches ──
        test("5. validateParity() detects mismatch in runInstructions, model, specs, and verification status", () => {
            const out1 = getSampleOutput();
            const out2 = getSampleOutput({
                result: {
                    runInstructions: "npm run dev",
                    summary: "Generation failed partially",
                    model: "glm-6.0",
                    projectSpec: {
                        projectName: "MismatchedProj",
                        projectType: "react-vite",
                        frontend: "React",
                        backend: "None",
                        database: "None",
                        authentication: "None",
                        designRequirements: "None"
                    }
                },
                metadata: {
                    repaired: true,
                    verificationResult: {
                        status: "FAILED"
                    }
                }
            });

            const res = validateParity(out1, out2);
            assert.strictEqual(res.success, false);
            assert.ok(res.differences.some(d => d.type === "RUN_INSTRUCTIONS_MISMATCH"));
            assert.ok(res.differences.some(d => d.type === "SUMMARY_MISMATCH"));
            assert.ok(res.differences.some(d => d.type === "MODEL_MISMATCH"));
            assert.ok(res.differences.some(d => d.type === "PROJECT_SPEC_PROJECTNAME_MISMATCH"));
            assert.ok(res.differences.some(d => d.type === "VERIFICATION_STATUS_MISMATCH"));
            assert.ok(res.differences.some(d => d.type === "REPAIRED_FLAG_MISMATCH"));
        });

        // ── 5. Invalid Result Errors ──
        test("6. validateParity() throws PARITY_INVALID_RESULT when inputs are structurally invalid", () => {
            assert.throws(() => {
                validateParity(null, {});
            }, (err) => {
                return err.code === parityValidatorErrorCodes.PARITY_INVALID_RESULT;
            });

            assert.throws(() => {
                validateParity({ result: {} }, { result: {} });
            }, (err) => {
                return err.code === parityValidatorErrorCodes.PARITY_INVALID_RESULT;
            });
        });

        // ── 6. Report Generation ──
        test("7. generateParityReport() returns structured reports with textual strings", () => {
            const out1 = getSampleOutput();
            const out2 = getSampleOutput({ result: { model: "mismatched" } });

            const report = generateParityReport(out1, out2);
            assert.strictEqual(report.success, false);
            assert.ok(report.reportString.includes("=== Z.AI PARITY VALIDATION REPORT ==="));
            assert.ok(report.reportString.includes("MODEL_MISMATCH"));
        });

        // ── 7. Deep Freeze ──
        test("8. outputs from validateParity and generateParityReport are deeply frozen", () => {
            const out1 = getSampleOutput();
            const out2 = getSampleOutput();

            const res = validateParity(out1, out2);
            assert.ok(Object.isFrozen(res));
            assert.ok(Object.isFrozen(res.differences));

            const report = generateParityReport(out1, out2);
            assert.ok(Object.isFrozen(report));
            assert.ok(Object.isFrozen(report.differences));
            assert.ok(Object.isFrozen(report.reportString));
        });

        // ── 8. Public API ──
        test("9. exposes expected version and functions", () => {
            assert.strictEqual(PARITY_VALIDATOR_VERSION, "1.0");
            const val = createParityValidator();
            assert.ok(val.validateParity);
            assert.ok(val.generateParityReport);
        });
    });
};
