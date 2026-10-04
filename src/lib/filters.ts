import type { Response } from "./scoring";
import { SEGMENT_IDS, type Segment } from "./survey-config";

export interface Filters {
  month: string;
  airline: string;
  flightType: string;
  travelPurpose: string;
  route: string;
}

export const EMPTY_FILTERS: Filters = { month: "", airline: "", flightType: "", travelPurpose: "", route: "" };

export function applyFilters(responses: Response[], f: Filters) {
  return responses.filter(
    (r) =>
      (!f.month || r.date.startsWith(f.month)) &&
      (!f.airline || r.airline === f.airline) &&
      (!f.flightType || r.flightType === f.flightType) &&
      (!f.travelPurpose || r.travelPurpose === f.travelPurpose) &&
      (!f.route || r.route === f.route),
  );
}

export const hasFilters = (f: Filters) => Boolean(f.month || f.airline || f.flightType || f.travelPurpose || f.route);

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
  airline: "maskapai",
  flightType: "jenis",
  travelPurpose: "tujuan",
  route: "rute",
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
      const v = q.filters[seg][key];
      if (v) params.set(`${seg}.${PARAM[key]}`, v);
    }
  }
  if (q.content.length < ALL_CONTENT.length) params.set("konten", q.content.join(","));
  return params.toString();
}

export function parseScope(sp: Record<string, string | string[] | undefined> | URLSearchParams): ReportScope {
  const get = (k: string) => {
    const v = sp instanceof URLSearchParams ? sp.get(k) : sp[k];
    return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
  };
  const segments = get("segmen")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is Segment => (SEGMENT_IDS as string[]).includes(s));
  const filters: Record<Segment, Filters> = {
    airline: {
      month: get("airline.periode"),
      airline: get("airline.maskapai"),
      flightType: get("airline.jenis"),
      travelPurpose: get("airline.tujuan"),
      route: get("airline.rute"),
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

export type ExportFormat = "pdf" | "xlsx";

export const exportUrl = (scope: ReportScope, format: ExportFormat) =>
  `/api/export?format=${format}&${scopeToSearch(scope)}`;
