"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAnalyst = runAnalyst;
const observability_1 = require("./observability");
const db_1 = require("../db");
const locking_1 = require("./locking");
const runs_1 = require("./runs");
const version_1 = require("./version");
const anomalies_1 = require("./anomalies");
const config_1 = require("./config");
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
async function runAnalyst(config, registry) {
    const plugin = registry.get(config.plugin);
    if (!plugin) {
        (0, observability_1.logError)("analyst_run_error", { plugin: config.plugin, error: "unknown_plugin" });
        return 2; // exit code 2 for unknown plugin / bad args
    }
    const schema = plugin.metaSchema;
    const lockKey = `analyst:${plugin.name}`;
    const client = await (0, db_1.getClient)();
    let runId = null;
    let anomalyCfg;
    try {
        const locked = await (0, locking_1.acquireLock)(client, lockKey, schema);
        if (!locked)
            return 3; // lock not acquired
        const run = await (0, runs_1.startRun)(client, schema, `${plugin.name}@${plugin.version}`, version_1.ANALYST_VERSION);
        runId = run.runId;
        const ctx = { client, metaSchema: schema, runId };
        const result = await plugin.materialize(ctx);
        // Anomaly detection (does not fail the run)
        anomalyCfg = (0, config_1.readAnomalyConfig)();
        const anomalies = await (0, anomalies_1.detectGenericAnomalies)(client, schema, {
            runId,
            processed: result?.processed ?? 0,
            errors: result?.errors ?? 0
        }, anomalyCfg);
        for (const a of anomalies) {
            await (0, anomalies_1.persistAnomaly)(client, schema, runId, a.type, a.details);
        }
        await (0, runs_1.finishRun)(client, schema, runId, "SUCCESS", result?.processed ?? 0, result?.errors ?? 0, result?.notes ?? null);
        return 0;
    }
    catch (err) {
        if (runId) {
            try {
                await (0, runs_1.finishRun)(client, schema, runId, "FAILED", 0, 1, err?.message || null);
            }
            catch {
                // swallow secondary errors
            }
        }
        (0, observability_1.logError)("analyst_run_error", { plugin: plugin.name, error: err?.message });
        return 4;
    }
    finally {
        await (0, locking_1.releaseLock)(client, lockKey, schema);
    }
}
