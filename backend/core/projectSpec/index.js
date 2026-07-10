const { SCHEMA_VERSION } = require("./projectSpecSchema");
const { validateProjectSpec } = require("./projectSpecValidator");
const { errorCodes } = require("./projectSpecErrors");

module.exports = {
    PROJECT_SPEC_SCHEMA_VERSION: SCHEMA_VERSION,
    validateProjectSpec,
    errorCodes
};
