import { DetailItem, ListingItem, SubastaLive } from "./types";

export function mergeAndParse(list: ListingItem[], details: DetailItem[]): SubastaLive[] {
  const detailMap = new Map(details.map((d) => [d.url, d]));
  return list.map((l) => {
    const d = detailMap.get(l.url);
    const precio = d?.precio_salida ?? null;
    const valor = d?.valor_tasacion ?? null;
    const descuento = precio !== null && valor && valor > 0 ? (1 - precio / valor) * 100 : null;
    const descripcion = d?.descripcion || null;
    const valorMissing = valor === null || valor === undefined;
    const descripcionCorta = !descripcion || descripcion.length < 40;
    return {
      ...l,
      ...(d || { precio_salida: null, valor_tasacion: null, descripcion: null, juzgado: null, notas: null }),
      descuento_pct: descuento,
      valor_missing: valorMissing,
      descripcion_corta: descripcionCorta,
      score: 0,
      semaforo: "AMBAR"
    } as SubastaLive;
  });
}

