export const PHARMA_META_SCHEMA = "pharma_meta";
export const PHARMA_NORM_SCHEMA = "pharma_norm";
export const PHARMA_PROD_SCHEMA = "pharma_prod";
export const PHARMA_HIST_SCHEMA = "pharma_hist";
export const PHARMA_NORM_TABLE = `${PHARMA_NORM_SCHEMA}.farmacias`;

export type PharmaNormRow = {
  raw_id: number | null;
  nombre: string | null;
  direccion: string | null;
  municipio: string | null;
  provincia: string | null;
  estado_norm: string | null;
  checksum: string | null;
};
