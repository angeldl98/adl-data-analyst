import type { AnalystPlugin, PluginResult, PluginRunContext } from "../../core/plugin";
import { loadBoeNormRows } from "./plan";
import { materializeBoeProduct } from "./materialize";
import { BOE_META_SCHEMA } from "./schema";

export const BoePlugin: AnalystPlugin = {
  name: "boe",
  version: "1.0.0",
  metaSchema: BOE_META_SCHEMA,
  async materialize(ctx: PluginRunContext): Promise<PluginResult> {
    const rows = await loadBoeNormRows(ctx.client);
    const { processed, errors } = await materializeBoeProduct(ctx.client, ctx.metaSchema, ctx.runId, rows);
    return { processed, errors, notes: null };
  }
};
