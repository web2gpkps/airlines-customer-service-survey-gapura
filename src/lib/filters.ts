import { meetsKpi, type Response } from "./scoring";
import { SEGMENT_IDS, type Segment } from "./survey-config";

/** Tiap filter menyimpan daftar pilihan; daftar kosong berarti semua data. */
export interface Filters {
  month: string[];
  airport: string[];
  airline: string[];
  flightType: string[];
  route: string[];
  kpi: ("met" | "unmet")[];
}

export const EMPTY_FILTERS: Filters = { month: [], airport: [], airline: [], flightType: [], route: [], kpi: [] };

const MAX_VALUES = 100;
const MAX_VALUE_LENGTH = 120;

const matches = (selected: string[], value: string) => !selected.length || selected.includes(value);

export const KPI_OPTIONS = [
  { value: "met", label: "Memenuhi standar (≥ 4,50)" },
  { value: "unmet", label: "Belum memenuhi (< 4,50)" },
] as const;

/** Index satu responden = rata-rata semua pernyataan yang dijawab (sama dengan Total Skor / Skor Maksimum × 5). */
function respondentIndex(r: Response): number | null {
  const answered = r.scores.filter((s): s is number => s !== null);
  return answered.length ? answered.reduce((a, b) => a + b, 0) / answered.length : null;
}

export function applyFilters(responses: Response[], f: Filters) {
  return responses.filter(
    (r) =>
      (!f.month.length || f.month.some((m) => r.date.startsWith(m))) &&
      matches(f.airport, r.airport) &&
      matches(f.airline, r.airline) &&
      matches(f.flightType, r.flightType) &&
      matches(f.route, r.route) &&
      (f.kpi.length !== 1 || meetsKpi(respondentIndex(r)) === (f.kpi[0] === "met")),
  );
}

export const hasFilters = (f: Filters) => Object.values(f).some((values) => values.length > 0);

export const CONTENT_OPTIONS = [
  { key: "ringkasan", label: "Ringkasan index" },
  { key: "bagian", label: "Index per bagian" },
  { key: "prioritas", label: "Pernyataan skor terendah" },
  { key: "tren", label: "Tren mingguan" },
  { key: "rincian", label: "Rincian per pernyataan" },
  { key: "responden", label: "Kata responden" },
  { key: "standar", label: "Standar KPI & cara hitung" },
] as const;

export type ContentKey = (typeof CONTENT_OPTIONS)[number]["key"];
export const ALL_CONTENT: ContentKey[] = CONTENT_OPTIONS.map((c) => c.key);

const PARAM: Record<keyof Filters, string> = {
  month: "periode",
  airport: "stasiun",
  airline: "maskapai",
  flightType: "jenis",
  route: "rute",
  kpi: "kpi",
};

export interface ReportScope {
  segments: Segment[];
  filters: Record<Segment, Filters>;
  content: ContentKey[];
}

export function scopeToSearch(q: ReportScope): string {
  const params = new URLSearchParams();
  params.set("segmen", q.segments.join(","));
  for (const seg of q.segments) {
    for (const key of Object.keys(PARAM) as (keyof Filters)[]) {
      for (const v of q.filters[seg][key]) params.append(`${seg}.${PARAM[key]}`, v);
    }
  }
  if (q.content.length < ALL_CONTENT.length) params.set("konten", q.content.join(","));
  return params.toString();
}

export function parseScope(sp: Record<string, string | string[] | undefined> | URLSearchParams): ReportScope {
  const get = (k: string) => {
    const v = sp instanceof URLSearchParams ? sp.get(k) : sp[k];
    return (Array.isArray(v) ? v[0] : v)?.trim().slice(0, MAX_VALUE_LENGTH) ?? "";
  };
  const getAll = (k: string): string[] => {
    const v = sp instanceof URLSearchParams ? sp.getAll(k) : sp[k];
    const list = Array.isArray(v) ? v : v ? [v] : [];
    return [...new Set(list.map((s) => s.trim().slice(0, MAX_VALUE_LENGTH)).filter(Boolean))].slice(0, MAX_VALUES);
  };
  const segments = get("segmen")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is Segment => (SEGMENT_IDS as string[]).includes(s));
  const filters: Record<Segment, Filters> = {
    airline: {
      month: getAll("airline.periode"),
      airport: getAll("airline.stasiun"),
      airline: getAll("airline.maskapai"),
      flightType: getAll("airline.jenis"),
      route: getAll("airline.rute"),
      kpi: getAll("airline.kpi").filter((k): k is "met" | "unmet" => k === "met" || k === "unmet"),
    },
  };
  const content = get("konten")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is ContentKey => (ALL_CONTENT as string[]).includes(s));
  return {
    segments: segments.length ? SEGMENT_IDS.filter((s) => segments.includes(s)) : [...SEGMENT_IDS],
    filters,
    content: content.length ? ALL_CONTENT.filter((c) => content.includes(c)) : [...ALL_CONTENT],
  };
}

export type ExportFormat = "pdf" | "pdf-slide" | "xlsx";

export const exportUrl = (scope: ReportScope, format: ExportFormat, base = "/api/export") =>
  `${base}?format=${format}&${scopeToSearch(scope)}`;
