-- Meta schemas and tables for analyst locks/runs (pharma, boe)

CREATE SCHEMA IF NOT EXISTS pharma_meta;
CREATE SCHEMA IF NOT EXISTS boe_meta;

-- Job locks
CREATE TABLE IF NOT EXISTS pharma_meta.job_locks (
  lock_key TEXT PRIMARY KEY,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS boe_meta.job_locks (
  lock_key TEXT PRIMARY KEY,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Analyst runs
CREATE TABLE IF NOT EXISTS pharma_meta.analyst_runs (
  run_id UUID PRIMARY KEY,
  plugin TEXT NOT NULL,
  version TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL,
  processed INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS boe_meta.analyst_runs (
  run_id UUID PRIMARY KEY,
  plugin TEXT NOT NULL,
  version TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL,
  processed INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  notes TEXT
);
