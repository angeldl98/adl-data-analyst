export const PHARMA_META_SCHEMA = "pharma_meta";
export const PHARMA_NORM_SCHEMA = "pharma_norm";
export const PHARMA_PROD_SCHEMA = "pharma_prod";
export const PHARMA_SEARCH_INDEX_TABLE = `${PHARMA_PROD_SCHEMA}.search_index`;

export type PharmaNormRow = {
  raw_id: number | null;
  nombre: string | null;
  codigo_nacional: string | null;
  laboratorio: string | null;
  estado: string | null;
  presentacion: string | null;
  url: string | null;
  checksum: string | null;
};
