import axios from "axios";
import * as cheerio from "cheerio";
import { DetailItem } from "./types";
import { sleep } from "./util";

const MAX_DETAILS = Number(process.env.BOE_LIVE_MAX_DETAILS || 30);
const DELAY_MS = Number(process.env.BOE_LIVE_DELAY_MS || 2500);

export async function fetchDetails(urls: string[]): Promise<DetailItem[]> {
  const details: DetailItem[] = [];
  for (const url of urls.slice(0, MAX_DETAILS)) {
    try {
      const res = await axios.get(url, {
        headers: { "User-Agent": userAgent() },
        timeout: 15000
      });
      const $ = cheerio.load(res.data);
      const map = extractTable($);
      const precio = parseNumber(map["Tipo"] || map["Tipo de subasta"] || map["Tipo de salida"] || map["Tipo subasta"]);
      const valor = parseNumber(map["Valor subasta"] || map["Valor tasación"] || map["Tasación"]);
      const descripcion = (map["Descripción"] || map["Bien"] || map["Descripción del bien"] || "").trim() || null;
      const juzgado = (map["Juzgado"] || map["Órgano"] || map["Juzgado/órgano"] || "").trim() || null;
      const notas = (map["Notas"] || map["Observaciones"] || "").trim() || null;
      details.push({
        url,
        precio_salida: precio,
        valor_tasacion: valor,
        descripcion,
        juzgado,
        notas
      });
    } catch (err) {
      // omit failing detail but continue
    }
    await sleep(DELAY_MS);
  }
  return details;
}

function extractTable($: cheerio.CheerioAPI): Record<string, string> {
  const map: Record<string, string> = {};
  $("tr").each((_, tr) => {
    const th = $(tr).find("th").first().text().trim();
    const td = $(tr).find("td").first().text().trim();
    if (th) map[th.replace(/\s+/g, " ").trim()] = td;
  });
  return map;
}

function parseNumber(val?: string | null): number | null {
  if (!val) return null;
  const cleaned = val.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function userAgent() {
  return (
    process.env.BOE_LIVE_UA ||
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
  );
}

