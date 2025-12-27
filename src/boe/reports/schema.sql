CREATE SCHEMA IF NOT EXISTS boe_reports;

CREATE TABLE IF NOT EXISTS boe_reports.subscribers (
  email TEXT PRIMARY KEY,
  province TEXT,
  plan TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS boe_reports.reports (
  report_id UUID PRIMARY KEY,
  province TEXT,
  period_start DATE,
  period_end DATE,
  generated_at TIMESTAMPTZ DEFAULT now(),
  file_path_pdf TEXT,
  file_path_csv TEXT,
  items_count INT,
  run_id TEXT
);

CREATE TABLE IF NOT EXISTS boe_reports.report_items (
  report_id UUID REFERENCES boe_reports.reports(report_id) ON DELETE CASCADE,
  subasta_id INT,
  score NUMERIC,
  discount_pct NUMERIC,
  precio NUMERIC,
  valor NUMERIC,
  deadline DATE,
  municipio TEXT,
  url TEXT,
  PRIMARY KEY (report_id, subasta_id)
);

