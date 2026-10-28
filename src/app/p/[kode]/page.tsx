import type { Metadata } from "next";
import { LoadError } from "@/components/LoadError";
import { Presentation } from "@/components/Presentation";
import { parseScope } from "@/lib/filters";
import { getDashboardData, toClientData } from "@/lib/sheets";
import { scopeDataForShare } from "@/lib/shared-data";
import { getLink, isBranchLink } from "@/lib/share-store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Laporan Airline CSS Survey",
  robots: { index: false, follow: false },
};

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-xl px-4 py-24">
      <div className="card p-8">
        <p className="eyebrow">Airline CSS Survey</p>
        <h1 className="mt-2 text-xl font-bold">{title}</h1>
        <p className="mt-3 text-sm text-ink-2">{children}</p>
      </div>
    </main>
  );
}

export default async function SharedReportPage({ params }: { params: Promise<{ kode: string }> }) {
  const { kode } = await params;

  let link;
  try {
    link = await getLink(kode);
  } catch (err) {
    console.error("Penyimpanan link bermasalah:", err);
    return <Notice title="Laporan belum bisa dibuka">Layanan sedang bermasalah sementara. Coba muat ulang beberapa saat lagi.</Notice>;
  }

  // Link yang salah, tidak ada, atau sudah diputus menampilkan pesan yang sama.
  if (!link || link.revokedAt || isBranchLink(link)) {
    return <Notice title="Link ini tidak berlaku">Link sudah diputus atau tidak ditemukan. Minta link baru ke pengirimnya.</Notice>;
  }

  const query = parseScope(new URLSearchParams(link.search));
  try {
    const data = scopeDataForShare(toClientData(await getDashboardData()), query);
    return <Presentation data={data} query={query} publicView />;
  } catch (err) {
    console.error("Gagal memuat data survei:", err);
    return <LoadError message={err instanceof Error ? err.message : String(err)} />;
  }
}
