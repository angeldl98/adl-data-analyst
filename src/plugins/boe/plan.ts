import type { Client } from "pg";
import { BOE_NORM_TABLE, type BoeNormRow } from "./schema";

// Reads normalized subastas. Other tables (bienes, importes) may be added later.
export async function loadBoeNormRows(client: Client): Promise<BoeNormRow[]> {
  const res = await client.query(
    `
      SELECT
        raw_id AS subasta_id,
        titulo,
        estado AS estado_subasta,
        NULL::date AS fecha_inicio,
        fecha_conclusion AS fecha_fin,
        NULL::text AS direccion_texto,
        NULL::text AS municipio,
        provincia,
        NULL::text AS codigo_postal,
        importe_base AS precio_salida,
        NULL::numeric AS valor_tasacion
      FROM ${BOE_NORM_TABLE}
    `
  );
  return res.rows as BoeNormRow[];
}
