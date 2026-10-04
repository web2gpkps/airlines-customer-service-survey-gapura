"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Download, RefreshCw, RotateCcw, Share2 } from "lucide-react";
import { refreshData } from "@/app/actions";
import { ALL_CONTENT, EMPTY_FILTERS, applyFilters, hasFilters, type Filters, type ReportScope } from "@/lib/filters";
import type { DashboardData } from "@/lib/sheets";
import { SEGMENT_META } from "@/lib/survey-config";
import { SegmentView } from "./SegmentView";
import { ExportDialog } from "./ExportDialog";
import { ShareDialog } from "./ShareDialog";
import { formatDateTime, formatMonth } from "./ui";
import { useAutoRefresh } from "./useAutoRefresh";

const AUTO_REFRESH_MS = 2 * 60_000;

export function Dashboard({ data }: { data: DashboardData }) {
  const router = useRouter();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [dialog, setDialog] = useState<"share" | "export" | null>(null);
  const [refreshing, startRefresh] = useTransition();
  useAutoRefresh(AUTO_REFRESH_MS);

  const segment = data.segments.airline;
  const filtered = useMemo(() => applyFilters(segment.responses, filters), [segment.responses, filters]);
  const options = useMemo(() => {
    const all = segment.responses;
    return {
      months: [...new Set(all.map((r) => r.date.slice(0, 7)))].filter(Boolean).sort().reverse(),
      airlines: [...new Set(all.map((r) => r.airline))].filter(Boolean).sort(),
      flightTypes: [...new Set(all.map((r) => r.flightType))].filter(Boolean).sort(),
      travelPurposes: [...new Set(all.map((r) => r.travelPurpose))].filter(Boolean).sort(),
      routes: [...new Set(all.map((r) => r.route))].filter(Boolean).sort(),
    };
  }, [segment.responses]);
  const setFilter = (key: keyof Filters, value: string) => setFilters((prev) => ({ ...prev, [key]: value }));
  const currentScope = (): ReportScope => ({ segments: ["airline"], filters: { airline: filters }, content: [...ALL_CONTENT] });

  return (
    <div className="min-h-dvh">
      <header className="runway border-b border-line">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-4 sm:gap-5">
            <Image src="/logo-gapura.webp" alt="Gapura Airport Services" width={1052} height={569} priority className="h-10 w-auto shrink-0 sm:h-12" />
            <div className="h-10 w-px shrink-0 bg-line-strong" aria-hidden />
            <div className="min-w-0">
              <p className="eyebrow">Survei kepuasan pelanggan · skala 1 sampai 5</p>
              <h1 className="text-lg leading-tight font-extrabold tracking-tight text-ink sm:text-2xl">AIRLINE CSS SURVEY DASHBOARD</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <p className="mr-1 text-right text-xs leading-snug text-muted">Data Google Sheets<br /><span className="font-medium text-ink-2">per {formatDateTime(data.fetchedAt)}</span></p>
            <button onClick={() => startRefresh(async () => { await refreshData(); router.refresh(); })} disabled={refreshing} aria-label="Muat ulang data" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line-strong bg-card px-3 text-sm font-semibold text-ink transition-colors hover:border-ink-2 disabled:opacity-60">
              <RefreshCw aria-hidden className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
              <span className="hidden lg:inline">{refreshing ? "Memuat…" : "Muat ulang"}</span>
            </button>
            <button onClick={() => setDialog("export")} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line-strong bg-card px-3 text-sm font-semibold text-ink transition-colors hover:border-ink-2"><Download aria-hidden className="size-4" /> Export</button>
            <button onClick={() => setDialog("share")} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand px-3.5 text-sm font-semibold text-white transition-colors hover:bg-brand-deep"><Share2 aria-hidden className="size-4" /> Bagikan</button>
          </div>
        </div>
      </header>

      <div className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-end gap-3 px-4 py-4 sm:px-6 lg:px-8">
          {options.months.length > 0 && <FilterSelect label="Periode" value={filters.month} onChange={(v) => setFilter("month", v)} allLabel="Semua periode" options={options.months.map((m) => ({ value: m, label: formatMonth(m) }))} />}
          {options.airlines.length > 0 && <FilterSelect label="Maskapai" value={filters.airline} onChange={(v) => setFilter("airline", v)} allLabel="Semua maskapai" options={options.airlines.map((v) => ({ value: v, label: v }))} />}
          {options.flightTypes.length > 0 && <FilterSelect label="Jenis penerbangan" value={filters.flightType} onChange={(v) => setFilter("flightType", v)} allLabel="Semua jenis" options={options.flightTypes.map((v) => ({ value: v, label: v }))} />}
          {options.travelPurposes.length > 0 && <FilterSelect label="Tujuan perjalanan" value={filters.travelPurpose} onChange={(v) => setFilter("travelPurpose", v)} allLabel="Semua tujuan" options={options.travelPurposes.map((v) => ({ value: v, label: v }))} />}
          {options.routes.length > 0 && <FilterSelect label="Rute" value={filters.route} onChange={(v) => setFilter("route", v)} allLabel="Semua rute" options={options.routes.map((v) => ({ value: v, label: v }))} />}
          <div className="flex min-h-11 items-center gap-3 sm:ml-auto">
            <p className="text-sm text-muted" aria-live="polite"><span className="num font-bold text-ink">{filtered.length}</span> dari <span className="num">{segment.responses.length}</span> respons</p>
            {hasFilters(filters) && <button onClick={() => setFilters(EMPTY_FILTERS)} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-brand hover:bg-brand-wash"><RotateCcw aria-hidden className="size-3.5" /> Hapus filter</button>}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1320px] px-4 pt-6 pb-16 sm:px-6 lg:px-8">
        <SegmentView meta={SEGMENT_META.airline} sheet={segment.sheet} sections={segment.sections} responses={filtered} unmapped={segment.unmapped} hasFilters={hasFilters(filters)} />
      </main>

      <footer className="border-t border-line bg-card"><div className="mx-auto flex max-w-[1320px] flex-wrap justify-between gap-2 px-4 py-5 text-xs text-muted sm:px-6 lg:px-8"><span>PT Gapura Angkasa · Survei kepuasan pelanggan maskapai</span><span>Data diperbarui otomatis tiap 2 menit selama halaman terbuka</span></div></footer>
      <ShareDialog open={dialog === "share"} onClose={() => setDialog(null)} data={data} initialScope={currentScope} />
      <ExportDialog open={dialog === "export"} onClose={() => setDialog(null)} data={data} initialScope={currentScope} />
    </div>
  );
}

function FilterSelect({ label, value, onChange, options, allLabel }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; allLabel: string }) {
  return <label className="flex min-w-0 flex-1 basis-44 flex-col gap-1 sm:max-w-60"><span className="eyebrow">{label}</span><select className="select" value={value} onChange={(e) => onChange(e.target.value)}><option value="">{allLabel}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}
