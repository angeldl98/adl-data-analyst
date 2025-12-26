"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadPharmaNormRows = loadPharmaNormRows;
const schema_1 = require("./schema");
async function loadPharmaNormRows(client) {
    const res = await client.query(`
      SELECT raw_id, nombre, codigo_nacional, laboratorio, estado, presentacion, url, checksum
      FROM ${schema_1.PHARMA_NORM_SCHEMA}.medicamentos
    `);
    return res.rows;
}
