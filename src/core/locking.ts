import { Client } from "pg";
import { logError, logInfo } from "./observability";

export async function acquireLock(client: Client, lockKey: string, schema: string): Promise<boolean> {
  try {
    await client.query(`INSERT INTO ${schema}.job_locks (lock_key) VALUES ($1)`, [lockKey]);
    logInfo("lock_acquired", { lockKey, schema });
    return true;
  } catch (err: any) {
    if (err?.code === "23505") {
      logInfo("lock_not_acquired", { lockKey, schema });
      return false;
    }
    logError("lock_error", { lockKey, schema, error: err?.message });
    throw err;
  }
}

export async function releaseLock(client: Client, lockKey: string, schema: string): Promise<void> {
  try {
    await client.query(`DELETE FROM ${schema}.job_locks WHERE lock_key = $1`, [lockKey]);
    logInfo("lock_released", { lockKey, schema });
  } catch (err: any) {
    logError("lock_release_error", { lockKey, schema, error: err?.message });
  }
}
