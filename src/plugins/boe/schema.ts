export const BOE_META_SCHEMA = "boe_meta";
export const BOE_NORM_TABLE = "boe_subastas";
export const BOE_PROD_TABLE = "boe_prod.subastas_min";

export type BoeNormRow = {
  raw_id: number | null;
  boe_uid?: string | null;
  titulo: string | null;
  provincia: string | null;
  importe_base: any | null; // NUMERIC
  fecha_conclusion: string | null; // DATE
  estado: string | null;
};
