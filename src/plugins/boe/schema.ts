export const BOE_META_SCHEMA = "boe_meta";
export const BOE_NORM_TABLE = "boe_subastas"; // canonical normalized table (no inference)
export const BOE_PROD_TABLE = "boe_prod.subastas_pro";

export type BoeNormRow = {
  subasta_id: number | null;
  boe_uid?: string | null;
  identificador?: string | null;
  titulo: string | null;
  estado_subasta: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  direccion_texto: string | null;
  municipio: string | null;
  provincia: string | null;
  codigo_postal: string | null;
  valor_subasta?: any | null;
  precio_salida: any | null; // NUMERIC
  valor_tasacion: any | null; // NUMERIC
  tasacion?: any | null;
  importe_deposito?: any | null;
  estado_detalle?: string | null;
  url_detalle?: string | null;
};

export type BoeSignal = BoeNormRow & {
  pdf_texts: string[];
};

export type BoeEnriched = BoeSignal & {
  descripcion_bien?: string | null;
  tipo_bien: string;
  es_vivienda: boolean;
  es_comercial: boolean;
  riesgo_cargas: string;
  riesgo_posesion: string;
};

export type BoeCalculated = BoeEnriched & {
  descuento_pct: number | null;
  capital_minimo: any | null;
};
