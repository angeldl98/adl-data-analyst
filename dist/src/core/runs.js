"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startRun = startRun;
exports.finishRun = finishRun;
const uuid_1 = require("uuid");
const observability_1 = require("./observability");
async function startRun(client, schema, plugin, version) {
    const runId = (0, uuid_1.v4)();
    await client.query(`
      INSERT INTO ${schema}.analyst_runs (run_id, plugin, version, started_at, status, processed, errors)
      VALUES ($1, $2, $3, now(), 'RUNNING', 0, 0)
    `, [runId, plugin, version]);
    (0, observability_1.logInfo)("analyst_run_start", { runId, plugin, version, schema });
    return { runId, status: "RUNNING", processed: 0, errors: 0 };
}
async function finishRun(client, schema, runId, status, processed, errors, notes) {
    try {
        await client.query(`
        UPDATE ${schema}.analyst_runs
        SET finished_at = now(), status = $2, processed = $3, errors = $4, notes = $5
        WHERE run_id = $1
      `, [runId, status, processed, errors, notes || null]);
        (0, observability_1.logInfo)("analyst_run_end", { runId, status, processed, errors, schema });
    }
    catch (err) {
        (0, observability_1.logError)("analyst_run_end_error", { runId, status, error: err?.message, schema });
        throw err;
    }
}
