import type { Client } from "pg";
import { PHARMA_NORM_TABLE, type PharmaNormRow } from "./schema";

export async function loadPharmaNormRows(client: Client): Promise<PharmaNormRow[]> {
  const res = await client.query(
    `
      SELECT raw_id, name AS nombre, address AS direccion, municipality AS municipio, province AS provincia, estado_norm, checksum
      FROM ${PHARMA_NORM_TABLE}
    `
  );
  return res.rows as PharmaNormRow[];
}
