"use strict";

const assert = require("assert");

module.exports = function registerAuditCertificationTests(suite, test) {
    const { buildAuditCertification, resolveCertificationTier } = require("../../../core/audit/auditCertification");

    function makeSummary(allPassed, overallScore, failed = [], passed = []) {
        return Object.freeze({
            allPassed,
            overallScore,
            stages: Object.freeze([]),
            passedStages: Object.freeze(passed),
            failedStages: Object.freeze(failed),
            stageCount: 4,
            passedCount: passed.length,
            failedCount: failed.length
        });
    }

    suite("Audit Certification (Phase 12E)", () => {
        test("1. resolveCertificationTier returns CERTIFIED when all passed and score >= 80", () => {
            const tier = resolveCertificationTier(makeSummary(true, 95));
            assert.strictEqual(tier, "CERTIFIED");
        });

        test("2. resolveCertificationTier returns CONDITIONALLY_CERTIFIED when all passed and score < 80", () => {
            const tier = resolveCertificationTier(makeSummary(true, 65));
            assert.strictEqual(tier, "CONDITIONALLY_CERTIFIED");
        });

        test("3. resolveCertificationTier returns NOT_CERTIFIED when any stage fails", () => {
            const tier = resolveCertificationTier(makeSummary(false, 90, ["Security Audit"]));
            assert.strictEqual(tier, "NOT_CERTIFIED");
        });

        test("4. buildAuditCertification returns a deeply frozen artifact", () => {
            const summary = makeSummary(true, 100, [], ["Requirement Compliance", "Security Audit", "Integration Audit", "Deployment Qualification"]);
            const cert = buildAuditCertification(summary);

            assert.ok(Object.isFrozen(cert));
            assert.throws(() => { cert.passed = false; }, TypeError);
        });

        test("5. CERTIFIED report text includes expected section markers", () => {
            const summary = makeSummary(true, 90, [], ["Requirement Compliance", "Security Audit", "Integration Audit", "Deployment Qualification"]);
            const cert = buildAuditCertification(summary);

            assert.strictEqual(cert.tier, "CERTIFIED");
            assert.strictEqual(cert.passed, true);
            assert.ok(cert.text.includes("CERTIFIED for production"));
        });

        test("6. NOT_CERTIFIED report text describes failure correctly", () => {
            const summary = makeSummary(false, 40, ["Security Audit"], []);
            const cert = buildAuditCertification(summary);

            assert.strictEqual(cert.tier, "NOT_CERTIFIED");
            assert.strictEqual(cert.passed, false);
            assert.ok(cert.text.includes("NOT CERTIFIED"));
        });

        test("7. createdAt and certificationVersion fields are present", () => {
            const summary = makeSummary(true, 85, [], []);
            const cert = buildAuditCertification(summary);

            assert.ok(typeof cert.createdAt === "string");
            assert.ok(typeof cert.certificationVersion === "string");
        });
    });
};
