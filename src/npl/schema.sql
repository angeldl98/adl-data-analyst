-- NPL raw and normalized schema

CREATE SCHEMA IF NOT EXISTS npl_raw;
CREATE SCHEMA IF NOT EXISTS npl_norm;

-- Raw files ingested from ZIPs
CREATE TABLE IF NOT EXISTS npl_raw.files (
  file_id UUID PRIMARY KEY,
  sha256 TEXT UNIQUE,
  original_path TEXT,
  stored_path TEXT,
  size_bytes BIGINT,
  mime_type TEXT,
  source_zip TEXT,
  ingested_at TIMESTAMPTZ DEFAULT now()
);

-- Assets normalized from Excel sheets
CREATE TABLE IF NOT EXISTS npl_norm.assets (
  asset_id UUID PRIMARY KEY,
  portfolio TEXT,
  ref_catastral TEXT,
  location TEXT,
  gbv NUMERIC,
  auction_value NUMERIC,
  status_internal TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Identifiers linked to assets
CREATE TABLE IF NOT EXISTS npl_norm.asset_identifiers (
  asset_id UUID REFERENCES npl_norm.assets(asset_id) ON DELETE CASCADE,
  id_type TEXT,
  id_value TEXT,
  PRIMARY KEY (asset_id, id_type, id_value)
);

-- Documents indexed (PDF/DOCX)
CREATE TABLE IF NOT EXISTS npl_norm.documents (
  document_id UUID PRIMARY KEY,
  asset_id UUID REFERENCES npl_norm.assets(asset_id),
  file_id UUID REFERENCES npl_raw.files(file_id),
  guessed_identifier TEXT,
  guessed_doc_type TEXT,
  date_guess TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

