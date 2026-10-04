import { readFileSync } from "node:fs";
import path from "node:path";
import { jsPDF } from "jspdf";
import { autoTable, type CellInput, type RowInput } from "jspdf-autotable";
import type { ReportScope } from "../filters";
import { formatDate, formatDateTime } from "../format";
import { buildSegmentReport, lowestStatements, pickComments, type SegmentReport } from "../report";
import { CATEGORIES, KPI_TARGET, categorize, formatIndex, meetsKpi, type StatusTone } from "../scoring";
import type { ServerDashboardData } from "../sheets";

type RGB = [number, number, number];
const INK: RGB = [21, 25, 29];
const INK2: RGB = [61, 67, 74];
const MUTED: RGB = [100, 106, 113];
const LINE: RGB = [226, 224, 216];
const SUNKEN: RGB = [243, 242, 238];
const TONE: Record<StatusTone, { text: RGB; fill: RGB }> = {
  good: { text: [11, 122, 59], fill: [230, 244, 234] },
  warning: { text: [138, 83, 0], fill: [253, 241, 216] },
  critical: { text: [180, 35, 24], fill: [253, 236, 235] },
};

const M = 14; // margin mm
const PAGE_W = 210;
const CONTENT_W = PAGE_W - M * 2;

/** Font standar PDF hanya mengenal WinAnsi; ganti karakter di luar itu. */
function t(s: string): string {
  return s
    .replace(/[−‒]/g, "-")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/[^\x00-\xFF–—‘’“”•…€™]/g, "");
}

function loadLogo(): string | null {
  try {
    const file = path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "logo-gapura.png");
    return `data:image/png;base64,${readFileSync(file).toString("base64")}`;
  } catch {
    return null;
  }
}

export function buildPdf(data: ServerDashboardData, scope: ReportScope): Buffer {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const logo = loadLogo();
  const reports = scope.segments.map((seg) => buildSegmentReport(data, seg, scope.filters[seg]));
  const has = (k: ReportScope["content"][number]) => scope.content.includes(k);
  // Objek posisi mencegah minifier membaca nilai lama saat text() dipanggil.
  const cur = { y: M };

  const ensure = (h: number) => {
    if (cur.y + h > 297 - 18) {
      doc.addPage();
      cur.y = 24;
    }
  };
  const text = (
    s: string,
    x: number,
    size: number,
    opts: { bold?: boolean; color?: RGB; maxW?: number; align?: "left" | "right" } = {},
  ) => {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...(opts.color ?? INK));
    const lines = doc.splitTextToSize(t(s), opts.maxW ?? CONTENT_W) as string[];
    doc.text(lines, x, cur.y, { align: opts.align ?? "left", baseline: "top" });
    return lines.length * size * 0.3528 * 1.25;
  };
  const heading = (s: string, sub?: string) => {
    ensure(22);
    cur.y += 2;
    cur.y += text(s, M, 13, { bold: true });
    if (sub) cur.y += text(sub, M, 9, { color: MUTED });
    cur.y += 2;
  };
  const table = (opts: Parameters<typeof autoTable>[1]) => {
    autoTable(doc, {
      startY: cur.y,
      margin: { left: M, right: M, top: 24, bottom: 18 },
      theme: "plain",
      styles: { font: "helvetica", fontSize: 8.5, textColor: INK, cellPadding: { top: 1.8, bottom: 1.8, left: 2, right: 2 }, lineColor: LINE },
      headStyles: { fillColor: INK, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
      bodyStyles: { lineWidth: { bottom: 0.2 } },
      ...opts,
    });
    cur.y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;
  };
  const status = (tone: StatusTone | undefined, label: string): CellInput =>
    tone
      ? { content: t(label), styles: { textColor: TONE[tone].text, fillColor: TONE[tone].fill, fontStyle: "bold" } }
      : "-";

  if (logo) doc.addImage(logo, "PNG", M, cur.y, 36, 19.5);
  cur.y += 32;
  cur.y += text("LAPORAN SURVEI KEPUASAN PELANGGAN", M, 8.5, { bold: true, color: MUTED });
  cur.y += 1;
  cur.y += text("AIRLINE CSS SURVEY DASHBOARD", M, 22, { bold: true });
  const dates = reports.flatMap((r) => r.responses.map((x) => x.date)).filter(Boolean).sort();
  if (dates.length) {
    cur.y += text(`Respons tanggal ${formatDate(dates[0], true)} sampai ${formatDate(dates[dates.length - 1], true)}`, M, 11, {
      color: INK2,
    });
  }
  cur.y += text(`Data Google Sheets per ${formatDateTime(data.fetchedAt)}`, M, 9, { color: MUTED });
  const testTotal = reports.reduce((count, report) => count + report.responses.filter((response) => response.isTestData).length, 0);
  if (testTotal) cur.y += text(`${testTotal} respons terindikasi uji tetap dihitung dalam index.`, M, 9, { color: TONE.warning.text });
  cur.y += 6;

  const cardW = CONTENT_W;
  reports.forEach((rep, i) => {
    const x = M + i * (cardW + 6);
    const idx = rep.result.overall.index;
    const cat = categorize(idx);
    doc.setDrawColor(...LINE);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, cur.y, cardW, 46, 2, 2, "FD");
    if (cat) {
      doc.setFillColor(...TONE[cat.tone].text);
      doc.rect(x, cur.y, cardW, 1.2, "F");
    }
    const save = cur.y;
    cur.y = save + 5.5;
    text("Airline Customer CSS Survey", x + 5, 10, { bold: true });
    text(`${rep.responses.length} respons`, x + cardW - 5, 8.5, { color: MUTED, align: "right" });
    cur.y = save + 13;
    text(formatIndex(idx), x + 5, 30, { bold: true });
    doc.setFontSize(30);
    const w = doc.getTextWidth(formatIndex(idx));
    cur.y = save + 18.5;
    text(cat?.label ?? "-", x + 8 + w, 12, { bold: true, color: cat ? TONE[cat.tone].text : MUTED });
    cur.y = save + 29;
    text(cat?.status ?? "Belum ada data", x + 5, 9, { bold: true, color: cat ? TONE[cat.tone].text : MUTED });
    cur.y = save + 36;
    text(rep.filterText, x + 5, 7.5, { color: MUTED, maxW: cardW - 10 });
    cur.y = save;
  });
  cur.y += 54;
  cur.y += text(`Standar KPI ${formatIndex(KPI_TARGET)} pada skala 1 sampai 5.`, M, 9, { color: MUTED });

  for (const rep of reports) {
    doc.addPage();
    cur.y = 24;
    cur.y += text("Airline Customer CSS Survey", M, 18, { bold: true });
    cur.y += text(rep.filterText, M, 9, { color: MUTED });
    cur.y += 3;

    if (!rep.responses.length) {
      cur.y += text("Tidak ada respons untuk pilihan ini.", M, 10, { color: MUTED });
      continue;
    }
    if (has("ringkasan")) summarySection(rep);
    if (has("bagian")) sectionsSection(rep);
    if (has("prioritas")) prioritySection(rep);
    if (has("tren")) trendSection(rep);
    if (has("rincian")) detailSection(rep);
    if (has("responden")) commentsSection(rep);
  }

  if (has("standar")) {
    doc.addPage();
    cur.y = 24;
    heading("Standar KPI dan cara menghitung index", "Standar minimum index kepuasan Airline adalah 4,50 pada skala Likert 1 sampai 5.");
    table({
      head: [["Rentang index", "Kategori", "Status"]],
      body: CATEGORIES.map((c) => [
        t(c.range),
        c.label,
        status(c.tone, c.tone === "warning" ? "Perlu Peningkatan / Belum Memenuhi Standar" : c.status),
      ]),
      columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 50 } },
    });
    for (const line of [
      "Index (1-5) = Total skor / Skor maksimum x 5",
      "Total skor adalah jumlah semua skor 1 sampai 5 yang diberikan responden.",
      "Skor maksimum adalah jumlah jawaban dikali 5.",
      "Index bagian dan index keseluruhan memakai total skor semua pernyataan di dalamnya.",
      "Pertanyaan yang tidak dijawab tidak ikut dihitung. Index dibulatkan 2 desimal sebelum kategorinya ditentukan.",
      "Pertanyaan bersyarat seperti transit dan lost & found hanya memengaruhi index bila dijawab.",
    ]) {
      ensure(6);
      cur.y += text(line, M, 9, { color: INK2 });
    }
  }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    if (p > 1) {
      if (logo) doc.addImage(logo, "PNG", M, 8, 16, 8.7);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...INK);
      doc.text("Airline Customer CSS Survey", M + 20, 13.5);
      doc.setDrawColor(...LINE);
      doc.line(M, 18.5, PAGE_W - M, 18.5);
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(t(`Data Google Sheets per ${formatDateTime(data.fetchedAt)}`), M, 297 - 9);
    doc.text(`Halaman ${p} dari ${pages}`, PAGE_W - M, 297 - 9, { align: "right" });
  }

  return Buffer.from(doc.output("arraybuffer"));


  function summarySection(rep: SegmentReport) {
    const { result, nps } = rep;
    const idx = result.overall.index;
    const cat = categorize(idx);
    const secWithData = result.sections.filter((s) => s.index !== null);
    const statements = result.sections.flatMap((s) => s.statements).filter((s) => s.index !== null);
    const testCount = rep.responses.filter((r) => r.isTestData).length;
    heading("Ringkasan");
    table({
      body: [
        ["Index keseluruhan", { content: `${formatIndex(idx)} / 5,00`, styles: { fontStyle: "bold", fontSize: 11 } }],
        ["Kategori", cat?.label ?? "-"],
        ["Status", status(cat?.tone, cat?.status ?? "-")],
        [
          "Selisih terhadap standar 4,50",
          idx === null ? "-" : `${idx - KPI_TARGET >= 0 ? "+" : "-"}${formatIndex(Math.abs(idx - KPI_TARGET))}`,
        ],
        ["Responden", String(result.respondents)],
        ...(testCount ? [["Respons terindikasi uji", `${testCount} (tetap dihitung dalam index)`]] : []),
        ["Bagian yang lolos KPI", `${secWithData.filter((s) => meetsKpi(s.index)).length} dari ${secWithData.length}`],
        ["Pernyataan di bawah 4,50", `${statements.filter((s) => !meetsKpi(s.index)).length} dari ${statements.length}`],
        [
          "Net Promoter Score",
          nps.score === null
            ? "Belum ada jawaban"
            : `${nps.score > 0 ? "+" : ""}${nps.score} (dari ${nps.n} jawaban: ${nps.promoters} promotor, ${nps.passives} pasif, ${nps.detractors} detraktor)`,
        ],
      ],
      columnStyles: { 0: { cellWidth: 62, textColor: INK2 } },
    });
    if (testCount) {
      cur.y += text("Penanda uji disimpulkan dari ID atau nama maskapai pada Google Sheets, bukan kolom penanda khusus.", M, 8.5, { color: MUTED });
    }
  }

  function sectionsSection(rep: SegmentReport) {
    heading("Index per bagian layanan", "Standar KPI 4,50.");
    table({
      head: [["Bagian", "Butir", "Jawaban", "Index", "Kategori", "Status KPI"]],
      body: rep.result.sections.map((s) => {
        const c = categorize(s.index);
        return [`${s.code}. ${t(s.title)}`, String(s.statements.length), String(s.n), formatIndex(s.index), c?.label ?? "-", status(c?.tone, c?.status ?? "-")];
      }),
      columnStyles: {
        1: { halign: "center", cellWidth: 14 },
        2: { halign: "center", cellWidth: 18 },
        3: { halign: "right", cellWidth: 16, fontStyle: "bold" },
        4: { cellWidth: 30 },
        5: { cellWidth: 40 },
      },
    });
  }

  function prioritySection(rep: SegmentReport) {
    const lowest = lowestStatements(rep.result);
    heading("Pernyataan dengan skor terendah", "Pernyataan yang belum mencapai 4,50, dari yang paling rendah.");
    if (!lowest.length) {
      cur.y += text("Semua pernyataan sudah mencapai standar KPI 4,50.", M, 9.5, { color: TONE.good.text });
      cur.y += 4;
      return;
    }
    table({
      head: [["#", "Pernyataan", "Bagian", "n", "Index", "Selisih"]],
      body: lowest.map((s, i) => [
        String(i + 1),
        t(s.text),
        s.sectionCode,
        String(s.n),
        formatIndex(s.index),
        { content: `-${formatIndex(KPI_TARGET - s.index!)}`, styles: { textColor: TONE[categorize(s.index)!.tone].text } },
      ]),
      columnStyles: {
        0: { cellWidth: 8 },
        2: { halign: "center", cellWidth: 16 },
        3: { halign: "center", cellWidth: 12 },
        4: { halign: "right", cellWidth: 16, fontStyle: "bold" },
        5: { halign: "right", cellWidth: 16 },
      },
    });
  }

  function trendSection(rep: SegmentReport) {
    const points = rep.trend.filter((p) => p.index !== null);
    heading("Index per minggu", "Minggu dihitung Senin sampai Minggu berdasarkan tanggal pengisian.");
    if (!points.length) {
      cur.y += text("Belum ada data bertanggal.", M, 9.5, { color: MUTED });
      cur.y += 4;
      return;
    }
    table({
      head: [["Minggu mulai", "Respons", "Index", "Status KPI"]],
      body: points.map((p) => {
        const c = categorize(p.index);
        return [formatDate(p.week, true), String(p.respondents), formatIndex(p.index), status(c?.tone, c?.status ?? "-")];
      }),
      columnStyles: { 1: { halign: "center" }, 2: { halign: "right", fontStyle: "bold" } },
    });
  }

  function detailSection(rep: SegmentReport) {
    heading("Rincian per pernyataan", "Jumlah responden yang memilih skor 1 sampai 5.");
    const body: RowInput[] = [];
    for (const s of rep.result.sections) {
      const c = categorize(s.index);
      body.push([
        {
          content: t(`${s.code}. ${s.title}   ·   index ${formatIndex(s.index)}   ·   ${c?.status ?? "belum ada data"}`),
          colSpan: 10,
          styles: { fillColor: SUNKEN, fontStyle: "bold" },
        },
      ]);
      for (const st of s.statements) {
        const sc = categorize(st.index);
        body.push([
          String(st.no),
          t(st.text),
          ...st.counts.map(String),
          String(st.n),
          formatIndex(st.index),
          sc ? { content: sc.label, styles: { textColor: TONE[sc.tone].text, fontStyle: "bold" } } : "-",
        ]);
      }
    }
    table({
      head: [["No", "Pernyataan", "1", "2", "3", "4", "5", "n", "Index", "Kategori"]],
      body,
      styles: { fontSize: 7.8 },
      columnStyles: {
        0: { cellWidth: 8 },
        2: { halign: "center", cellWidth: 7 },
        3: { halign: "center", cellWidth: 7 },
        4: { halign: "center", cellWidth: 7 },
        5: { halign: "center", cellWidth: 7 },
        6: { halign: "center", cellWidth: 7 },
        7: { halign: "center", cellWidth: 8 },
        8: { halign: "right", cellWidth: 12, fontStyle: "bold" },
        9: { cellWidth: 26 },
      },
    });
  }

  function commentsSection(rep: SegmentReport) {
    const groups: [string, ReturnType<typeof pickComments>][] = [
      ["Yang perlu diperbaiki", pickComments(rep.responses, "improve")],
      ["Yang paling berkesan", pickComments(rep.responses, "best")],
      ["Saran lainnya", pickComments(rep.responses, "suggestion")],
    ];
    if (groups.every(([, items]) => !items.length)) return;
    heading("Kata responden", "Jawaban tertulis, terbaru lebih dulu.");
    for (const [title, items] of groups) {
      if (!items.length) continue;
      table({
        head: [[title, "Tanggal", "Maskapai"]],
        body: items.slice(0, 15).map(({ r, text: c }) => [t(c), r.date ? formatDate(r.date) : "-", r.airline || "-"]),
        columnStyles: { 1: { cellWidth: 26 }, 2: { cellWidth: 30 } },
      });
    }
  }
}
