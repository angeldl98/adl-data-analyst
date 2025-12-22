import { Client } from "pg";
import { v4 as uuidv4 } from "uuid";
import { logError, logInfo } from "./observability";

export type RunSummary = {
  runId: string;
  processed: number;
  errors: number;
};

export type AnomalyType = "ZERO_PROCESSED" | "ERROR_SPIKE" | "VOLUME_DROP";

export type AnomalyConfig = {
  baselineDays: number;
  dropThresholdPct: number;
};

type BaselineStats = {
  avgProcessed: number;
};

async function loadBaseline(client: Client, schema: string, days: number): Promise<BaselineStats | null> {
  const res = await client.query(
    `
      SELECT AVG(processed)::numeric AS avg_processed
      FROM ${schema}.analyst_runs
      WHERE status = 'SUCCESS'
        AND finished_at >= now() - INTERVAL '${days} days'
    `
  );
  const avgProcessed = res.rows?.[0]?.avg_processed ? Number(res.rows[0].avg_processed) : 0;
  if (!res.rowCount || avgProcessed === 0) return null;
  return { avgProcessed };
}

export async function detectGenericAnomalies(
  client: Client,
  schema: string,
  summary: RunSummary,
  cfg: AnomalyConfig
): Promise<Array<{ type: AnomalyType; details: Record<string, unknown> }>> {
  const anomalies: Array<{ type: AnomalyType; details: Record<string, unknown> }> = [];

  if (summary.processed === 0) {
    anomalies.push({ type: "ZERO_PROCESSED", details: { processed: summary.processed } });
  }

  if (summary.errors > 0) {
    anomalies.push({ type: "ERROR_SPIKE", details: { errors: summary.errors } });
  }

  const baseline = await loadBaseline(client, schema, cfg.baselineDays);
  if (baseline && baseline.avgProcessed > 0 && summary.processed > 0) {
    const dropPct = ((baseline.avgProcessed - summary.processed) / baseline.avgProcessed) * 100;
    if (dropPct >= cfg.dropThresholdPct) {
      anomalies.push({
        type: "VOLUME_DROP",
        details: { dropPct, processed: summary.processed, baselineProcessed: baseline.avgProcessed }
      });
    }
  }

  return anomalies;
}

export async function persistAnomaly(
  client: Client,
  schema: string,
  runId: string,
  type: AnomalyType,
  details: Record<string, unknown>
): Promise<void> {
  const id = uuidv4();
  try {
    await client.query(
      `
        INSERT INTO ${schema}.anomalies (id, run_id, type, details_json)
        VALUES ($1, $2, $3, $4)
      `,
      [id, runId, type, JSON.stringify(details)]
    );
    logInfo("analyst_anomaly_recorded", { runId, type, schema });
  } catch (err: any) {
    logError("analyst_anomaly_error", { runId, type, error: err?.message, schema });
    throw err;
  }
}
