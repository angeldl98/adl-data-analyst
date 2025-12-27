import type { Client } from "pg";
import { insertDeadLetter } from "../../core/deadLetters";
import { PHARMA_PROD_SCHEMA, PHARMA_HIST_SCHEMA, type PharmaNormRow } from "./schema";

function isValid(row: PharmaNormRow): row is PharmaNormRow & { raw_id: number; nombre_medicamento: string } {
  if (row.raw_id === null || row.raw_id === undefined) return false;
  if (!row.nombre_medicamento || row.nombre_medicamento.trim() === "") return false;
  return true;
}

function excerptRow(row: PharmaNormRow): string {
  try {
    return JSON.stringify(row).slice(0, 500);
  } catch {
    return "";
  }
}

async function createTables(client: Client) {
  await client.query(`CREATE SCHEMA IF NOT EXISTS ${PHARMA_PROD_SCHEMA}`);
  await client.query(`CREATE SCHEMA IF NOT EXISTS ${PHARMA_HIST_SCHEMA}`);
  const createTableSql = (schema: string) => `
    CREATE TABLE IF NOT EXISTS ${schema}.medicamentos (
      raw_id INT PRIMARY KEY,
      codigo_nacional TEXT,
      nombre_medicamento TEXT,
      laboratorio TEXT,
      estado_aemps TEXT,
      fecha_estado TIMESTAMPTZ,
      estado_norm TEXT,
      checksum TEXT,
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `;
  await client.query(createTableSql(PHARMA_PROD_SCHEMA));
  await client.query(createTableSql(PHARMA_HIST_SCHEMA));
}

async function upsertMedicamento(client: Client, schema: string, row: PharmaNormRow) {
  await client.query(
    `
      INSERT INTO ${schema}.medicamentos (raw_id, codigo_nacional, nombre_medicamento, laboratorio, estado_aemps, fecha_estado, estado_norm, checksum, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now())
      ON CONFLICT (raw_id) DO UPDATE SET
        codigo_nacional = EXCLUDED.codigo_nacional,
        nombre_medicamento = EXCLUDED.nombre_medicamento,
        laboratorio = EXCLUDED.laboratorio,
        estado_aemps = EXCLUDED.estado_aemps,
        fecha_estado = EXCLUDED.fecha_estado,
        estado_norm = EXCLUDED.estado_norm,
        checksum = EXCLUDED.checksum,
        updated_at = now()
    `,
    [
      row.raw_id,
      row.codigo_nacional,
      row.nombre_medicamento,
      row.laboratorio,
      row.estado_aemps,
      row.fecha_estado,
      row.estado_norm,
      row.checksum
    ]
  );
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
    await createTables(client);

    const activeIds: Set<number> = new Set();

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

      const targetSchema = row.estado_norm === "ACTIVA" ? PHARMA_PROD_SCHEMA : PHARMA_HIST_SCHEMA;
      await upsertMedicamento(client, targetSchema, row);
      processed += 1;
      if (targetSchema === PHARMA_PROD_SCHEMA) activeIds.add(row.raw_id);
    }

    // Transiciones: mover fuera de prod si ya no están activos
    if (activeIds.size > 0) {
      await client.query(
        `DELETE FROM ${PHARMA_PROD_SCHEMA}.medicamentos WHERE raw_id NOT IN (${Array.from(activeIds).join(",")})`
      );
    } else {
      await client.query(`TRUNCATE TABLE ${PHARMA_PROD_SCHEMA}.medicamentos`);
    }

    // Limpia hist duplicados de activos
    if (activeIds.size > 0) {
      await client.query(
        `DELETE FROM ${PHARMA_HIST_SCHEMA}.medicamentos WHERE raw_id IN (${Array.from(activeIds).join(",")})`
      );
    }

    await client.query("COMMIT");
    return { processed, errors };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}
