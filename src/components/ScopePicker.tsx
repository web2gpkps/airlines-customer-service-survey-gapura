"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { CONTENT_OPTIONS, KPI_OPTIONS, applyFilters, type ContentKey, type Filters, type ReportScope } from "@/lib/filters";
import type { DashboardData } from "@/lib/sheets";
import { MultiSelect } from "./MultiSelect";
import { formatMonth } from "./ui";

export function ScopePicker({
  data,
  value,
  onChange,
  contentNote,
}: {
  data: DashboardData;
  value: ReportScope;
  onChange: (next: ReportScope) => void;
  contentNote?: string;
}) {
  const setFilter = <K extends keyof Filters>(key: K, v: Filters[K]) =>
    onChange({ ...value, filters: { airline: { ...value.filters.airline, [key]: v } } });

  const toggleContent = (key: ContentKey) => {
    const on = value.content.includes(key);
    if (on && value.content.length === 1) return;
    onChange({
      ...value,
      content: CONTENT_OPTIONS.map((c) => c.key).filter((k) => (k === key ? !on : value.content.includes(k))),
    });
  };

  return (
    <div className="grid gap-5">
      <SegmentFilters data={data} filters={value.filters.airline} onChange={setFilter} />

      <fieldset className="grid gap-2">
        <legend className="eyebrow mb-2">Konten</legend>
        <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
          {CONTENT_OPTIONS.map((c) => {
            const checked = value.content.includes(c.key);
            return (
              <label key={c.key} className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={checked && value.content.length === 1}
                  onChange={() => toggleContent(c.key)}
                  className="size-4 accent-[var(--color-brand)]"
                />
                {c.label}
              </label>
            );
          })}
        </div>
        {contentNote && <p className="text-xs text-muted">{contentNote}</p>}
      </fieldset>
    </div>
  );
}

function SegmentFilters({
  data,
  filters,
  onChange,
}: {
  data: DashboardData;
  filters: Filters;
  onChange: <K extends keyof Filters>(key: K, v: Filters[K]) => void;
}) {
  const all = data.segments.airline.responses;
  const options = useMemo(
    () => ({
      months: [...new Set(all.map((r) => r.date.slice(0, 7)))].filter(Boolean).sort().reverse(),
      airports: [...new Set(all.map((r) => r.airport))].filter(Boolean).sort(),
      airlines: [...new Set(all.map((r) => r.airline))].filter(Boolean).sort(),
      flightTypes: [...new Set(all.map((r) => r.flightType))].filter(Boolean).sort(),
      routes: [...new Set(all.map((r) => r.route))].filter(Boolean).sort(),
    }),
    [all],
  );
  const count = applyFilters(all, filters).length;

  return (
    <fieldset className="rounded-xl border border-line bg-sunken p-3.5">
      <legend className="sr-only">Filter laporan Airline</legend>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-ink">
          Data laporan
        </span>
        <span className={`num text-xs ${count ? "text-muted" : "font-semibold text-crit"}`}>{count} respons</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <MultiSelect compact label="Periode" values={filters.month} onChange={(v) => onChange("month", v)} allLabel="Semua periode" options={options.months.map((m) => ({ value: m, label: formatMonth(m) }))} />
        {options.airports.length > 0 && <MultiSelect compact label="Stasiun Bandara" values={filters.airport} onChange={(v) => onChange("airport", v)} allLabel="Semua stasiun" options={options.airports.map((s) => ({ value: s, label: s }))} />}
        {options.airlines.length > 0 && <MultiSelect compact label="Maskapai" values={filters.airline} onChange={(v) => onChange("airline", v)} allLabel="Semua maskapai" options={options.airlines.map((s) => ({ value: s, label: s }))} />}
        {options.flightTypes.length > 0 && <MultiSelect compact label="Jenis penerbangan" values={filters.flightType} onChange={(v) => onChange("flightType", v)} allLabel="Semua jenis" options={options.flightTypes.map((s) => ({ value: s, label: s }))} />}
        {options.routes.length > 0 && <MultiSelect compact label="Rute" values={filters.route} onChange={(v) => onChange("route", v)} allLabel="Semua rute" options={options.routes.map((s) => ({ value: s, label: s }))} />}
        <MultiSelect compact label="KPI" values={filters.kpi} onChange={(v) => onChange("kpi", v as Filters["kpi"])} allLabel="Semua KPI" options={KPI_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
      </div>
    </fieldset>
  );
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  wide = false,
}: {
  wide?: boolean;
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={title}
      className={`m-auto max-h-[calc(100dvh-2rem)] ${wide ? "w-[min(980px,calc(100vw-2rem))]" : "w-[min(640px,calc(100vw-2rem))]"} overflow-hidden rounded-2xl border border-line bg-card p-0 text-ink shadow-2xl backdrop:bg-ink/40 backdrop:backdrop-blur-[2px] open:flex open:flex-col`}
    >
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        <button
          onClick={onClose}
          aria-label="Tutup"
          className="grid size-11 shrink-0 place-items-center rounded-lg text-muted hover:bg-sunken hover:text-ink"
        >
          <X className="size-5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
      {footer && <div className="shrink-0 border-t border-line bg-sunken/60 px-5 py-4 sm:px-6">{footer}</div>}
    </dialog>
  );
}

export function useScopeState(open: boolean, initial: () => ReportScope) {
  const [scope, setScope] = useState<ReportScope>(initial);
  const init = useRef(initial);
  init.current = initial;
  useEffect(() => {
    if (open) setScope(init.current());
  }, [open]);
  return [scope, setScope] as const;
}
