import { getDashboardData } from "../sheets";
import { appreciationSummary, buildCandidates } from "./candidates";
import { lastSync, syncDisabled } from "./sync";
import { readTracker } from "./tracker";
import type { AppreciationItem, FollowupItem } from "./types";

export interface FollowupView {
  items: FollowupItem[];
  appreciation: AppreciationItem[];
  /** Jawaban yang perlu ditindaklanjuti tetapi belum masuk sheet (menunggu sinkronisasi berikutnya). */
  pending: number;
  syncedAt: number | null;
  syncError: string | null;
  syncDisabled: boolean;
  version: string;
  generatedAt: number;
}

/** Hash FNV-1a sederhana untuk ETag. */
function fnv(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

export async function loadView(): Promise<FollowupView> {
  const [data, snap] = await Promise.all([getDashboardData(), readTracker()]);
  const tracked = new Set(snap.items.filter((i) => i.responseId).map((i) => i.responseId));

  const appreciation: AppreciationItem[] = [];
  let pending = 0;
  for (const c of buildCandidates(data)) {
    if (tracked.has(c.responseId)) continue;
    if (c.classification.needsFollowup) {
      pending++;
      continue;
    }
    appreciation.push({
      responseId: c.responseId,
      date: c.date,
      station: c.station,
      summary: appreciationSummary(data, c.responseId),
      nps: c.nps,
      index: c.index,
    });
  }
  appreciation.sort((a, b) => b.date.localeCompare(a.date));

  // Riwayat perubahan hanya dimuat saat satu item dibuka, bukan di daftar.
  const items = snap.items.map((i) => ({ ...i, history: "" }));
  const sync = lastSync();
  return {
    items,
    appreciation,
    pending,
    syncedAt: sync?.ran ? sync.at : null,
    syncError: sync?.error ?? null,
    syncDisabled: syncDisabled(),
    version: fnv(items.map((i) => `${i.id}${i.updatedAt}${i.status}${i.pic}${i.action}${i.target}${i.done}${i.klass}${i.priority}${i.category}${i.evidence.length}`).join("|") + `|${appreciation.length}|${pending}`),
    generatedAt: Date.now(),
  };
}
