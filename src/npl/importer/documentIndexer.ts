import path from "path";
import { v4 as uuidv4 } from "uuid";
import type { PoolClient } from "pg";
import { extractText } from "./documentTextExtractor";
import { DocumentMatcher, extractContextFromPath } from "./documentMatcher";

type DocResult = { documents: number; linked: number; unlinked: number; avgScore: number };

async function ensureDocumentColumns(client: PoolClient) {
  await client.query(`ALTER TABLE npl_norm.documents ADD COLUMN IF NOT EXISTS link_score INT`);
  await client.query(`ALTER TABLE npl_norm.documents ADD COLUMN IF NOT EXISTS link_reason TEXT`);
}

function classifyDocType(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.includes("demanda")) return "demanda";
  if (lower.includes("sentencia")) return "sentencia";
  if (lower.includes("decreto")) return "decreto";
  if (lower.includes("nota simple") || lower.includes("notasimple")) return "nota simple";
  if (lower.includes("contrato") || lower.includes("loan") || lower.includes("hipoteca")) return "contrato";
  if (lower.includes("certificado")) return "certificado";
  if (lower.includes("tasacion") || lower.includes("valoracion")) return "tasacion";
  return null;
}

export async function indexDocuments(client: PoolClient): Promise<DocResult> {
  await ensureDocumentColumns(client);

  const files = await client.query(
    `SELECT file_id, stored_path, original_path, mime_type FROM npl_raw.files WHERE mime_type ILIKE 'application/pdf%' OR mime_type ILIKE 'application/msword%' OR mime_type ILIKE 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'`
  );

  const matcher = await DocumentMatcher.build(client);

  let documents = 0;
  let linked = 0;
  let unlinked = 0;
  let scoreSum = 0;

  for (const f of files.rows) {
    documents += 1;
    const fileId = f.file_id as string;
    const storedPath = f.stored_path as string;
    const originalPath = f.original_path as string;
    const mime = f.mime_type as string;
    const { filename, folder } = extractContextFromPath(originalPath || storedPath);
    const guessedType = classifyDocType(filename);

    const text = await extractText(storedPath, mime);
    const match = matcher.match({ filename, folder, text });
    scoreSum += match.score;
    if (match.assetId) linked += 1;
    else unlinked += 1;

    // Evita duplicados al reejecutar
    await client.query(`DELETE FROM npl_norm.documents WHERE file_id = $1`, [fileId]);

    await client.query(
      `
        INSERT INTO npl_norm.documents (document_id, asset_id, file_id, guessed_identifier, guessed_doc_type, date_guess, link_score, link_reason, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now())
      `,
      [uuidv4(), match.assetId, fileId, match.identifier || null, guessedType, null, match.score || null, match.reason || null]
    );
  }

  const avgScore = documents > 0 ? Math.round(scoreSum / documents) : 0;
  console.log(`RUN_OK | documents=${documents} | linked=${linked} | unlinked=${unlinked} | avg_score=${avgScore}`);
  return { documents, linked, unlinked, avgScore };
}

