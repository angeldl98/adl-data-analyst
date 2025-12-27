import type { PoolClient } from "pg";
import { Opportunity, Subscriber } from "./types";

export async function ensureReportSchema(client: PoolClient) {
  const sql = await import("fs").then(fs => fs.readFileSync("src/boe/reports/schema.sql", "utf8"));
  await client.query(sql);
}

export async function fetchActiveProvinces(client: PoolClient): Promise<string[]> {
  const res = await client.query(`SELECT province FROM boe_reports.subscribers WHERE is_active = TRUE GROUP BY province`);
  return res.rows.map(r => (r.province ? String(r.province) : "")).filter(Boolean);
}

export async function fetchSubscribersByProvince(client: PoolClient, province: string): Promise<Subscriber[]> {
  const res = await client.query(`SELECT email, province FROM boe_reports.subscribers WHERE is_active = TRUE AND province = $1`, [
    province
  ]);
  return res.rows as Subscriber[];
}

export async function fetchOpportunities(
  client: PoolClient,
  province: string,
  topN: number,
  minDiscount: number
): Promise<Opportunity[]> {
  const res = await client.query(
    `
      SELECT
        subasta_id,
        provincia,
        municipio,
        precio_salida AS precio,
        valor_tasacion AS valor,
        (1 - precio_salida / NULLIF(valor_tasacion, 0)) * 100 AS discount_pct,
        fecha_fin AS deadline,
        url_detalle AS url
      FROM boe_prod.subastas_pro
      WHERE provincia = $1
        AND valor_tasacion IS NOT NULL
        AND valor_tasacion > 0
        AND precio_salida IS NOT NULL
        AND (1 - precio_salida / NULLIF(valor_tasacion, 0)) * 100 >= $2
      ORDER BY discount_pct DESC NULLS LAST, fecha_fin ASC NULLS LAST
      LIMIT $3
    `,
    [province, minDiscount, topN]
  );
  return res.rows.map((r) => ({
    ...r,
    deadline: r.deadline ? new Date(r.deadline) : null,
    discount_pct: Number(r.discount_pct),
    precio: Number(r.precio),
    valor: Number(r.valor)
  })) as Opportunity[];
}

