import { isAdmin } from "@/lib/admin";
import { buildExportResponse } from "@/lib/export/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await isAdmin())) return new Response("Tidak diizinkan.", { status: 401, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  return buildExportResponse(request);
}
