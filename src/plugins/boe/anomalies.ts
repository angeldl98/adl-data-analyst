import type { Client } from "pg";
import type { RunSummary } from "../../core/anomalies";

// Placeholder for BOE-specific anomalies (none implemented yet)
export async function detectBoeAnomalies(_client: Client, _summary: RunSummary): Promise<void> {
  // no-op
}
