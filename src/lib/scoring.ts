/** Standar minimum Index Kepuasan Airline CSS (Skala Likert 1–5). */
export const KPI_TARGET = 4.5;

export type StatusTone = "good" | "warning" | "critical";

export interface Category {
  label: string;
  status: string;
  tone: StatusTone;
  range: string;
}

export const CATEGORIES: Category[] = [
  { range: "≤ 1,00", label: "Sangat Tidak Puas", status: "Belum Memenuhi Standar", tone: "critical" },
  { range: "1,01 – 2,00", label: "Tidak Puas", status: "Belum Memenuhi Standar", tone: "critical" },
  { range: "2,01 – 3,00", label: "Cukup / Netral", status: "Belum Memenuhi Standar", tone: "critical" },
  { range: "3,01 – 4,49", label: "Puas", status: "Perlu Peningkatan / Belum Memenuhi Standar", tone: "warning" },
  { range: "4,50 – 5,00", label: "Sangat Puas", status: "Memenuhi Standar KPI", tone: "good" },
];

/** Index dibulatkan 2 desimal sebelum diklasifikasi, sehingga angka yang tampil selalu cocok dengan kategorinya. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function categorize(index: number | null): Category | null {
  if (index === null) return null;
  const r = round2(index);
  if (r <= 1) return CATEGORIES[0];
  if (r <= 2) return CATEGORIES[1];
  if (r <= 3) return CATEGORIES[2];
  if (r < KPI_TARGET) return CATEGORIES[3];
  return CATEGORIES[4];
}

export function meetsKpi(index: number | null): boolean {
  return index !== null && round2(index) >= KPI_TARGET;
}

export function formatIndex(index: number | null): string {
  if (index === null) return "–";
  return round2(index).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatSigned(value: number): string {
  const r = round2(value);
  const s = Math.abs(r).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return r > 0 ? `+${s}` : r < 0 ? `−${s}` : s;
}

/* ------------------------------------------------------------------ */

export interface Response {
  id: string;
  rowIndex: number;
  date: string;
  submittedAt: string;
  airline: string;
  flight: string;
  route: string;
  flightType: string;
  travelPurpose: string;
  isTestData: boolean;
  nps: number | null;
  scores: (number | null)[];
  comments: { best: string; improve: string; suggestion: string };
}

export interface Tally {
  counts: [number, number, number, number, number];
  n: number;
  total: number;
  max: number;
  index: number | null;
}

function emptyTally(): Tally {
  return { counts: [0, 0, 0, 0, 0], n: 0, total: 0, max: 0, index: null };
}

function finish(t: Tally): Tally {
  // Index (1–5) = Total Skor / Skor Maksimum × 5
  t.index = t.max > 0 ? (t.total / t.max) * 5 : null;
  return t;
}

function merge(into: Tally, from: Tally) {
  from.counts.forEach((c, i) => (into.counts[i] += c));
  into.n += from.n;
  into.total += from.total;
  into.max += from.max;
}

/** Struktur kuesioner hasil baca header sheet. Urutan statement = urutan skor di Response.scores. */
export interface StatementDef {
  no: number;
  text: string;
}

export interface SectionDef {
  code: string;
  title: string;
  short: string;
  statements: StatementDef[];
}

export interface StatementResult extends Tally {
  no: number;
  text: string;
  sectionCode: string;
}

export interface SectionResult extends Tally {
  code: string;
  title: string;
  short: string;
  statements: StatementResult[];
}

export interface SurveyResult {
  overall: Tally;
  sections: SectionResult[];
  respondents: number;
}

export function computeSurvey(defs: SectionDef[], responses: Response[]): SurveyResult {
  const overall = emptyTally();
  let offset = 0;
  const sections = defs.map((sec) => {
    const sTally = emptyTally();
    const statements = sec.statements.map((st, i) => {
      const t = emptyTally();
      for (const r of responses) {
        const v = r.scores[offset + i];
        if (v === null || v === undefined) continue;
        t.counts[v - 1] += 1;
        t.n += 1;
        t.total += v;
        t.max += 5;
      }
      finish(t);
      merge(sTally, t);
      return { ...t, no: st.no, text: st.text, sectionCode: sec.code };
    });
    offset += sec.statements.length;
    finish(sTally);
    merge(overall, sTally);
    return { ...sTally, code: sec.code, title: sec.title, short: sec.short, statements };
  });
  finish(overall);
  return { overall, sections, respondents: responses.length };
}

export interface NpsResult {
  score: number | null;
  promoters: number;
  passives: number;
  detractors: number;
  n: number;
}

export function computeNps(responses: Response[]): NpsResult {
  let promoters = 0;
  let passives = 0;
  let detractors = 0;
  for (const r of responses) {
    if (r.nps === null) continue;
    if (r.nps >= 9) promoters++;
    else if (r.nps >= 7) passives++;
    else detractors++;
  }
  const n = promoters + passives + detractors;
  return { score: n ? Math.round(((promoters - detractors) / n) * 100) : null, promoters, passives, detractors, n };
}

/** Index keseluruhan per minggu (Senin–Minggu) untuk grafik tren. */
export function weeklyTrend(defs: SectionDef[], responses: Response[]) {
  const buckets = new Map<string, Response[]>();
  for (const r of responses) {
    if (!r.date) continue;
    const d = new Date(`${r.date}T00:00:00Z`);
    const day = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - day);
    const key = d.toISOString().slice(0, 10);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(r);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, rs]) => ({ week, respondents: rs.length, index: computeSurvey(defs, rs).overall.index }));
}
