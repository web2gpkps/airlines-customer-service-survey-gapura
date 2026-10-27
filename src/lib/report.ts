import { applyFilters, type Filters } from "./filters";
import {
  computeNps,
  computeSurvey,
  meetsKpi,
  weeklyTrend,
  type NpsResult,
  type Response,
  type StatementResult,
  type SurveyResult,
} from "./scoring";
import type { DashboardData } from "./sheets";
import { SEGMENT_META, type Segment, type SegmentMeta } from "./survey-config";

export type CommentKey = "improve" | "best" | "suggestion";

const TRIVIAL = /^(ya|iya|tidak|tdk|no|yes|ok|oke|-|–|\.|n\/a|na|none|tidak ada|nothing)\.?$/i;

/** Jawaban terbuka yang berisi (bukan sekadar "ya"/"tidak"), terbaru lebih dulu. */
export function pickComments(responses: Response[], key: CommentKey) {
  return responses
    .map((r) => ({ r, text: r.comments[key].trim() }))
    .filter(({ text }) => text.length > 2 && !TRIVIAL.test(text))
    .sort((a, b) => b.r.submittedAt.localeCompare(a.r.submittedAt));
}

export function lowestStatements(result: SurveyResult, limit = 5): StatementResult[] {
  return result.sections
    .flatMap((s) => s.statements)
    .filter((s) => s.index !== null && !meetsKpi(s.index))
    .sort((a, b) => a.index! - b.index!)
    .slice(0, limit);
}

export interface SegmentReport {
  seg: Segment;
  meta: SegmentMeta;
  sheet: string;
  filterText: string;
  responses: Response[];
  result: SurveyResult;
  nps: NpsResult;
  trend: ReturnType<typeof weeklyTrend>;
}

export function buildSegmentReport(data: DashboardData, seg: Segment, filters: Filters): SegmentReport {
  const segment = data.segments[seg];
  const responses = applyFilters(segment.responses, filters);
  const filterText = [
    filters.month && `Periode ${filters.month}`,
    filters.airport && `Stasiun ${filters.airport}`,
    filters.airline && `Maskapai ${filters.airline}`,
    filters.flightType && `Jenis penerbangan ${filters.flightType}`,
    filters.route && `Rute ${filters.route}`,
    filters.kpi && `KPI ${filters.kpi === "met" ? "memenuhi standar" : "belum memenuhi"}`,
  ].filter(Boolean).join(" · ") || "Semua respons";
  return {
    seg,
    meta: SEGMENT_META[seg],
    sheet: segment.sheet,
    filterText,
    responses,
    result: computeSurvey(segment.sections, responses),
    nps: computeNps(responses),
    trend: weeklyTrend(segment.sections, responses),
  };
}
