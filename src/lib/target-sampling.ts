import type { Response } from "./scoring";
import { getSheetsAccess } from "./sheets";
import { stationCode, type OutsideGroup, type OutsideReason, type TargetBlock, type TargetData, type TargetRow } from "./target-shared";

export type { OutsideGroup, OutsideReason, TargetBlock, TargetData, TargetRow };

// Target sampling per cabang. Angka Terkumpul dibaca dari sheet "Target Sampling" apa adanya (sama dengan PDF panduan).
// Aturan pencocokan (kode stasiun + pola nama airline) dibaca dari rumus sheet yang sama, supaya respons yang
// tidak terhitung bisa ditandai "di luar panduan target sampling" dengan aturan yang persis sama.

export const TARGET_SHEET = "Target Sampling";

const CACHE_TTL_MS = 60_000;
const MAX_PATTERN_LENGTH = 400;

interface Rule {
  code: string;
  airline: RegExp;
}

interface Parsed {
  blocks: TargetBlock[];
  rules: Rule[];
}

let cache: { at: number; parsed: Parsed } | null = null;


const toNumber = (raw: string | undefined): number | null => {
  const n = Number((raw ?? "").replace(/[^\d.-]/g, ""));
  return /\d/.test(raw ?? "") && Number.isFinite(n) ? n : null;
};

function compile(pattern: string): RegExp | null {
  if (pattern.length > MAX_PATTERN_LENGTH) return null;
  try {
    return new RegExp(pattern.replace(/^\(\?i\)/, ""), "i");
  } catch {
    return null;
  }
}

// REGEXMATCH(F, "(?i)\(\s*AAP\s*\)") dan REGEXMATCH(G, "<pola airline>") di dalam SUMPRODUCT.
const FORMULA = /^=SUMPRODUCT\(--REGEXMATCH\([^,]+,"([^"]*)"\),--REGEXMATCH\([^,]+,"([^"]*)"\)\)$/;

export function parseTargetSheet(values: string[][], formulas: string[][]): Parsed {
  const blocks: TargetBlock[] = [];
  const rules: Rule[] = [];
  let current: TargetBlock | null = null;

  values.forEach((row, i) => {
    const first = (row[0] ?? "").trim();
    const header = first.match(/^CABANG\s+([A-Za-z0-9]{3})$/i);
    if (header) {
      current = { code: header[1].toUpperCase(), summary: (row[3] ?? "").trim(), target: 0, collected: 0, remaining: 0, pct: null, b2b: 0, rows: [] };
      blocks.push(current);
      return;
    }
    if (!current) return;
    if (/^TOTAL/i.test(first)) {
      current.target = toNumber(row[3]) ?? 0;
      current.collected = toNumber(row[4]) ?? 0;
      current.remaining = toNumber(row[5]) ?? 0;
      current.b2b = toNumber(row[7]) ?? 0;
      current.pct = current.target > 0 ? current.collected / current.target : null;
      return;
    }
    const no = toNumber(first);
    if (no === null || !/^\d+$/.test(first)) return;

    const target = toNumber(row[3]);
    const collected = target === null ? null : (toNumber(row[4]) ?? 0);
    current.rows.push({
      no,
      airline: (row[1] ?? "").trim(),
      category: (row[2] ?? "").trim(),
      target,
      collected,
      remaining: target === null || collected === null ? null : Math.max(0, target - collected),
      pct: target && collected !== null ? collected / target : null,
      b2b: toNumber(row[7]),
      note: (row[8] ?? "").trim(),
    });

    const match = String(formulas[i]?.[4] ?? "").match(FORMULA);
    if (match) {
      const airline = compile(match[2]);
      if (airline) rules.push({ code: current.code, airline });
    }
  });
  return { blocks, rules };
}

async function loadTargetSheet(): Promise<Parsed> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.parsed;
  const { base, headers } = await getSheetsAccess();
  const get = async (render: "FORMATTED_VALUE" | "FORMULA") => {
    const res = await fetch(`${base}/values/${encodeURIComponent(`'${TARGET_SHEET}'`)}?valueRenderOption=${render}`, { headers, cache: "no-store" });
    if (!res.ok) throw new Error(`Google Sheets API ${res.status}`);
    return (((await res.json()) as { values?: string[][] }).values ?? []).map((r) => r.map((c) => String(c ?? "")));
  };
  const [values, formulas] = await Promise.all([get("FORMATTED_VALUE"), get("FORMULA")]);
  const parsed = parseTargetSheet(values, formulas);
  cache = { at: Date.now(), parsed };
  return parsed;
}

export function classifyOutside(parsed: Parsed, responses: Response[]): OutsideGroup[] {
  const blockCodes = new Map(parsed.blocks.map((b) => [b.code, b]));
  const groups = new Map<string, OutsideGroup>();
  for (const r of responses) {
    const code = stationCode(r.airport);
    let reason: OutsideReason | null = null;
    if (!code) reason = "no-station";
    else {
      const block = blockCodes.get(code);
      if (!block) reason = "no-block";
      else if (!parsed.rules.some((rule) => rule.code === code && rule.airline.test(r.airline))) {
        reason = block.target === 0 ? "b2b-only" : "airline-unlisted";
      }
    }
    if (!reason) continue;
    const airline = r.airline.replace(/\s+/g, " ").trim().toUpperCase() || "(kosong)";
    const key = `${code}|${airline}|${reason}`;
    const group = groups.get(key);
    if (group) group.count++;
    else groups.set(key, { code, airline, reason, count: 1 });
  }
  return [...groups.values()].sort((a, b) => a.code.localeCompare(b.code) || b.count - a.count);
}

/** Data target untuk halaman yang menampilkannya. Gagal baca sheet tidak menjatuhkan dashboard. */
export async function getTargetData(responses: Response[]): Promise<TargetData> {
  try {
    const parsed = await loadTargetSheet();
    const outside = classifyOutside(parsed, responses);
    return { blocks: parsed.blocks, outside, totalResponses: responses.length, outsideTotal: outside.reduce((a, g) => a + g.count, 0) };
  } catch (err) {
    console.error("Gagal memuat sheet Target Sampling:", err);
    return { blocks: [], outside: [], totalResponses: responses.length, outsideTotal: 0, error: "Sheet Target Sampling belum bisa dimuat." };
  }
}
