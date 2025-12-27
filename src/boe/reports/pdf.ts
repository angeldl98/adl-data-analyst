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

  doc.fontSize(18).text(`Informe semanal de oportunidades - Provincia ${ctx.province}`, { align: "left" });
  doc.moveDown(0.5);
  doc.fontSize(10).text(`Periodo: ${fmtDate(ctx.periodStart)} a ${fmtDate(ctx.periodEnd)}`);
  doc.text(`Top ${ctx.topN} con descuento >= ${ctx.minDiscount}%`);
  doc.moveDown(1);

  doc.fontSize(12).text("Resumen", { underline: true });
  doc.fontSize(10).text(`Total oportunidades: ${items.length}`);
  const avgDiscount = items.length ? (items.reduce((a, b) => a + b.discount_pct, 0) / items.length).toFixed(1) : "0";
  doc.text(`Descuento medio: ${avgDiscount}%`);
  doc.moveDown(1);

  doc.fontSize(12).text("Listado", { underline: true });
  doc.moveDown(0.2);
  items.forEach((item, idx) => {
    doc.fontSize(10).text(
      `${idx + 1}. Subasta ${item.subasta_id} | ${item.municipio || "—"} | Descuento ${item.discount_pct.toFixed(
        1
      )}%`
    );
    doc.text(`   Precio: ${fmtEuro(item.precio)} | Valor: ${fmtEuro(item.valor)} | Cierre: ${fmtDate(item.deadline)}`);
    if (item.url) doc.text(`   URL: ${item.url}`);
    doc.moveDown(0.5);
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

