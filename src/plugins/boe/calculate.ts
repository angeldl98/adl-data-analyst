import { type BoeEnriched, type BoeCalculated } from "./schema";

function toNumber(val: any): number | null {
  if (val === null || val === undefined) return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function toDate(val: any): Date | null {
  if (val === null || val === undefined) return null;
  const d = new Date(val);
  return Number.isFinite(d.getTime()) ? d : null;
}

function classifyEstado(row: { fecha_inicio: any; fecha_fin: any }): string | null {
  const fi = toDate(row.fecha_inicio);
  const ff = toDate(row.fecha_fin);
  if (!fi || !ff) return null;
  const now = Date.now();
  if (now < fi.getTime()) return "FUTURA";
  if (now > ff.getTime()) return "CERRADA";
  return "ACTIVA";
}

export function calculateMetrics(rows: BoeEnriched[]): BoeCalculated[] {
  return rows.map((row) => {
    const precio = toNumber(row.precio_salida);
    const tasacion = toNumber(row.valor_tasacion);
    const descuento_pct = precio !== null && tasacion && tasacion > 0 ? 100 * (1 - precio / tasacion) : null;
    const capital_minimo = null; // not provided in norm; keep explicit null
    const estado_subasta = classifyEstado(row);
    return {
      ...row,
      estado_subasta,
      descuento_pct,
      capital_minimo
    };
  });
}

