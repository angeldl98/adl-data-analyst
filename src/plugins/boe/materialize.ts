import type { Client } from "pg";
import { insertDeadLetter } from "../../core/deadLetters";
import { BOE_PROD_TABLE, type BoeNormRow } from "./schema";

type MaterializeResult = { processed: number; errors: number };

function classifyTipoBien(titulo: string | null): { tipo: string; esVivienda: boolean; esComercial: boolean } {
  if (!titulo) return { tipo: "otros", esVivienda: false, esComercial: false };
  const t = titulo.toLowerCase();
  if (t.includes("vivienda") || t.includes("piso") || t.includes("casa")) {
    return { tipo: "vivienda", esVivienda: true, esComercial: false };
  }
  if (t.includes("local") || t.includes("oficina")) {
    return { tipo: "local", esVivienda: false, esComercial: true };
  }
  if (t.includes("garaje") || t.includes("plaza")) {
    return { tipo: "garaje", esVivienda: false, esComercial: false };
  }
  return { tipo: "otros", esVivienda: false, esComercial: false };
}

function computeDescuento(precioSalida: any, valorTasacion: any): number | null {
  if (precioSalida === null || valorTasacion === null) return null;
  const p = Number(precioSalida);
  const v = Number(valorTasacion);
  if (!Number.isFinite(p) || !Number.isFinite(v) || v <= 0) return null;
  return 100 * (1 - p / v);
}

function isValid(row: BoeNormRow): row is BoeNormRow & { subasta_id: number; titulo: string } {
  if (row.subasta_id === null || row.subasta_id === undefined) return false;
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

      const { tipo, esVivienda, esComercial } = classifyTipoBien(row.titulo);
      const descuento = computeDescuento(row.precio_salida, row.valor_tasacion);

      await client.query(
        `
          INSERT INTO ${BOE_PROD_TABLE} (
            subasta_id, estado_subasta, fecha_inicio, fecha_fin, tipo_bien, es_vivienda, es_comercial,
            direccion_texto, municipio, provincia, codigo_postal, precio_salida, valor_tasacion, descuento_pct, fuente, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'BOE', now())
          ON CONFLICT (subasta_id) DO UPDATE SET
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
            fuente = 'BOE',
            updated_at = now()
        `,
        [
          row.subasta_id,
          row.estado_subasta,
          row.fecha_inicio,
          row.fecha_fin,
          tipo,
          esVivienda,
          esComercial,
          row.direccion_texto,
          row.municipio,
          row.provincia,
          row.codigo_postal,
          row.precio_salida,
          row.valor_tasacion,
          descuento
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
