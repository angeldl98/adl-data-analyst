import { PluginRegistry } from "./registry";
import type { AnalystConfig, AnomalyConfig } from "./config";
import { logError, logInfo } from "./observability";
import type { AnalystPlugin, PluginRunContext } from "./plugin";
import { getClient } from "../db";
import { acquireLock, releaseLock } from "./locking";
import { finishRun, startRun } from "./runs";
import { ANALYST_VERSION } from "./version";
import { detectGenericAnomalies, persistAnomaly } from "./anomalies";
import { readAnomalyConfig } from "./config";

/**
 * Single orchestrator path:
 * 1) resolve plugin
 * 2) acquire lock
 * 3) record run start
 * 4) execute plugin.materialize
 * 5) detect/persist anomalies (does not fail the run)
 * 6) record run end
 * 7) release lock
 *
 * Exit codes: 0 success, 2 bad args, 3 lock not acquired, 4 execution failure.
 */
export async function runAnalyst(config: AnalystConfig, registry: PluginRegistry): Promise<number> {
  const plugin: AnalystPlugin | undefined = registry.get(config.plugin);
  if (!plugin) {
    logError("analyst_run_error", { plugin: config.plugin, error: "unknown_plugin" });
    return 2; // exit code 2 for unknown plugin / bad args
  }

  const schema = plugin.metaSchema;
  const lockKey = `analyst:${plugin.name}`;
  const client = await getClient();
  let runId: string | null = null;
  let anomalyCfg: AnomalyConfig;

  try {
    const locked = await acquireLock(client, lockKey, schema);
    if (!locked) return 3; // lock not acquired

    const run = await startRun(client, schema, `${plugin.name}@${plugin.version}`, ANALYST_VERSION);
    runId = run.runId;

    const ctx: PluginRunContext = { client, metaSchema: schema, runId };
    const result = await plugin.materialize(ctx);

    // Anomaly detection (does not fail the run)
    anomalyCfg = readAnomalyConfig();
    const anomalies = await detectGenericAnomalies(
      client,
      schema,
      {
        runId,
        processed: result?.processed ?? 0,
        errors: result?.errors ?? 0
      },
      anomalyCfg
    );
    for (const a of anomalies) {
      await persistAnomaly(client, schema, runId, a.type, a.details);
    }

    await finishRun(
      client,
      schema,
      runId,
      "SUCCESS",
      result?.processed ?? 0,
      result?.errors ?? 0,
      result?.notes ?? null
    );
    return 0;
  } catch (err: any) {
    if (runId) {
      try {
        await finishRun(client, schema, runId, "FAILED", 0, 1, err?.message || null);
      } catch {
        // swallow secondary errors
      }
    }
    logError("analyst_run_error", { plugin: plugin.name, error: err?.message });
    return 4;
  } finally {
    await releaseLock(client, lockKey, schema);
  }
}
