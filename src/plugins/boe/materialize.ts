import type { Client } from "pg";
import { insertDeadLetter } from "../../core/deadLetters";
import { BOE_PROD_TABLE, type BoeCalculated } from "./schema";

type MaterializeResult = { processed: number; errors: number };

function isValid(row: BoeCalculated): row is BoeCalculated & { subasta_id: number } {
  return row.subasta_id !== null && row.subasta_id !== undefined;
}

function excerptRow(row: BoeCalculated): string {
  try {
    return JSON.stringify(row).slice(0, 500);
  } catch {
    return "";
  }
}

async function ensureDocsTable(client: Client): Promise<void> {
  await client.query(`CREATE SCHEMA IF NOT EXISTS boe_prod`);
  await client.query(
    `
      CREATE TABLE IF NOT EXISTS boe_prod.subastas_docs (
        identificador TEXT NOT NULL,
        url TEXT NOT NULL,
        tipo_doc TEXT,
        local_path TEXT,
        extracted_text TEXT,
        PRIMARY KEY (identificador, url)
      )
    `
  );
}

async function publishDocs(client: Client, rows: BoeCalculated[]): Promise<void> {
  const idents = Array.from(
    new Set(
      rows
        .map((r) => r.identificador)
        .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    )
  );
  if (idents.length === 0) return;

  const pdfs = await client.query<{ boe_uid: string; file_path: string }>(
    `SELECT boe_uid, file_path FROM boe_subastas_pdfs WHERE boe_uid = ANY($1)`,
    [idents]
  );
  if (!pdfs.rowCount) return;

  await ensureDocsTable(client);
  for (const pdf of pdfs.rows) {
    await client.query(
      `
        INSERT INTO boe_prod.subastas_docs (identificador, url, tipo_doc, local_path)
        VALUES ($1, $2, 'edict_pdf', $2)
        ON CONFLICT (identificador, url) DO NOTHING
      `,
      [pdf.boe_uid, pdf.file_path]
    );
  }
}

export async function materializeProduct(
  client: Client,
  metaSchema: string,
  runId: string,
  rows: BoeCalculated[]
): Promise<MaterializeResult> {
  let processed = 0;
  let errors = 0;

  await client.query("BEGIN");
  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS boe_prod`);
    await client.query(
      `
        CREATE TABLE IF NOT EXISTS ${BOE_PROD_TABLE} (
          subasta_id INT PRIMARY KEY,
          boe_uid TEXT,
          estado_subasta TEXT,
          fecha_inicio DATE,
          fecha_fin DATE,
          tipo_bien TEXT,
          es_vivienda BOOLEAN,
          es_comercial BOOLEAN,
          direccion_texto TEXT,
          municipio TEXT,
          provincia TEXT,
          codigo_postal TEXT,
          precio_salida NUMERIC,
          valor_tasacion NUMERIC,
          descuento_pct NUMERIC,
          riesgo_cargas TEXT,
          riesgo_posesion TEXT,
          capital_minimo TEXT,
          descripcion_bien TEXT,
          url_detalle TEXT,
          fuente TEXT DEFAULT 'BOE',
          updated_at TIMESTAMPTZ DEFAULT now()
        )
      `
    );

    for (const row of rows) {
      if (!isValid(row)) {
        errors += 1;
        await insertDeadLetter(client, metaSchema, {
          runId,
          rawId: row.subasta_id !== null && row.subasta_id !== undefined ? String(row.subasta_id) : null,
          reason: "missing_key_fields",
          payloadExcerpt: excerptRow(row)
        });
        continue;
      }

      await client.query(
        `
          INSERT INTO ${BOE_PROD_TABLE} (
            subasta_id, identificador, boe_uid, estado_subasta, fecha_inicio, fecha_fin, tipo_bien, es_vivienda, es_comercial,
            direccion_texto, municipio, provincia, codigo_postal, precio_salida, valor_tasacion, descuento_pct,
            riesgo_cargas, riesgo_posesion, capital_minimo, descripcion_bien, url_detalle, fuente, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, 'BOE', now())
          ON CONFLICT (subasta_id) DO UPDATE SET
            identificador = EXCLUDED.identificador,
            boe_uid = EXCLUDED.boe_uid,
            estado_subasta = EXCLUDED.estado_subasta,
            fecha_inicio = EXCLUDED.fecha_inicio,
            fecha_fin = EXCLUDED.fecha_fin,
            tipo_bien = EXCLUDED.tipo_bien,
            es_vivienda = EXCLUDED.es_vivienda,
            es_comercial = EXCLUDED.es_comercial,
            direccion_texto = EXCLUDED.direccion_texto,
            municipio = EXCLUDED.municipio,
            provincia = EXCLUDED.provincia,
            codigo_postal = EXCLUDED.codigo_postal,
            precio_salida = EXCLUDED.precio_salida,
            valor_tasacion = EXCLUDED.valor_tasacion,
            descuento_pct = EXCLUDED.descuento_pct,
            riesgo_cargas = EXCLUDED.riesgo_cargas,
            riesgo_posesion = EXCLUDED.riesgo_posesion,
            capital_minimo = EXCLUDED.capital_minimo,
            descripcion_bien = EXCLUDED.descripcion_bien,
            url_detalle = EXCLUDED.url_detalle,
            fuente = 'BOE',
            updated_at = now()
        `,
        [
          row.subasta_id,
          row.identificador,
          row.boe_uid,
          row.estado_subasta,
          row.fecha_inicio,
          row.fecha_fin,
          row.tipo_bien,
          row.es_vivienda,
          row.es_comercial,
          row.direccion_texto,
          row.municipio,
          row.provincia,
          row.codigo_postal,
          row.precio_salida,
          row.valor_tasacion,
          row.descuento_pct,
          row.riesgo_cargas,
          row.riesgo_posesion,
          row.capital_minimo,
          (row as any).descripcion_bien ?? null,
          row.url_detalle
        ]
      );
      processed += 1;
    }

    await publishDocs(client, rows);
    await client.query("COMMIT");
    return { processed, errors };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}
