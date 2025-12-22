/**
 * Analyst configuration contract.
 * Safety-critical: plugin selection, anomaly config must be valid numbers.
 * Tuning-only: anomaly baseline window and drop threshold (with safe defaults).
 */
export type AnalystConfig = {
  plugin: string;
};

export type AnomalyConfig = {
  baselineDays: number;
  dropThresholdPct: number;
};

function readPositiveIntEnv(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === "") return defaultValue;
  const num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) {
    throw new Error(`Invalid ${name} value: ${raw}`);
  }
  return Math.trunc(num);
}

export function readAnomalyConfig(): AnomalyConfig {
  const baselineDays = readPositiveIntEnv("ANALYST_ANOMALY_BASELINE_DAYS", 14);
  const dropThresholdPct = readPositiveIntEnv("ANALYST_ANOMALY_DROP_THRESHOLD_PCT", 80);
  return { baselineDays, dropThresholdPct };
}

export function validatePluginName(name: string): string {
  if (!name || !name.trim()) throw new Error("plugin argument is required");
  return name.trim();
}
