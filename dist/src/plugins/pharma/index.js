"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PharmaPlugin = void 0;
const plan_1 = require("./plan");
const materialize_1 = require("./materialize");
const schema_1 = require("./schema");
exports.PharmaPlugin = {
    name: "pharma",
    version: "1.0.0",
    metaSchema: schema_1.PHARMA_META_SCHEMA,
    async materialize(ctx) {
        const rows = await (0, plan_1.loadPharmaNormRows)(ctx.client);
        const { processed, errors } = await (0, materialize_1.materializeSearchIndex)(ctx.client, ctx.metaSchema, ctx.runId, rows);
        return { processed, errors, notes: null };
    }
};
