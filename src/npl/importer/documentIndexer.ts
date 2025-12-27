import path from "path";
import { v4 as uuidv4 } from "uuid";
import type { PoolClient } from "pg";

type DocResult = { documents: number; linked: number; unlinked: number };

const idRegexes = [/(BMOM\d+)/i, /(BGAL\d+)/i, /(NDG\d+)/i, /([A-Z0-9]{14})/]; // includes ref catastral heuristic
const docKeywords: Record<string, string[]> = {
  demanda: ["demanda"],
  sentencia: ["sentencia"],
  decreto: ["decreto"],
  "nota simple": ["nota simple", "notasimple"],
  contrato: ["contrato", "loan", "hipoteca"],
  certificado: ["certificado"],
  tasacion: ["tasacion", "valoracion"]
};

function classifyDocType(name: string): string | null {
  const lower = name.toLowerCase();
  for (const [type, kws] of Object.entries(docKeywords)) {
    if (kws.some(k => lower.includes(k))) return type;
  }
  return null;
}

function findIdentifier(name: string): string | null {
  for (const r of idRegexes) {
    const m = name.match(r);
    if (m && m[1]) return m[1];
  }
  return null;
}

export async function indexDocuments(client: PoolClient): Promise<DocResult> {
  const files = await client.query(
    `SELECT file_id, stored_path, original_path FROM npl_raw.files WHERE mime_type ILIKE 'application/pdf%' OR mime_type ILIKE 'application/msword%' OR mime_type ILIKE 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'`
  );

  const idLookup = await client.query(`SELECT asset_id, id_value FROM npl_norm.asset_identifiers`);
  const idMap = new Map<string, string>();
  idLookup.rows.forEach(r => {
    if (r.id_value) idMap.set(String(r.id_value).toUpperCase(), String(r.asset_id));
  });

  let documents = 0;
  let linked = 0;
  let unlinked = 0;

  for (const f of files.rows) {
    documents += 1;
    const fileId = f.file_id as string;
    const name = path.basename(f.original_path || f.stored_path || "");
    const guessedId = findIdentifier(name);
    const guessedType = classifyDocType(name);

    let assetId: string | null = null;
    if (guessedId && idMap.has(guessedId.toUpperCase())) {
      assetId = idMap.get(guessedId.toUpperCase())!;
      linked += 1;
    } else {
      unlinked += 1;
    }

    await client.query(
      `
        INSERT INTO npl_norm.documents (document_id, asset_id, file_id, guessed_identifier, guessed_doc_type, date_guess, created_at)
        VALUES ($1,$2,$3,$4,$5,$6, now())
      `,
      [uuidv4(), assetId, fileId, guessedId, guessedType, null]
    );
  }

  console.log(`RUN_OK | documents=${documents} | linked=${linked} | unlinked=${unlinked}`);
  return { documents, linked, unlinked };
}

