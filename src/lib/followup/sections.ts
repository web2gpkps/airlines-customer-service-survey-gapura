/**
 * Menentukan kategori isu sebagai BAGIAN KUESIONER (Check-in & Dokumen, Boarding Gate, dst.).
 * Urutan keputusan:
 *  1. teks berisi keluhan → bagian "Delay, Pembatalan & Kendala Lain"
 *  2. ada butir bernilai rendah → bagian dengan butir rendah terbanyak (seri: rata-rata skor terendah)
 *  3. index di bawah standar tanpa butir rendah → bagian dengan rata-rata skor terendah
 *  4. hanya kritik atau saran → bagian yang paling cocok dengan kata kunci di teks
 */
import { normText } from "./classify";
import { KENDALA_CATEGORY, LOW_ITEM_MAX } from "./types";
import { OTHER_SECTION } from "../survey-config";

export interface SectionSpan {
  short: string;
  from: number; // indeks skor pertama (termasuk)
  to: number; // indeks skor terakhir (tidak termasuk)
}

export function spansOf(sections: { short: string; statements: unknown[] }[]): SectionSpan[] {
  let at = 0;
  return sections.map((s) => {
    const span = { short: s.short, from: at, to: at + s.statements.length };
    at = span.to;
    return span;
  });
}

const OVERALL = "Kepuasan Keseluruhan & Loyalitas";

/** Kata kunci → bagian. Yang paling spesifik lebih dulu (bagasi hilang masuk Lost and Found, bukan Penimbangan). */
const HINTS: [RegExp, string][] = [
  [/\b(lost|found|hilang|kehilangan|pir|rusak|kerusakan|dibanting)\b/, "Lost and Found"],
  [/\b(bagasi|baggage|luggage|koper|timbang\w*|kelebihan|overweight|excess|kasir|qris|struk|tag|label|kabin|cabin)\b/, "Penimbangan & Pembayaran Bagasi"],
  [/\b(delay\w*|terlambat|telat|molor|cancel\w*|batal|pembatalan|refund|rebooking|reschedule|jadwal|komplain|keluhan|kompensasi|compensation|kendala|masalah)\b/, KENDALA_CATEGORY],
  [/\b(transit|transfer|connecting|lanjutan|sambungan)\b/, "Transit / Transfer"],
  [/\b(gate|boarding|zona|prioritas|lansia|disabilitas|kursi roda|wheelchair|garbarata)\b/, "Boarding Gate"],
  [/\b(security|screening|keamanan|x-?ray|aman|barang terlarang|dilarang)\b/, "Keamanan & Kepatuhan Prosedur"],
  [/\b(check-?in|counter|loket|antri\w*|antrean|queue|dokumen\w*|tiket|ticket|verifikasi|kiosk|paspor|ktp|identitas)\b/, "Check-in & Dokumen"],
];

/** Bagian paling cocok untuk teks tanpa data skor; bila tak ada kata kunci, bagian umum (kepuasan keseluruhan). */
export function sectionFromText(text: string): string {
  const n = normText(text);
  for (const [re, section] of HINTS) if (re.test(n)) return section;
  return OVERALL;
}

export function pickSection(input: {
  spans: SectionSpan[];
  scores: (number | null)[];
  index: number | null;
  belowKpi: boolean;
  kendala: boolean;
  text: string;
}): string {
  const { spans } = input;
  const exists = (label: string) => spans.some((s) => s.short === label);
  const safe = (label: string) => (exists(label) ? label : OTHER_SECTION.short);

  if (input.kendala && exists(KENDALA_CATEGORY)) return KENDALA_CATEGORY;

  const stats = spans
    .map((s) => {
      const part = input.scores.slice(s.from, s.to).filter((v): v is number => v !== null);
      return {
        short: s.short,
        n: part.length,
        low: part.filter((v) => v <= LOW_ITEM_MAX).length,
        avg: part.length ? part.reduce((a, b) => a + b, 0) / part.length : Infinity,
      };
    })
    .filter((s) => s.n > 0);

  const lows = stats.filter((s) => s.low > 0).sort((a, b) => b.low - a.low || a.avg - b.avg);
  if (lows.length) return safe(lows[0].short);

  if (input.belowKpi && stats.length) return safe([...stats].sort((a, b) => a.avg - b.avg)[0].short);

  return safe(sectionFromText(input.text));
}
