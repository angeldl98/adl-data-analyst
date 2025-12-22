import type { Client } from "pg";
import type { RunSummary } from "../../core/anomalies";

// Placeholder for pharma-specific anomalies (none implemented yet)
export async function detectPharmaAnomalies(_client: Client, _summary: RunSummary): Promise<void> {
  // Intentionally no-op for now
}
