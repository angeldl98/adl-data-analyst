import { PluginRegistry } from "./registry";
import type { AnalystConfig } from "./config";
import { logError, logInfo } from "./observability";
import type { AnalystPlugin, PluginRunContext } from "./plugin";
import { getClient } from "../db";
import { acquireLock, releaseLock } from "./locking";
import { finishRun, startRun } from "./runs";
import { ANALYST_VERSION } from "./version";
import { detectGenericAnomalies, persistAnomaly } from "./anomalies";
import { readAnomalyConfig } from "./config";

export async function runAnalyst(config: AnalystConfig, registry: PluginRegistry): Promise<number> {
  const plugin: AnalystPlugin | undefined = registry.get(config.plugin);
  if (!plugin) {
    logError("analyst_run_error", { plugin: config.plugin, error: "unknown_plugin" });
    return 2; // exit code 2 for unknown plugin / bad args
  }

  const schema = config.plugin === "pharma" ? "pharma_meta" : `${config.plugin}_meta`;
  const lockKey = `analyst:${plugin.name}`;
  const client = await getClient();
  let runId: string | null = null;

  try {
    const locked = await acquireLock(client, lockKey, schema);
    if (!locked) return 3; // lock not acquired

    const run = await startRun(client, schema, plugin.name, ANALYST_VERSION);
    runId = run.runId;

    const ctx: PluginRunContext = { client, metaSchema: schema, runId };
    const result = await plugin.run(ctx);

    // Anomaly detection (does not fail the run)
    const anomalyCfg = readAnomalyConfig();
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
