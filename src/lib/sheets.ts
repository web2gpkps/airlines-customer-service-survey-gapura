import { JWT } from "google-auth-library";
import { getServiceAccount, getSheetId } from "./credentials";
import type { Response, SectionDef } from "./scoring";
import { OTHER_SECTION, SECTION_CATALOG, SEGMENT_META, type Segment } from "./survey-config";

const CACHE_TTL_MS = 60_000;

export interface SegmentData {
  sheet: string;
  sections: SectionDef[];
  responses: Response[];
  unmapped: string[];
}

export interface ServerSegmentData extends SegmentData {
  headers: string[];
  rows: string[][];
  statementCols: number[][];
}

export interface DashboardData {
  fetchedAt: string;
  segments: Record<Segment, SegmentData>;
}

export interface ServerDashboardData extends DashboardData {
  segments: Record<Segment, ServerSegmentData>;
}

export function toClientData(data: ServerDashboardData): DashboardData {
  const { headers: _headers, rows: _rows, statementCols: _statementCols, ...airline } = data.segments.airline;
  return { fetchedAt: data.fetchedAt, segments: { airline } };
}

let cache: { at: number; data: ServerDashboardData } | null = null;

export function clearSheetCache() {
  cache = null;
}

export async function getDashboardData(): Promise<ServerDashboardData> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;
  const data = await fetchDashboardData();
  cache = { at: Date.now(), data };
  return data;
}

async function fetchDashboardData(): Promise<ServerDashboardData> {
  const account = getServiceAccount();
  const client = new JWT({
    email: account.client_email,
    key: account.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const { token } = await client.getAccessToken();
  const headers = { Authorization: `Bearer ${token}` };
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${getSheetId()}`;
  const sheet = SEGMENT_META.airline.sheet;

  const metaRes = await fetch(`${base}?fields=sheets.properties.title`, { headers, cache: "no-store" });
  if (!metaRes.ok) throw new Error(`Google Sheets API ${metaRes.status}: ${(await metaRes.text()).slice(0, 300)}`);
  const titles = new Set(
    ((await metaRes.json()) as { sheets: { properties: { title: string } }[] }).sheets.map((s) => s.properties.title),
  );
  if (!titles.has(sheet)) throw new Error(`Sheet "${sheet}" tidak ditemukan.`);

  const url = new URL(`${base}/values:batchGet`);
  url.searchParams.append("ranges", `'${sheet.replace(/'/g, "''")}'`);
  url.searchParams.set("valueRenderOption", "FORMATTED_VALUE");
  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) throw new Error(`Google Sheets API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { valueRanges: { values?: string[][] }[] };
  const rows = json.valueRanges[0]?.values ?? [];

  return {
    fetchedAt: new Date().toISOString(),
    segments: { airline: parseSegment("airline", rows) },
  };
}

const displayText = (text: string) => text.replace(/&amp;/gi, "&").trim();
const norm = (text: string) => displayText(text).toLowerCase().replace(/\s+/g, " ").trim();

function parseLikert(raw: string | undefined): number | null {
  const value = raw?.trim() ?? "";
  return /^[1-5]$/.test(value) ? Number(value) : null;
}

function parseNps(raw: string): number | null {
  const value = raw.trim();
  return /^(10|[0-9])$/.test(value) ? Number(value) : null;
}

function normalizeRoute(raw: string): string {
  const route = raw.trim().toUpperCase().match(/^([A-Z]{3})\s*[-–]\s*([A-Z]{3})$/);
  return route ? `${route[1]} - ${route[2]}` : raw.trim();
}

function findColumn(headers: string[], test: RegExp): number {
  return headers.findIndex((header) => test.test(header.trim()));
}

function requiredColumn(headers: string[], label: string, test: RegExp): number {
  const index = findColumn(headers, test);
  if (index < 0) throw new Error(`Kolom "${label}" tidak ditemukan di sheet Airline.`);
  return index;
}

function value(row: string[], index: number): string {
  return index < 0 ? "" : row[index]?.trim() ?? "";
}

function discoverStatements(headers: string[]) {
  return headers.flatMap((header, col) => {
    const match = header.match(/^Pernyataan\s*\/\s*Aspek yang Dinilai\s*\[([\s\S]+)\]\s*$/i);
    return match ? [{ text: displayText(match[1]), col }] : [];
  });
}

export function parseSegment(segment: Segment, rows: string[][]): ServerSegmentData {
  const [headers = [], ...body] = rows;
  if (!headers.length) throw new Error(`Sheet "${SEGMENT_META[segment].sheet}" tidak memiliki header.`);
  const discovered = discoverStatements(headers);
  if (!discovered.length) throw new Error("Tidak ada kolom pernyataan Likert pada sheet Airline.");

  const catalog = SECTION_CATALOG[segment];
  const sectionOf = new Map<string, number>();
  catalog.forEach((section, index) => section.statements.forEach((text) => sectionOf.set(norm(text), index)));
  const buckets: typeof discovered[] = catalog.map(() => []);
  const other: typeof discovered = [];
  for (const statement of discovered) {
    const index = sectionOf.get(norm(statement.text));
    if (index === undefined) other.push(statement);
    else buckets[index].push(statement);
  }

  let no = 0;
  const statementCols: number[][] = [];
  const sections: SectionDef[] = [];
  const addSection = (meta: { code: string; title: string; short: string }, items: typeof discovered) => {
    if (!items.length) return;
    sections.push({
      ...meta,
      statements: items.map(({ text, col }) => {
        statementCols.push([col]);
        return { no: ++no, text };
      }),
    });
  };
  catalog.forEach((section, index) => addSection(section, buckets[index]));
  addSection(OTHER_SECTION, other);

  const col = {
    id: requiredColumn(headers, "Submission ID", /^Submission ID$/i),
    submittedAt: requiredColumn(headers, "Submitted at", /^Submitted at$/i),
    airline: requiredColumn(headers, "Nama maskapai", /^1\.\s*Nama maskapai/i),
    flight: requiredColumn(headers, "Tanggal & nomor penerbangan", /^2\.\s*Tanggal\s*&\s*nomor penerbangan/i),
    route: requiredColumn(headers, "Rute", /^3\.\s*Rute\s*\//i),
    flightType: requiredColumn(headers, "Jenis penerbangan", /^4\.\s*Jenis penerbangan/i),
    travelPurpose: requiredColumn(headers, "Tujuan perjalanan", /^5\.\s*Tujuan perjalanan/i),
    nps: requiredColumn(headers, "Rekomendasi maskapai", /^6\.\s*Seberapa besar kemungkinan/i),
    best: findColumn(headers, /^7\.\s*Apa bagian dari layanan/i),
    improve: findColumn(headers, /^8\.\s*Apa yang menurut Anda perlu diperbaiki/i),
    suggestion: findColumn(headers, /^9\.\s*Saran atau masukan/i),
  };

  const responses: Response[] = [];
  body.forEach((row, rowIndex) => {
    const scores = statementCols.map(([column]) => parseLikert(value(row, column)));
    if (scores.every((score) => score === null)) return;
    const id = value(row, col.id) || `airline-${rowIndex + 1}`;
    const airline = value(row, col.airline);
    const submittedAt = value(row, col.submittedAt);
    responses.push({
      id,
      rowIndex,
      date: submittedAt.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? "",
      submittedAt,
      airline,
      flight: value(row, col.flight),
      route: normalizeRoute(value(row, col.route)),
      flightType: value(row, col.flightType),
      travelPurpose: value(row, col.travelPurpose),
      nps: parseNps(value(row, col.nps)),
      scores,
      comments: {
        best: value(row, col.best),
        improve: value(row, col.improve),
        suggestion: value(row, col.suggestion),
      },
    });
  });

  return {
    sheet: SEGMENT_META[segment].sheet,
    sections,
    responses,
    unmapped: other.map(({ text }) => text),
    headers,
    rows: body,
    statementCols,
  };
}
