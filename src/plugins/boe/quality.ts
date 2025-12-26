import type { Client } from "pg";
import type { BoeCalculated } from "./schema";

type QualityRow = {
  run_id: string;
  field: string;
  total: number;
  failed: number;
  completeness: number;
  notes?: string | null;
};

const REQUIRED_NON_NULL: Array<keyof BoeCalculated> = [
  "subasta_id",
  "identificador",
  "boe_uid",
  "fecha_inicio",
  "fecha_fin",
  "precio_salida",
  "valor_tasacion",
  "url_detalle"
];

const NON_NEGATIVE: Array<keyof BoeCalculated> = ["precio_salida", "valor_tasacion", "descuento_pct"];

function asNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function calcCompleteness(total: number, failed: number): number {
  if (total === 0) return 0;
  return Math.max(0, Math.min(1, (total - failed) / total));
}

export async function evaluateQuality(
  client: Client,
  metaSchema: string,
  runId: string,
  rows: BoeCalculated[]
): Promise<QualityRow[]> {
  const total = rows.length;
  if (total === 0) {
    throw new Error("quality_fail: empty dataset");
  }

  const reports: QualityRow[] = [];

  for (const field of REQUIRED_NON_NULL) {
    let failed = 0;
    for (const row of rows) {
      const v = (row as any)[field];
      if (v === null || v === undefined) {
        failed += 1;
      }
    }
    reports.push({
      run_id: runId,
      field,
      total,
      failed,
      completeness: calcCompleteness(total, failed),
      notes: null
    });
  }

  for (const field of NON_NEGATIVE) {
    let failed = 0;
    for (const row of rows) {
      const v = asNumber((row as any)[field]);
      if (v === null || v < 0) {
        failed += 1;
      }
    }
    reports.push({
      run_id: runId,
      field,
      total,
      failed,
      completeness: calcCompleteness(total, failed),
      notes: "must_be_non_negative"
    });
  }

  const totalFailed = reports.reduce((acc, r) => acc + r.failed, 0);
  const failingFields = reports.filter((r) => r.failed > 0).map((r) => r.field);

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

  const values: any[] = [];
  const placeholders: string[] = [];
  reports.forEach((r, idx) => {
    const base = idx * 6;
    placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`);
    values.push(r.run_id, r.field, r.total, r.failed, r.completeness, r.notes ?? null);
  });

  if (placeholders.length > 0) {
    await client.query(
      `INSERT INTO ${metaSchema}.quality_reports_boe (run_id, field, total, failed, completeness, notes) VALUES ${placeholders.join(
        ", "
      )}`,
      values
    );
  }

  if (totalFailed > 0) {
    throw new Error(`quality_fail: fields=${failingFields.join(",")}`);
  }

  return reports;
}

