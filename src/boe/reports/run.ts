import fs from "fs-extra";
import path from "path";
import { Pool } from "pg";
import { v4 as uuidv4 } from "uuid";
import { ensureReportSchema, fetchActiveProvinces, fetchOpportunities, fetchSubscribersByProvince } from "./queries";
import { generatePdf } from "./pdf";
import { sendReportEmail } from "./mailer";
import { Opportunity, ReportContext } from "./types";

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

function weekPath(base: string): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const onejan = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(((now.getTime() - onejan.getTime()) / 86400000 + onejan.getUTCDay() + 1) / 7);
  return path.join(base, `${year}-${String(week).padStart(2, "0")}`);
}

function toCsv(items: Opportunity[]): string {
  const headers = ["subasta_id", "provincia", "municipio", "precio", "valor", "discount_pct", "deadline", "url"];
  const rows = items.map((i) =>
    [
      i.subasta_id,
      i.provincia || "",
      i.municipio || "",
      i.precio ?? "",
      i.valor ?? "",
      i.discount_pct?.toFixed(2) ?? "",
      i.deadline ? i.deadline.toISOString().slice(0, 10) : "",
      i.url || ""
    ].join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}

async function main() {
  const topN = envInt("BOE_REPORT_TOPN", 20);
  const minDiscount = envInt("BOE_REPORT_MIN_DISCOUNT", 30);
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
    const provinces = await fetchActiveProvinces(client);
    const periodEnd = new Date();
    const periodStart = new Date(periodEnd.getTime() - 6 * 86400000);

    const mailCfg = {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
      from: process.env.SMTP_FROM,
      dryRun
    };

    for (const province of provinces) {
      const items = await fetchOpportunities(client, province, topN, minDiscount);
      const ctx: ReportContext = { province, periodStart, periodEnd, topN, minDiscount, runId };
      const targetDir = weekPath(path.join(outputDir));
      const pdfPath = await generatePdf(ctx, items, targetDir);
      const csvPath = path.join(targetDir, `${province}.csv`);
      await fs.writeFile(csvPath, toCsv(items));

      const counts = await insertReport(client, ctx, pdfPath, csvPath, items);
      totalReports += counts.reports;
      totalItems += counts.items;

      const subs = await fetchSubscribersByProvince(client, province);
      const subject = `Informe semanal BOE - ${province}`;
      const text = `Informe semanal de oportunidades BOE para ${province} (${periodStart.toISOString().slice(0, 10)} a ${periodEnd
        .toISOString()
        .slice(0, 10)}). Adjuntamos PDF.`;
      await sendReportEmail(mailCfg, subs, subject, text, pdfPath);
    }

    console.log(`RUN_OK | provinces=${provinces.length} | reports=${totalReports} | items=${totalItems}`);
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

