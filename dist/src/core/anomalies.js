"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectGenericAnomalies = detectGenericAnomalies;
exports.persistAnomaly = persistAnomaly;
const uuid_1 = require("uuid");
const observability_1 = require("./observability");
async function loadBaseline(client, schema, days) {
    const res = await client.query(`
      SELECT AVG(processed)::numeric AS avg_processed
      FROM ${schema}.analyst_runs
      WHERE status = 'SUCCESS'
        AND finished_at >= now() - INTERVAL '${days} days'
    `);
    const avgProcessed = res.rows?.[0]?.avg_processed ? Number(res.rows[0].avg_processed) : 0;
    if (!res.rowCount || avgProcessed === 0)
        return null;
    return { avgProcessed };
}
async function detectGenericAnomalies(client, schema, summary, cfg) {
    const anomalies = [];
    if (summary.processed === 0) {
        anomalies.push({ type: "ZERO_PROCESSED", details: { processed: summary.processed } });
    }
    if (summary.errors > 0) {
        anomalies.push({ type: "ERROR_SPIKE", details: { errors: summary.errors } });
    }
    const baseline = await loadBaseline(client, schema, cfg.baselineDays);
    if (baseline && baseline.avgProcessed > 0 && summary.processed > 0) {
        const dropPct = ((baseline.avgProcessed - summary.processed) / baseline.avgProcessed) * 100;
        if (dropPct >= cfg.dropThresholdPct) {
            anomalies.push({
                type: "VOLUME_DROP",
                details: { dropPct, processed: summary.processed, baselineProcessed: baseline.avgProcessed }
            });
        }
    }
    return anomalies;
}
async function persistAnomaly(client, schema, runId, type, details) {
    const id = (0, uuid_1.v4)();
    try {
        await client.query(`
        INSERT INTO ${schema}.anomalies (id, run_id, type, details_json)
        VALUES ($1, $2, $3, $4)
      `, [id, runId, type, JSON.stringify(details)]);
        (0, observability_1.logInfo)("analyst_anomaly_recorded", { runId, type, schema });
    }
    catch (err) {
        (0, observability_1.logError)("analyst_anomaly_error", { runId, type, error: err?.message, schema });
        throw err;
    }
}
