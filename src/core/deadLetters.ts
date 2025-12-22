import { Client } from "pg";
import { v4 as uuidv4 } from "uuid";
import { logError, logInfo } from "./observability";

export type DeadLetterInput = {
  runId: string;
  rawId?: string | null;
  reason: string;
  payloadExcerpt?: string | null;
};

function truncateExcerpt(input: string | undefined | null, max = 500): string | null {
  if (!input) return null;
  return input.length > max ? `${input.slice(0, max)}...` : input;
}

export async function insertDeadLetter(client: Client, schema: string, dl: DeadLetterInput): Promise<void> {
  const id = uuidv4();
  const payloadExcerpt = truncateExcerpt(dl.payloadExcerpt);
  try {
    await client.query(
      `
        INSERT INTO ${schema}.dead_letters (id, run_id, raw_id, reason, payload_excerpt)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [id, dl.runId, dl.rawId || null, dl.reason, payloadExcerpt]
    );
    logInfo("dead_letter_inserted", { id, runId: dl.runId, schema });
  } catch (err: any) {
    logError("dead_letter_error", { runId: dl.runId, error: err?.message, schema });
    throw err;
  }
}
