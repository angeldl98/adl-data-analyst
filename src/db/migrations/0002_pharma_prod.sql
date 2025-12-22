-- Ensure pharma_prod.search_index exists with primary key and useful indexes

CREATE SCHEMA IF NOT EXISTS pharma_prod;

CREATE TABLE IF NOT EXISTS pharma_prod.search_index (
  raw_id INT PRIMARY KEY,
  nombre TEXT,
  codigo_nacional TEXT,
  laboratorio TEXT,
  estado TEXT,
  presentacion TEXT,
  url TEXT,
  checksum TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes to support search lookups
CREATE INDEX IF NOT EXISTS idx_pharma_search_index_nombre ON pharma_prod.search_index (nombre);
CREATE INDEX IF NOT EXISTS idx_pharma_search_index_codigo_nacional ON pharma_prod.search_index (codigo_nacional);
CREATE INDEX IF NOT EXISTS idx_pharma_search_index_laboratorio ON pharma_prod.search_index (laboratorio);
