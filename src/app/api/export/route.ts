import { buildExcel } from "@/lib/export/excel";
import { buildPdf } from "@/lib/export/pdf";
import { buildSlidesPdf } from "@/lib/export/pdf-slides";
import { parseScope } from "@/lib/filters";
import { getDashboardData } from "@/lib/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_MS = 60_000;
const MAX_EXPORTS_PER_WINDOW = 10;
const hits = new Map<string, number[]>();

/** Pembatas sederhana per IP (in-memory) agar ekspor yang berat tidak dipakai untuk membebani server. */
function rateLimited(request: Request): boolean {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_EXPORTS_PER_WINDOW) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5_000) for (const [key, times] of hits) if (!times.some((t) => now - t < WINDOW_MS)) hits.delete(key);
  return false;
}

export async function GET(request: Request) {
  if (rateLimited(request)) {
    return new Response("Terlalu banyak permintaan. Coba lagi sebentar.", {
      status: 429,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": "60" },
    });
  }
  const params = new URL(request.url).searchParams;
  const requested = params.get("format");
  const format = requested === "xlsx" ? "xlsx" : requested === "pdf-slide" ? "pdf-slide" : "pdf";
  const scope = parseScope(params);

  try {
    const data = await getDashboardData();
    const body = format === "xlsx" ? await buildExcel(data, scope) : format === "pdf-slide" ? buildSlidesPdf(data, scope) : buildPdf(data, scope);
    const stamp = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Jakarta" }).format(new Date(data.fetchedAt));
    const name = `Airline-CSS-Survey-${stamp}${format === "pdf-slide" ? "-slide" : ""}.${format === "xlsx" ? "xlsx" : "pdf"}`;
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type":
          format === "xlsx"
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : "application/pdf",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("Export gagal:", err);
    return new Response("Export gagal. Coba lagi beberapa saat.", { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}
