import path from "path";
import { v4 as uuidv4 } from "uuid";
import XLSX from "xlsx";
import type { PoolClient } from "pg";

type ParseResult = { excelsParsed: number; assetsCreated: number };

const identifierKeys = ["ndg", "bmom", "bgal", "ref_catastral", "ref cat", "referencia catastral", "catastral"];

function pickIdentifier(row: any, key: string): string | null {
  const entries = Object.entries(row || {});
  for (const [k, v] of entries) {
    if (!v) continue;
    const kNorm = k.toString().toLowerCase();
    if (kNorm.includes(key)) return String(v).trim();
  }
  return null;
}

function pickNumber(row: any, keys: string[]): number | null {
  for (const k of Object.keys(row || {})) {
    const kNorm = k.toLowerCase();
    if (keys.some(key => kNorm.includes(key))) {
      const v = Number(row[k]);
      if (!Number.isNaN(v)) return v;
    }
  }
  return null;
}

export async function parseExcels(client: PoolClient): Promise<ParseResult> {
  const excelRows = await client.query(
    `SELECT file_id, stored_path, original_path FROM npl_raw.files WHERE mime_type LIKE '%spreadsheet%' OR stored_path ILIKE '%.xlsx'`
  );

  let excelsParsed = 0;
  let assetsCreated = 0;

  for (const row of excelRows.rows) {
    const filePath = row.stored_path as string;
    const wb = XLSX.readFile(filePath, { cellDates: true });
    excelsParsed += 1;

    const portfolio = inferPortfolio(row.original_path || filePath);

    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      const records: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });
      for (const rec of records) {
        const assetId = uuidv4();
        const refCat =
          pickIdentifier(rec, "ref_catastral") ||
          pickIdentifier(rec, "ref cat") ||
          pickIdentifier(rec, "referencia catastral") ||
          pickIdentifier(rec, "catastral");
        const ndg = pickIdentifier(rec, "ndg");
        const bmom = pickIdentifier(rec, "bmom");
        const bgal = pickIdentifier(rec, "bgal");
        const gbv = pickNumber(rec, ["gbv", "importe", "importe_bruto", "bruto"]);
        const auctionValue = pickNumber(rec, ["subasta", "auction", "valor_sub"]);
        const status = pickIdentifier(rec, "estado") || null;

        await client.query(
          `
            INSERT INTO npl_norm.assets (asset_id, portfolio, ref_catastral, location, gbv, auction_value, status_internal, created_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7, now())
          `,
          [assetId, portfolio, refCat, null, gbv, auctionValue, status]
        );
        assetsCreated += 1;

        const identifiers: { id_type: string; id_value: string }[] = [];
        if (ndg) identifiers.push({ id_type: "NDG", id_value: ndg });
        if (bmom) identifiers.push({ id_type: "BMOM", id_value: bmom });
        if (bgal) identifiers.push({ id_type: "BGAL", id_value: bgal });
        if (refCat) identifiers.push({ id_type: "REF_CAT", id_value: refCat });

        for (const id of identifiers) {
          await client.query(
            `
              INSERT INTO npl_norm.asset_identifiers (asset_id, id_type, id_value)
              VALUES ($1,$2,$3)
              ON CONFLICT DO NOTHING
            `,
            [assetId, id.id_type, id.id_value]
          );
        }
      }
    }
  }

  console.log(`RUN_OK | excels_parsed=${excelsParsed} | assets_created=${assetsCreated}`);
  return { excelsParsed, assetsCreated };
}

function inferPortfolio(originalPath: string): string | null {
  const parts = originalPath.split(path.sep).filter(Boolean);
  if (parts.length === 0) return null;
  return parts[0];
}

