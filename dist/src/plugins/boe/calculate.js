"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateMetrics = calculateMetrics;
function toNumber(val) {
    if (val === null || val === undefined)
        return null;
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
}
function calculateMetrics(rows) {
    return rows.map((row) => {
        const precio = toNumber(row.precio_salida);
        const tasacion = toNumber(row.valor_tasacion);
        const descuento_pct = precio !== null && tasacion && tasacion > 0 ? 100 * (1 - precio / tasacion) : null;
        const capital_minimo = null; // not provided in norm; keep explicit null
        return {
            ...row,
            descuento_pct,
            capital_minimo
        };
    });
}
