import type { AnalystPlugin, PluginResult, PluginRunContext } from "../../core/plugin";
import { loadPharmaNormRows } from "./plan";
import { materializeSearchIndex } from "./materialize";
import { PHARMA_META_SCHEMA } from "./schema";

export const PharmaPlugin: AnalystPlugin = {
  name: "pharma",
  version: "1.0.0",
  metaSchema: PHARMA_META_SCHEMA,
  async materialize(ctx: PluginRunContext): Promise<PluginResult> {
    const rows = await loadPharmaNormRows(ctx.client);
    const { processed, errors } = await materializeSearchIndex(ctx.client, ctx.metaSchema, ctx.runId, rows);
    return { processed, errors, notes: null };
  }
};
