-- BOE PRO product table (additive to minimal subastas)

CREATE SCHEMA IF NOT EXISTS boe_prod;

CREATE TABLE IF NOT EXISTS boe_prod.subastas_pro (
  subasta_id INT PRIMARY KEY,
  estado_subasta TEXT,
  fecha_inicio DATE,
  fecha_fin DATE,
  tipo_bien TEXT,
  es_vivienda BOOLEAN,
  es_comercial BOOLEAN,
  direccion_texto TEXT,
  municipio TEXT,
  provincia TEXT,
  codigo_postal TEXT,
  precio_salida NUMERIC,
  valor_tasacion NUMERIC,
  descuento_pct NUMERIC,
  fuente TEXT DEFAULT 'BOE',
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_boe_pro_provincia ON boe_prod.subastas_pro (provincia);
CREATE INDEX IF NOT EXISTS idx_boe_pro_tipo_bien ON boe_prod.subastas_pro (tipo_bien);
CREATE INDEX IF NOT EXISTS idx_boe_pro_fecha_fin ON boe_prod.subastas_pro (fecha_fin);
CREATE INDEX IF NOT EXISTS idx_boe_pro_precio_salida ON boe_prod.subastas_pro (precio_salida);
