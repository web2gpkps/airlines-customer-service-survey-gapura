"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Download, ListChecks, LogOut, Presentation, RefreshCw, RotateCcw, Share2, Users } from "lucide-react";
import { logout, refreshData } from "@/app/actions";
import { ALL_CONTENT, EMPTY_FILTERS, KPI_OPTIONS, applyFilters, hasFilters, type Filters, type ReportScope } from "@/lib/filters";
import { buildSegmentReport } from "@/lib/report";
import { categorize, computeSurvey, formatIndex } from "@/lib/scoring";
import type { DashboardData } from "@/lib/sheets";
import { SEGMENT_META } from "@/lib/survey-config";
import { MultiSelect } from "./MultiSelect";
import { PresentationMode } from "./PresentationMode";
import { SegmentView } from "./SegmentView";
import { ExportDialog } from "./ExportDialog";
import { ShareDialog } from "./ShareDialog";
import { BranchShareDialog } from "./BranchShareDialog";
import { TargetSampling } from "./TargetSampling";
import type { TargetData } from "@/lib/target-shared";
import { formatDateTime, formatMonth, toneMark } from "./ui";
import { useAutoRefresh } from "./useAutoRefresh";

const AUTO_REFRESH_MS = 2 * 60_000;

/** main = dashboard utama; admin-cabang = halaman Share Akses Cabang (admin); cabang = halaman yang dibuka cabang lewat link. */
export type DashboardVariant = "main" | "admin-cabang" | "cabang";

export function Dashboard({ data, variant = "main", targets, branchCode, shareOrigin }: { data: DashboardData; variant?: DashboardVariant; targets?: TargetData; branchCode?: string; shareOrigin?: string }) {
  const isBranch = variant === "cabang";
  const router = useRouter();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [dialog, setDialog] = useState<"share" | "export" | "branch" | null>(null);
  const [presenting, setPresenting] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  useAutoRefresh(AUTO_REFRESH_MS);

  const segment = data.segments.airline;
  const filtered = useMemo(() => applyFilters(segment.responses, filters), [segment.responses, filters]);
  const options = useMemo(() => {
    const all = segment.responses;
    return {
      months: [...new Set(all.map((r) => r.date.slice(0, 7)))].filter(Boolean).sort().reverse(),
      airports: [...new Set(all.map((r) => r.airport))].filter(Boolean).sort(),
      airlines: [...new Set(all.map((r) => r.airline))].filter(Boolean).sort(),
      flightTypes: [...new Set(all.map((r) => r.flightType))].filter(Boolean).sort(),
      routes: [...new Set(all.map((r) => r.route))].filter(Boolean).sort(),
    };
  }, [segment.responses]);
  // Kartu segmen B2C di bawah judul: jumlah respons dan index mengikuti filter yang aktif.
  const tabIndex = useMemo(() => computeSurvey(segment.sections, filtered).overall.index, [segment.sections, filtered]);
  const tabCategory = categorize(tabIndex);
  const filterText = useMemo(
    () => (presenting ? buildSegmentReport(data, "airline", filters).filterText : ""),
    [presenting, data, filters],
  );
  const closePresenting = useCallback(() => setPresenting(false), []);
  // Harus dipanggil langsung dari klik pengguna agar browser mengizinkan layar penuh.
  const startPresenting = () => {
    setPresenting(true);
    void document.documentElement.requestFullscreen?.().catch(() => {});
  };
  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((prev) => ({ ...prev, [key]: value }));
  const currentScope = (): ReportScope => ({ segments: ["airline"], filters: { airline: filters }, content: [...ALL_CONTENT] });

  return (
    <div className="min-h-dvh">
      <header className="runway border-b border-line">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-4 px-4 pt-5 pb-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-4 sm:gap-5">
            <Image src="/logo-gapura.webp" alt="Gapura Airport Services" width={1052} height={569} priority className="h-10 w-auto shrink-0 sm:h-12" />
            <div className="h-10 w-px shrink-0 bg-line-strong" aria-hidden />
            <div className="min-w-0">
              <p className="eyebrow">Survei kepuasan pelanggan · skala 1 sampai 5</p>
              <h1 className="text-lg leading-tight font-extrabold tracking-tight text-ink sm:text-2xl">AIRLINE CSS SURVEY DASHBOARD</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <p className="mr-1 text-right text-xs leading-snug text-muted">Data Realtime<br /><span className="font-medium text-ink-2">per {formatDateTime(data.fetchedAt)}</span></p>
            {!isBranch && <button onClick={() => startRefresh(async () => { await refreshData(); router.refresh(); })} disabled={refreshing} aria-label="Muat ulang data" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line-strong bg-card px-3 text-sm font-semibold text-ink transition-colors hover:border-ink-2 disabled:opacity-60">
              <RefreshCw aria-hidden className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
              <span className="hidden lg:inline">{refreshing ? "Memuat…" : "Muat ulang"}</span>
            </button>}
            <button onClick={startPresenting} aria-label="Mulai mode presentasi" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line-strong bg-card px-3 text-sm font-semibold text-ink transition-colors hover:border-ink-2"><Presentation aria-hidden className="size-4" /> <span className="hidden sm:inline">Presentasi</span></button>
            <button onClick={() => setDialog("export")} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line-strong bg-card px-3 text-sm font-semibold text-ink transition-colors hover:border-ink-2"><Download aria-hidden className="size-4" /> Export</button>
            {variant === "main" && <button onClick={() => setDialog("share")} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand px-3.5 text-sm font-semibold text-white transition-colors hover:bg-brand-deep"><Share2 aria-hidden className="size-4" /> Bagikan</button>}
            {variant === "main" && <Link href="/akses-cabang" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-brand bg-card px-3.5 text-sm font-semibold text-brand transition-colors hover:bg-brand-wash"><Users aria-hidden className="size-4" /> Share Akses Cabang</Link>}
            {variant === "main" && <Link href="/tindak-lanjut" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-crit px-3.5 text-sm font-semibold text-white transition-colors hover:bg-crit/85"><ListChecks aria-hidden className="size-4" /> Tindak Lanjut</Link>}
            {variant === "admin-cabang" && <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line-strong bg-card px-3 text-sm font-semibold text-ink transition-colors hover:border-ink-2"><ArrowLeft aria-hidden className="size-4" /> Dashboard utama</Link>}
            {variant === "admin-cabang" && <button onClick={() => setDialog("branch")} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand px-3.5 text-sm font-semibold text-white transition-colors hover:bg-brand-deep"><Share2 aria-hidden className="size-4" /> Bagikan akses cabang</button>}
            {!isBranch && <button onClick={() => logout()} aria-label="Keluar" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line-strong bg-card px-3 text-sm font-semibold text-ink transition-colors hover:border-ink-2"><LogOut aria-hidden className="size-4" /> <span className="hidden lg:inline">Keluar</span></button>}
          </div>
        </div>

        <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
          <div role="group" aria-label="Segmen survei" className="grid grid-cols-1 gap-2 sm:flex sm:gap-3">
            <div className="relative flex min-h-16 items-center gap-3 rounded-t-xl border border-b-0 border-line bg-page px-3 py-3 text-left sm:min-w-72 sm:px-5">
              <span className="grid h-9 min-w-12 place-items-center rounded-lg bg-ink px-2 font-mono text-sm font-semibold text-white">B2C</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-ink">{SEGMENT_META.airline.audience}</span>
                <span className="block text-xs text-muted"><span className="num">{filtered.length}</span> respons</span>
              </span>
              <span className="hidden text-right sm:block">
                <span className="num block text-xl font-extrabold tracking-tight text-ink">{formatIndex(tabIndex)}</span>
                {tabCategory && (
                  <span className="flex items-center justify-end gap-1 text-[11px] font-medium text-muted">
                    <span className={`size-1.5 rounded-full ${toneMark(tabCategory.tone)}`} aria-hidden />
                    {tabCategory.label}
                  </span>
                )}
              </span>
              <span className="absolute inset-x-0 -top-px h-[3px] rounded-t-xl bg-brand" aria-hidden />
            </div>
          </div>
        </div>
      </header>

      <div className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-end gap-3 px-4 py-4 sm:px-6 lg:px-8">
          {options.months.length > 0 && <MultiSelect className="flex-1 basis-44 sm:max-w-60" label="Periode" values={filters.month} onChange={(v) => setFilter("month", v)} allLabel="Semua periode" options={options.months.map((m) => ({ value: m, label: formatMonth(m) }))} />}
          {options.airports.length > 0 && <MultiSelect className="flex-1 basis-44 sm:max-w-60" label="Stasiun Bandara" values={filters.airport} onChange={(v) => setFilter("airport", v)} allLabel="Semua stasiun" options={options.airports.map((v) => ({ value: v, label: v }))} />}
          {options.airlines.length > 0 && <MultiSelect className="flex-1 basis-44 sm:max-w-60" label="Maskapai" values={filters.airline} onChange={(v) => setFilter("airline", v)} allLabel="Semua maskapai" options={options.airlines.map((v) => ({ value: v, label: v }))} />}
          {options.flightTypes.length > 0 && <MultiSelect className="flex-1 basis-44 sm:max-w-60" label="Jenis penerbangan" values={filters.flightType} onChange={(v) => setFilter("flightType", v)} allLabel="Semua jenis" options={options.flightTypes.map((v) => ({ value: v, label: v }))} />}
          {options.routes.length > 0 && <MultiSelect className="flex-1 basis-44 sm:max-w-60" label="Rute" values={filters.route} onChange={(v) => setFilter("route", v)} allLabel="Semua rute" options={options.routes.map((v) => ({ value: v, label: v }))} />}
          <MultiSelect className="flex-1 basis-44 sm:max-w-60" label="KPI" values={filters.kpi} onChange={(v) => setFilter("kpi", v as Filters["kpi"])} allLabel="Semua KPI" options={[...KPI_OPTIONS]} />
          <div className="flex min-h-11 items-center gap-3 sm:ml-auto">
            <p className="text-sm text-muted" aria-live="polite"><span className="num font-bold text-ink">{filtered.length}</span> dari <span className="num">{segment.responses.length}</span> respons</p>
            {hasFilters(filters) && <button onClick={() => setFilters(EMPTY_FILTERS)} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-brand hover:bg-brand-wash"><RotateCcw aria-hidden className="size-3.5" /> Hapus filter</button>}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1320px] px-4 pt-6 pb-16 sm:px-6 lg:px-8">
        {targets && variant !== "main" && <div className="mb-5 lg:mb-6"><TargetSampling targets={targets} selectedAirports={filters.airport} /></div>}
        <SegmentView meta={SEGMENT_META.airline} sheet={segment.sheet} sections={segment.sections} responses={filtered} unmapped={segment.unmapped} hasFilters={hasFilters(filters)} />
      </main>

      <footer className="border-t border-line bg-card"><div className="mx-auto flex max-w-[1320px] flex-wrap justify-between gap-2 px-4 py-5 text-xs text-muted sm:px-6 lg:px-8"><span>PT Gapura Angkasa · Survei kepuasan pelanggan maskapai</span><span>Data diperbarui otomatis tiap 2 menit selama halaman terbuka</span></div></footer>
      {presenting && (
        <PresentationMode meta={SEGMENT_META.airline} sections={segment.sections} responses={filtered} filterText={filterText} onClose={closePresenting} />
      )}
      {variant === "main" && <ShareDialog open={dialog === "share"} onClose={() => setDialog(null)} data={data} initialScope={currentScope} origin={shareOrigin} />}
      <ExportDialog open={dialog === "export"} onClose={() => setDialog(null)} data={data} initialScope={currentScope} exportBase={isBranch && branchCode ? `/api/cabang-export/${encodeURIComponent(branchCode)}` : undefined} />
      {variant === "admin-cabang" && <BranchShareDialog open={dialog === "branch"} onClose={() => setDialog(null)} origin={shareOrigin} />}
    </div>
  );
}
