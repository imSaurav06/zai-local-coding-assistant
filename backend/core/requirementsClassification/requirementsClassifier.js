"use strict";

const { classificationErrorCodes } = require("./requirementsClassifierErrors");

/**
 * Deep freezes an object recursively to ensure immutability.
 */
function deepFreeze(obj) {
    if (obj === null || typeof obj !== "object") {
        return obj;
    }
    Object.freeze(obj);
    Object.getOwnPropertyNames(obj).forEach(prop => {
        if (
            obj.hasOwnProperty(prop) &&
            obj[prop] !== null &&
            (typeof obj[prop] === "object" || typeof obj[prop] === "function") &&
            !Object.isFrozen(obj[prop])
        ) {
            deepFreeze(obj[prop]);
        }
    });
    return obj;
}

/**
 * Recursively extracts all string values from a payload to search for classification keywords.
 */
function extractStrings(val) {
    if (typeof val === "string") {
        return [val.toLowerCase()];
    }
    if (Array.isArray(val)) {
        return val.flatMap(item => extractStrings(item));
    }
    if (val !== null && typeof val === "object") {
        return Object.values(val).flatMap(item => extractStrings(item));
    }
    return [];
}

/**
 * Maps requirement kind to primaryCategory deterministically.
 */
function determinePrimaryCategory(kind) {
    if (!kind || typeof kind !== "string") {
        return "OTHER";
    }
    switch (kind) {
        case "pageRoute":
        case "route":
            return "ROUTE";
        case "component":
            return "UI";
        case "backendApi":
        case "api":
            return "API";
        case "databaseModel":
        case "database":
            return "DATABASE";
        case "frontend":
            return "FRONTEND";
        case "backend":
            return "BACKEND";
        case "authentication":
            return "AUTH";
        case "integration":
            return "INTEGRATION";
        case "deploymentRequirement":
        case "deploymentRequirements":
            return "DEPLOYMENT";
        case "architectureConstraint":
        case "architecture":
            return "ARCHITECTURE";
        case "designRequirement":
        case "designRequirements":
            return "DESIGN";
        default:
            return "OTHER";
    }
}

/**
 * Deterministically extracts secondary tags from a requirement's metadata.
 */
function determineSecondaryTags(semanticKey, payloadStrings) {
    const tags = new Set();

    const hasKeyword = (keywords) => {
        return keywords.some(kw => {
            if (/^[a-zA-Z0-9_-]+$/.test(kw)) {
                const regex = new RegExp('\\b' + kw + '\\b', 'i');
                return regex.test(semanticKey) || payloadStrings.some(str => regex.test(str));
            }
            return semanticKey.includes(kw) || payloadStrings.some(str => str.includes(kw));
        });
    };

    // 1. AUTH
    const authKeywords = [
        "auth", "login", "signup", "signin", "logout", "jwt", "token", 
        "session", "password", "bcrypt", "passport", "oauth", "credential",
        "authorize", "authentication"
    ];
    if (hasKeyword(authKeywords)) {
        tags.add("AUTH");
    }

    // 2. PAYMENT
    const paymentKeywords = [
        "stripe", "paypal", "payment", "checkout", "card", "subscription", 
        "billing", "transaction", "invoice", "pay"
    ];
    if (hasKeyword(paymentKeywords)) {
        tags.add("PAYMENT");
    }

    // 3. ADMIN
    const adminKeywords = [
        "admin", "dashboard", "moderator", "backoffice", "portal", "management"
    ];
    if (hasKeyword(adminKeywords)) {
        tags.add("ADMIN");
    }

    // 4. AI
    const aiKeywords = [
        "openai", "gpt", "llm", "claude", "gemini", "ai", "ml", "chatbot", 
        "intelligent", "prediction", "chatgpt"
    ];
    if (hasKeyword(aiKeywords)) {
        tags.add("AI");
    }

    // 5. CHAT
    const chatKeywords = [
        "chat", "message", "messaging", "slack", "discord", "websocket", 
        "ws", "conversation", "inbox"
    ];
    if (hasKeyword(chatKeywords)) {
        tags.add("CHAT");
    }

    // 6. VIDEO
    const videoKeywords = [
        "video", "media", "stream", "youtube", "vimeo", "player", "zoom", "meeting"
    ];
    if (hasKeyword(videoKeywords)) {
        tags.add("VIDEO");
    }

    // 7. EMAIL
    const emailKeywords = [
        "email", "mail", "sendgrid", "smtp", "newsletter", "mailchimp"
    ];
    if (hasKeyword(emailKeywords)) {
        tags.add("EMAIL");
    }

    // 8. STORAGE
    const storageKeywords = [
        "s3", "storage", "upload", "download", "file", "cloudinary", 
        "aws-s3", "multer", "bucket"
    ];
    if (hasKeyword(storageKeywords)) {
        tags.add("STORAGE");
    }

    // 9. ANALYTICS
    const analyticsKeywords = [
        "analytics", "tracking", "metrics", "log", "chart", "graph", 
        "google-analytics", "mixpanel", "telemetry"
    ];
    if (hasKeyword(analyticsKeywords)) {
        tags.add("ANALYTICS");
    }

    // 10. NOTIFICATION
    const notificationKeywords = [
        "notification", "notify", "push", "alert", "sms", "twilio", "firebase-messaging"
    ];
    if (hasKeyword(notificationKeywords)) {
        tags.add("NOTIFICATION");
    }

    // Return unique sorted tags array
    return Array.from(tags).sort();
}

/**
 * Deterministically classifies a single requirement.
 */
function classifySingleRequirement(req) {
    const kind = req.kind;
    const semanticKey = (req.semanticKey || "").toLowerCase();
    const payloadStrings = extractStrings(req.payload);

    const primaryCategory = determinePrimaryCategory(kind);
    const secondaryTags = determineSecondaryTags(semanticKey, payloadStrings);

    return {
        primaryCategory,
        secondaryTags
    };
}

/**
 * Classifies an array of canonical requirement descriptors.
 * 
 * @param {Array} requirements Array of requirement objects
 */
function classifyRequirements(requirements) {
    try {
        if (!Array.isArray(requirements)) {
            return {
                success: false,
                classifications: [],
                errors: [{
                    code: classificationErrorCodes.CLASSIFICATION_INVALID_INPUT,
                    path: "",
                    message: "Input must be an array of requirements."
                }]
            };
        }

        const errors = [];
        const classifications = [];

        for (let i = 0; i < requirements.length; i++) {
            const req = requirements[i];
            const path = `requirements[${i}]`;

            // Validate structure
            if (req === null || typeof req !== "object") {
                errors.push({
                    code: classificationErrorCodes.CLASSIFICATION_VALIDATION_FAILED,
                    path,
                    message: "Requirement must be a non-null object."
                });
                continue;
            }

            // Check required fields
            const requiredFields = ["stableId", "displayId", "kind", "semanticKey", "payload"];
            let missingField = false;
            for (const field of requiredFields) {
                if (!req.hasOwnProperty(field)) {
                    errors.push({
                        code: classificationErrorCodes.CLASSIFICATION_VALIDATION_FAILED,
                        path: `${path}.${field}`,
                        message: `Requirement is missing required field: '${field}'`
                    });
                    missingField = true;
                }
            }

            if (missingField) continue;

            // Deterministic classification
            const { primaryCategory, secondaryTags } = classifySingleRequirement(req);

            classifications.push({
                stableId: req.stableId,
                displayId: req.displayId,
                kind: req.kind,
                semanticKey: req.semanticKey,
                primaryCategory,
                secondaryTags
            });
        }

        if (errors.length > 0) {
            return {
                success: false,
                classifications: [],
                errors
            };
        }

        const result = {
            success: true,
            classifications,
            errors: []
        };

        // Output must be deeply frozen
        return deepFreeze(result);

    } catch (err) {
        return {
            success: false,
            classifications: [],
            errors: [{
                code: classificationErrorCodes.CLASSIFICATION_INTERNAL_ERROR,
                path: "",
                message: `Internal error: ${err.message}`
            }]
        };
    }
}

module.exports = {
    classifyRequirements
};
