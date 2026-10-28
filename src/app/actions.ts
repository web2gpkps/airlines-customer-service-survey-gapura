"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { assertAdmin } from "@/lib/admin";
import { SESSION_COOKIE } from "@/lib/auth";
import { parseScope, scopeToSearch } from "@/lib/filters";
import { clearSheetCache } from "@/lib/sheets";
import { createLink, getLink, isBranchLink, listLinks, revokeLink, type ShareLink } from "@/lib/share-store";

export async function refreshData() {
  await assertAdmin();
  clearSheetCache();
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

/** Membuat link pendek. Filter dinormalisasi ulang di server, jadi input mentah dari klien tidak dipercaya. */
export async function createShareLink(search: string): Promise<ShareLink> {
  await assertAdmin();
  return createLink(scopeToSearch(parseScope(new URLSearchParams(String(search).slice(0, 4000)))));
}

export async function listShareLinks(): Promise<ShareLink[]> {
  await assertAdmin();
  return listLinks("report");
}

export async function revokeShareLink(code: string): Promise<boolean> {
  await assertAdmin();
  const link = await getLink(String(code));
  if (!link || isBranchLink(link)) return false;
  return revokeLink(link.code);
}

const BRANCH_DAYS = [7, 30, 90, 0] as const;

/** Link akses cabang: berlaku untuk semua cabang. days = 0 berarti tanpa batas waktu. */
export async function createBranchLink(days: number): Promise<ShareLink> {
  await assertAdmin();
  if (!(BRANCH_DAYS as readonly number[]).includes(days)) throw new Error("Masa berlaku tidak valid.");
  const expiresAt = days ? new Date(Date.now() + days * 86_400_000).toISOString() : undefined;
  return createLink("", { kind: "cabang", expiresAt });
}

export async function listBranchLinks(): Promise<ShareLink[]> {
  await assertAdmin();
  return listLinks("cabang");
}

export async function revokeBranchLink(code: string): Promise<boolean> {
  await assertAdmin();
  const link = await getLink(String(code));
  if (!link || !isBranchLink(link)) return false;
  return revokeLink(link.code);
}
