const { SCHEMA_VERSION } = require("./projectSpecSchema");
const { validateProjectSpec } = require("./projectSpecValidator");
const { errorCodes } = require("./projectSpecErrors");
const { compileProjectSpec, compilerErrorCodes } = require("./projectSpecCompiler");

module.exports = {
    PROJECT_SPEC_SCHEMA_VERSION: SCHEMA_VERSION,
    validateProjectSpec,
    errorCodes,
    compileProjectSpec,
    compilerErrorCodes
};
