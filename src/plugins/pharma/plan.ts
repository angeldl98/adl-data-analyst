import type { Client } from "pg";
import { PHARMA_NORM_SCHEMA, type PharmaNormRow } from "./schema";

export async function loadPharmaNormRows(client: Client): Promise<PharmaNormRow[]> {
  const res = await client.query(
    `
      SELECT raw_id, nombre, codigo_nacional, laboratorio, estado, presentacion, url, checksum
      FROM ${PHARMA_NORM_SCHEMA}.medicamentos
    `
  );
  return res.rows as PharmaNormRow[];
}
