"use strict";

const assert = require("assert");

module.exports = function registerConfigurationValidatorTests(suite, test) {
    const { validateConfiguration } = require("../../../core/readiness/configurationValidator");

    suite("Configuration Validator (Phase 13B)", () => {
        test("1. Validates complete configuration metadata cleanly", () => {
            const input = {
                jwtConfigured: true,
                dbConfigured: true,
                port: 5000,
                schemaVersion: "1.0"
            };

            const result = validateConfiguration(input);
            assert.strictEqual(result.valid, true);
            assert.strictEqual(result.errors.length, 0);
            assert.strictEqual(result.details.jwtDeclared, true);
            assert.strictEqual(result.details.databaseDeclared, true);
            assert.strictEqual(result.details.portDeclared, true);
            assert.ok(Object.isFrozen(result));
        });

        test("2. Detects missing port configuration as error", () => {
            const input = {
                jwtConfigured: true,
                dbConfigured: true
            };

            const result = validateConfiguration(input);
            assert.strictEqual(result.valid, false);
            assert.ok(result.errors.some(e => e.includes("port")));
        });

        test("3. Warns when JWT or DB config declarations are omitted", () => {
            const input = {
                port: 5000
            };

            const result = validateConfiguration(input);
            assert.strictEqual(result.valid, true);
            assert.ok(result.warnings.some(w => w.includes("JWT")));
            assert.ok(result.warnings.some(w => w.includes("Database")));
        });

        test("4. Returns invalid result on null or invalid input", () => {
            assert.strictEqual(validateConfiguration(null).valid, false);
            assert.strictEqual(validateConfiguration([]).valid, false);
        });
    });
};
