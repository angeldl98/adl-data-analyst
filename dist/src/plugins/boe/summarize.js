"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.summarize = summarize;
async function summarize(client, summaryTable, riskTable, rows) {
    await client.query("BEGIN");
    try {
        await client.query(`
        CREATE TABLE IF NOT EXISTS ${summaryTable} (
          subasta_id INT PRIMARY KEY,
          resumen TEXT NOT NULL,
          completitud TEXT NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT now()
        )
      `);
        await client.query(`
        CREATE TABLE IF NOT EXISTS ${riskTable} (
          subasta_id INT PRIMARY KEY,
          riesgo_cargas TEXT,
          riesgo_posesion TEXT,
          updated_at TIMESTAMPTZ DEFAULT now()
        )
      `);
        let summaryCount = 0;
        for (const row of rows) {
            const missing = [];
            if (!row.descripcion_bien)
                missing.push("Descripción");
            if (!row.valor_tasacion)
                missing.push("Tasación");
            if (!row.precio_salida)
                missing.push("Valor subasta");
            const completitud = missing.length === 0 ? "Completo" : `Faltan: ${missing.join(", ")}`;
            const resumen = [
                `Estado: ${row.estado_subasta || "n/d"}`,
                `Tipo: ${row.tipo_bien || "otros"}`,
                `Precio: ${row.precio_salida ?? "n/d"}`,
                `Tasación: ${row.valor_tasacion ?? "n/d"}`,
                `Descuento: ${row.descuento_pct !== null && row.descuento_pct !== undefined ? `${row.descuento_pct.toFixed(1)}%` : "n/d"}`,
                `Riesgo posesión: ${row.riesgo_posesion}`,
                `Riesgo cargas: ${row.riesgo_cargas}`
            ].join(" · ");
            await client.query(`
          INSERT INTO ${summaryTable} (subasta_id, resumen, completitud, updated_at)
          VALUES ($1, $2, $3, now())
          ON CONFLICT (subasta_id) DO UPDATE SET
            resumen = EXCLUDED.resumen,
            completitud = EXCLUDED.completitud,
            updated_at = now()
        `, [row.subasta_id, resumen, completitud]);
            await client.query(`
          INSERT INTO ${riskTable} (subasta_id, riesgo_cargas, riesgo_posesion, updated_at)
          VALUES ($1, $2, $3, now())
          ON CONFLICT (subasta_id) DO UPDATE SET
            riesgo_cargas = EXCLUDED.riesgo_cargas,
            riesgo_posesion = EXCLUDED.riesgo_posesion,
            updated_at = now()
        `, [row.subasta_id, row.riesgo_cargas, row.riesgo_posesion]);
            summaryCount += 1;
        }
        await client.query("COMMIT");
        return { summaryCount };
    }
    catch (err) {
        await client.query("ROLLBACK");
        throw err;
    }
}
