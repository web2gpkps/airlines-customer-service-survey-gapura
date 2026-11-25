/**
 * Sinkronisasi survei → sheet tracker, dirancang hemat dan aman terhadap batas Vercel dan Google:
 *
 * - Tidak ada cron dan tidak ada polling berat. Sinkronisasi dipicu (1) saat halaman dibuka dan lewat polling browser,
 *   dibatasi gerbang waktu (default satu kali per 60 detik untuk seluruh pengguna), dan (2) oleh webhook Apps Script
 *   begitu ada respons baru masuk (gerbang 5 detik), sehingga Google Sheet terbarui hampir seketika.
 * - Satu kunci terdistribusi (Upstash) memastikan hanya satu sinkronisasi berjalan pada satu waktu.
 * - Satu putaran = 2 pembacaan (survei, tracker) dan, bila ada item baru, 3 sampai 4 penulisan berkelompok. Jauh di bawah
 *   kuota Google (300 baca per menit per proyek).
 * - Sinkronisasi hanya MENAMBAH baris baru dan melengkapi kolom milik sistem (kategori bagian kuesioner, klasifikasi sistem)
 *   pada baris lama. Isian manajemen (status, PIC, tindakan) tidak pernah ditimpa dan baris tidak pernah dihapus.
 * - TRACKER_SYNC_DISABLED=1 mematikan sinkronisasi sepenuhnya (dipakai saat uji baca-saja pada sheet asli).
 */
import { randomBytes } from "node:crypto";
import { clearSheetCache, getDashboardData } from "../sheets";
import { buildCandidates, type Candidate } from "./candidates";
import { release, setIfAbsent } from "./kv";
import { appendRows, ensureSchema, readTracker, writeCells, type CellWrite, type NewRow } from "./tracker";
import { APPRECIATION, CATEGORIES, ID_PREFIX } from "./types";

export interface SyncStatus {
  at: number;
  ran: boolean;
  added: number;
  updated: number;
  skipped?: string;
  error?: string;
}

const g = globalThis as unknown as { __followupSync?: SyncStatus };
export const lastSync = (): SyncStatus | null => g.__followupSync ?? null;

export const syncDisabled = (): boolean => process.env.TRACKER_SYNC_DISABLED === "1";

const CHUNK = 150;

const picFor = (station: string) => `Cabang ${station}`;

export function toNewRow(c: Candidate, override?: { klass: string; priority: "Tinggi" | "Sedang" | "Rendah"; summary: string; quote: string; category: string }): NewRow {
  const cls = c.classification;
  return {
    id: `${ID_PREFIX}${c.responseId}`,
    date: c.date,
    station: c.station,
    klass: override?.klass ?? cls.klass ?? "Saran Perbaikan",
    priority: override?.priority ?? cls.priority ?? "Sedang",
    category: override?.category ?? c.category,
    summary: override?.summary ?? c.summary,
    quote: override?.quote ?? c.quote,
    pic: picFor(c.station),
    nps: c.nps,
    lowItems: c.lowItemsText,
    airline: c.airline,
    route: c.route,
    flight: c.flight,
    systemClass: cls.klass ?? APPRECIATION,
  };
}

/**
 * Jalankan satu putaran sinkronisasi bila gerbang waktu terbuka.
 * `minIntervalMs`: jarak minimum antar putaran untuk seluruh pengguna.
 */
export async function syncTracker(opts: { minIntervalMs: number; fresh?: boolean }): Promise<SyncStatus> {
  const skip = (reason: string): SyncStatus => ({ at: Date.now(), ran: false, added: 0, updated: 0, skipped: reason });

  if (syncDisabled()) return skip("sinkronisasi dimatikan (TRACKER_SYNC_DISABLED)");
  if (!(await setIfAbsent("gate", "1", opts.minIntervalMs))) return skip("baru saja disinkronkan");
  const token = randomBytes(8).toString("hex");
  if (!(await setIfAbsent("lock", token, 90_000))) return skip("sinkronisasi lain sedang berjalan");

  const status: SyncStatus = { at: Date.now(), ran: true, added: 0, updated: 0 };
  try {
    if (opts.fresh) clearSheetCache();
    const data = await getDashboardData();
    let snap = await readTracker({ fresh: true });
    if (!snap.schemaReady) {
      await ensureSchema();
      snap = await readTracker({ fresh: true });
    }

    const candidates = buildCandidates(data);
    const byId = new Map(candidates.map((c) => [c.responseId, c]));
    const known = new Set(snap.items.map((i) => i.responseId));
    const writes: CellWrite[] = [];

    // 1. Baris lama: kategori yang bukan bagian kuesioner (nama lama sheet) diganti bagian kuesioner, dan kolom
    // "Klasifikasi Sistem" yang kosong dilengkapi. Kategori yang sudah berupa bagian, termasuk pilihan manual, tidak ditimpa.
    const validCategories = new Set(CATEGORIES);
    for (const it of snap.items) {
      const c = byId.get(it.responseId);
      if (!c) continue;
      let touched = false;
      if (!validCategories.has(it.category)) {
        writes.push({ row: it.row, col: "Kategori Isu", value: c.category });
        touched = true;
      }
      if (!it.systemClass.trim()) {
        writes.push({ row: it.row, col: "Klasifikasi Sistem", value: c.classification.klass ?? APPRECIATION });
        touched = true;
      }
      if (touched) status.updated++;
    }

    // 2. Jawaban baru yang perlu ditindaklanjuti dan belum ada di tracker.
    const fresh = candidates
      .filter((c) => c.classification.needsFollowup && c.date && !known.has(c.responseId))
      .sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);
    const toAppend = fresh.map((c) => toNewRow(c));

    for (let i = 0; i < writes.length; i += 400) await writeCells(writes.slice(i, i + 400));
    for (let i = 0; i < toAppend.length; i += CHUNK) {
      await appendRows(toAppend.slice(i, i + CHUNK));
      status.added += Math.min(CHUNK, toAppend.length - i);
    }
  } catch (err) {
    status.error = err instanceof Error ? err.message : String(err);
    console.error("Sinkronisasi tracker gagal:", err);
  } finally {
    await release("lock", token);
  }
  g.__followupSync = status;
  return status;
}
