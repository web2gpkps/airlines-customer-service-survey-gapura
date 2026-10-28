"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_MAX_AGE_S, authConfigured, createSessionToken, passwordMatches } from "@/lib/auth";

export interface LoginState {
  error?: string;
}

const WINDOW_MS = 10 * 60_000;
const MAX_ATTEMPTS = 8;
const attempts = new Map<string, number[]>();

/** Pembatas percobaan login per IP (in-memory; per instance di Vercel). */
function tooManyAttempts(ip: string): boolean {
  const now = Date.now();
  const recent = (attempts.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  attempts.set(ip, recent);
  if (attempts.size > 5_000) for (const [key, times] of attempts) if (!times.some((t) => now - t < WINDOW_MS)) attempts.delete(key);
  return recent.length > MAX_ATTEMPTS;
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!authConfigured()) return { error: "Login belum dikonfigurasi. Hubungi administrator." };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  if (tooManyAttempts(ip)) return { error: "Terlalu banyak percobaan. Coba lagi dalam beberapa menit." };

  const password = String(formData.get("password") ?? "").slice(0, 200);
  if (!(await passwordMatches(password))) return { error: "Password salah." };

  (await cookies()).set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });
  attempts.delete(ip);

  // Hanya path internal yang boleh dituju setelah login (cegah open redirect).
  const next = String(formData.get("next") ?? "");
  redirect(next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/");
}
