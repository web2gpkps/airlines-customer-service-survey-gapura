import { JWT } from "google-auth-library";
import { getServiceAccount, getSheetId } from "./credentials";
import type { Response, SectionDef } from "./scoring";
import { OTHER_SECTION, SECTION_CATALOG, SEGMENT_META, type SectionCatalogEntry, type Segment } from "./survey-config";

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

const MIN_REFRESH_INTERVAL_MS = 15_000;

/** Muat ulang dari Sheets, tetapi tidak lebih sering dari MIN_REFRESH_INTERVAL_MS agar kuota API tidak bisa dihabiskan. */
export function clearSheetCache() {
  if (cache && Date.now() - cache.at < MIN_REFRESH_INTERVAL_MS) return;
  cache = null;
}

export async function getDashboardData(): Promise<ServerDashboardData> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;
  const data = await fetchDashboardData();
  cache = { at: Date.now(), data };
  return data;
}

/** Akses baca-saja ke spreadsheet (dipakai juga oleh pembaca sheet Target Sampling). */
export async function getSheetsAccess(): Promise<{ base: string; headers: { Authorization: string } }> {
  const account = getServiceAccount();
  const client = new JWT({
    email: account.client_email,
    key: account.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const { token } = await client.getAccessToken();
  return { base: `https://sheets.googleapis.com/v4/spreadsheets/${getSheetId()}`, headers: { Authorization: `Bearer ${token}` } };
}

async function fetchDashboardData(): Promise<ServerDashboardData> {
  const { base, headers } = await getSheetsAccess();
  const sheet = SEGMENT_META.airline.sheet;

  const metaRes = await fetch(`${base}?fields=sheets.properties.title`, { headers, cache: "no-store" });
  if (!metaRes.ok) throw new Error(`Google Sheets API ${metaRes.status}`);
  const titles = new Set(
    ((await metaRes.json()) as { sheets: { properties: { title: string } }[] }).sheets.map((s) => s.properties.title),
  );
  if (!titles.has(sheet)) throw new Error(`Sheet "${sheet}" tidak ditemukan.`);

  const url = new URL(`${base}/values:batchGet`);
  url.searchParams.append("ranges", `'${sheet.replace(/'/g, "''")}'`);
  url.searchParams.set("valueRenderOption", "FORMATTED_VALUE");
  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) throw new Error(`Google Sheets API ${res.status}`);
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

function discoverStatements(headers: string[], rows: string[][], catalog: SectionCatalogEntry[]) {
  const known = new Map<string, string>(
    catalog.flatMap((section) => section.statements.map((text): [string, string] => [norm(text), text])),
  );
  const bracketed: { text: string; col: number }[] = [];
  const numbered: { text: string; col: number }[] = [];

  headers.forEach((header, col) => {
    const bracketedMatch = header.match(/^Pernyataan\s*\/\s*Aspek yang Dinilai\s*\[([\s\S]+)\]\s*$/i);
    if (bracketedMatch) {
      bracketed.push({ text: displayText(bracketedMatch[1]), col });
      return;
    }

    const numberedMatch = header.match(/^\d+\.\s*([\s\S]+?)\s*$/);
    const catalogText = numberedMatch ? known.get(norm(numberedMatch[1])) : undefined;
    if (catalogText) numbered.push({ text: catalogText, col });
  });

  const populated = (items: { col: number }[]) =>
    items.reduce((total, item) => total + rows.filter((row) => parseLikert(value(row, item.col)) !== null).length, 0);

  return populated(numbered) > populated(bracketed) ? numbered : bracketed;
}

export function parseSegment(segment: Segment, rows: string[][]): ServerSegmentData {
  const [headers = [], ...body] = rows;
  if (!headers.length) throw new Error(`Sheet "${SEGMENT_META[segment].sheet}" tidak memiliki header.`);
  const catalog = SECTION_CATALOG[segment];
  const discovered = discoverStatements(headers, body, catalog);
  if (!discovered.length) throw new Error("Tidak ada kolom pernyataan Likert pada sheet Airline.");

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
    airline: requiredColumn(
      headers,
      "Nama maskapai",
      /^(?:\d+\.\s*)?Nama maskapai\s*\(airline\)\s*yang Anda gunakan:\s*$/i,
    ),
    flight: requiredColumn(
      headers,
      "Nomor penerbangan & Tanggal",
      /^(?:\d+\.\s*)?(?:Tanggal\s*&\s*nomor penerbangan|Nomor penerbangan\s*&\s*Tanggal):\s*$/i,
    ),
    airport: findColumn(headers, /^Bandara keberangkatan\s*\/\s*kedatangan\s*\/\s*transit:?\s*$/i),
    route: requiredColumn(
      headers,
      "Rute",
      /^(?:\d+\.\s*)?Rute\s*\/\s*bandara keberangkatan\s*[–-]\s*tujuan:\s*$/i,
    ),
    flightType: requiredColumn(
      headers,
      "Jenis penerbangan",
      /^(?:\d+\.\s*)?Jenis penerbangan Anda:\s*$/i,
    ),
    travelPurpose: requiredColumn(
      headers,
      "Tujuan perjalanan",
      /^(?:\d+\.\s*)?Tujuan perjalanan Anda:\s*$/i,
    ),
    nps: requiredColumn(headers, "Rekomendasi maskapai", /^\d+\.\s*Seberapa besar kemungkinan/i),
    best: findColumn(headers, /^\d+\.\s*Apa bagian dari layanan/i),
    improve: findColumn(headers, /^\d+\.\s*Apa yang menurut Anda perlu diperbaiki/i),
    suggestion: findColumn(headers, /^\d+\.\s*Saran atau masukan/i),
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
      airport: value(row, col.airport),
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
