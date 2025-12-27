import fs from "fs";
import pdf from "pdf-parse";
import mammoth from "mammoth";

const MAX_CHARS = Number(process.env.NPL_TEXT_MAX_CHARS || 20000);

export async function extractText(filePath: string, mimeType: string | null): Promise<string> {
  const lowerMime = (mimeType || "").toLowerCase();
  try {
    if (lowerMime.includes("pdf") || filePath.toLowerCase().endsWith(".pdf")) {
      const buf = fs.readFileSync(filePath);
      const parsed = await pdf(buf).catch(() => null);
      if (parsed?.text) return truncate(parsed.text);
    }
    if (lowerMime.includes("word") || filePath.toLowerCase().endsWith(".docx")) {
      const res = await mammoth.extractRawText({ path: filePath }).catch(() => null);
      if (res?.value) return truncate(res.value);
    }
  } catch (err: any) {
    console.warn("TEXT_EXTRACT_FAIL", filePath, err?.message || err);
  }
  return "";
}

function truncate(text: string): string {
  if (!text) return "";
  if (text.length > MAX_CHARS) return text.slice(0, MAX_CHARS);
  return text;
}

