// Tipe dan pembantu murni untuk target sampling. Aman diimpor komponen browser (tanpa google-auth-library).

export interface TargetRow {
  no: number;
  airline: string;
  category: string;
  target: number | null;
  collected: number | null;
  remaining: number | null;
  /** 0 sampai 1, null bila tanpa target penumpang. */
  pct: number | null;
  b2b: number | null;
  note: string;
}

export interface TargetBlock {
  code: string;
  summary: string;
  target: number;
  collected: number;
  remaining: number;
  pct: number | null;
  b2b: number;
  rows: TargetRow[];
}

export type OutsideReason = "no-block" | "b2b-only" | "airline-unlisted" | "no-station";

export interface OutsideGroup {
  /** Kode stasiun; kosong bila respons tidak punya kode. */
  code: string;
  airline: string;
  reason: OutsideReason;
  count: number;
}

export interface TargetData {
  blocks: TargetBlock[];
  outside: OutsideGroup[];
  /** Jumlah respons yang tercatat di sheet Tally dan jumlah yang di luar panduan. */
  totalResponses: number;
  outsideTotal: number;
  error?: string;
}

export const OUTSIDE_REASON_LABEL: Record<OutsideReason, string> = {
  "no-block": "Cabang tidak ada di panduan",
  "b2b-only": "Cabang khusus B2B (target 0)",
  "airline-unlisted": "Airline tidak ada di daftar cabang",
  "no-station": "Kode stasiun tidak terbaca",
};

export const stationCode = (airport: string): string => airport.match(/\(\s*([A-Za-z0-9]{3})\s*\)/)?.[1].toUpperCase() ?? "";
