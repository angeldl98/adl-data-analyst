import type { Client } from "pg";
import { PHARMA_NORM_TABLE, type PharmaNormRow } from "./schema";

export async function loadPharmaNormRows(client: Client): Promise<PharmaNormRow[]> {
  const res = await client.query(
    `
      SELECT raw_id, codigo_nacional, nombre_medicamento, laboratorio, estado_aemps, fecha_estado, estado_norm, checksum
      FROM ${PHARMA_NORM_TABLE}
    `
  );
  return res.rows as PharmaNormRow[];
}
