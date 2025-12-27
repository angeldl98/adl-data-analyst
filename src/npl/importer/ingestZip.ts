import fs from "fs-extra";
import path from "path";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import unzipper from "unzipper";
import type { PoolClient } from "pg";

type IngestResult = { total: number; inserted: number; duplicates: number };

function readEnv(key: string, def: string) {
  return process.env[key] && process.env[key]!.trim() ? process.env[key]!.trim() : def;
}

export async function ingestZip(client: PoolClient): Promise<IngestResult> {
  const zipPath = readEnv("NPL_ZIP_PATH", "/mnt/data/dataset fondos.zip");
  const targetRoot = readEnv(
    "NPL_TARGET_DIR",
    `/opt/adl-suite/data/npl/raw/import_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`
  );

  await fs.ensureDir(targetRoot);
  const stat = await fs.stat(zipPath).catch(() => null);
  if (!stat) throw new Error(`zip_not_found ${zipPath}`);

  const directory = await unzipper.Open.file(zipPath);
  let total = 0;
  let inserted = 0;
  let duplicates = 0;

  for (const entry of directory.files) {
    if (entry.type === "Directory") continue;
    total += 1;
    const relPath = entry.path;
    const buf = await entry.buffer();
    const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
    const fileId = uuidv4();
    const destPath = path.join(targetRoot, relPath);
    await fs.ensureDir(path.dirname(destPath));
    await fs.writeFile(destPath, buf);

    const mime = inferMime(relPath);
    const size = buf.length;

    const res = await client.query(
      `
        INSERT INTO npl_raw.files (file_id, sha256, original_path, stored_path, size_bytes, mime_type, source_zip, ingested_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7, now())
        ON CONFLICT (sha256) DO NOTHING
      `,
      [fileId, sha256, relPath, destPath, size, mime, zipPath]
    );
    if (res.rowCount && res.rowCount > 0) inserted += 1;
    else duplicates += 1;
  }

  console.log(`RUN_OK | files_total=${total} | inserted=${inserted} | duplicates=${duplicates}`);
  return { total, inserted, duplicates };
}

function inferMime(relPath: string): string {
  const lower = relPath.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
  return "application/octet-stream";
}

