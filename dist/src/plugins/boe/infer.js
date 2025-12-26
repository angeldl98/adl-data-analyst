"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inferFields = inferFields;
function classifyTipoBien(titulo) {
    if (!titulo)
        return { tipo: "otros", esVivienda: false, esComercial: false };
    const t = titulo.toLowerCase();
    if (t.includes("vivienda") || t.includes("piso") || t.includes("casa"))
        return { tipo: "vivienda", esVivienda: true, esComercial: false };
    if (t.includes("local") || t.includes("oficina"))
        return { tipo: "local", esVivienda: false, esComercial: true };
    if (t.includes("garaje") || t.includes("plaza"))
        return { tipo: "garaje", esVivienda: false, esComercial: false };
    return { tipo: "otros", esVivienda: false, esComercial: false };
}
function inferPosesion(texts) {
    const joined = texts.join(" ").toLowerCase();
    if (joined.includes("ocupad"))
        return "Posible ocupación";
    if (joined.includes("desocupad") || joined.includes("libre"))
        return "Libre";
    if (joined.includes("arrend"))
        return "Arrendada";
    return "Situación posesoria no determinada";
}
function inferCargas(texts) {
    const joined = texts.join(" ").toLowerCase();
    if (joined.includes("hipoteca") || joined.includes("carga"))
        return "Cargas registrales detectadas";
    if (joined.includes("embargo"))
        return "Embargo detectado";
    return "Cargas no determinadas (revisar registro)";
}
function inferFields(rows) {
    return rows.map((row) => {
        const { tipo, esVivienda, esComercial } = classifyTipoBien(row.titulo || null);
        const posesion = inferPosesion(row.pdf_texts || []);
        const cargas = inferCargas(row.pdf_texts || []);
        return {
            ...row,
            tipo_bien: tipo,
            es_vivienda: esVivienda,
            es_comercial: esComercial,
            riesgo_cargas: cargas,
            riesgo_posesion: posesion
        };
    });
}
