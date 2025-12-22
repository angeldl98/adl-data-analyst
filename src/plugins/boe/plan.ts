import type { Client } from "pg";
import { BOE_NORM_TABLE, type BoeNormRow } from "./schema";

export async function loadBoeNormRows(client: Client): Promise<BoeNormRow[]> {
  const res = await client.query(
    `
      SELECT raw_id, boe_uid, titulo, provincia, importe_base, fecha_conclusion, estado
      FROM ${BOE_NORM_TABLE}
    `
  );
  return res.rows as BoeNormRow[];
}
