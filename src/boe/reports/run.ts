import fs from "fs-extra";
import path from "path";
import { Pool } from "pg";
import { v4 as uuidv4 } from "uuid";
import { ensureReportSchema, fetchActiveProvinces, fetchOpportunities, fetchSubscribersByProvince } from "./queries";
import { generatePdf } from "./pdf";
import { sendReportEmail } from "./mailer";
import { Opportunity, ReportContext } from "./types";
import { PoolClient } from "pg";

type InsertedCounts = { reports: number; items: number };

function envInt(key: string, def: number) {
  const v = process.env[key];
  if (!v) return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function envBool(key: string, def: boolean) {
  const v = process.env[key];
  if (v === undefined) return def;
  return v === "1" || v.toLowerCase() === "true";
}

async function insertReport(
  client: any,
  ctx: ReportContext,
  filePdf: string,
  fileCsv: string | null,
  items: Opportunity[]
): Promise<InsertedCounts> {
  const reportId = uuidv4();
  await client.query(
    `
      INSERT INTO boe_reports.reports
        (report_id, province, period_start, period_end, generated_at, file_path_pdf, file_path_csv, items_count, run_id)
      VALUES ($1,$2,$3,$4, now(), $5,$6,$7,$8)
    `,
    [reportId, ctx.province, ctx.periodStart, ctx.periodEnd, filePdf, fileCsv, items.length, ctx.runId]
  );

  for (const it of items) {
    await client.query(
      `
        INSERT INTO boe_reports.report_items
          (report_id, subasta_id, score, discount_pct, precio, valor, deadline, municipio, url)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `,
      [
        reportId,
        it.subasta_id,
        it.discount_pct,
        it.discount_pct,
        it.precio,
        it.valor,
        it.deadline,
        it.municipio,
        it.url
      ]
    );
  }
  return { reports: 1, items: items.length };
}

function periodPath(base: string, periodStart: Date): string {
  const year = periodStart.getUTCFullYear();
  const month = String(periodStart.getUTCMonth() + 1).padStart(2, "0");
  return path.join(base, `${year}-${month}`);
}

function toCsv(items: Opportunity[]): string {
  const headers = [
    "subasta_id",
    "provincia",
    "municipio",
    "precio",
    "valor",
    "discount_pct",
    "deadline",
    "url",
    "semaforo",
    "criterio_usado"
  ];
  const rows = items.map((i) =>
    [
      i.subasta_id,
      i.provincia || "",
      i.municipio || "",
      i.precio ?? "",
      i.valor ?? "",
      i.discount_pct?.toFixed(2) ?? "",
      i.deadline ? i.deadline.toISOString().slice(0, 10) : "",
      i.url || "",
      i.semaforo || "",
      i.criterio_usado || ""
    ].join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}

async function main() {
  const topN = envInt("BOE_REPORT_TOPN", 20);
  const minDiscount = envInt("BOE_REPORT_MIN_DISCOUNT", 20);
  const fallbackMinDiscount = envInt("BOE_REPORT_FALLBACK_MIN_DISCOUNT", 0);
  const minItems = envInt("BOE_REPORT_MIN_ITEMS", 15);
  const scope = process.env.BOE_REPORT_SCOPE === "province" ? "province" : "all";
  const targetProvince = process.env.BOE_REPORT_TARGET_PROVINCE || "Madrid";
  const outputDir = process.env.BOE_REPORT_OUTPUT_DIR || "/opt/adl-suite/data/reports/boe";
  const dryRun = envBool("BOE_REPORT_DRY_RUN", true);
  const runId = uuidv4();

  const pool = new Pool({
    host: process.env.PGHOST || process.env.POSTGRES_HOST || "localhost",
    user: process.env.PGUSER || process.env.POSTGRES_USER || "adl",
    password: process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || "",
    database: process.env.PGDATABASE || process.env.POSTGRES_DB || "adl_core",
    port: Number(process.env.PGPORT || process.env.POSTGRES_PORT || 5432)
  });
  const client = await pool.connect();

  let totalReports = 0;
  let totalItems = 0;

  try {
    await ensureReportSchema(client);
    const ready = await hasEnoughDataForReport(client);
    if (!ready.ready) {
      console.log(
        `REPORT_SKIPPED | reason=insufficient_data | eligible_subastas=${ready.eligible} | pdf_signals=${ready.pdfs}`
      );
      console.log(
        `RUN_OK | period=rolling_30d | scope=${scope} | provinces=0 | reports=0 | items=0 | ready=false | eligible=${ready.eligible} | pdfs=${ready.pdfs}`
      );
      process.exit(0);
    }
    const provinces =
      scope === "all"
        ? ["ALL"]
        : scope === "province"
          ? [targetProvince]
          : await fetchActiveProvinces(client);

    const now = new Date();
    const periodStart = now;
    const periodEnd = new Date(now.getTime() + 30 * 86400000);

    const mailCfg = {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
      from: process.env.SMTP_FROM,
      dryRun
    };

    for (const province of provinces) {
      const selection = await selectItems(
        client,
        province === "ALL" ? null : province,
        topN,
        minDiscount,
        minItems,
        fallbackMinDiscount
      );
      const ctx: ReportContext = {
        province,
        periodStart,
        periodEnd,
        topN,
        minDiscount: selection.usedMinDiscount,
        runId,
        criterio: selection.criterio
      };
      const targetDir = periodPath(path.join(outputDir), periodStart);
      const pdfPath = await generatePdf(ctx, selection.items, targetDir);
      const csvPath = path.join(targetDir, `${province}.csv`);
      await fs.writeFile(csvPath, toCsv(selection.items));

      const counts = await insertReport(client, ctx, pdfPath, csvPath, selection.items);
      totalReports += counts.reports;
      totalItems += counts.items;

      const subs = province === "ALL" ? [] : await fetchSubscribersByProvince(client, province);
      const subject = `Informe mensual BOE - ${province}`;
      const text = `Informe mensual de oportunidades BOE para ${province} (${periodStart.toISOString().slice(0, 10)} a ${periodEnd
        .toISOString()
        .slice(0, 10)}). Adjuntamos PDF.`;
      await sendReportEmail(mailCfg, subs, subject, text, pdfPath);

      printSummary(ctx, pdfPath, csvPath, selection.items);
    }

    console.log(
      `RUN_OK | period=rolling_30d | scope=${scope} | provinces=${provinces.length} | reports=${totalReports} | items=${totalItems}`
    );
    process.exit(0);
  } catch (err: any) {
    console.error("RUN_FAIL", err?.message || err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("RUN_FAIL", err?.message || err);
  process.exit(1);
});

async function hasEnoughDataForReport(client: PoolClient): Promise<{ ready: boolean; eligible: number; pdfs: number }> {
  const MIN_ELIGIBLE_SUBASTAS = 20;
  const MIN_PDFS_ANALYZED = 5;
  const eligibleRes = await client.query(
    `SELECT count(*)::int AS c FROM boe_prod.subastas_pro WHERE estado_subasta = 'ACTIVA' AND fecha_fin >= now()`
  );
  const pdfRes = await client.query(`SELECT count(*)::int AS c FROM boe_aux.pdf_signals WHERE extract_ok = true`);
  const eligible = eligibleRes.rows?.[0]?.c || 0;
  const pdfs = pdfRes.rows?.[0]?.c || 0;
  const ready = eligible >= MIN_ELIGIBLE_SUBASTAS && pdfs >= MIN_PDFS_ANALYZED;
  console.log(`CHECK_REPORT | eligible_subastas=${eligible} | pdf_signals=${pdfs} | ready=${ready}`);
  return { ready, eligible, pdfs };
}

type SelectionResult = { items: Opportunity[]; criterio: "A" | "B" | "C"; usedMinDiscount: number };

async function selectItems(
  client: any,
  province: string | null,
  topN: number,
  minDiscount: number,
  minItems: number,
  fallbackMinDiscount: number
): Promise<SelectionResult> {
  let items = await fetchOpportunities(client, province, topN, minDiscount, "A");
  if (items.length >= minItems) {
    annotate(items, "A");
    return { items, criterio: "A", usedMinDiscount: minDiscount };
  }

  items = await fetchOpportunities(client, province, topN, fallbackMinDiscount, "B");
  if (items.length >= minItems) {
    annotate(items, "B");
    return { items, criterio: "B", usedMinDiscount: fallbackMinDiscount };
  }

  items = await fetchOpportunities(client, province, topN, fallbackMinDiscount, "C");
  annotate(items, "C");
  return { items, criterio: "C", usedMinDiscount: fallbackMinDiscount };
}

function annotate(items: Opportunity[], criterio: "A" | "B" | "C") {
  items.forEach((it) => {
    it.criterio_usado = criterio;
    it.semaforo = semaforo(it);
  });
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

function printSummary(ctx: ReportContext, pdfPath: string, csvPath: string, items: Opportunity[]) {
  console.log(
    `SUMMARY | period=${ctx.periodStart.toISOString().slice(0, 10)}..${ctx.periodEnd
      .toISOString()
      .slice(0, 10)} | scope=${ctx.province} | criterio=${ctx.criterio} | items=${items.length}`
  );
  console.log(`PDF=${pdfPath}`);
  console.log(`CSV=${csvPath}`);
  const top = items.slice(0, 10);
  console.log("TOP10:");
  top.forEach((it, idx) => {
    console.log(
      `${idx + 1}. ${it.subasta_id} ${it.provincia || ""}/${it.municipio || ""} desc=${it.discount_pct?.toFixed(
        1
      )}% precio=${it.precio} valor=${it.valor} fin=${it.deadline ? it.deadline.toISOString().slice(0, 10) : ""} semaforo=${
        it.semaforo
      }`
    );
  });
}

