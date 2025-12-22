import { Client } from "pg";
import { v4 as uuidv4 } from "uuid";
import { logError, logInfo } from "./observability";

export type RunRecord = {
  runId: string;
  status: string;
  processed: number;
  errors: number;
  notes?: string | null;
};

export async function startRun(
  client: Client,
  schema: string,
  plugin: string,
  version: string
): Promise<RunRecord> {
  const runId = uuidv4();
  await client.query(
    `
      INSERT INTO ${schema}.analyst_runs (run_id, plugin, version, started_at, status, processed, errors)
      VALUES ($1, $2, $3, now(), 'RUNNING', 0, 0)
    `,
    [runId, plugin, version]
  );
  logInfo("analyst_run_start", { runId, plugin, version, schema });
  return { runId, status: "RUNNING", processed: 0, errors: 0 };
}

export async function finishRun(
  client: Client,
  schema: string,
  runId: string,
  status: "SUCCESS" | "FAILED",
  processed: number,
  errors: number,
  notes?: string | null
): Promise<void> {
  try {
    await client.query(
      `
        UPDATE ${schema}.analyst_runs
        SET finished_at = now(), status = $2, processed = $3, errors = $4, notes = $5
        WHERE run_id = $1
      `,
      [runId, status, processed, errors, notes || null]
    );
    logInfo("analyst_run_end", { runId, status, processed, errors, schema });
  } catch (err: any) {
    logError("analyst_run_end_error", { runId, status, error: err?.message, schema });
    throw err;
  }
}
