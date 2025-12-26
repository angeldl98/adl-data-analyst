import type { AnalystPlugin, PluginResult, PluginRunContext } from "../../core/plugin";
import { BOE_META_SCHEMA } from "./schema";
import { extractSignals } from "./extract";
import { inferFields } from "./infer";
import { calculateMetrics } from "./calculate";
import { summarize } from "./summarize";
import { materializeProduct } from "./materialize";
import { evaluateQuality } from "./quality";
import { BOE_HIST_TABLE } from "./schema";

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
    const active = ready.filter((row) => row.estado_subasta === "ACTIVA");
    const hist = ready.filter((row) => row.estado_subasta !== "ACTIVA");

    if (active.length > 0) {
      await evaluateQuality(ctx.client, ctx.metaSchema, ctx.runId, active);
    }

    const { processed, errors } = await materializeProduct(ctx.client, ctx.metaSchema, ctx.runId, active, hist);
    const { summaryCount: prodSummaries } = await summarize(
      ctx.client,
      "boe_prod.subastas_summary",
      "boe_prod.subastas_risk",
      active
    );
    const { summaryCount: histSummaries } = await summarize(
      ctx.client,
      "boe_hist.subastas_summary",
      "boe_hist.subastas_risk",
      hist
    );
    return { processed, errors, notes: `summaries_prod=${prodSummaries} summaries_hist=${histSummaries}` };
  }
};
