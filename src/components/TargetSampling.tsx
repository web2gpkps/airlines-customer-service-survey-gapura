"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, TriangleAlert } from "lucide-react";
import { OUTSIDE_REASON_LABEL, stationCode, type OutsideGroup, type TargetBlock, type TargetData } from "@/lib/target-shared";
import { CardHeader } from "./ui";

const pctText = (p: number | null) => (p === null ? "–" : `${Math.round(p * 100)}%`);
const numText = (n: number | null) => (n === null ? "–" : String(n));

/** Panah capaian: hijau naik bila target tercapai (100% atau lebih), merah turun bila belum. */
function Arrow({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  return pct >= 1 ? (
    <ArrowUp aria-label="Target tercapai" className="size-3.5 shrink-0 text-good" strokeWidth={3} />
  ) : (
    <ArrowDown aria-label="Belum mencapai target" className="size-3.5 shrink-0 text-crit" strokeWidth={3} />
  );
}

/** Terkumpul: nol ditampilkan merah supaya baris yang belum terisi langsung terlihat. */
function Collected({ value }: { value: number | null }) {
  if (value === null) return <>–</>;
  return <span className={value === 0 ? "font-bold text-crit" : ""}>{value}</span>;
}

function Bar({ pct }: { pct: number | null }) {
  const value = Math.min(1, pct ?? 0);
  return (
    <div className="h-1.5 w-full min-w-16 overflow-hidden rounded-full bg-sunken" aria-hidden>
      <div className={`h-full rounded-full ${value >= 1 ? "bg-good-mark" : value >= 0.5 ? "bg-warn-mark" : "bg-crit-mark"}`} style={{ width: `${value * 100}%` }} />
    </div>
  );
}

const sumCount = (groups: OutsideGroup[]) => groups.reduce((a, g) => a + g.count, 0);

/** Baris respons yang tidak masuk panduan sampling cabang ini: tetap ditampilkan, berwarna merah. */
function OutsideRows({ code, groups }: { code: string; groups: OutsideGroup[] }) {
  if (!groups.length) return null;
  return (
    <>
      <tr className="border-t-2 border-warn-mark bg-warn-wash">
        <td colSpan={7} className="py-1.5 pr-3 pl-2 text-xs font-bold text-crit">
          Di luar panduan sampling cabang {code}: {sumCount(groups)} respons (tidak dihitung ke Terkumpul)
        </td>
      </tr>
      {groups.map((g) => (
        <tr key={`${g.airline}|${g.reason}`} className="border-t border-line bg-warn-wash align-top text-crit">
          <td className="py-2 pr-3 pl-2 font-medium">{g.airline}</td>
          <td className="py-2 pr-3">{OUTSIDE_REASON_LABEL[g.reason]}</td>
          <td className="num py-2 pr-3 text-right">–</td>
          <td className="num py-2 pr-3 text-right font-bold">{g.count}</td>
          <td className="num py-2 pr-3 text-right">–</td>
          <td className="py-2 pr-3">–</td>
          <td className="num py-2 text-right">–</td>
        </tr>
      ))}
    </>
  );
}

function OutsideOnlyBlock({ code, groups, defaultOpen }: { code: string; groups: OutsideGroup[]; defaultOpen: boolean }) {
  return (
    <details className="group border-t border-line first:border-t-0" open={defaultOpen || undefined}>
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2 bg-warn-wash px-5 py-3 sm:px-6">
        <ChevronDown aria-hidden className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
        <span className="w-12 font-bold text-ink">{code}</span>
        <span className="min-w-0 flex-1 basis-48 text-xs font-semibold text-crit">Cabang tidak ada di panduan target sampling</span>
        <span className="num text-sm font-bold text-crit">{sumCount(groups)} respons di luar panduan</span>
      </summary>
      <div className="overflow-x-auto px-5 pb-4 sm:px-6">
        <table className="w-full min-w-[640px] text-left text-sm">
          <tbody>
            <OutsideRows code={code} groups={groups} />
          </tbody>
        </table>
      </div>
    </details>
  );
}

function BlockTable({ block, defaultOpen, outside }: { block: TargetBlock; defaultOpen: boolean; outside: OutsideGroup[] }) {
  return (
    <details className="group border-t border-line first:border-t-0" open={defaultOpen || undefined}>
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 hover:bg-sunken sm:px-6">
        <ChevronDown aria-hidden className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
        <span className="w-12 font-bold text-ink">{block.code}</span>
        <span className="min-w-0 flex-1 basis-48 text-xs text-muted">
          {block.summary}
          {outside.length > 0 && <b className="ml-2 rounded bg-warn-wash px-1.5 py-0.5 text-crit">+{sumCount(outside)} di luar panduan</b>}
        </span>
        <span className="num text-sm text-ink-2">
          <b className={block.collected === 0 && block.target > 0 ? "text-crit" : "text-ink"}>{block.collected}</b> / {block.target}
        </span>
        <span className="w-24"><Bar pct={block.pct} /></span>
        <span className="num flex w-14 items-center justify-end gap-1 text-sm font-bold text-ink"><Arrow pct={block.pct} />{pctText(block.pct)}</span>
      </summary>
      <div className="overflow-x-auto px-5 pb-4 sm:px-6">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="py-2 pr-3 font-semibold">Airline</th>
              <th className="py-2 pr-3 font-semibold">Kategori</th>
              <th className="py-2 pr-3 text-right font-semibold">Target</th>
              <th className="py-2 pr-3 text-right font-semibold">Terkumpul</th>
              <th className="py-2 pr-3 text-right font-semibold">Sisa</th>
              <th className="py-2 pr-3 font-semibold">% capaian</th>
              <th className="py-2 text-right font-semibold">B2B</th>
            </tr>
          </thead>
          <tbody>
            {block.rows.map((r) => (
              <tr key={r.no} className="border-t border-line align-top">
                <td className="py-2 pr-3 font-medium text-ink">{r.airline}</td>
                <td className="py-2 pr-3 text-ink-2">{r.category}</td>
                <td className="num py-2 pr-3 text-right">{numText(r.target)}</td>
                <td className="num py-2 pr-3 text-right font-semibold"><Collected value={r.collected} /></td>
                <td className="num py-2 pr-3 text-right">{numText(r.remaining)}</td>
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2"><span className="w-20"><Bar pct={r.pct} /></span><Arrow pct={r.pct} /><span className="num text-xs">{pctText(r.pct)}</span></div>
                </td>
                <td className="num py-2 text-right">{numText(r.b2b)}</td>
              </tr>
            ))}
            <OutsideRows code={block.code} groups={outside} />
          </tbody>
          <tfoot>
            <tr className="border-t border-line-strong font-bold">
              <td className="py-2 pr-3" colSpan={2}>Total cabang {block.code}</td>
              <td className="num py-2 pr-3 text-right">{block.target}</td>
              <td className="num py-2 pr-3 text-right"><Collected value={block.target > 0 ? block.collected : null} /></td>
              <td className="num py-2 pr-3 text-right">{block.remaining}</td>
              <td className="num py-2 pr-3"><span className="flex items-center gap-1"><Arrow pct={block.pct} />{pctText(block.pct)}</span></td>
              <td className="num py-2 text-right">{block.b2b}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </details>
  );
}

export function TargetSampling({ targets, selectedAirports }: { targets: TargetData; selectedAirports: string[] }) {
  const codes = useMemo(() => new Set(selectedAirports.map(stationCode).filter(Boolean)), [selectedAirports]);
  const filtered = selectedAirports.length > 0;
  const blocks = useMemo(() => (filtered ? targets.blocks.filter((b) => codes.has(b.code)) : targets.blocks), [targets.blocks, codes, filtered]);
  const outside = useMemo(() => (filtered ? targets.outside.filter((g) => codes.has(g.code)) : targets.outside), [targets.outside, codes, filtered]);
  const outsideTotal = sumCount(outside);
  const [showOutside, setShowOutside] = useState(false);
  const outsideByCode = useMemo(() => {
    const map = new Map<string, OutsideGroup[]>();
    for (const g of targets.outside) map.set(g.code, [...(map.get(g.code) ?? []), g]);
    return map;
  }, [targets.outside]);
  // Stasiun yang punya respons tetapi tidak punya blok di panduan (mis. BDO) tetap ditampilkan sebagai blok merah.
  const orphanCodes = useMemo(() => {
    const known = new Set(targets.blocks.map((b) => b.code));
    return [...outsideByCode.keys()].filter((c) => c && !known.has(c) && (!filtered || codes.has(c))).sort();
  }, [outsideByCode, targets.blocks, filtered, codes]);
  const sum = useMemo(() => {
    const target = blocks.reduce((a, b) => a + b.target, 0);
    const collected = blocks.reduce((a, b) => a + b.collected, 0);
    return { target, collected, remaining: Math.max(0, target - collected), pct: target > 0 ? collected / target : null };
  }, [blocks]);

  if (targets.error) {
    return (
      <section className="card px-5 py-4 text-sm text-ink-2" aria-label="Target sampling">
        <p className="font-bold text-ink">Target sampling</p>
        <p className="mt-1">{targets.error} Bagian lain dashboard tetap berjalan.</p>
      </section>
    );
  }

  return (
    <section aria-label="Target sampling" className="card overflow-hidden">
      <CardHeader
        eyebrow="Target sampling"
        title="Target responden penumpang per cabang"
        description={`Sumber: sheet Target Sampling (dihitung dari seluruh respons, tidak terpengaruh filter periode, maskapai, rute, dan KPI). ${filtered ? "Menampilkan stasiun yang dipilih." : "Pilih Stasiun Bandara di atas untuk melihat satu atau beberapa cabang."}`}
      />
      <div className="grid grid-cols-2 gap-3 border-b border-line px-5 py-4 sm:grid-cols-4 sm:px-6">
        {[
          ["Target", String(sum.target), ""],
          ["Terkumpul", String(sum.collected), sum.collected === 0 && sum.target > 0 ? "text-crit" : "text-ink"],
          ["Sisa", String(sum.remaining), "text-ink"],
          ["% capaian", pctText(sum.pct), "text-ink"],
        ].map(([label, value, tone]) => (
          <div key={label}>
            <p className="eyebrow">{label}</p>
            <p className={`num flex items-center gap-1.5 text-2xl font-extrabold ${tone || "text-ink"}`}>
              {label === "% capaian" && <Arrow pct={sum.pct} />}
              {value}
            </p>
          </div>
        ))}
      </div>
      {blocks.length === 0 && orphanCodes.length === 0 && (
        <p className="px-5 py-6 text-sm text-muted sm:px-6">Stasiun yang dipilih tidak punya blok di panduan target sampling.</p>
      )}
      {blocks.map((b) => (
        <BlockTable key={`${b.code}-${blocks.length + orphanCodes.length <= 3}`} block={b} defaultOpen={blocks.length + orphanCodes.length <= 3} outside={outsideByCode.get(b.code) ?? []} />
      ))}
      {orphanCodes.map((c) => (
        <OutsideOnlyBlock key={`${c}-${blocks.length + orphanCodes.length <= 3}`} code={c} groups={outsideByCode.get(c) ?? []} defaultOpen={blocks.length + orphanCodes.length <= 3} />
      ))}

      {outsideTotal > 0 && (
        <div className="border-t border-warn-mark bg-warn-wash px-5 py-4 sm:px-6" role="note">
          <p className="flex items-start gap-2 text-sm font-bold text-warn">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={2.4} />
            <span>
              Di luar panduan target sampling: {outsideTotal} respons{filtered ? "" : ` dari ${targets.totalResponses}`}
            </span>
          </p>
          <p className="mt-1 text-xs text-ink-2">
            Respons ini tetap masuk perhitungan index dan seluruh dashboard, tetapi tidak dihitung ke kolom Terkumpul di atas.
          </p>
          <button
            type="button"
            onClick={() => setShowOutside((v) => !v)}
            aria-expanded={showOutside}
            className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-warn-mark bg-card px-3 text-xs font-semibold text-crit hover:bg-sunken"
          >
            <ChevronDown aria-hidden className={`size-3.5 transition-transform ${showOutside ? "rotate-180" : ""}`} />
            {showOutside ? "Sembunyikan data" : "Tampilkan data"}
          </button>
          {showOutside && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="text-xs text-muted">
                  <tr>
                    <th className="py-1.5 pr-3 font-semibold">Stasiun</th>
                    <th className="py-1.5 pr-3 font-semibold">Isian maskapai</th>
                    <th className="py-1.5 pr-3 font-semibold">Alasan</th>
                    <th className="py-1.5 text-right font-semibold">Respons</th>
                  </tr>
                </thead>
                <tbody>
                  {outside.map((g) => (
                    <tr key={`${g.code}|${g.airline}|${g.reason}`} className="border-t border-line">
                      <td className="py-1.5 pr-3 font-semibold">{g.code || "–"}</td>
                      <td className="py-1.5 pr-3">{g.airline}</td>
                      <td className="py-1.5 pr-3 text-ink-2">{OUTSIDE_REASON_LABEL[g.reason]}</td>
                      <td className="num py-1.5 text-right font-semibold">{g.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
