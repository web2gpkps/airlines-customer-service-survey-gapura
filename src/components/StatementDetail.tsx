"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { categorize, formatIndex, type StatementResult, type SurveyResult } from "@/lib/scoring";
import { CardHeader, StatusBadge, toneText } from "./ui";

export const LIKERT = [
  { score: 1, label: "Sangat Tidak Puas", color: "bg-lk1" },
  { score: 2, label: "Tidak Puas", color: "bg-lk2" },
  { score: 3, label: "Cukup / Netral", color: "bg-lk3" },
  { score: 4, label: "Puas", color: "bg-lk4" },
  { score: 5, label: "Sangat Puas", color: "bg-lk5" },
];

export function LikertLegend({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${className}`}>
      <span className="eyebrow">Skala</span>
      {LIKERT.map((l) => (
        <span key={l.score} className="inline-flex items-center gap-1.5 text-xs text-ink-2">
          <span className={`size-3 rounded-[3px] ${l.color}`} aria-hidden />
          <b className="font-mono">{l.score}</b> {l.label}
        </span>
      ))}
    </div>
  );
}

export function StatementDetail({ result }: { result: SurveyResult }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set([result.sections[0]?.code]));
  const allOpen = open.size === result.sections.length;

  const toggle = (code: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  return (
    <section className="card">
      <CardHeader
        eyebrow="Per pernyataan"
        title="Rincian skor tiap pernyataan"
        description="Jumlah responden yang memilih skor 1 sampai 5, lalu index dan kategorinya."
        action={
          <button
            onClick={() => setOpen(allOpen ? new Set() : new Set(result.sections.map((s) => s.code)))}
            className="min-h-9 rounded-lg border border-line-strong px-3 text-xs font-semibold text-ink hover:border-ink-2"
          >
            {allOpen ? "Tutup semua" : "Buka semua"}
          </button>
        }
      />
      <LikertLegend className="border-b border-line bg-sunken px-5 py-3 sm:px-6" />

      <div>
        {result.sections.map((s) => {
          const c = categorize(s.index);
          const isOpen = open.has(s.code);
          return (
            <div key={s.code} className="border-b border-line last:border-b-0">
              <button
                onClick={() => toggle(s.code)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-sunken/70 sm:px-6"
              >
                <ChevronDown
                  aria-hidden
                  className={`size-4 shrink-0 text-muted transition-transform ${isOpen ? "" : "-rotate-90"}`}
                />
                <span className="grid size-6 shrink-0 place-items-center rounded-md bg-ink font-mono text-xs font-semibold text-white">
                  {s.code}
                </span>
                <span className="min-w-0 flex-1 font-bold text-ink">{s.title}</span>
                <span className="num hidden text-sm text-muted sm:inline">{s.statements.length} butir</span>
                <span className="num w-12 text-right text-base font-extrabold text-ink">{formatIndex(s.index)}</span>
                <span className="hidden md:inline">
                  <StatusBadge category={c} />
                </span>
              </button>
              {isOpen && (
                <div className="border-t border-line">
                  <StatementList statements={s.statements} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Daftar pernyataan: kartu di layar kecil, tabel di layar md ke atas. */
export function StatementList({ statements }: { statements: StatementResult[] }) {
  return (
    <>
      <ul className="md:hidden">
        {statements.map((st) => {
          const c = categorize(st.index);
          return (
            <li key={st.no} className="border-t border-line px-5 py-3.5 first:border-t-0">
              <p className="flex gap-3 text-sm leading-snug text-ink">
                <span className="num w-5 shrink-0 font-mono text-xs text-muted">{st.no}</span>
                {st.text}
              </p>
              <div className="mt-2.5 pl-8">
                <Distribution counts={st.counts} n={st.n} />
                <p className="num mt-2 flex flex-wrap items-baseline gap-x-3 text-xs text-muted">
                  <span>
                    Index <b className="text-sm font-extrabold text-ink">{formatIndex(st.index)}</b>
                  </span>
                  {c && <span className={`font-semibold ${toneText(c.tone)}`}>{c.label}</span>}
                  <span>n={st.n}</span>
                  <span>
                    Skor 1 s.d. 5: <span className="font-mono text-ink-2">{st.counts.join(" · ")}</span>
                  </span>
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead className="bg-sunken/60 text-left">
            <tr>
              <th scope="col" className="w-10 py-2 pl-5 sm:pl-6">
                <span className="eyebrow">No</span>
              </th>
              <th scope="col" className="px-3 py-2">
                <span className="eyebrow">Pernyataan</span>
              </th>
              <th scope="col" className="w-[22%] px-3 py-2">
                <span className="eyebrow">Sebaran jawaban</span>
              </th>
              {LIKERT.map((l) => (
                <th key={l.score} scope="col" className="w-9 px-1 py-2 text-center" title={l.label}>
                  <span className="eyebrow">{l.score}</span>
                </th>
              ))}
              <th scope="col" className="w-10 px-2 py-2 text-right">
                <span className="eyebrow">n</span>
              </th>
              <th scope="col" className="w-16 px-3 py-2 text-right">
                <span className="eyebrow">Index</span>
              </th>
              <th scope="col" className="w-44 py-2 pr-5 pl-3 sm:pr-6">
                <span className="eyebrow">Kategori</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {statements.map((st) => {
              const c = categorize(st.index);
              return (
                <tr key={st.no} className="border-t border-line align-middle hover:bg-sunken/50">
                  <td className="num py-3 pl-5 font-mono text-xs text-muted sm:pl-6">{st.no}</td>
                  <td className="px-3 py-3 leading-snug text-ink">{st.text}</td>
                  <td className="px-3 py-3">
                    <Distribution counts={st.counts} n={st.n} />
                  </td>
                  {st.counts.map((count, i) => (
                    <td key={i} className={`num px-1 py-3 text-center ${count ? "text-ink-2" : "text-line-strong"}`}>
                      {count}
                    </td>
                  ))}
                  <td className="num px-2 py-3 text-right font-semibold text-ink">{st.n}</td>
                  <td className="num px-3 py-3 text-right text-base font-extrabold text-ink">{formatIndex(st.index)}</td>
                  <td className="py-3 pr-5 pl-3 sm:pr-6">
                    {c ? (
                      <span className={`font-semibold ${toneText(c.tone)}`}>{c.label}</span>
                    ) : (
                      <span className="text-xs text-muted">Belum ada jawaban</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function Distribution({ counts, n }: { counts: number[]; n: number }) {
  if (!n) return <div className="h-3 rounded-full bg-sunken" aria-label="Belum ada jawaban" />;
  const summary = LIKERT.map((l, i) => `${l.label}: ${counts[i]}`).join(", ");
  return (
    <div className="flex h-3 gap-[2px]" role="img" aria-label={summary}>
      {LIKERT.map((l, i) =>
        counts[i] ? (
          <span
            key={l.score}
            tabIndex={0}
            className={`group relative first:rounded-l-full last:rounded-r-full ${l.color} outline-offset-1`}
            style={{ flexGrow: counts[i], flexBasis: 0 }}
          >
            <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden -translate-x-1/2 rounded-md bg-ink px-2 py-1 text-[11px] font-medium whitespace-nowrap text-white shadow-lg group-hover:block group-focus:block">
              {l.score} · {l.label}: <b>{counts[i]}</b> ({Math.round((counts[i] / n) * 100)}%)
            </span>
          </span>
        ) : null,
      )}
    </div>
  );
}
