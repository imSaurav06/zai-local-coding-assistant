"use strict";

const assert = require("assert");

module.exports = function registerSecretScannerTests(suite, test) {
    const { scanSecrets } = require("../../../core/audit/secretScanner");

    suite("Secret Scanner (Phase 12B)", () => {
        test("1. Successfully scans Google API keys, AWS Access Keys, and Slack Webhooks", () => {
            const googleKey = "AIzaSy" + "D-12345_67890-abcdefghijklmnopqrs";
            const awsId = "AKIA" + "IOSFODNN7EXAMPLE";
            const slackUrl = "https://hooks.slack.com/services/T" + "12345678/B12345678/123456789012345678901234";

            const projectFiles = [
                {
                    name: "src/config.js",
                    content: `
                        const GOOGLE_KEY = "${googleKey}";
                        const AWS_ID = "${awsId}";
                        console.log("Slack: ${slackUrl}");
                    `
                }
            ];

            const findings = scanSecrets(projectFiles, []);

            assert.strictEqual(findings.length, 3);
            assert.ok(findings.some(f => f.type === "Google API Key" && f.severity === "CRITICAL"));
            assert.ok(findings.some(f => f.type === "AWS Access Key ID" && f.severity === "CRITICAL"));
            assert.ok(findings.some(f => f.type === "Slack Webhook URL" && f.severity === "CRITICAL"));
        });

        test("2. Detects generic secret/password assignment strings and ignores placeholders", () => {
            const projectFiles = [
                {
                    name: "src/db.js",
                    content: `
                        const db_password = "superSecretPassword123";
                        const api_key = "placeholder_key"; // should ignore placeholder
                    `
                }
            ];

            const findings = scanSecrets(projectFiles, []);

            assert.strictEqual(findings.length, 1);
            assert.strictEqual(findings[0].type, "Generic Secret Assignment");
            assert.strictEqual(findings[0].severity, "HIGH");
            assert.ok(findings[0].preview.includes("supe..."));
        });
    });
};
