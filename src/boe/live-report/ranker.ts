import { SubastaLive } from "./types";

const TOP_N = Number(process.env.BOE_LIVE_TOPN || 20);

export function rank(items: SubastaLive[]): SubastaLive[] {
  for (const it of items) {
    let score = 0;
    const desc = it.descuento_pct ?? 0;
    if (desc >= 30) score += 40;
    else if (desc >= 20) score += 25;
    else if (desc >= 10) score += 15;
    if (it.valor_tasacion !== null && it.valor_tasacion !== undefined) score += 10;
    if (isResidential(it)) score += 10;
    if (it.valor_tasacion === null || it.valor_tasacion === undefined) score -= 20;
    it.score = score;
    it.semaforo = computeSemaforo(it);
  }
  return items.sort((a, b) => b.score - a.score).slice(0, TOP_N);
}

function computeSemaforo(it: SubastaLive): "VERDE" | "AMBAR" | "ROJO" {
  const desc = it.descuento_pct ?? 0;
  const hasValor = it.valor_tasacion !== null && it.valor_tasacion !== undefined;
  const tipo = (it.tipo || it.descripcion || "").toLowerCase();
  if (hasValor && desc >= 25) return "VERDE";
  if ((desc >= 10 && desc < 25) || (!hasValor && it.precio_salida !== null && it.precio_salida <= 120000)) return "AMBAR";
  const rare =
    (!hasValor && desc < 10) ||
    tipo.includes("suelo") ||
    tipo.includes("rústico") ||
    tipo.includes("rustico") ||
    tipo.includes("solar");
  if (rare) return "ROJO";
  return "AMBAR";
}

function isResidential(it: SubastaLive): boolean {
  const txt = ((it.tipo || "") + " " + (it.descripcion || "")).toLowerCase();
  return ["vivienda", "piso", "garaje", "trastero", "apto", "apartamento"].some((k) => txt.includes(k));
}

