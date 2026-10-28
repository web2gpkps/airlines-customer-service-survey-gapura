import { clientIp, isGuessBlocked, recordMiss } from "@/lib/guess-limit";
import { buildExportResponse } from "@/lib/export/handler";
import { getLink, isBranchLink, isExpired } from "@/lib/share-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const deny = (status: number) =>
  new Response("Tidak diizinkan.", { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

/** Ekspor untuk pemegang link akses cabang. Hanya sah bila kode link cabang masih berlaku; tidak memakai sesi admin. */
export async function GET(request: Request, { params }: { params: Promise<{ kode: string }> }) {
  const { kode } = await params;
  const ip = clientIp(request.headers);
  if (isGuessBlocked(ip)) return deny(429);
  let link;
  try {
    link = await getLink(kode);
  } catch {
    return deny(503);
  }
  if (!link || !isBranchLink(link) || link.revokedAt || isExpired(link)) {
    recordMiss(ip);
    return deny(401);
  }
  return buildExportResponse(request);
}
