export type Segment = "airline";

export interface SegmentMeta {
  id: Segment;
  label: string;
  audience: string;
  sheet: string;
}

export const SEGMENT_META: Record<Segment, SegmentMeta> = {
  airline: { id: "airline", label: "Airline", audience: "Penumpang", sheet: process.env.SHEET_AIRLINE || "CSS Airline Tally" },
};

export const SEGMENT_IDS: Segment[] = ["airline"];

export interface SectionCatalogEntry {
  code: string;
  title: string;
  short: string;
  statements: string[];
}

// Judul bagian tidak ada di sheet; teks pernyataan menjaga pemetaan saat kolom dipindah.
export const SECTION_CATALOG: Record<Segment, SectionCatalogEntry[]> = {
  airline: [
    {
      code: "A", title: "Check-in dan Dokumen", short: "Check-in",
      statements: [
        "Petugas check-in counter menyambut saya dengan ramah dan sopan",
        "Antrean check-in tidak terlalu lama sesuai kondisi jam keberangkatan",
        "Proses verifikasi tiket dan dokumen identitas berjalan cepat dan tidak berbelit",
        "Saya tidak perlu menjelaskan dokumen/persyaratan yang sama berulang kali",
        "Petugas menjelaskan dengan jelas jika ada dokumen tambahan yang saya perlukan (mis. kondisi kesehatan khusus)",
      ],
    },
    {
      code: "B", title: "Bagasi dan Biaya", short: "Bagasi",
      statements: [
        "Proses penimbangan bagasi dilakukan secara terbuka dan saya dapat melihat hasil timbangan dengan jelas",
        "Saya sudah mengetahui estimasi biaya kelebihan bagasi sebelum tiba di counter (mis. lewat email/app)",
        "Jika terdapat kelebihan bagasi, biaya yang saya bayar sesuai dengan tarif resmi yang berlaku",
        "Saya diarahkan membayar kelebihan bagasi hanya melalui kasir resmi/QRIS resmi maskapai, bukan secara personal ke petugas",
        "Saya menerima bukti/struk pembayaran resmi atas kelebihan bagasi yang saya bayarkan",
        "Label/tag bagasi saya terpasang dengan benar dan sesuai dengan penerbangan saya",
        "Bagasi khusus saya (mis. alat olahraga, mobility aids, alat musik) ditangani dengan hati-hati",
      ],
    },
    {
      code: "C", title: "Boarding dan Gate", short: "Boarding",
      statements: [
        "Informasi gate dan waktu boarding jelas dan mudah saya temukan",
        "Proses verifikasi boarding pass &amp; identitas di gate berjalan cepat, tanpa antrean panjang",
        "Petugas menerapkan prioritas boarding secara adil dan konsisten (lansia, keluarga dengan bayi, disabilitas)",
        "Saya tidak mengalami kebingungan terkait zona/grup boarding",
        "Petugas gate bersikap profesional dan responsif terhadap pertanyaan saya",
      ],
    },
    {
      code: "D", title: "Transit dan Transfer", short: "Transit",
      statements: [
        "Saya diarahkan dengan jelas menuju gate lanjutan atau area transfer",
        "Saya tidak khawatir tertinggal penerbangan lanjutan saat transit singkat",
        "Proses transfer bagasi (through check-in) saat transit berjalan lancar tanpa saya perlu mengurus ulang",
        "Petugas transfer desk siap membantu begitu saya turun dari pesawat",
      ],
    },
    {
      code: "E", title: "Gangguan dan Komplain", short: "Gangguan",
      statements: [
        "Saya menerima informasi delay/perubahan jadwal secara cepat dan jelas",
        "Petugas menjelaskan hak-hak saya sebagai penumpang sesuai peraturan yang berlaku",
        "Proses rebooking/reprotection (jika diperlukan) dilakukan dengan cepat dan tidak berbelit",
        "Jika saya menyampaikan komplain, keluhan saya didengarkan dengan serius dan empati",
        "Saya menerima update perkembangan penanganan kendala hingga selesai",
      ],
    },
    {
      code: "F", title: "Lost & Found", short: "Lost & Found",
      statements: [
        "Lokasi counter Lost &amp; Found mudah ditemukan",
        "Proses pelaporan kehilangan/kerusakan bagasi (PIR) singkat dan tidak berbelit",
        "Saya mendapat nomor referensi sebagai bukti laporan",
        "Saya menerima update status pencarian bagasi secara berkala tanpa harus menghubungi berulang kali",
        "Bagasi saya diantar/dikembalikan tepat waktu setelah ditemukan",
      ],
    },
    {
      code: "G", title: "Keamanan", short: "Keamanan",
      statements: [
        "Saya memahami barang-barang yang dilarang dibawa sebelum tiba di security check point",
        "Proses screening keamanan berjalan lancar dan petugas bersikap sopan meski prosedurnya ketat",
        "Saya merasa aman selama berada di area bandara maupun di sekitar pesawat",
      ],
    },
    {
      code: "H", title: "Kepuasan dan Loyalitas", short: "Kepuasan",
      statements: [
        "Secara keseluruhan, saya puas dengan layanan ground handling yang saya terima",
        "Petugas ground handling bersikap profesional di sepanjang perjalanan saya",
        "Saya percaya proses check-in dan penanganan bagasi dilakukan secara jujur dan transparan",
        "Saya akan tetap menggunakan maskapai ini untuk perjalanan berikutnya",
      ],
    },
  ],
};

export const OTHER_SECTION = { code: "•", title: "Pernyataan lainnya", short: "Lainnya" };
