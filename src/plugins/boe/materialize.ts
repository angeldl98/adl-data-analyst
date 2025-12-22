import type { Client } from "pg";
import { insertDeadLetter } from "../../core/deadLetters";
import { BOE_PROD_TABLE, type BoeNormRow } from "./schema";

type MaterializeResult = { processed: number; errors: number };

function isValid(row: BoeNormRow): row is BoeNormRow & { raw_id: number; titulo: string } {
  if (row.raw_id === null || row.raw_id === undefined) return false;
  if (!row.titulo || row.titulo.trim() === "") return false;
  return true;
}

function excerptRow(row: BoeNormRow): string {
  try {
    return JSON.stringify(row).slice(0, 500);
  } catch {
    return "";
  }
}

export async function materializeBoeProduct(
  client: Client,
  metaSchema: string,
  runId: string,
  rows: BoeNormRow[]
): Promise<MaterializeResult> {
  let processed = 0;
  let errors = 0;

  await client.query("BEGIN");
  try {
    await client.query(
      `
        CREATE TABLE IF NOT EXISTS ${BOE_PROD_TABLE} (
          subasta_id INT PRIMARY KEY,
          titulo TEXT,
          provincia TEXT,
          precio_salida NUMERIC,
          fecha_fin DATE,
          estado TEXT,
          updated_at TIMESTAMPTZ DEFAULT now()
        )
      `
    );

    for (const row of rows) {
      if (!isValid(row)) {
        errors += 1;
        await insertDeadLetter(client, metaSchema, {
          runId,
          rawId: row.raw_id !== null && row.raw_id !== undefined ? String(row.raw_id) : null,
          reason: "missing_key_fields",
          payloadExcerpt: excerptRow(row)
        });
        continue;
      }

      await client.query(
        `
          INSERT INTO ${BOE_PROD_TABLE} (subasta_id, titulo, provincia, precio_salida, fecha_fin, estado, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, now())
          ON CONFLICT (subasta_id) DO UPDATE SET
            titulo = EXCLUDED.titulo,
            provincia = EXCLUDED.provincia,
            precio_salida = EXCLUDED.precio_salida,
            fecha_fin = EXCLUDED.fecha_fin,
            estado = EXCLUDED.estado,
            updated_at = now()
        `,
        [
          row.raw_id,
          row.titulo,
          row.provincia,
          row.importe_base,
          row.fecha_conclusion,
          row.estado
        ]
      );
      processed += 1;
    }

    await client.query("COMMIT");
    return { processed, errors };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}
