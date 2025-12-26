"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertDeadLetter = insertDeadLetter;
const uuid_1 = require("uuid");
const observability_1 = require("./observability");
function truncateExcerpt(input, max = 500) {
    if (!input)
        return null;
    return input.length > max ? `${input.slice(0, max)}...` : input;
}
async function insertDeadLetter(client, schema, dl) {
    const id = (0, uuid_1.v4)();
    const payloadExcerpt = truncateExcerpt(dl.payloadExcerpt);
    try {
        await client.query(`
        INSERT INTO ${schema}.dead_letters (id, run_id, raw_id, reason, payload_excerpt)
        VALUES ($1, $2, $3, $4, $5)
      `, [id, dl.runId, dl.rawId || null, dl.reason, payloadExcerpt]);
        (0, observability_1.logInfo)("dead_letter_inserted", { id, runId: dl.runId, schema });
    }
    catch (err) {
        (0, observability_1.logError)("dead_letter_error", { runId: dl.runId, error: err?.message, schema });
        throw err;
    }
}
