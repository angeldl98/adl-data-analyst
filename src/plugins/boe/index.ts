import type { AnalystPlugin, PluginResult, PluginRunContext } from "../../core/plugin";
import { BOE_META_SCHEMA } from "./schema";
import { extractSignals } from "./extract";
import { inferFields } from "./infer";
import { calculateMetrics } from "./calculate";
import { summarize } from "./summarize";
import { materializeProduct } from "./materialize";

export const BoePlugin: AnalystPlugin = {
  name: "boe",
  version: "2.0.0",
  metaSchema: BOE_META_SCHEMA,
  async materialize(ctx: PluginRunContext): Promise<PluginResult> {
    const signals = await extractSignals(ctx.client);
    const inferred = inferFields(signals);
    const calculated = calculateMetrics(inferred);
    const { processed, errors } = await materializeProduct(ctx.client, ctx.metaSchema, ctx.runId, calculated);
    const { summaryCount } = await summarize(ctx.client, ctx.metaSchema, ctx.runId, calculated);
    return { processed, errors, notes: `summaries=${summaryCount}` };
  }
};
