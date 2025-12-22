import type { PluginResult, PluginRunContext } from "../../core/plugin";
import { loadBoeNormRows } from "./plan";
import { materializeBoeProduct } from "./materialize";

export const BoePlugin = {
  name: "boe",
  async run(ctx: PluginRunContext): Promise<PluginResult> {
    const rows = await loadBoeNormRows(ctx.client);
    const { processed, errors } = await materializeBoeProduct(ctx.client, ctx.metaSchema, ctx.runId, rows);
    return { processed, errors, notes: null };
  }
};
