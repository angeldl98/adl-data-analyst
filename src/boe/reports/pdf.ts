import fs from "fs-extra";
import path from "path";
import PDFDocument from "pdfkit";
import { Opportunity, ReportContext } from "./types";

export async function generatePdf(ctx: ReportContext, items: Opportunity[], outputDir: string): Promise<string> {
  await fs.ensureDir(outputDir);
  const filename = `${ctx.province}.pdf`;
  const outPath = path.join(outputDir, filename);
  const doc = new PDFDocument({ margin: 40 });
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);

  doc
    .fontSize(18)
    .text(`Informe semanal – Mejores oportunidades de subastas ACTIVAS (próximos 30 días)`, { align: "left" });
  doc.moveDown(0.5);
  doc.fontSize(10).text(`Subastas activas con vencimiento en los próximos 30 días desde la fecha de generación.`);
  doc.text(`Top ${ctx.topN} | criterio ${ctx.criterio} | descuento mínimo ${ctx.minDiscount}%`);
  doc.moveDown(1);

  doc.fontSize(12).text("Cómo usar este informe", { underline: true });
  doc.fontSize(10).list([
    "Prioriza revisar cargas y ocupación antes de pujar.",
    "Valida tasaciones y calcula tu coste total (impuestos, depósitos).",
    "Si dudas, consulta a un abogado especializado en subastas."
  ]);
  doc.moveDown(1);

  doc.fontSize(12).text("Resumen", { underline: true });
  doc.fontSize(10).text(`Total oportunidades: ${items.length}`);
  const avgDiscount = items.length ? (items.reduce((a, b) => a + b.discount_pct, 0) / items.length).toFixed(1) : "0";
  doc.text(`Descuento medio: ${avgDiscount}%`);
  doc.text(`Criterio aplicado: ${ctx.criterio}`);
  doc.text(`Disclaimer: Este informe es informativo y no sustituye el análisis jurídico ni la visita al inmueble.`);
  doc.moveDown(1);

  doc.fontSize(12).text("Top oportunidades", { underline: true });
  doc.moveDown(0.2);
  items.forEach((item, idx) => {
    const sem = semaforo(item);
    doc.fontSize(10).text(
      `${idx + 1}. Subasta ${item.subasta_id} | ${item.municipio || "—"} | Desc. ${fmtPct(
        item.discount_pct
      )} | Semáforo: ${sem}`
    );
    doc.text(`   Precio: ${fmtEuro(item.precio)} | Valor: ${fmtEuro(item.valor)} | Cierre: ${fmtDate(item.deadline)}`);
    if (item.url) doc.text(`   URL: ${item.url}`);
    doc.moveDown(0.5);
  });

  doc.addPage();
  doc.fontSize(14).text("Fichas detalladas", { underline: true });
  doc.moveDown(0.5);
  items.forEach((item, idx) => {
    const sem = semaforo(item);
    doc.fontSize(12).text(`Ficha ${idx + 1}: Subasta ${item.subasta_id}`);
    doc.fontSize(10).text(`Provincia/Municipio: ${item.provincia || "—"} / ${item.municipio || "—"}`);
    doc.text(`Precio: ${fmtEuro(item.precio)} | Valor: ${fmtEuro(item.valor)} | Descuento: ${fmtPct(item.discount_pct)}`);
    doc.text(`Cierre: ${fmtDate(item.deadline)} | Tipo: ${item.tipo_bien || "—"}`);
    doc.text(`Semáforo: ${sem}`);
    doc.text("Checklist novato:");
    doc.list(["Revisar cargas", "Confirmar ocupación", "Revisar gastos y depósitos", "Consultar abogado si puja alta"]);
    if (item.url) doc.text(`URL detalle: ${item.url}`);
    doc.moveDown(1);
  });

  doc.end();
  await new Promise((resolve) => stream.on("finish", resolve));
  return outPath;
}

function fmtDate(d?: Date | null): string {
  if (!d) return "—";
  if (!(d instanceof Date)) return String(d);
  return d.toISOString().slice(0, 10);
}

function fmtEuro(n?: number | null): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function fmtPct(v?: number | null): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${v.toFixed(1)}%`;
}

function fmtMonth(d: Date): string {
  return d.toLocaleDateString("es-ES", { month: "long", year: "numeric", timeZone: "Europe/Madrid" });
}

function semaforo(item: Opportunity): string {
  const desc = item.discount_pct;
  const hasValor = item.valor !== null && item.valor !== undefined && !Number.isNaN(item.valor);
  const tipo = (item.tipo_bien || "").toLowerCase();
  const texto = ((item.descripcion_bien || "") + " " + (item.url || "")).toLowerCase();

  if (hasValor && desc >= 25) return "VERDE";
  if ((desc >= 10 && desc < 25) || (!hasValor && item.precio <= 120000)) return "AMBAR";
  const rare =
    (!hasValor && desc < 10) ||
    tipo.includes("suelo") ||
    tipo.includes("rústico") ||
    texto.includes("solar") ||
    texto.includes("rustico");
  if (rare) return "ROJO";
  return "AMBAR";
}

