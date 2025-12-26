import { spawnSync } from "child_process";
import fs from "fs";
import crypto from "crypto";
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
  await client.query(`CREATE SCHEMA IF NOT EXISTS ${metaSchema}`);
  await client.query(
    `
      CREATE TABLE IF NOT EXISTS ${metaSchema}.quality_reports_boe (
        run_id TEXT,
        field TEXT,
        total INT,
        failed INT,
        completeness NUMERIC,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `
  );
  await client.query(`DELETE FROM ${metaSchema}.quality_reports_boe WHERE run_id = $1`, [runId]);

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
  const pythonBin = process.env.GE_PYTHON || "python3";
  const cwd = process.cwd();
  const scriptPath = path.resolve(cwd, "scripts/ge_validate_boe.py");
  const stat = fs.statSync(scriptPath);
  const buf = fs.readFileSync(scriptPath);
  const hash = crypto.createHash("sha256").update(buf).digest("hex");
  const firstLine = buf.toString("utf-8").split("\n")[0] ?? "";

  console.log(
    `GE_DEBUG_START python=${pythonBin} script=${scriptPath} cwd=${cwd} size=${stat.size} mtimeMs=${stat.mtimeMs} sha256=${hash} first_line=${firstLine}`
  );

  const result = spawnSync(pythonBin, [scriptPath], {
    input: JSON.stringify(rows),
    encoding: "utf-8",
    cwd
  });

  if (result.error) {
    throw new Error(`great_expectations_exec_error:${result.error.message}`);
  }

  const stdout = result.stdout || "";
  const stderr = result.stderr || "";
  console.log(
    `GE_DEBUG_RESULT status=${result.status ?? "null"} signal=${result.signal ?? "null"} stdout_len=${stdout.length} stderr_len=${stderr.length}`
  );

  let parsed: GeOutput;
  try {
    parsed = JSON.parse(stdout || "{}");
  } catch (err: any) {
    const tail = stderr ? stderr.slice(-200) : "";
    throw new Error(
      `great_expectations_output_invalid:${err?.message || "parse_error"} stdout_len=${stdout.length} stderr_tail=${tail}`
    );
  }

  if (!parsed.results || !Array.isArray(parsed.results)) {
    const tail = stderr ? stderr.slice(-200) : "";
    throw new Error(
      `great_expectations_output_missing_results stdout_len=${stdout.length} stderr_tail=${tail} status=${result.status}`
    );
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

