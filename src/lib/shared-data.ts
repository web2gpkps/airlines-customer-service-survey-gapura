import { applyFilters, type ReportScope } from "./filters";
import type { DashboardData } from "./sheets";

/**
 * Data untuk halaman link bagikan. Filter diterapkan di server sebelum data dikirim ke browser,
 * jadi penerima hanya menerima respons yang masuk cakupan link. Komentar bebas ikut dibuang
 * bila "Kata responden" tidak dipilih.
 */
export function scopeDataForShare(data: DashboardData, scope: ReportScope): DashboardData {
  const keepComments = scope.content.includes("responden");
  const airline = data.segments.airline;
  const responses = applyFilters(airline.responses, scope.filters.airline).map((r) =>
    keepComments ? r : { ...r, comments: { best: "", improve: "", suggestion: "" } },
  );
  return { fetchedAt: data.fetchedAt, segments: { airline: { ...airline, responses } } };
}
