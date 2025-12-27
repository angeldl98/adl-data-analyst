export const PHARMA_META_SCHEMA = "pharma_meta";
export const PHARMA_NORM_SCHEMA = "pharma_norm";
export const PHARMA_PROD_SCHEMA = "pharma_prod";
export const PHARMA_HIST_SCHEMA = "pharma_hist";
export const PHARMA_NORM_TABLE = `${PHARMA_NORM_SCHEMA}.medicamentos`;

export type PharmaNormRow = {
  raw_id: number | null;
  codigo_nacional: string | null;
  nombre_medicamento: string | null;
  laboratorio: string | null;
  estado_aemps: string | null;
  fecha_estado: string | null;
  estado_norm: string | null;
  checksum: string | null;
};
