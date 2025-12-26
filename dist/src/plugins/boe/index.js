"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BoePlugin = void 0;
const schema_1 = require("./schema");
const extract_1 = require("./extract");
const infer_1 = require("./infer");
const calculate_1 = require("./calculate");
const summarize_1 = require("./summarize");
const materialize_1 = require("./materialize");
const quality_1 = require("./quality");
exports.BoePlugin = {
    name: "boe",
    version: "2.0.0",
    metaSchema: schema_1.BOE_META_SCHEMA,
    async materialize(ctx) {
        const signals = await (0, extract_1.extractSignals)(ctx.client);
        const inferred = (0, infer_1.inferFields)(signals);
        const calculated = (0, calculate_1.calculateMetrics)(inferred);
        await (0, quality_1.evaluateQuality)(ctx.client, ctx.metaSchema, ctx.runId, calculated);
        const { processed, errors } = await (0, materialize_1.materializeProduct)(ctx.client, ctx.metaSchema, ctx.runId, calculated);
        const { summaryCount } = await (0, summarize_1.summarize)(ctx.client, ctx.metaSchema, ctx.runId, calculated);
        return { processed, errors, notes: `summaries=${summaryCount}` };
    }
};
