"use strict";

const { createTaskGraph, TASK_GRAPH_MODEL_VERSION } = require("./taskGraphModel");
const { taskGraphErrorCodes } = require("./taskGraphErrors");
const { getDependencyRules, getDependenciesForKind, taskGraphDependencyVersion } = require("./dependencyRules");
const { buildTaskGraph } = require("./taskGraphBuilder");
const { validateTaskGraph } = require("./taskGraphValidator");

module.exports = {
    createTaskGraph,
    TASK_GRAPH_MODEL_VERSION,
    taskGraphErrorCodes,
    getDependencyRules,
    getDependenciesForKind,
    taskGraphDependencyVersion,
    buildTaskGraph,
    validateTaskGraph
};
