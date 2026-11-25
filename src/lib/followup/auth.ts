/**
 * Akses menu Tindak Lanjut: tiga tingkat.
 * - admin   : FOLLOWUP_ADMIN_PASSWORD (akses penuh)
 * - manager : FOLLOWUP_MANAGER_PASSWORD, boleh mengisi dan mengubah
 * - viewer  : FOLLOWUP_VIEWER_PASSWORD, hanya melihat
 *
 * Sesi menu memakai cookie sendiri yang ditandatangani dengan kunci turunan, sehingga cookie ini tidak pernah sah
 * sebagai sesi admin dashboard (dan sebaliknya). Kunci turunan memuat ketiga password: mengganti salah satunya
 * membatalkan semua sesi menu yang aktif.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authSecret, readSession } from "../session";
import { canEdit, type Role } from "./types";

export const FOLLOWUP_COOKIE = "airline_tindak_lanjut";
export const FOLLOWUP_SESSION_MS = 12 * 60 * 60 * 1000;

/** Password menu. Yang sama dengan DASHBOARD_PASSWORD diabaikan: password dashboard tidak pernah membuka menu ini. */
export function menuPasswords(): { admin?: string; manager?: string; viewer?: string } {
  const dashboardPw = process.env.DASHBOARD_PASSWORD;
  const pick = (value: string | undefined) => (value && value !== dashboardPw ? value : undefined);
  return {
    admin: pick(process.env.FOLLOWUP_ADMIN_PASSWORD),
    manager: pick(process.env.FOLLOWUP_MANAGER_PASSWORD),
    viewer: pick(process.env.FOLLOWUP_VIEWER_PASSWORD),
  };
}

export const followupSecret = (): string | null => {
  const s = authSecret();
  const p = menuPasswords();
  if (!s || !(p.admin || p.manager || p.viewer)) return null;
  return `${s}|tindak-lanjut|${p.admin ?? ""}|${p.manager ?? ""}|${p.viewer ?? ""}`;
};

/** Peran diambil HANYA dari sesi menu ini. Sesi admin dashboard utama tidak otomatis membuka menu. */
export async function getRole(): Promise<Role | null> {
  const secret = followupSecret();
  if (!secret) return null;
  const session = await readSession<{ exp: number; role?: string }>((await cookies()).get(FOLLOWUP_COOKIE)?.value, secret);
  return session?.role === "admin" || session?.role === "manager" || session?.role === "viewer" ? session.role : null;
}

/** Untuk halaman: tanpa sesi diarahkan ke halaman masuk. */
export async function requireRole(): Promise<Role> {
  const role = await getRole();
  if (!role) redirect("/tindak-lanjut/masuk");
  return role;
}

/** Untuk server action dan route: melempar galat bila tidak berhak mengubah data. */
export async function requireEditor(): Promise<"admin" | "manager"> {
  const role = await getRole();
  if (!canEdit(role)) throw new Error("Tidak berwenang mengubah data.");
  return role;
}
