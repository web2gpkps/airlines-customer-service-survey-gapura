const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const MONTHS_LONG = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export function formatDate(iso: string, long = false) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m) return iso;
  return `${d ? `${d} ` : ""}${(long ? MONTHS_LONG : MONTHS)[m - 1]} ${y}`;
}

export function formatMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS_LONG[m - 1]} ${y}`;
}

export function formatDateTime(iso: string) {
  const s = new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));
  return `${s} WIB`;
}

export function stationLabel(code: string, airports: Record<string, string>) {
  const name = airports[code]?.split(",")[0];
  return name ? `${code} · ${name}` : code;
}
