import { spawnSync } from "child_process";
import path from "path";
import type { Client } from "pg";
import type { BoeCalculated } from "./schema";

type GeRowResult = {
  field: string;
  total: number;
  failed: number;
  completeness: number;
  notes?: string | null;
  success?: boolean;
};

type GeOutput = {
  success: boolean;
  results: GeRowResult[];
  total_records: number;
};

async function persistReports(client: Client, metaSchema: string, runId: string, results: GeRowResult[]) {
  await client.query(
    `
      CREATE SCHEMA IF NOT EXISTS ${metaSchema};
      CREATE TABLE IF NOT EXISTS ${metaSchema}.quality_reports_boe (
        run_id TEXT,
        field TEXT,
        total INT,
        failed INT,
        completeness NUMERIC,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      );
      DELETE FROM ${metaSchema}.quality_reports_boe WHERE run_id = $1;
    `,
    [runId]
  );

  if (results.length === 0) return;

  const values: any[] = [];
  const placeholders: string[] = [];
  results.forEach((r, idx) => {
    const base = idx * 6;
    placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`);
    values.push(runId, r.field, r.total, r.failed, r.completeness, r.notes ?? null);
  });

  await client.query(
    `INSERT INTO ${metaSchema}.quality_reports_boe (run_id, field, total, failed, completeness, notes) VALUES ${placeholders.join(
      ", "
    )}`,
    values
  );
}

function runGreatExpectations(rows: BoeCalculated[]): GeOutput {
  const scriptPath = path.resolve(process.cwd(), "scripts/ge_validate_boe.py");
  const result = spawnSync("python3", [scriptPath], {
    input: JSON.stringify(rows),
    encoding: "utf-8"
  });

  if (result.error) {
    throw new Error(`great_expectations_exec_error:${result.error.message}`);
  }

  let parsed: GeOutput;
  try {
    parsed = JSON.parse(result.stdout || "{}");
  } catch (err: any) {
    throw new Error(`great_expectations_output_invalid:${err?.message || "parse_error"}`);
  }

  if (!parsed.results || !Array.isArray(parsed.results)) {
    throw new Error("great_expectations_output_missing_results");
  }

  const successFlag = result.status === 0 && parsed.success === true;
  if (!successFlag) {
    const failing = parsed.results.filter((r) => r.failed > 0).map((r) => r.field);
    throw Object.assign(new Error(`great_expectations_fail: fields=${failing.join(",")}`), { parsed });
  }

  return parsed;
}

export async function evaluateQuality(
  client: Client,
  metaSchema: string,
  runId: string,
  rows: BoeCalculated[]
): Promise<GeRowResult[]> {
  if (rows.length === 0) {
    throw new Error("quality_fail: empty dataset");
  }

  let geOutput: GeOutput;
  try {
    geOutput = runGreatExpectations(rows);
  } catch (err: any) {
    // If GE signals failure but still returned parsed results, persist them
    const parsed = err?.parsed as GeOutput | undefined;
    if (parsed?.results) {
      await persistReports(client, metaSchema, runId, parsed.results);
    }
    throw err;
  }

  await persistReports(client, metaSchema, runId, geOutput.results);
  return geOutput.results;
}

