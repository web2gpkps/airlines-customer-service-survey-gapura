import type { ServerDashboardData } from "../sheets";
import { stationCode } from "../target-shared";
import { buildSummary, classify, formatLowItems, type Classification } from "./classify";
import { pickSection, spansOf } from "./sections";
import { FOLLOWUP_KPI, LOW_ITEM_MAX } from "./types";

/** Satu jawaban survei beserta hasil baca sistem. Dipakai untuk membuat baris tracker dan tab Apresiasi. */
export interface Candidate {
  responseId: string;
  date: string;
  station: string; // kode bandara (CGK, YIA, ...)
  airline: string;
  route: string; // "Rute • Tujuan perjalanan", sama dengan kolom di sheet
  flight: string; // nomor penerbangan & tanggal
  nps: number | null;
  index: number | null;
  classification: Classification;
  /** Bagian kuesioner (Check-in & Dokumen, Boarding Gate, dst.). */
  category: string;
  summary: string;
  quote: string;
  lowItemsText: string;
  lowCount: number;
  /** Urutan baris di sheet survei, supaya item baru ditambahkan menurut urutan masuk. */
  order: number;
}

export interface ResponseDetail {
  responseId: string;
  submittedAt: string;
  name: string;
  phone: string;
  best: string;
  improve: string;
  suggestion: string;
  index: number | null;
  nps: number | null;
  airline: string;
  station: string;
  flight: string;
  route: string;
  flightType: string;
  travelPurpose: string;
  lowItems: { no: number; text: string; score: number }[];
}

const find = (headers: string[], re: RegExp) => headers.findIndex((h) => re.test(h));

function columns(headers: string[]) {
  return {
    name: find(headers, /^\s*(\d+\.\s*)?nama penumpang/i),
    phone: find(headers, /nomor hp|no\.?\s?hp/i),
  };
}

const cell = (row: string[], i: number) => (i >= 0 ? (row[i] ?? "").trim() : "");
const clean = (s: string) => s.replace(/&amp;/gi, "&");

function statementsOf(data: ServerDashboardData) {
  return data.segments.airline.sections.flatMap((s) => s.statements.map((st) => ({ no: st.no, text: clean(st.text) })));
}

/** Kolom "Rute / Jenis Penerbangan / Tujuan" di sheet: rute dan tujuan perjalanan dipisah titik tengah. */
const routeText = (route: string, purpose: string) => [route, purpose].filter(Boolean).join(" • ");

export function buildCandidates(data: ServerDashboardData): Candidate[] {
  const seg = data.segments.airline;
  const statements = statementsOf(data);
  const spans = spansOf(seg.sections);
  const out: Candidate[] = [];

  for (const r of seg.responses) {
    const valid = r.scores.filter((s): s is number => s !== null);
    const index = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
    const lowItems = r.scores.flatMap((s, k) =>
      s !== null && s <= LOW_ITEM_MAX && statements[k] ? [{ ...statements[k], score: s }] : [],
    );
    // Formulir Airline tidak punya pertanyaan "pernah mengalami kendala"; keluhan hanya terbaca dari teks.
    const input = {
      index,
      nps: r.nps,
      issueYes: false,
      improve: r.comments.improve,
      suggestion: r.comments.suggestion,
      lowItems,
    };
    const classification = classify(input);
    const category = pickSection({
      spans,
      scores: r.scores,
      index,
      belowKpi: index !== null && Math.round(index * 100) / 100 < FOLLOWUP_KPI,
      kendala: classification.complaint,
      text: `${r.comments.improve} ${r.comments.suggestion}`,
    });
    const built = classification.klass ? buildSummary({ ...input, klass: classification.klass }) : null;
    out.push({
      responseId: r.id,
      date: r.date,
      station: stationCode(r.airport),
      airline: r.airline,
      route: routeText(r.route, r.travelPurpose),
      flight: r.flight.replace(/\s+/g, " "),
      nps: r.nps,
      index,
      classification,
      summary: built?.summary ?? "",
      quote: built?.quote ?? "",
      lowItemsText: formatLowItems(lowItems),
      category,
      lowCount: lowItems.length,
      order: r.rowIndex,
    });
  }
  return out;
}

/** Ringkasan satu jawaban yang tidak perlu ditindaklanjuti, untuk tab Apresiasi. */
export function appreciationSummary(data: ServerDashboardData, responseId: string): string {
  const r = data.segments.airline.responses.find((x) => x.id === responseId);
  if (!r) return "";
  const t = [r.comments.best, r.comments.suggestion, r.comments.improve].find((x) => x.trim().length > 3) ?? "";
  return t.replace(/\s+/g, " ").trim().slice(0, 160);
}

/** Data lengkap satu jawaban, termasuk data pribadi responden. Hanya untuk pengguna yang sudah login. */
export function responseDetail(data: ServerDashboardData, responseId: string): ResponseDetail | null {
  const seg = data.segments.airline;
  const r = seg.responses.find((x) => x.id === responseId);
  if (!r) return null;
  const row = seg.rows[r.rowIndex] ?? [];
  const cols = columns(seg.headers);
  const statements = statementsOf(data);
  const valid = r.scores.filter((s): s is number => s !== null);
  return {
    responseId: r.id,
    submittedAt: r.submittedAt,
    name: cell(row, cols.name),
    phone: cell(row, cols.phone),
    best: r.comments.best,
    improve: r.comments.improve,
    suggestion: r.comments.suggestion,
    index: valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null,
    nps: r.nps,
    airline: r.airline,
    station: r.airport,
    flight: r.flight,
    route: r.route,
    flightType: r.flightType,
    travelPurpose: r.travelPurpose,
    lowItems: r.scores.flatMap((s, k) =>
      s !== null && s <= LOW_ITEM_MAX && statements[k] ? [{ ...statements[k], score: s }] : [],
    ),
  };
}
