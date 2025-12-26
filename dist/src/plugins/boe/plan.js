"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadBoeNormRows = loadBoeNormRows;
const schema_1 = require("./schema");
// Reads normalized subastas. Other tables (bienes, importes) may be added later.
async function loadBoeNormRows(client) {
    const res = await client.query(`
      SELECT
        raw_id AS subasta_id,
        titulo,
        estado AS estado_subasta,
        NULL::date AS fecha_inicio,
        fecha_conclusion AS fecha_fin,
        NULL::text AS direccion_texto,
        NULL::text AS municipio,
        provincia,
        NULL::text AS codigo_postal,
        importe_base AS precio_salida,
        NULL::numeric AS valor_tasacion
      FROM ${schema_1.BOE_NORM_TABLE}
    `);
    return res.rows;
}
