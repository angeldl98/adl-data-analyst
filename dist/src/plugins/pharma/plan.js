"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadPharmaNormRows = loadPharmaNormRows;
const schema_1 = require("./schema");
async function loadPharmaNormRows(client) {
    const res = await client.query(`
      SELECT raw_id, name AS nombre, address AS direccion, municipality AS municipio, province AS provincia, estado_norm, checksum
      FROM ${schema_1.PHARMA_NORM_TABLE}
    `);
    return res.rows;
}
