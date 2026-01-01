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
        const ready = calculated.filter((row) => row.subasta_id &&
            row.identificador &&
            row.boe_uid &&
            row.fecha_inicio &&
            row.fecha_fin &&
            row.precio_salida !== null &&
            row.precio_salida !== undefined &&
            row.url_detalle);
        const active = ready.filter((row) => row.estado_subasta === "ACTIVA");
        const hist = ready.filter((row) => row.estado_subasta !== "ACTIVA");
        if (active.length > 0) {
            await (0, quality_1.evaluateQuality)(ctx.client, ctx.metaSchema, ctx.runId, active);
        }
        const { processed, errors } = await (0, materialize_1.materializeProduct)(ctx.client, ctx.metaSchema, ctx.runId, active, hist);
        const { summaryCount: prodSummaries } = await (0, summarize_1.summarize)(ctx.client, "boe_prod.subastas_summary", "boe_prod.subastas_risk", active);
        const { summaryCount: histSummaries } = await (0, summarize_1.summarize)(ctx.client, "boe_hist.subastas_summary", "boe_hist.subastas_risk", hist);
        return { processed, errors, notes: `summaries_prod=${prodSummaries} summaries_hist=${histSummaries}` };
    }
};
