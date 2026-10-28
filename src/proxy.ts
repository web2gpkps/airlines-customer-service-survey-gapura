import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

// Hanya /login, /p/<kode>, dan /cabang/<kode>, dan /api/cabang-export/<kode> (divalidasi di route) yang terbuka tanpa sesi admin. Sisanya (dashboard, /presentasi lama, /api) terkunci.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Persen-encoding yang rusak ditolak di depan, bukan dibiarkan jadi error 500 di dalam framework.
  try {
    decodeURIComponent(pathname);
  } catch {
    return new NextResponse("Permintaan tidak valid.", { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  if (pathname === "/login" || pathname.startsWith("/p/") || pathname.startsWith("/cabang/") || pathname.startsWith("/api/cabang-export/")) return NextResponse.next();

  if (await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return new NextResponse("Tidak diizinkan.", { status: 401, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  const url = new URL("/login", request.url);
  if (pathname !== "/") url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|webp|svg|ico|jpg)$).*)"],
};
