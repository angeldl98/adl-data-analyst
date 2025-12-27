import axios from "axios";
import * as cheerio from "cheerio";
import { ListingItem } from "./types";

const LISTING_URL = process.env.BOE_LIVE_LISTING_URL || "https://www.boe.es/rss/subastas.php";
const MAX_LISTING = Number(process.env.BOE_LIVE_MAX_LISTING || 50);

export async function fetchListing(): Promise<ListingItem[]> {
  const res = await axios.get(LISTING_URL, {
    headers: { "User-Agent": userAgent() },
    timeout: 15000
  });
  const $ = cheerio.load(res.data, { xmlMode: true });
  const items: ListingItem[] = [];
  $("item")
    .slice(0, MAX_LISTING)
    .each((_, el) => {
      const link = $(el).find("link").first().text().trim();
      const title = $(el).find("title").first().text().trim();
      const desc = $(el).find("description").first().text().trim();
      const { province, municipality, tipo } = parseTitle(title) || {};
      const deadline = parseDeadline(desc);
      items.push({
        url: link,
        province: province || null,
        municipality: municipality || null,
        deadline,
        tipo: tipo || null
      });
    });
  return items;
}

function parseTitle(title: string): { province?: string; municipality?: string; tipo?: string } | null {
  // Ejemplo de título típico: "Subasta de Bienes Muebles: Vivienda en Madrid (Madrid)"
  if (!title) return null;
  const parts = title.split(":");
  const tipo = parts[1]?.split(" en ")[0]?.trim();
  const locPart = parts[1]?.split(" en ")[1] || "";
  const locMatch = locPart.match(/(.+)\s+\((.+)\)/);
  if (locMatch) {
    return { tipo, municipality: locMatch[1].trim(), province: locMatch[2].trim() };
  }
  return { tipo };
}

function parseDeadline(desc: string): Date | null {
  // El RSS incluye algo como "Fecha de finalización: 27-12-2025"
  const m = desc.match(/Fecha de finalización:\s*([0-9]{2}-[0-9]{2}-[0-9]{4})/i);
  if (!m) return null;
  const [d, mth, y] = m[1].split("-").map(Number);
  return new Date(y, mth - 1, d);
}

function userAgent() {
  return (
    process.env.BOE_LIVE_UA ||
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
  );
}

