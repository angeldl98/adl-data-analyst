import { type BoeEnriched, type BoeCalculated } from "./schema";

function toNumber(val: any): number | null {
  if (val === null || val === undefined) return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

export function calculateMetrics(rows: BoeEnriched[]): BoeCalculated[] {
  return rows.map((row) => {
    const precio = toNumber(row.precio_salida);
    const tasacion = toNumber(row.valor_tasacion);
    const descuento_pct = precio !== null && tasacion && tasacion > 0 ? 100 * (1 - precio / tasacion) : null;
    const capital_minimo = null; // not provided in norm; keep explicit null
    return {
      ...row,
      descuento_pct,
      capital_minimo
    };
  });
}

