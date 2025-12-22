-- Minimal BOE PRODUCT table for deterministic outputs

CREATE SCHEMA IF NOT EXISTS boe_prod;

CREATE TABLE IF NOT EXISTS boe_prod.subastas_min (
  subasta_id INT PRIMARY KEY,
  titulo TEXT,
  provincia TEXT,
  precio_salida NUMERIC,
  fecha_fin DATE,
  estado TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Useful indexes for lookups
CREATE INDEX IF NOT EXISTS idx_boe_subastas_min_provincia ON boe_prod.subastas_min (provincia);
CREATE INDEX IF NOT EXISTS idx_boe_subastas_min_fecha_fin ON boe_prod.subastas_min (fecha_fin);
