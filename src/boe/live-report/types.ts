export type ListingItem = {
  url: string;
  province: string | null;
  municipality: string | null;
  deadline: Date | null;
  tipo: string | null;
};

export type DetailItem = {
  url: string;
  precio_salida: number | null;
  valor_tasacion: number | null;
  descripcion: string | null;
  juzgado: string | null;
  notas: string | null;
};

export type SubastaLive = ListingItem &
  DetailItem & {
    descuento_pct: number | null;
    valor_missing: boolean;
    descripcion_corta: boolean;
    score: number;
    semaforo: "VERDE" | "AMBAR" | "ROJO";
  };

