import type { AnalystPlugin, PluginResult, PluginRunContext } from "../../core/plugin";
import { BOE_META_SCHEMA } from "./schema";
import { extractSignals } from "./extract";
import { inferFields } from "./infer";
import { calculateMetrics } from "./calculate";
import { summarize } from "./summarize";
import { materializeProduct } from "./materialize";
import { evaluateQuality } from "./quality";

export const BoePlugin: AnalystPlugin = {
  name: "boe",
  version: "2.0.0",
  metaSchema: BOE_META_SCHEMA,
  async materialize(ctx: PluginRunContext): Promise<PluginResult> {
    const signals = await extractSignals(ctx.client);
    const inferred = inferFields(signals);
    const calculated = calculateMetrics(inferred);
    const ready = calculated.filter(
      (row) =>
        row.subasta_id &&
        row.identificador &&
        row.boe_uid &&
        row.fecha_inicio &&
        row.fecha_fin &&
        row.precio_salida !== null &&
        row.precio_salida !== undefined &&
        row.url_detalle
    );
    if (ready.length === 0) {
      throw new Error("quality_fail: no PRO-ready rows after filtering required fields");
    }
    const active = ready.filter((row) => row.estado_subasta === "ACTIVA");
    if (active.length === 0) {
      throw new Error("quality_fail: no active auctions to publish");
    }

    await evaluateQuality(ctx.client, ctx.metaSchema, ctx.runId, active);
    const { processed, errors } = await materializeProduct(ctx.client, ctx.metaSchema, ctx.runId, active);
    const { summaryCount } = await summarize(ctx.client, ctx.metaSchema, ctx.runId, active);
    return { processed, errors, notes: `summaries=${summaryCount}` };
  }
};
