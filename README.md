# ADL Data Analyst (Core Contract)

## Philosophy
- **Single source of truth**: Git-tracked code defines runtime behavior.
- **Data flow**: `RAW → NORM → PRODUCT`. The analyst reads **only NORM** and writes **only PRODUCT**.
- **One entrypoint**: `src/index.ts`. No other entrypoints are supported.
- **Safety first**: deterministic runs, explicit locks, explicit run tracking, clear exit codes.

## What the analyst does
- Materializes PRODUCT tables from already-normalized data.
- Tracks each run in `<vertical>_meta.analyst_runs`.
- Uses DB locks (`<vertical>_meta.job_locks`) to ensure single execution per plugin.
- Detects generic anomalies and records them (does **not** fail the run).
- Supports dead letters for invalid normalized rows.

## What the analyst must **never** do
- Read from RAW tables.
- Write outside PRODUCT schemas.
- Execute scrapers or fetch external data.
- Apply migrations or mutate schema at runtime.
- Add dynamic entrypoints or side paths.

## Plugin contract (frozen)
Every vertical must implement an `AnalystPlugin` with:
- `name`: unique plugin name.
- `version`: plugin version string.
- `metaSchema`: meta schema used for locks/runs/anomalies/dead letters.
- `materialize(ctx)`: async function performing PRODUCT upserts.

`PluginRunContext` provides:
- `client`: pg client (connected, ready).
- `metaSchema`: meta schema for writes.
- `runId`: current analyst run id.

Registration is explicit in `src/index.ts` via `PluginRegistry` (no dynamic imports).

## Exit codes
- `0`: success.
- `2`: bad args / unknown plugin.
- `3`: lock not acquired.
- `4`: execution failure.

## Config (environment)
- `ANALYST_ANOMALY_BASELINE_DAYS` (default 14) — tuning.
- `ANALYST_ANOMALY_DROP_THRESHOLD_PCT` (default 80) — tuning.
Invalid values cause a hard fail before execution.

## Current verticals
- **pharma**: PRODUCT `pharma_prod.search_index` (idempotent upsert by `raw_id`).
- **boe**: PRODUCT `boe_prod.subastas_min` (idempotent upsert by `subasta_id`).

## Migrations
SQL migrations live in `src/db/migrations/`. They must be applied out-of-band; the analyst never applies them at runtime.

## Legacy
Legacy entrypoints reside under `_graveyard/legacy/`. Do not use them; `src/index.ts` is the sole supported entrypoint.
