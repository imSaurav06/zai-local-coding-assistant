"use strict";

const { runBenchmark } = require("./benchmarkEngine");
const { calculateBenchmarkMetrics } = require("./benchmarkMetrics");
const { calculateBenchmarkScore } = require("./benchmarkScoring");
const { buildBenchmarkReport } = require("./benchmarkReport");
const { benchmarkErrorCodes } = require("./benchmarkErrors");

module.exports = {
    runBenchmark,
    calculateBenchmarkMetrics,
    calculateBenchmarkScore,
    buildBenchmarkReport,
    benchmarkErrorCodes
};
