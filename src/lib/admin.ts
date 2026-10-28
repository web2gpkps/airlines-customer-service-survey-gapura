import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "./auth";

/** Pemeriksaan sesi admin di sisi server (lapisan kedua di luar proxy). */
export async function isAdmin(): Promise<boolean> {
  return verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function assertAdmin() {
  if (!(await isAdmin())) throw new Error("Tidak diizinkan.");
}
