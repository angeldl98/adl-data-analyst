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
  province: string | null,
  topN: number,
  minDiscount: number,
  criteria: "A" | "B" | "C"
): Promise<Opportunity[]> {
  const filters: string[] = [];
  const params: any[] = [];

  if (province) {
    params.push(province);
    filters.push(`provincia = $${params.length}`);
  }

  filters.push(`fecha_fin >= now()`);
  filters.push(`fecha_fin <= now() + interval '30 days'`);

  if (criteria === "A" || criteria === "B") {
    params.push(minDiscount);
    filters.push(`(1 - precio_salida / NULLIF(valor_tasacion, 0)) * 100 >= $${params.length}`);
  }

  if (criteria !== "C") {
    filters.push(`valor_tasacion IS NOT NULL`);
    filters.push(`precio_salida IS NOT NULL`);
    filters.push(`valor_tasacion > 0`);
  }

  const whereSql = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  const orderSql =
    criteria === "C"
      ? "ORDER BY valor_tasacion DESC NULLS LAST, fecha_fin ASC NULLS LAST"
      : "ORDER BY discount_pct DESC NULLS LAST, fecha_fin ASC NULLS LAST";

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
        url_detalle AS url,
        tipo_bien,
        descripcion_bien
      FROM boe_prod.subastas_pro
      ${whereSql}
      ${orderSql}
      LIMIT $${params.length + 1}
    `,
    [...params, topN]
  );
  return res.rows.map((r) => ({
    ...r,
    deadline: r.deadline ? new Date(r.deadline) : null,
    discount_pct: Number(r.discount_pct),
    precio: Number(r.precio),
    valor: Number(r.valor)
  })) as Opportunity[];
}

