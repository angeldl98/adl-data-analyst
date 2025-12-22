import type { Client } from "pg";
import { insertDeadLetter } from "../../core/deadLetters";
import { PHARMA_SEARCH_INDEX_TABLE, type PharmaNormRow } from "./schema";

function isValid(row: PharmaNormRow): row is PharmaNormRow & { raw_id: number; nombre: string } {
  if (row.raw_id === null || row.raw_id === undefined) return false;
  if (row.nombre === null || row.nombre === undefined || row.nombre.trim() === "") return false;
  return true;
}

function excerptRow(row: PharmaNormRow): string {
  try {
    return JSON.stringify(row).slice(0, 500);
  } catch {
    return "";
  }
}

export async function materializeSearchIndex(
  client: Client,
  metaSchema: string,
  runId: string,
  rows: PharmaNormRow[]
): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;

  await client.query("BEGIN");
  try {
    await client.query(
      `
        CREATE TABLE IF NOT EXISTS ${PHARMA_SEARCH_INDEX_TABLE} (
          raw_id INT PRIMARY KEY,
          nombre TEXT,
          codigo_nacional TEXT,
          laboratorio TEXT,
          estado TEXT,
          presentacion TEXT,
          url TEXT,
          checksum TEXT,
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
          INSERT INTO ${PHARMA_SEARCH_INDEX_TABLE} (raw_id, nombre, codigo_nacional, laboratorio, estado, presentacion, url, checksum, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
          ON CONFLICT (raw_id) DO UPDATE SET
            nombre = EXCLUDED.nombre,
            codigo_nacional = EXCLUDED.codigo_nacional,
            laboratorio = EXCLUDED.laboratorio,
            estado = EXCLUDED.estado,
            presentacion = EXCLUDED.presentacion,
            url = EXCLUDED.url,
            checksum = EXCLUDED.checksum,
            updated_at = now()
        `,
        [
          row.raw_id,
          row.nombre,
          row.codigo_nacional,
          row.laboratorio,
          row.estado,
          row.presentacion,
          row.url,
          row.checksum
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
