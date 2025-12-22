import type { PluginResult, PluginRunContext } from "../../core/plugin";
import { loadPharmaNormRows } from "./plan";
import { materializeSearchIndex } from "./materialize";

export async function runPharmaPlugin(ctx: PluginRunContext): Promise<PluginResult> {
  const rows = await loadPharmaNormRows(ctx.client);
  const { processed, errors } = await materializeSearchIndex(ctx.client, ctx.metaSchema, ctx.runId, rows);
  return { processed, errors, notes: null };
}
