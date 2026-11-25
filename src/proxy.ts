import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

// Hanya /login, /p/<kode>, /cabang/<kode>, /api/cabang-export/<kode> (divalidasi di route), serta menu /tindak-lanjut dan
// /api/tindak-lanjut/* (dijaga password bertingkat sendiri, diperiksa di halaman dan route-nya) yang terbuka tanpa sesi admin.
// Sisanya (dashboard, /presentasi lama, /api) terkunci.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Persen-encoding yang rusak ditolak di depan, bukan dibiarkan jadi error 500 di dalam framework.
  try {
    decodeURIComponent(pathname);
  } catch {
    return new NextResponse("Permintaan tidak valid.", { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  if (
    pathname === "/login" ||
    pathname.startsWith("/p/") ||
    pathname.startsWith("/cabang/") ||
    pathname.startsWith("/api/cabang-export/") ||
    pathname === "/tindak-lanjut" ||
    pathname.startsWith("/tindak-lanjut/") ||
    pathname.startsWith("/api/tindak-lanjut/")
  ) {
    return NextResponse.next();
  }

  if (await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return new NextResponse("Tidak diizinkan.", { status: 401, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  const url = new URL("/login", request.url);
  if (pathname !== "/") url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Unggahan evidence dilewati: proxy menyangga isi permintaan maksimal 10 MB. Route itu memeriksa peran dan asal permintaan sendiri.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/tindak-lanjut/evidence|.*\\.(?:png|webp|svg|ico|jpg)$).*)"],
};
