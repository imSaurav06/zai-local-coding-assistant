"use strict";

const { runBenchmarkSuite } = require("./benchmarkSuite");
const { normalizeBenchmarkScenario } = require("./benchmarkScenario");
const {
    registerBenchmarkScenario,
    getRegisteredBenchmark,
    resolveBenchmarkScenario,
    listRegisteredBenchmarks
} = require("./benchmarkRegistry");
const { aggregateBenchmarkResults } = require("./benchmarkAggregator");
const { buildBenchmarkSuiteReport } = require("./benchmarkSuiteReport");
const { benchmarkSuiteErrorCodes } = require("./benchmarkSuiteErrors");

module.exports = {
    runBenchmarkSuite,
    normalizeBenchmarkScenario,
    resolveBenchmarkScenario,
    registerBenchmarkScenario,
    getRegisteredBenchmark,
    listRegisteredBenchmarks,
    aggregateBenchmarkResults,
    buildBenchmarkSuiteReport,
    benchmarkSuiteErrorCodes
};
