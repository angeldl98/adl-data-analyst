export const BOE_META_SCHEMA = "boe_meta";
export const BOE_NORM_TABLE = "boe_subastas";
export const BOE_PROD_TABLE = "boe_prod.subastas_pro";

export type BoeNormRow = {
  subasta_id: number | null;
  titulo: string | null;
  estado_subasta: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  direccion_texto: string | null;
  municipio: string | null;
  provincia: string | null;
  codigo_postal: string | null;
  precio_salida: any | null; // NUMERIC
  valor_tasacion: any | null; // NUMERIC
};

export type BoeProdRow = {
  subasta_id: number;
  titulo: string;
  estado_subasta: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  direccion_texto: string | null;
  municipio: string | null;
  provincia: string | null;
  codigo_postal: string | null;
  precio_salida: number | null;
  valor_tasacion: number | null;
};
