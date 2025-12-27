import path from "path";
import type { PoolClient } from "pg";

type MatchInput = {
  filename: string;
  folder: string | null;
  text: string;
};

type MatchResult = { assetId: string | null; score: number; reason: string; identifier?: string | null };

type AssetInfo = { asset_id: string; portfolio: string | null; location: string | null };

const WEIGHTS = {
  refCat: 50,
  ndg: 30,
  bmom: 20,
  bgal: 20,
  municipality: 10,
  portfolio: 10
};

const refCatRegex = /(?:REF|RC|CATASTRAL|CATASTRO)[-_:\s]*([0-9A-Z]{14,20})/gi;
const ndgRegex = /(NDG\d{3,})/gi;
const bmomRegex = /(BMOM\d{3,})/gi;
const bgalRegex = /(BGAL\d{3,})/gi;
const refCatLoose = /([0-9A-Z]{14,20})/g;

export class DocumentMatcher {
  private refCatMap = new Map<string, string>();
  private idMap = new Map<string, { assetId: string; type: string }>(); // any id_value -> {assetId,type}
  private assets = new Map<string, AssetInfo>();

  static async build(client: PoolClient): Promise<DocumentMatcher> {
    const self = new DocumentMatcher();
    const idRows = await client.query(`SELECT asset_id, id_type, id_value FROM npl_norm.asset_identifiers`);
    for (const r of idRows.rows) {
      const idVal = r.id_value ? String(r.id_value).toUpperCase() : null;
      if (!idVal) continue;
      const type = (r.id_type || "").toUpperCase();
      self.idMap.set(idVal, { assetId: r.asset_id, type });
      switch ((r.id_type || "").toUpperCase()) {
        case "REF_CAT":
          self.refCatMap.set(idVal, r.asset_id);
          break;
        default:
          break;
      }
    }

    const assetRows = await client.query(`SELECT asset_id, portfolio, location, ref_catastral FROM npl_norm.assets`);
    for (const r of assetRows.rows) {
      self.assets.set(r.asset_id, {
        asset_id: r.asset_id,
        portfolio: r.portfolio || null,
        location: r.location || null
      });
      if (r.ref_catastral) {
        const val = String(r.ref_catastral).toUpperCase();
        if (!self.refCatMap.has(val)) self.refCatMap.set(val, r.asset_id);
      }
    }
    return self;
  }

  match(input: MatchInput): MatchResult {
    const candidates = new Map<string, number>();
    const reasons = new Map<string, string[]>();
    const idHit = new Map<string, string>();

    const textUpper = (input.text || "").toUpperCase();
    const nameUpper = input.filename.toUpperCase();

    const addScore = (assetId: string, inc: number, reason: string) => {
      candidates.set(assetId, (candidates.get(assetId) || 0) + inc);
      if (!reasons.has(assetId)) reasons.set(assetId, []);
      reasons.get(assetId)!.push(reason);
    };

    const refCats = collectMatches(refCatRegex, textUpper + " " + nameUpper);
    refCats.forEach(ref => {
      const assetId = this.refCatMap.get(ref);
      if (assetId) {
        addScore(assetId, WEIGHTS.refCat, `ref_catastral:${ref}`);
        idHit.set(assetId, ref);
      }
    });

    const looseRefs = collectMatches(refCatLoose, textUpper + " " + nameUpper).filter(isPotentialRef);
    looseRefs.forEach(ref => {
      const assetId = this.refCatMap.get(ref);
      if (assetId) {
        addScore(assetId, WEIGHTS.refCat, `ref_catastral:${ref}`);
        idHit.set(assetId, ref);
      }
    });

    const ndgs = collectMatches(ndgRegex, textUpper + " " + nameUpper);
    ndgs.forEach(id => {
      const entry = this.idMap.get(id);
      if (entry) {
        addScore(entry.assetId, WEIGHTS.ndg, `ndg:${id}`);
        idHit.set(entry.assetId, id);
      }
    });

    const bmoms = collectMatches(bmomRegex, textUpper + " " + nameUpper);
    bmoms.forEach(id => {
      const entry = this.idMap.get(id);
      if (entry) {
        addScore(entry.assetId, WEIGHTS.bmom, `bmom:${id}`);
        idHit.set(entry.assetId, id);
      }
    });

    const bgals = collectMatches(bgalRegex, textUpper + " " + nameUpper);
    bgals.forEach(id => {
      const entry = this.idMap.get(id);
      if (entry) {
        addScore(entry.assetId, WEIGHTS.bgal, `bgal:${id}`);
        idHit.set(entry.assetId, id);
      }
    });

    // Token-based exact identifier matches
    const tokens = extractTokens(textUpper + " " + nameUpper);
    tokens.forEach(tok => {
      const entry = this.idMap.get(tok);
      if (!entry) return;
      const type = entry.type;
      const weight =
        type === "REF_CAT" ? WEIGHTS.refCat : type === "NDG" ? WEIGHTS.ndg : WEIGHTS.bmom; // default 20
      addScore(entry.assetId, weight, `${type.toLowerCase()}:${tok}`);
      idHit.set(entry.assetId, tok);
    });

    // Portfolio hint via folder
    // Portfolio/location hints only if candidate already exists
    if (input.folder) {
      const folderUpper = input.folder.toUpperCase();
      for (const assetId of candidates.keys()) {
        const info = this.assets.get(assetId);
        if (info?.portfolio && info.portfolio.toUpperCase() === folderUpper) {
          addScore(assetId, WEIGHTS.portfolio, `portfolio:${folderUpper}`);
        }
      }
    }

    // Location hint
    for (const assetId of candidates.keys()) {
      const info = this.assets.get(assetId);
      if (info?.location && textUpper.includes(info.location.toUpperCase())) {
        addScore(assetId, WEIGHTS.municipality, `location:${info.location}`);
      }
    }

    if (candidates.size === 0) return { assetId: null, score: 0, reason: "no_match" };

    let best: { id: string; score: number } = { id: "", score: 0 };
    for (const [id, sc] of candidates.entries()) {
      if (sc > best.score) best = { id, score: sc };
    }

    if (best.score >= 60) {
      const reason = (reasons.get(best.id) || []).join(",");
      return { assetId: best.id, score: best.score, reason, identifier: idHit.get(best.id) || null };
    }
    return { assetId: null, score: best.score, reason: "score_below_threshold" };
  }
}

function collectMatches(regex: RegExp, text: string): string[] {
  const values = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m[1]) values.add(m[1].toUpperCase());
  }
  return Array.from(values);
}

function isPotentialRef(val: string): boolean {
  if (!val) return false;
  if (val.length < 14 || val.length > 20) return false;
  const hasLetter = /[A-Z]/.test(val);
  const hasDigit = /\d/.test(val);
  return hasLetter && hasDigit;
}

function extractTokens(text: string): string[] {
  const parts = text.split(/[^A-Z0-9]+/).filter(Boolean);
  const filtered = parts.filter(p => p.length >= 4 && p.length <= 15);
  return Array.from(new Set(filtered));
}

export function extractContextFromPath(p: string): { filename: string; folder: string | null } {
  const filename = path.basename(p || "");
  const parts = p.split(path.sep).filter(Boolean);
  const folder = parts.length > 1 ? parts[0] : null;
  return { filename, folder };
}

