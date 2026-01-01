"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadPharmaNormRows = loadPharmaNormRows;
const schema_1 = require("./schema");
async function loadPharmaNormRows(client) {
    const res = await client.query(`
      SELECT raw_id, codigo_nacional, nombre_medicamento, laboratorio, estado_aemps, fecha_estado, estado_norm, checksum
      FROM ${schema_1.PHARMA_NORM_TABLE}
    `);
    return res.rows;
}
