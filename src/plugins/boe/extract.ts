import type { Client } from "pg";
import { BOE_NORM_TABLE, type BoeNormRow, type BoeSignal } from "./schema";

function toNumber(val: any): number | null {
  if (val === null || val === undefined) return null;
  const n = typeof val === "number" ? val : Number(val);
  if (Number.isFinite(n)) return n;
  return null;
}

export async function extractSignals(client: Client): Promise<BoeSignal[]> {
  const normRes = await client.query(
    `
      SELECT
        id AS subasta_id,
        identificador AS boe_uid,
        identificador AS identificador_norm,
        tipo_subasta,
        estado AS estado_subasta,
        fecha_inicio,
        fecha_fin,
        NULL::text AS direccion_texto,
        municipio,
        provincia,
        NULL::text AS codigo_postal,
        precio_salida,
        tasacion AS valor_tasacion,
        valor_subasta,
        tasacion,
        importe_deposito,
        estado_detalle,
        url AS url_detalle
      FROM ${BOE_NORM_TABLE}
    `
  );

  const docsRes = await client.query(
    `
      SELECT identificador, url, local_path, extracted_text
      FROM boe_prod.subastas_docs
    `
  );

  const docsByIdent = new Map<string, string[]>();
  for (const row of docsRes.rows) {
    const key = row.identificador;
    if (!docsByIdent.has(key)) docsByIdent.set(key, []);
    if (row.extracted_text) docsByIdent.get(key)!.push(String(row.extracted_text));
  }

  return (normRes.rows as BoeNormRow[]).map((row) => {
    const ident = (row as any).identificador_norm || row.identificador || row.boe_uid || null;
    return {
      ...row,
      precio_salida: toNumber((row as any).precio_salida ?? row.valor_subasta),
      valor_tasacion: toNumber((row as any).valor_tasacion ?? row.tasacion),
      identificador: ident,
      pdf_texts: docsByIdent.get(ident || "") || []
    };
  });
}

