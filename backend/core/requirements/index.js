"use strict";

const { deriveRequirementIdentities, REQUIREMENT_IDENTITY_VERSION } = require("./requirementIdentity");
const { identityErrorCodes } = require("./requirementIdentityErrors");

module.exports = {
    deriveRequirementIdentities,
    REQUIREMENT_IDENTITY_VERSION,
    identityErrorCodes
};
