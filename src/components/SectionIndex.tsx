"use client";

import { useState } from "react";
import { KPI_TARGET, categorize, formatIndex, type SurveyResult } from "@/lib/scoring";
import { CardHeader, Segmented, StatusBadge, toneMark, toneText } from "./ui";

const pos = (v: number) => `${((Math.min(Math.max(v, 1), 5) - 1) / 4) * 100}%`;
const TICKS = [1, 2, 3, 4, 5];

type Sort = "order" | "low";

export function SectionIndex({ result, controls = true }: { result: SurveyResult; controls?: boolean }) {
  const [sort, setSort] = useState<Sort>("order");
  const rows =
    sort === "order"
      ? result.sections
      : [...result.sections].sort((a, b) => (a.index ?? 99) - (b.index ?? 99));

  return (
    <section className="card rise" style={{ animationDelay: "120ms" }}>
      <CardHeader
        eyebrow="Per bagian"
        title="Index per bagian layanan"
        description="Garis hitam adalah standar KPI 4,50. Batang dimulai dari 1,00, nilai terendah skala."
        action={
          controls && (
          <Segmented
            label="Urutkan bagian"
            value={sort}
            onChange={setSort}
            options={[
              { value: "order", label: "Urutan kuesioner" },
              { value: "low", label: "Terendah dulu" },
            ]}
          />
          )
        }
      />

      {/* Mobile: daftar kartu */}
      <ul className="md:hidden">
        {rows.map((s) => {
          const c = categorize(s.index);
          return (
            <li key={s.code} className="border-t border-line px-5 py-4 first:border-t-0">
              <div className="flex items-start gap-2.5">
                <span className="grid size-6 shrink-0 place-items-center rounded-md bg-sunken font-mono text-xs font-semibold text-ink-2 ring-1 ring-line">
                  {s.code}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{s.short}</p>
                  <p className="num text-xs text-muted">
                    {s.statements.length} butir · {s.n} jawaban
                  </p>
                </div>
                <div className="text-right">
                  <p className="num text-lg leading-none font-extrabold text-ink">{formatIndex(s.index)}</p>
                  <p className={`mt-1 text-xs font-semibold ${c ? toneText(c.tone) : "text-muted"}`}>{c?.label ?? "–"}</p>
                </div>
              </div>
              <div className="relative mt-3 h-2.5">
                <span className="absolute inset-0 rounded-full bg-sunken" aria-hidden />
                {s.index !== null && c && (
                  <span className={`absolute inset-y-0 left-0 rounded-full ${toneMark(c.tone)}`} style={{ width: pos(s.index) }} aria-hidden />
                )}
                <span className="absolute -inset-y-1 w-0.5 -translate-x-1/2 bg-ink" style={{ left: pos(KPI_TARGET) }} aria-hidden />
              </div>
              <div className="mt-2.5">
                <StatusBadge category={c} />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[680px] border-collapse text-sm">
          <caption className="sr-only">Index per bagian, kategori, dan status terhadap standar KPI</caption>
          <thead>
            <tr className="text-left">
              <th scope="col" className="w-[26%] px-5 py-3 font-medium sm:px-6">
                <span className="eyebrow">Bagian</span>
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                <span className="sr-only">Grafik index</span>
                <div className="relative h-4 font-mono text-[10.5px] text-muted" aria-hidden>
                  {TICKS.map((t) => (
                    <span
                      key={t}
                      className="num absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full"
                      style={{ left: pos(t) }}
                    >
                      {t}
                    </span>
                  ))}
                  <span
                    className="absolute -translate-x-1/2 font-semibold text-ink"
                    style={{ left: pos(KPI_TARGET) }}
                  >
                    4,5
                  </span>
                </div>
              </th>
              <th scope="col" className="w-20 px-3 py-3 text-right">
                <span className="eyebrow">Index</span>
              </th>
              <th scope="col" className="w-32 px-3 py-3">
                <span className="eyebrow">Kategori</span>
              </th>
              <th scope="col" className="w-52 px-5 py-3 sm:px-6">
                <span className="eyebrow">Status KPI</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => {
              const c = categorize(s.index);
              return (
                <tr key={s.code} className="border-t border-line hover:bg-sunken/70">
                  <th scope="row" className="px-5 py-3.5 text-left font-normal sm:px-6">
                    <span className="flex items-center gap-2.5">
                      <span className="grid size-6 shrink-0 place-items-center rounded-md bg-sunken font-mono text-xs font-semibold text-ink-2 ring-1 ring-line">
                        {s.code}
                      </span>
                      <span>
                        <span className="block font-semibold text-ink">{s.short}</span>
                        <span className="num block text-xs text-muted">
                          {s.statements.length} butir · {s.n} jawaban
                        </span>
                      </span>
                    </span>
                  </th>
                  <td className="px-3 py-3.5">
                    <div className="relative h-5">
                      <span className="absolute inset-y-0 left-0 right-0 rounded-sm bg-sunken" aria-hidden />
                      {TICKS.slice(1, -1).map((t) => (
                        <span key={t} className="absolute inset-y-0 w-px bg-line" style={{ left: pos(t) }} aria-hidden />
                      ))}
                      {s.index !== null && c && (
                        <span
                          className={`grow-x absolute inset-y-[3px] left-0 rounded-r-[4px] ${toneMark(c.tone)}`}
                          style={{ width: pos(s.index), animationDelay: `${150 + i * 50}ms` }}
                          aria-hidden
                        />
                      )}
                      <span
                        className="absolute -inset-y-1 w-0.5 -translate-x-1/2 bg-ink"
                        style={{ left: pos(KPI_TARGET) }}
                        aria-hidden
                      />
                    </div>
                  </td>
                  <td className="num px-3 py-3.5 text-right text-base font-extrabold text-ink">{formatIndex(s.index)}</td>
                  <td className={`px-3 py-3.5 font-semibold ${c ? toneText(c.tone) : "text-muted"}`}>
                    {c?.label ?? "Belum ada data"}
                  </td>
                  <td className="px-5 py-3.5 sm:px-6">
                    <StatusBadge category={c} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
