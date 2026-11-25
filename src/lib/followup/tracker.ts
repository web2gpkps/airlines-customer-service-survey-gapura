/**
 * Akses ke sheet "Tracking Follow Up Index CSS Airline" (terpisah dari sheet survei, yang tetap hanya-baca).
 * Sheet ini satu-satunya penyimpanan data tindak lanjut, jadi tampilan web dan Google Sheet selalu sama.
 *
 * Aturan keamanan penulisan:
 * - Semua nilai ditulis dengan mode RAW (tidak ditafsirkan Sheets): teks responden yang diawali = + - @ tidak pernah menjadi
 *   rumus, dan teks seperti "1/2" atau "10 November" tidak berubah menjadi tanggal. Hanya rumus Target Selesai milik sistem
 *   yang ditulis sebagai rumus.
 * - Sebelum mengubah satu baris, ID di baris itu dibaca ulang dan dicocokkan, supaya baris yang bergeser tidak tertimpa.
 */
import { JWT } from "google-auth-library";
import { getServiceAccount, getTrackerSheetId } from "../credentials";
import {
  ALL_CLASSES,
  CATEGORIES,
  COL,
  COLS,
  EVIDENCE_SEP,
  FIRST_SYSTEM_COL,
  LAST_COL_LETTER,
  PRIORITIES,
  QUOTE_MARK,
  STATUSES,
  responseIdOf,
  type EvidenceEntry,
  type FollowupItem,
  type Priority,
  type Status,
} from "./types";

/** Nama tab di sheet tracker. Bisa diganti lewat env (dipakai untuk uji pada tab salinan). */
const SHEET_TAB = process.env.TRACKER_TAB?.trim() || "B2C";
const REKAP_TAB = process.env.TRACKER_TAB_REKAP?.trim() || "Rekap";

const API = "https://sheets.googleapis.com/v4/spreadsheets";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const MAX_ROWS = 5000;

/* ---------- jaringan ---------- */

let jwt: JWT | null = null;

async function call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const account = getServiceAccount();
  jwt ??= new JWT({ email: account.client_email, key: account.private_key, scopes: [SCOPE] });
  const { token } = await jwt.getAccessToken();
  let lastStatus = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${API}/${getTrackerSheetId()}${path}`, {
      method: init?.method ?? "GET",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (res.ok) return (await res.json()) as T;
    lastStatus = res.status;
    // 429 dan 5xx dicoba ulang dengan jeda bertambah; selain itu langsung gagal.
    if (res.status !== 429 && res.status < 500) break;
    await new Promise((r) => setTimeout(r, 800 * 2 ** attempt));
  }
  if (lastStatus === 403) throw new Error("Service account belum berstatus Editor di sheet tracker.");
  if (lastStatus === 404) throw new Error("Sheet tracker tidak ditemukan. Periksa TRACKER_SHEET_ID.");
  throw new Error(`Google Sheets API ${lastStatus}`);
}

/* ---------- konversi nilai ---------- */

const SERIAL_EPOCH = 25569; // 1970-01-01 dalam serial Google Sheets
export const isoToSerial = (iso: string): number => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86_400_000) + SERIAL_EPOCH;
export const serialToIso = (n: number): string => new Date((Math.round(n) - SERIAL_EPOCH) * 86_400_000).toISOString().slice(0, 10);

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7, agu: 8, aug: 8, ags: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12 };

/** Sel tanggal bisa berupa serial (angka), teks "10 Nov 2026", atau "2026-11-10". */
export function toIsoDate(v: unknown): string {
  if (typeof v === "number" && v > 30_000 && v < 80_000) return serialToIso(v);
  const t = String(v ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const m = t.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{4})/);
  if (m && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${String(MONTHS[m[2].toLowerCase()]).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return "";
}

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const bool = (v: unknown) => v === true || /^true$/i.test(str(v));
const numOrNull = (v: unknown): number | null => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const todayWib = (): string => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
const stampWib = (d = new Date()) =>
  new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })
    .format(d)
    .replace(",", "")
    .replace(/\./g, ":");

/* ---------- baca ---------- */

export function parseRow(rowNumber: number, c: unknown[]): FollowupItem {
  const g = (name: (typeof COLS)[number]) => c[COL[name]];
  const raw = str(g("Ringkasan Feedback"));
  const cut = raw.indexOf(QUOTE_MARK);
  const status = str(g("Status")) as Status;
  const id = str(g("ID / Submission ID")).trim();
  return {
    id,
    row: rowNumber,
    responseId: responseIdOf(id),
    date: toIsoDate(g("Tanggal Survei")),
    station: str(g("Bandara")).trim().toUpperCase(),
    klass: str(g("Klasifikasi")),
    priority: str(g("Prioritas")),
    category: str(g("Kategori Isu")),
    summary: (cut >= 0 ? raw.slice(0, cut) : raw).trim(),
    quote: cut >= 0 ? raw.slice(cut + QUOTE_MARK.length).trim() : "",
    status: (STATUSES as readonly string[]).includes(status) ? status : "Dalam pemantauan",
    pic: str(g("PIC")),
    action: str(g("Tindakan Follow Up")),
    target: toIsoDate(g("Target Selesai")),
    done: toIsoDate(g("Tanggal Selesai")),
    contacted: bool(g("Pelanggan Dihubungi")),
    nps: numOrNull(g("Skor Rekomendasi (0–10)")),
    lowItems: str(g("Butir Skor ≤ 3")),
    airline: str(g("Maskapai")),
    route: str(g("Rute / Jenis Penerbangan / Tujuan")),
    flight: str(g("Nomor Penerbangan & Tanggal")),
    systemClass: str(g("Klasifikasi Sistem")),
    updatedBy: str(g("Diubah Oleh")),
    updatedAt: str(g("Terakhir Diubah")),
    history: str(g("Riwayat Perubahan")),
    note: str(g("Catatan Sinkron")),
    evidence: str(g("Link Evidence")),
  };
}

export interface TrackerSnapshot {
  items: FollowupItem[];
  schemaReady: boolean;
  nextRow: number;
  fetchedAt: number;
}

let snapshot: TrackerSnapshot | null = null;
const SNAPSHOT_TTL_MS = 10_000;
export const clearTrackerCache = () => {
  snapshot = null;
};

export async function readTracker(opts: { fresh?: boolean } = {}): Promise<TrackerSnapshot> {
  if (!opts.fresh && snapshot && Date.now() - snapshot.fetchedAt < SNAPSHOT_TTL_MS) return snapshot;
  const url = new URLSearchParams();
  url.append("ranges", `'${SHEET_TAB}'!A2:${LAST_COL_LETTER}`);
  url.set("valueRenderOption", "UNFORMATTED_VALUE");
  url.set("dateTimeRenderOption", "SERIAL_NUMBER");
  const json = await call<{ valueRanges: { values?: unknown[][] }[] }>(`/values:batchGet?${url}`);

  const items: FollowupItem[] = [];
  let nextRow = 3;
  const [header = [], ...body] = json.valueRanges[0]?.values ?? [];
  const schemaReady = str(header[FIRST_SYSTEM_COL]) === COLS[FIRST_SYSTEM_COL] && str(header[COL["Link Evidence"]]) === "Link Evidence";
  body.forEach((cells, i) => {
    const rowNumber = i + 3;
    if (!str(cells[COL["ID / Submission ID"]]).trim()) return;
    items.push(parseRow(rowNumber, cells));
    nextRow = rowNumber + 1;
  });
  return (snapshot = { items, schemaReady, nextRow, fetchedAt: Date.now() });
}

/* ---------- tulis ---------- */

export interface NewRow {
  id: string;
  date: string;
  station: string;
  klass: string;
  priority: Priority;
  category: string;
  summary: string;
  quote: string;
  pic: string;
  nps: number | null;
  lowItems: string;
  airline: string;
  route: string;
  flight: string;
  systemClass: string;
  note?: string;
}

function rowValues(r: NewRow): (string | number | boolean)[] {
  const v: (string | number | boolean)[] = new Array(COLS.length).fill("");
  v[COL["ID / Submission ID"]] = r.id;
  v[COL["Tanggal Survei"]] = isoToSerial(r.date);
  v[COL.Bandara] = r.station;
  v[COL.Klasifikasi] = r.klass;
  v[COL.Prioritas] = r.priority;
  v[COL["Kategori Isu"]] = r.category;
  v[COL["Ringkasan Feedback"]] = r.quote ? `${r.summary}${QUOTE_MARK} ${r.quote}` : r.summary;
  v[COL.Status] = "Dalam pemantauan";
  v[COL.PIC] = r.pic;
  v[COL["Pelanggan Dihubungi"]] = false;
  v[COL["Skor Rekomendasi (0–10)"]] = r.nps ?? "";
  v[COL["Butir Skor ≤ 3"]] = r.lowItems;
  v[COL.Maskapai] = r.airline;
  v[COL["Rute / Jenis Penerbangan / Tujuan"]] = r.route;
  v[COL["Nomor Penerbangan & Tanggal"]] = r.flight;
  v[COL["Klasifikasi Sistem"]] = r.systemClass;
  v[COL["Diubah Oleh"]] = "Sistem";
  v[COL["Terakhir Diubah"]] = new Date().toISOString();
  v[COL["Catatan Sinkron"]] = r.note ?? "";
  return v;
}

async function sheetInfo(): Promise<{ id: number; rows: number }> {
  const j = await call<{ sheets: { properties: { sheetId: number; title: string; gridProperties: { rowCount: number } } }[] }>(
    "?fields=sheets.properties(sheetId,title,gridProperties.rowCount)",
  );
  const s = j.sheets.find((x) => x.properties.title === SHEET_TAB);
  if (!s) throw new Error(`Tab "${SHEET_TAB}" tidak ada di sheet tracker.`);
  return { id: s.properties.sheetId, rows: s.properties.gridProperties.rowCount };
}

/** Tambah baris baru di akhir tabel. Mengembalikan baris pertama yang terisi. */
export async function appendRows(rows: NewRow[]): Promise<number> {
  if (!rows.length) return 0;
  const snap = await readTracker({ fresh: true });
  const start = snap.nextRow;
  const end = start + rows.length - 1;
  if (end > MAX_ROWS) throw new Error(`Tab ${SHEET_TAB} penuh (batas ${MAX_ROWS} baris).`);

  const info = await sheetInfo();
  const sheetId = info.id;
  const requests: unknown[] = [];
  if (end > info.rows) {
    const newRows = end + 50;
    requests.push({ appendDimension: { sheetId, dimension: "ROWS", length: newRows - info.rows } });
    // Filter dan warna selang-seling berhenti di baris terakhir lama; perluas ke baris yang baru ditambahkan.
    const grid = await call<{ sheets: { properties: { sheetId: number }; basicFilter?: { range: GridRange; [k: string]: unknown }; bandedRanges?: { bandedRangeId: number; range: GridRange }[] }[] }>(
      "?fields=sheets(properties(sheetId),basicFilter,bandedRanges(bandedRangeId,range))",
    );
    const mine = grid.sheets.find((x) => x.properties.sheetId === sheetId);
    if (mine?.basicFilter) requests.push({ setBasicFilter: { filter: { ...mine.basicFilter, range: { ...mine.basicFilter.range, endRowIndex: newRows } } } });
    for (const band of mine?.bandedRanges ?? []) {
      requests.push({ updateBanding: { bandedRange: { bandedRangeId: band.bandedRangeId, range: { ...band.range, endRowIndex: newRows } }, fields: "range" } });
    }
  }
  // Salin format dan dropdown dari baris contoh (baris 3) ke baris baru.
  const dest = { sheetId, startRowIndex: start - 1, endRowIndex: end, startColumnIndex: 0, endColumnIndex: COLS.length };
  const src = { sheetId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: COLS.length };
  requests.push({ copyPaste: { source: src, destination: dest, pasteType: "PASTE_FORMAT" } });
  requests.push({ copyPaste: { source: src, destination: dest, pasteType: "PASTE_DATA_VALIDATION" } });
  await call(":batchUpdate", { method: "POST", body: { requests } });

  const values = rows.map((r) => rowValues(r));
  const range = `'${SHEET_TAB}'!A${start}:${LAST_COL_LETTER}${end}`;
  await call(`/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
    method: "PUT",
    body: { range, majorDimension: "ROWS", values },
  });
  // Rumus Target Selesai milik sistem, sama dengan baris lama: tanggal survei + 3 hari (Tinggi) atau 14 hari.
  const kRange = `'${SHEET_TAB}'!K${start}:K${end}`;
  await call(`/values/${encodeURIComponent(kRange)}?valueInputOption=USER_ENTERED`, {
    method: "PUT",
    body: { range: kRange, majorDimension: "ROWS", values: rows.map((_, i) => [`=B${start + i}+IF(E${start + i}="Tinggi",3,14)`]) },
  });
  clearTrackerCache();
  return start;
}

export interface CellWrite {
  row: number;
  col: (typeof COLS)[number];
  value: string | number | boolean;
  /** true = nilai adalah rumus milik sistem (USER_ENTERED); selain itu selalu RAW. */
  formula?: boolean;
}

/** Tulis banyak sel sekaligus. Nilai biasa memakai RAW; rumus sistem dikirim terpisah. */
export async function writeCells(writes: CellWrite[]): Promise<void> {
  if (!writes.length) return;
  const colLetter = (i: number) => String.fromCharCode(65 + i);
  const toData = (list: CellWrite[]) => list.map((w) => ({ range: `'${SHEET_TAB}'!${colLetter(COL[w.col])}${w.row}`, values: [[w.value]] }));
  const plain = writes.filter((w) => !w.formula);
  const formulas = writes.filter((w) => w.formula);
  if (plain.length) await call("/values:batchUpdate", { method: "POST", body: { valueInputOption: "RAW", data: toData(plain) } });
  if (formulas.length) await call("/values:batchUpdate", { method: "POST", body: { valueInputOption: "USER_ENTERED", data: toData(formulas) } });
  clearTrackerCache();
}

/* ---------- ubah satu item (dipakai UI) ---------- */

export interface ItemPatch {
  status?: string;
  pic?: string;
  action?: string;
  target?: string;
  done?: string;
  contacted?: boolean;
  klass?: string;
  priority?: string;
  category?: string;
}

export class ConflictError extends Error {}
export class ValidationError extends Error {}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (s: string) => ISO.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && s >= "2020-01-01" && s <= "2100-12-31";
/** Buang karakter kontrol (selain baris baru dan tab), rapikan baris baru, dan batasi panjang. */
const clean = (s: unknown, max: number) =>
  [...String(s ?? "").replace(/\r\n?/g, "\n")]
    .filter((ch) => {
      const c = ch.charCodeAt(0);
      return c >= 32 || c === 10 || c === 9;
    })
    .join("")
    .trim()
    .slice(0, max);

/** Validasi input dari klien; hanya nilai yang dikenal yang lolos. */
export function validatePatch(input: unknown): ItemPatch {
  if (typeof input !== "object" || input === null) throw new ValidationError("Data tidak valid.");
  const p = input as Record<string, unknown>;
  const out: ItemPatch = {};
  const pick = (key: keyof ItemPatch, list: readonly string[], label: string) => {
    if (p[key] === undefined) return;
    if (typeof p[key] !== "string" || !list.includes(p[key] as string)) throw new ValidationError(`${label} tidak dikenal.`);
    (out as Record<string, unknown>)[key] = p[key];
  };
  pick("status", STATUSES, "Status");
  pick("priority", PRIORITIES, "Prioritas");
  pick("category", CATEGORIES, "Kategori");
  pick("klass", ALL_CLASSES, "Klasifikasi");
  if (p.pic !== undefined) out.pic = clean(p.pic, 80);
  if (p.action !== undefined) out.action = clean(p.action, 2000);
  for (const key of ["target", "done"] as const) {
    if (p[key] === undefined) continue;
    const v = String(p[key]);
    if (v !== "" && !validDate(v)) throw new ValidationError("Tanggal tidak valid.");
    out[key] = v;
  }
  if (p.contacted !== undefined) {
    if (typeof p.contacted !== "boolean") throw new ValidationError("Nilai dihubungi tidak valid.");
    out.contacted = p.contacted;
  }
  return out;
}

const FIELD_LABEL: Record<keyof ItemPatch, string> = {
  status: "Status",
  pic: "PIC",
  action: "Tindakan",
  target: "Target",
  done: "Selesai",
  contacted: "Dihubungi",
  klass: "Klasifikasi",
  priority: "Prioritas",
  category: "Kategori",
};

const shortVal = (v: unknown) => {
  const s = typeof v === "boolean" ? (v ? "ya" : "tidak") : String(v ?? "");
  return s ? (s.length > 60 ? `${s.slice(0, 59)}…` : s).replace(/\n/g, " ") : "(kosong)";
};

const rowRange = (row: number) => `'${SHEET_TAB}'!A${row}:${LAST_COL_LETTER}${row}`;
const readRow = (row: number) =>
  call<{ values?: unknown[][] }>(`/values/${encodeURIComponent(rowRange(row))}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`);

/** Riwayat dibatasi 30 baris dan 8000 karakter terakhir. */
function appendHistory(current: string, lines: string[]): string {
  let history = [current, ...lines].filter(Boolean).join("\n");
  const kept = history.split("\n");
  if (kept.length > 30) history = kept.slice(-30).join("\n");
  if (history.length > 8000) history = history.slice(-8000);
  return history;
}

/**
 * Ubah satu baris. `expectedVersion` = nilai "Terakhir Diubah" yang dilihat pengguna; bila sudah berubah di sheet
 * (orang lain mengubahnya lebih dulu) permintaan ditolak dengan ConflictError.
 * Baris lama yang belum pernah diubah sistem punya "Terakhir Diubah" kosong; itu dianggap versi yang sama.
 */
export async function updateItem(id: string, patch: ItemPatch, who: string, expectedVersion: string): Promise<FollowupItem> {
  const snap = await readTracker({ fresh: true });
  const known = snap.items.find((i) => i.id === id);
  if (!known) throw new ValidationError("Item tidak ditemukan.");

  // Baca ulang baris yang akan diubah dan pastikan masih item yang sama.
  const cells = (await readRow(known.row)).values?.[0] ?? [];
  const current = parseRow(known.row, cells);
  if (current.id !== id) throw new ConflictError("Baris di sheet sudah bergeser. Muat ulang halaman.");
  if (current.updatedAt !== expectedVersion) throw new ConflictError("Item ini baru saja diubah orang lain. Data terbaru sudah dimuat.");

  const next = { ...current } as unknown as Record<string, unknown>;
  const before = current as unknown as Record<string, unknown>;
  const changed: (keyof ItemPatch)[] = [];
  for (const key of Object.keys(patch) as (keyof ItemPatch)[]) {
    const value = patch[key];
    if (value === undefined) continue;
    if (before[key] !== value) {
      next[key] = value;
      changed.push(key);
    }
  }
  if (!changed.length) return current;
  if (changed.includes("category") && !CATEGORIES.includes(String(next.category))) {
    throw new ValidationError("Kategori tidak dikenal.");
  }

  // Aturan turunan: selesai otomatis memberi tanggal selesai; kembali ke status terbuka mengosongkannya.
  const closed = next.status === "Selesai" || next.status === "Tidak perlu tindak lanjut";
  if (changed.includes("status") && !changed.includes("done")) {
    if (closed && !next.done) {
      next.done = todayWib();
      changed.push("done");
    } else if (!closed && next.done) {
      next.done = "";
      changed.push("done");
    }
  }

  const stamp = stampWib();
  const lines = changed.map((k) => `${stamp} · ${who} · ${FIELD_LABEL[k]}: ${shortVal(before[k])} → ${shortVal(next[k])}`);
  const history = appendHistory(current.history, lines);

  const version = new Date().toISOString();
  const writes: CellWrite[] = [];
  const w = (col: (typeof COLS)[number], value: string | number | boolean, formula = false) => writes.push({ row: known.row, col, value, formula });
  for (const k of changed) {
    switch (k) {
      case "status": w("Status", String(next.status)); break;
      case "pic": w("PIC", String(next.pic)); break;
      case "action": w("Tindakan Follow Up", String(next.action)); break;
      // Target kosong = kembali ke rumus bawaan (tanggal survei + 3 atau 14 hari menurut prioritas).
      case "target":
        if (next.target) w("Target Selesai", isoToSerial(String(next.target)));
        else w("Target Selesai", `=B${known.row}+IF(E${known.row}="Tinggi",3,14)`, true);
        break;
      case "done": w("Tanggal Selesai", next.done ? isoToSerial(String(next.done)) : ""); break;
      case "contacted": w("Pelanggan Dihubungi", Boolean(next.contacted)); break;
      case "klass": w("Klasifikasi", String(next.klass)); break;
      case "priority": w("Prioritas", String(next.priority)); break;
      case "category": w("Kategori Isu", String(next.category)); break;
    }
  }
  w("Diubah Oleh", who);
  w("Terakhir Diubah", version);
  w("Riwayat Perubahan", history);
  await writeCells(writes);

  // Baca ulang baris agar tampilan memakai nilai akhir sheet (termasuk hasil rumus Target Selesai).
  return parseRow(known.row, (await readRow(known.row)).values?.[0] ?? []);
}

/* ---------- penataan sheet (sekali jalan, idempotent) ---------- */

export interface MigrateReport {
  headers: boolean;
  rekapFormulas: number;
  conditionalRules: number;
  filters: number;
  rekapCategories: boolean;
}

type GridRange = { sheetId: number; startRowIndex?: number; endRowIndex?: number; startColumnIndex?: number; endColumnIndex?: number };

export async function ensureSchema(): Promise<MigrateReport> {
  const report: MigrateReport = { headers: false, rekapFormulas: 0, conditionalRules: 0, filters: 0, rekapCategories: false };
  const meta = await call<{
    sheets: {
      properties: { sheetId: number; title: string };
      conditionalFormats?: { ranges: GridRange[]; [k: string]: unknown }[];
      basicFilter?: { range: GridRange; [k: string]: unknown };
      bandedRanges?: { bandedRangeId: number; range: GridRange }[];
    }[];
  }>("?fields=sheets(properties(sheetId,title),conditionalFormats,basicFilter,bandedRanges(bandedRangeId,range))");

  const sheet = meta.sheets.find((s) => s.properties.title === SHEET_TAB);
  if (!sheet) throw new Error(`Tab "${SHEET_TAB}" tidak ada di sheet tracker.`);
  const sheetId = sheet.properties.sheetId;

  const requests: unknown[] = [];
  const headerWrites: { range: string; values: string[][] }[] = [];

  const first = String.fromCharCode(65 + FIRST_SYSTEM_COL);
  const head = await call<{ values?: string[][] }>(`/values/${encodeURIComponent(`'${SHEET_TAB}'!${first}2:${LAST_COL_LETTER}2`)}`);
  const row = head.values?.[0] ?? [];
  if ((row[0] ?? "") !== COLS[FIRST_SYSTEM_COL] || (row[COL["Link Evidence"] - FIRST_SYSTEM_COL] ?? "") !== "Link Evidence") {
    report.headers = true;
    headerWrites.push({ range: `'${SHEET_TAB}'!${first}2:${LAST_COL_LETTER}2`, values: [COLS.slice(FIRST_SYSTEM_COL) as unknown as string[]] });
    const last = FIRST_SYSTEM_COL - 1; // kolom terakhir yang sudah ada sebagai sumber format
    requests.push({
      copyPaste: {
        source: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: last, endColumnIndex: last + 1 },
        destination: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: FIRST_SYSTEM_COL, endColumnIndex: COLS.length },
        pasteType: "PASTE_FORMAT",
      },
    });
    // Sel isi di kolom baru memakai format baris contoh (teks, rata atas) untuk seluruh area tabel.
    requests.push({
      copyPaste: {
        source: { sheetId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: last, endColumnIndex: last + 1 },
        destination: { sheetId, startRowIndex: 2, endRowIndex: MAX_ROWS, startColumnIndex: FIRST_SYSTEM_COL, endColumnIndex: COLS.length },
        pasteType: "PASTE_FORMAT",
      },
    });
    const widths = [150, 110, 170, 320, 220, 340];
    widths.forEach((px, k) => {
      const i = FIRST_SYSTEM_COL + k;
      requests.push({ updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: i, endIndex: i + 1 }, properties: { pixelSize: px }, fields: "pixelSize" } });
    });
  }

  // Aturan format bersyarat yang berhenti sebelum batas diperpanjang agar baris baru ikut diwarnai.
  (sheet.conditionalFormats ?? []).forEach((rule, index) => {
    if (!rule.ranges.some((r) => r.endRowIndex !== undefined && r.endRowIndex < MAX_ROWS)) return;
    report.conditionalRules++;
    requests.push({
      updateConditionalFormatRule: {
        sheetId,
        index,
        rule: { ...rule, ranges: rule.ranges.map((r) => (r.endRowIndex !== undefined && r.endRowIndex < MAX_ROWS ? { ...r, endRowIndex: MAX_ROWS } : r)) },
      },
    });
  });

  // Filter otomatis dan warna selang-seling diperluas ke seluruh tabel dan kolom baru.
  if (sheet.basicFilter) {
    const r = sheet.basicFilter.range;
    if (r.endRowIndex !== undefined || (r.endColumnIndex ?? 0) < COLS.length) {
      report.filters++;
      const { endRowIndex: _drop, ...rest } = r;
      void _drop;
      requests.push({ setBasicFilter: { filter: { ...sheet.basicFilter, range: { ...rest, endColumnIndex: COLS.length } } } });
    }
  }
  for (const band of sheet.bandedRanges ?? []) {
    if ((band.range.endRowIndex ?? 0) >= MAX_ROWS && (band.range.endColumnIndex ?? 0) >= COLS.length) continue;
    requests.push({
      updateBanding: {
        bandedRange: { bandedRangeId: band.bandedRangeId, range: { ...band.range, endRowIndex: MAX_ROWS, endColumnIndex: COLS.length } },
        fields: "range",
      },
    });
  }

  // Rumus tab Rekap menghitung sampai baris terakhir tabel saat sheet dibuat; perpanjang agar semua item terhitung.
  const rekap = await call<{ values?: string[][] }>(`/values/${encodeURIComponent(`'${REKAP_TAB}'!A1:H80`)}?valueRenderOption=FORMULA`);
  const rekapWrites: { range: string; values: string[][] }[] = [];
  const RANGE_END = /(\$?[A-Z]+\$?3:\$?[A-Z]+\$?)(\d{3,4})\b/g;
  (rekap.values ?? []).forEach((r, ri) => {
    r.forEach((cell, ci) => {
      if (typeof cell !== "string" || !cell.startsWith("=")) return;
      const next = cell.replace(RANGE_END, (m, head: string, end: string) => (Number(end) < MAX_ROWS ? `${head}${MAX_ROWS}` : m));
      if (next === cell) return;
      report.rekapFormulas++;
      rekapWrites.push({ range: `'${REKAP_TAB}'!${String.fromCharCode(65 + ci)}${ri + 1}`, values: [[next]] });
    });
  });

  // Blok "Kategori isu" di Rekap memakai nama kategori lama. Ganti dengan nama bagian kuesioner (jumlah baris sama;
  // rumus COUNTIF menunjuk ke sel nama, jadi hanya nama yang berubah).
  const rows = rekap.values ?? [];
  const labelRows = rows.map((r, i) => ({ i, label: String(r[0] ?? "") }));
  const start = labelRows.findIndex((x) => x.label === "Kategori isu");
  if (start >= 0) {
    const block = rows.slice(start + 2, start + 2 + CATEGORIES.length).map((r) => String(r[0] ?? ""));
    const outdated = block.length === CATEGORIES.length && block.some((l, k) => l !== CATEGORIES[k]) && block.every((l) => /\S/.test(l));
    if (outdated) {
      report.rekapCategories = true;
      const from = start + 3; // baris 1-based pertama setelah judul "Kategori isu" dan baris kepala tabel
      rekapWrites.push({ range: `'${REKAP_TAB}'!A${from}:A${from + CATEGORIES.length - 1}`, values: CATEGORIES.map((c) => [c]) });
    }
  }

  if (requests.length) await call(":batchUpdate", { method: "POST", body: { requests } });
  const data = [...headerWrites, ...rekapWrites];
  if (data.length) await call("/values:batchUpdate", { method: "POST", body: { valueInputOption: "USER_ENTERED", data } });
  clearTrackerCache();
  return report;
}

/** Tambahkan tautan evidence ke baris item (menambah, tidak pernah menimpa evidence yang sudah ada). */
export async function addEvidence(id: string, entries: EvidenceEntry[], who: string): Promise<FollowupItem> {
  if (!entries.length) throw new ValidationError("Tidak ada evidence untuk disimpan.");
  const snap = await readTracker({ fresh: true });
  const known = snap.items.find((i) => i.id === id);
  if (!known) throw new ValidationError("Item tidak ditemukan.");
  const current = parseRow(known.row, (await readRow(known.row)).values?.[0] ?? []);
  if (current.id !== id) throw new ConflictError("Baris di sheet sudah bergeser. Muat ulang halaman.");

  const oneLine = (s: string) => s.replace(/[\r\n|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 150);
  const lines = entries.map((e) => `${oneLine(e.title)}${EVIDENCE_SEP}${e.url}`);
  const stamp = stampWib();
  const history = appendHistory(current.history, entries.map((e) => `${stamp} · ${who} · Evidence ditambahkan: ${oneLine(e.title)}`));

  await writeCells([
    { row: known.row, col: "Link Evidence", value: [current.evidence, ...lines].filter(Boolean).join("\n") },
    { row: known.row, col: "Riwayat Perubahan", value: history },
    { row: known.row, col: "Diubah Oleh", value: who },
    { row: known.row, col: "Terakhir Diubah", value: new Date().toISOString() },
  ]);
  return parseRow(known.row, (await readRow(known.row)).values?.[0] ?? []);
}
