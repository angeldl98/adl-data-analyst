"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.materializeSearchIndex = materializeSearchIndex;
const deadLetters_1 = require("../../core/deadLetters");
const schema_1 = require("./schema");
function isValid(row) {
    if (row.raw_id === null || row.raw_id === undefined)
        return false;
    if (!row.nombre || row.nombre.trim() === "")
        return false;
    return true;
}
function excerptRow(row) {
    try {
        return JSON.stringify(row).slice(0, 500);
    }
    catch {
        return "";
    }
}
async function createTables(client) {
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${schema_1.PHARMA_PROD_SCHEMA}`);
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${schema_1.PHARMA_HIST_SCHEMA}`);
    const createTableSql = (schema) => `
    CREATE TABLE IF NOT EXISTS ${schema}.farmacias (
      raw_id INT PRIMARY KEY,
      nombre TEXT,
      direccion TEXT,
      municipio TEXT,
      provincia TEXT,
      estado TEXT,
      checksum TEXT,
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `;
    await client.query(createTableSql(schema_1.PHARMA_PROD_SCHEMA));
    await client.query(createTableSql(schema_1.PHARMA_HIST_SCHEMA));
}
async function upsertFarmacia(client, schema, row) {
    await client.query(`
      INSERT INTO ${schema}.farmacias (raw_id, nombre, direccion, municipio, provincia, estado, checksum, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7, now())
      ON CONFLICT (raw_id) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        direccion = EXCLUDED.direccion,
        municipio = EXCLUDED.municipio,
        provincia = EXCLUDED.provincia,
        estado = EXCLUDED.estado,
        checksum = EXCLUDED.checksum,
        updated_at = now()
    `, [row.raw_id, row.nombre, row.direccion, row.municipio, row.provincia, row.estado_norm, row.checksum]);
}
async function materializeSearchIndex(client, metaSchema, runId, rows) {
    let processed = 0;
    let errors = 0;
    await client.query("BEGIN");
    try {
        await createTables(client);
        const activeIds = new Set();
        const histIds = new Set();
        for (const row of rows) {
            if (!isValid(row)) {
                errors += 1;
                await (0, deadLetters_1.insertDeadLetter)(client, metaSchema, {
                    runId,
                    rawId: row.raw_id !== null && row.raw_id !== undefined ? String(row.raw_id) : null,
                    reason: "missing_key_fields",
                    payloadExcerpt: excerptRow(row)
                });
                continue;
            }
            const targetSchema = row.estado_norm === "ACTIVA" ? schema_1.PHARMA_PROD_SCHEMA : schema_1.PHARMA_HIST_SCHEMA;
            await upsertFarmacia(client, targetSchema, row);
            processed += 1;
            if (targetSchema === schema_1.PHARMA_PROD_SCHEMA)
                activeIds.add(row.raw_id);
            else
                histIds.add(row.raw_id);
        }
        // Transiciones: mover fuera de prod si ya no están activos
        if (activeIds.size > 0) {
            await client.query(`DELETE FROM ${schema_1.PHARMA_PROD_SCHEMA}.farmacias WHERE raw_id NOT IN (${Array.from(activeIds).join(",")})`);
        }
        else {
            await client.query(`TRUNCATE TABLE ${schema_1.PHARMA_PROD_SCHEMA}.farmacias`);
        }
        // Limpia hist duplicados de activos
        if (activeIds.size > 0) {
            await client.query(`DELETE FROM ${schema_1.PHARMA_HIST_SCHEMA}.farmacias WHERE raw_id IN (${Array.from(activeIds).join(",")})`);
        }
        await client.query("COMMIT");
        return { processed, errors };
    }
    catch (err) {
        await client.query("ROLLBACK");
        throw err;
    }
}
