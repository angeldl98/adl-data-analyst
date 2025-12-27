import { v4 as uuidv4 } from "uuid";
import { fetchListing } from "./fetchListing";
import { fetchDetails } from "./fetchDetail";
import { mergeAndParse } from "./parser";
import { rank } from "./ranker";
import { generateReport } from "./report";

async function main() {
  const dryRun = (process.env.BOE_LIVE_DRY_RUN || "false").toLowerCase() === "true";
  const runId = uuidv4();
  try {
    const listing = await fetchListing();
    const details = await fetchDetails(listing.map((l) => l.url));
    const merged = mergeAndParse(listing, details);
    const ranked = rank(merged);
    const outDir = process.env.BOE_LIVE_OUTPUT_DIR || "/opt/adl-suite/data/reports/boe-live";
    const { pdf, csv } = await generateReport(ranked, outDir);
    printTop(ranked);
    console.log(`RUN_OK | fetched=${listing.length} | ranked=${ranked.length} | output_pdf=${pdf} | output_csv=${csv} | run_id=${runId}`);
    if (dryRun) {
      // no-op, no email/send
    }
    process.exit(0);
  } catch (err: any) {
    console.error("RUN_FAIL", err?.message || err);
    process.exit(1);
  }
}

function printTop(items: any[]) {
  console.log("TOP10:");
  items.slice(0, 10).forEach((it, idx) => {
    console.log(
      `${idx + 1}. ${it.province || ""}/${it.municipality || ""} desc=${it.descuento_pct?.toFixed(1) ?? "—"}% precio=${
        it.precio_salida ?? "—"
      } valor=${it.valor_tasacion ?? "—"} fin=${it.deadline ? it.deadline.toISOString().slice(0, 10) : "—"} sem=${it.semaforo}`
    );
  });
}

main().catch((err) => {
  console.error("RUN_FAIL", err?.message || err);
  process.exit(1);
});

