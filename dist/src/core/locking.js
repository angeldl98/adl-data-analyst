"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.acquireLock = acquireLock;
exports.releaseLock = releaseLock;
const observability_1 = require("./observability");
async function acquireLock(client, lockKey, schema) {
    try {
        await client.query(`INSERT INTO ${schema}.job_locks (lock_key) VALUES ($1)`, [lockKey]);
        (0, observability_1.logInfo)("lock_acquired", { lockKey, schema });
        return true;
    }
    catch (err) {
        if (err?.code === "23505") {
            (0, observability_1.logInfo)("lock_not_acquired", { lockKey, schema });
            return false;
        }
        (0, observability_1.logError)("lock_error", { lockKey, schema, error: err?.message });
        throw err;
    }
}
async function releaseLock(client, lockKey, schema) {
    try {
        await client.query(`DELETE FROM ${schema}.job_locks WHERE lock_key = $1`, [lockKey]);
        (0, observability_1.logInfo)("lock_released", { lockKey, schema });
    }
    catch (err) {
        (0, observability_1.logError)("lock_release_error", { lockKey, schema, error: err?.message });
    }
}
