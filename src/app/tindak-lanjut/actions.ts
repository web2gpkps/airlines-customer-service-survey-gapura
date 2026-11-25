"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { buildCandidates, responseDetail, type ResponseDetail } from "@/lib/followup/candidates";
import { FOLLOWUP_COOKIE, FOLLOWUP_SESSION_MS, followupSecret, menuPasswords, requireEditor, requireRole } from "@/lib/followup/auth";
import { buildSummary } from "@/lib/followup/classify";
import { syncTracker, toNewRow, type SyncStatus } from "@/lib/followup/sync";
import { ConflictError, ValidationError, appendRows, readTracker, updateItem, validatePatch } from "@/lib/followup/tracker";
import { CLASSES, ID_PATTERN, ROLE_LABEL, type FollowupItem } from "@/lib/followup/types";
import { clientIp } from "@/lib/guess-limit";
import { getDashboardData } from "@/lib/sheets";
import { safeEqual, signSession } from "@/lib/session";

/* ── Masuk / keluar ── */

export interface LoginState {
  error?: string;
}

// 8 kali gagal per 10 menit per IP (per instance). Sama dengan login admin.
const WINDOW_MS = 10 * 60_000;
const MAX_FAILS = 8;
const store = globalThis as unknown as { __followupFails?: Map<string, number[]> };
const fails = (store.__followupFails ??= new Map<string, number[]>());
const recentFails = (ip: string) => {
  const now = Date.now();
  const list = (fails.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  fails.set(ip, list);
  return list;
};

const safeNext = (next: string) => (/^\/tindak-lanjut(?!\/\/)[\w\-./?=&%]*$/.test(next) ? next : "/tindak-lanjut");

export async function loginFollowup(_prev: LoginState, form: FormData): Promise<LoginState> {
  const fSecret = followupSecret();
  const { admin: adminPw, manager: managerPw, viewer: viewerPw } = menuPasswords();
  // DASHBOARD_PASSWORD hanya untuk masuk dashboard. Menu ini punya tiga password sendiri, dan password yang sama
  // dengan DASHBOARD_PASSWORD diabaikan (lihat menuPasswords).
  if (!fSecret || !(adminPw || managerPw || viewerPw)) {
    return {
      error:
        "Password menu belum diatur di environment server. FOLLOWUP_ADMIN_PASSWORD, FOLLOWUP_MANAGER_PASSWORD, dan FOLLOWUP_VIEWER_PASSWORD harus diisi dan berbeda dari DASHBOARD_PASSWORD (password dashboard).",
    };
  }

  const ip = clientIp(await headers());
  if (recentFails(ip).length >= MAX_FAILS) return { error: "Terlalu banyak percobaan. Coba lagi dalam beberapa menit." };

  const password = String(form.get("password") ?? "");
  // Semua password selalu dibandingkan (tanpa berhenti di yang cocok) supaya waktu respons tidak membocorkan jenisnya.
  const [isAdminPw, isManagerPw, isViewerPw] = await Promise.all([
    adminPw ? safeEqual(password, adminPw) : Promise.resolve(false),
    managerPw ? safeEqual(password, managerPw) : Promise.resolve(false),
    viewerPw ? safeEqual(password, viewerPw) : Promise.resolve(false),
  ]);
  if (!password || !(isAdminPw || isManagerPw || isViewerPw)) {
    recentFails(ip).push(Date.now());
    return { error: "Password salah." };
  }

  const role = isAdminPw ? "admin" : isManagerPw ? "manager" : "viewer";
  (await cookies()).set(FOLLOWUP_COOKIE, await signSession({ exp: Date.now() + FOLLOWUP_SESSION_MS, role }, fSecret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: FOLLOWUP_SESSION_MS / 1000,
  });
  redirect(safeNext(String(form.get("next") ?? "/tindak-lanjut")));
}

export async function logoutFollowup() {
  // Hanya mengakhiri sesi menu ini; sesi dashboard utama (bila ada) tidak disentuh.
  (await cookies()).delete(FOLLOWUP_COOKIE);
  redirect("/tindak-lanjut/masuk");
}

/* ── Data ── */

export type UpdateResult =
  | { ok: true; item: FollowupItem }
  | { ok: false; error: string; conflict?: boolean; item?: FollowupItem };

const asId = (s: unknown): string => {
  const id = String(s ?? "");
  if (!ID_PATTERN.test(id)) throw new ValidationError("ID tidak valid.");
  return id;
};

export async function updateFollowupItem(id: string, patch: unknown, version: string): Promise<UpdateResult> {
  try {
    const role = await requireEditor();
    const item = await updateItem(asId(id), validatePatch(patch), ROLE_LABEL[role], String(version ?? "").slice(0, 40));
    return { ok: true, item: { ...item, history: "" } };
  } catch (err) {
    if (err instanceof ConflictError) {
      const latest = (await readTracker({ fresh: true }).catch(() => null))?.items.find((i) => i.id === id);
      return { ok: false, error: err.message, conflict: true, item: latest ? { ...latest, history: "" } : undefined };
    }
    if (err instanceof ValidationError) return { ok: false, error: err.message };
    if (err instanceof Error && err.message === "Tidak berwenang mengubah data.") return { ok: false, error: err.message };
    console.error("Gagal mengubah item tindak lanjut:", err);
    return { ok: false, error: "Gagal menyimpan ke Google Sheet. Coba lagi." };
  }
}

export interface ItemDetail {
  history: string;
  /** Null bila jawaban survei tidak ditemukan lagi (mis. baris sumber dihapus). */
  response: ResponseDetail | null;
}

/** Versi panjang: jawaban asli penumpang beserta kontaknya. Boleh dibuka semua peran yang sudah masuk. */
export async function getItemDetail(responseId: string, id: string): Promise<ItemDetail | null> {
  await requireRole();
  try {
    const data = await getDashboardData();
    const snap = await readTracker();
    const item = snap.items.find((i) => i.id === String(id));
    return { history: item?.history ?? "", response: responseId ? responseDetail(data, String(responseId).slice(0, 40)) : null };
  } catch (err) {
    console.error("Gagal memuat detail:", err);
    return null;
  }
}

/** Jadikan jawaban yang dibaca apresiasi sebagai item tindak lanjut (sistem salah baca). */
export async function promoteResponse(responseId: string, klass: string): Promise<{ ok: boolean; error?: string; id?: string }> {
  try {
    const role = await requireEditor();
    if (!(CLASSES as readonly string[]).includes(klass)) return { ok: false, error: "Klasifikasi tidak dikenal." };
    const data = await getDashboardData();
    const snap = await readTracker({ fresh: true });
    if (snap.items.some((i) => i.responseId === responseId)) return { ok: false, error: "Item ini sudah ada di tracker." };
    const c = buildCandidates(data).find((x) => x.responseId === responseId);
    const detail = responseDetail(data, responseId);
    if (!c || !detail) return { ok: false, error: "Jawaban survei tidak ditemukan." };

    const input = {
      index: detail.index,
      nps: detail.nps,
      issueYes: false,
      improve: detail.improve,
      suggestion: detail.suggestion,
      lowItems: detail.lowItems,
    };
    const built = buildSummary({ ...input, klass: klass as (typeof CLASSES)[number] }, { force: true });
    const high = klass === "Indikasi Kendala";
    const row = toNewRow(c, { klass, priority: high ? "Tinggi" : "Sedang", summary: built.summary, quote: built.quote, category: c.category });
    await appendRows([{ ...row, note: `Ditandai manual oleh ${ROLE_LABEL[role]} (sistem membacanya sebagai apresiasi).` }]);
    return { ok: true, id: row.id };
  } catch (err) {
    if (err instanceof Error && err.message === "Tidak berwenang mengubah data.") return { ok: false, error: err.message };
    console.error("Gagal menambahkan item:", err);
    return { ok: false, error: "Gagal menyimpan ke Google Sheet." };
  }
}

/** Tombol "Sinkronkan": jeda minimum 5 detik antar-sinkronisasi untuk seluruh pengguna. */
export async function syncNow(): Promise<SyncStatus> {
  await requireEditor();
  return syncTracker({ minIntervalMs: 5_000, fresh: true });
}
