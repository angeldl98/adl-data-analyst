import fs from "fs-extra";
import path from "path";
import PDFDocument from "pdfkit";
import { SubastaLive } from "./types";

export async function generateReport(items: SubastaLive[], outDir: string): Promise<{ pdf: string; csv: string }> {
  const today = new Date();
  const dir = path.join(outDir, today.toISOString().slice(0, 10));
  await fs.ensureDir(dir);
  const pdfPath = path.join(dir, "live.pdf");
  const csvPath = path.join(dir, "live.csv");

  await generatePdf(items, pdfPath);
  await fs.writeFile(csvPath, toCsv(items), "utf8");
  return { pdf: pdfPath, csv: csvPath };
}

function toCsv(items: SubastaLive[]): string {
  const headers = [
    "subasta_id",
    "provincia",
    "municipio",
    "precio",
    "valor",
    "descuento_pct",
    "deadline",
    "url",
    "semaforo",
    "score"
  ];
  const rows = items.map((i) =>
    [
      i.url?.split("idSub=")[1] || "",
      i.province || "",
      i.municipality || "",
      i.precio_salida ?? "",
      i.valor_tasacion ?? "",
      i.descuento_pct !== null && i.descuento_pct !== undefined ? i.descuento_pct.toFixed(2) : "",
      i.deadline ? i.deadline.toISOString().slice(0, 10) : "",
      i.url || "",
      i.semaforo,
      i.score
    ].join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}

async function generatePdf(items: SubastaLive[], outPath: string) {
  const doc = new PDFDocument({ margin: 40 });
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);

  doc.fontSize(18).text("Informe de oportunidades de subastas ACTIVAS – Live BOE", { align: "left" });
  doc.moveDown(0.5);
  doc.fontSize(10).text("Consulta directa a la web pública del BOE en la fecha de generación.");
  doc.text("Ventana: subastas con vencimiento en los próximos 30 días.");
  doc.moveDown(1);

  doc.fontSize(12).text("¿Qué es este informe?", { underline: true });
  doc.fontSize(10).list([
    "Resumen inmediato de oportunidades activas sin esperar al pipeline histórico.",
    "Datos obtenidos de la web pública del BOE (sin PDFs).",
    "Orientado a inversor novel: prioriza viviendas y descuentos altos."
  ]);
  doc.moveDown(1);

  doc.fontSize(12).text("Metodología", { underline: true });
  doc.fontSize(10).list([
    "Se consultan las subastas activas y próximas a vencer (30 días).",
    "Se prioriza descuento y presencia de valor de tasación.",
    "No se incluyen PDFs ni enriquecimiento adicional."
  ]);
  doc.moveDown(1);

  doc.fontSize(10).text("Disclaimer: Este informe es informativo y no sustituye el análisis jurídico ni la visita al inmueble.");
  doc.moveDown(1);

  doc.fontSize(12).text("Top oportunidades", { underline: true });
  doc.moveDown(0.2);
  items.forEach((it, idx) => {
    doc
      .fontSize(10)
      .text(
        `${idx + 1}. ${it.municipality || "—"} (${it.province || "—"}) | Desc. ${fmtPct(
          it.descuento_pct
        )} | Semáforo: ${it.semaforo}`
      );
    doc.text(`   Precio: ${fmtEuro(it.precio_salida)} | Valor: ${fmtEuro(it.valor_tasacion)} | Cierre: ${fmtDate(it.deadline)}`);
    if (it.url) doc.text(`   URL: ${it.url}`);
    doc.moveDown(0.5);
  });

  doc.addPage();
  doc.fontSize(14).text("Fichas individuales", { underline: true });
  doc.moveDown(0.5);
  items.forEach((it, idx) => {
    doc.fontSize(12).text(`Ficha ${idx + 1}`);
    doc.fontSize(10).text(`Provincia/Municipio: ${it.province || "—"} / ${it.municipality || "—"}`);
    doc.text(`Precio: ${fmtEuro(it.precio_salida)} | Valor: ${fmtEuro(it.valor_tasacion)} | Descuento: ${fmtPct(it.descuento_pct)}`);
    doc.text(`Cierre: ${fmtDate(it.deadline)} | Semáforo: ${it.semaforo}`);
    doc.text(`Checklist novato: revisar cargas, ocupación, gastos/depositos, consulta legal.`);
    if (it.url) doc.text(`URL BOE: ${it.url}`);
    doc.moveDown(1);
  });

  doc.end();
  await new Promise((resolve) => stream.on("finish", resolve));
}

function fmtDate(d?: Date | null): string {
  if (!d) return "—";
  if (!(d instanceof Date)) return String(d);
  return d.toISOString().slice(0, 10);
}

function fmtEuro(n?: number | null): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function fmtPct(v?: number | null): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${v.toFixed(1)}%`;
}

