export type Segment = "b2c" | "b2b";

export interface SegmentMeta {
  id: Segment;
  label: string;
  audience: string;
  sheet: string;
}

export const SEGMENT_META: Record<Segment, SegmentMeta> = {
  b2c: { id: "b2c", label: "B2C", audience: "Penumpang", sheet: process.env.SHEET_B2C || "B2C CSS Tally" },
  b2b: { id: "b2b", label: "B2B", audience: "Mitra Bisnis", sheet: process.env.SHEET_B2B || "B2B CSS Tally" },
};

export const SEGMENT_IDS: Segment[] = ["b2c", "b2b"];

/**
 * Pengelompokan pernyataan ke bagian kuesioner.
 *
 * Sheet Tally hanya berisi teks pernyataan, tanpa nama bagiannya. Katalog ini
 * dipakai sebatas untuk memberi label bagian. Daftar, urutan, dan jumlah
 * pernyataan tetap dibaca dari header sheet; pernyataan yang tidak ada di
 * katalog masuk ke kelompok "Pernyataan lainnya".
 */
export interface SectionCatalogEntry {
  code: string;
  title: string;
  short: string;
  statements: string[];
}

export const SECTION_CATALOG: Record<Segment, SectionCatalogEntry[]> = {
  b2c: [
    {
      code: "B",
      title: "Tahap Reservasi",
      short: "Reservasi",
      statements: [
        "Proses reservasi mudah dilakukan melalui kanal pilihan saya (email/telepon/website)",
        "Saya tidak perlu mengulang informasi yang sama saat berpindah kanal komunikasi",
        "Petugas reservasi merespons dengan cepat",
        "Petugas menjelaskan ketentuan force majeure (kebijakan pembatalan/biaya) dengan jelas sejak awal",
        "Saya menerima email konfirmasi reservasi tepat waktu",
        "Isi email konfirmasi lengkap dan mudah dipahami (jadwal, jenis layanan, nama petugas)",
        "Saya sudah mengetahui estimasi biaya tambahan (mis. kelebihan bagasi) sebelum tiba di bandara",
      ],
    },
    {
      code: "C",
      title: "Tahap Keberangkatan",
      short: "Keberangkatan",
      statements: [
        "Petugas Joumpa sudah siap menyambut saya tepat waktu di drop zone",
        "Saya mudah dikenali/ditemukan oleh petugas (paging name)",
        "Petugas menyambut dengan ramah dan sopan",
        "Bantuan penanganan bagasi dilakukan dengan hati-hati dan meminta izin terlebih dahulu",
        "Saya didampingi dengan baik selama proses check-in di counter maskapai",
        "Informasi biaya tambahan bagasi (jika ada) tidak mengejutkan saya di counter",
        "Ruang tunggu / lounge yang disediakan nyaman sesuai fasilitas",
        "Layanan transportasi ke/dari bandara tersedia tanpa menunggu lama",
        "Proses pembayaran dan penyelesaian layanan (end of service) berjalan cepat dan jelas",
      ],
    },
    {
      code: "D",
      title: "Tahap Transit / Transfer",
      short: "Transit / Transfer",
      statements: [
        "Saya didampingi penuh oleh petugas selama proses transit",
        "Saya tidak khawatir tertinggal penerbangan lanjutan",
        "Proses pengambilan bagasi/through check-in saat transit berjalan lancar",
        "Transportasi antar-terminal (jika diperlukan) tersedia tepat waktu",
      ],
    },
    {
      code: "E",
      title: "Tahap Kedatangan",
      short: "Kedatangan",
      statements: [
        "Petugas Joumpa sudah hadir tepat waktu di area penjemputan (pick-up area)",
        "Saya mudah menemukan petugas melalui paging board/name",
        "Saya disambut secara personal (disebut nama) dan hangat",
        "Petugas membantu pengambilan bagasi di conveyor belt dengan baik",
        "Perbincangan/personal service petugas selama pendampingan terasa nyaman dan sopan",
        "Pendampingan menuju customs declaration/X-Ray berjalan lancar",
        "Transportasi lanjutan (limousine/hotel/mitra) sudah siap tanpa menunggu lama",
        "Bagasi dimuat dengan lengkap dan benar ke kendaraan",
      ],
    },
    {
      code: "F",
      title: "Penanganan Kendala / Irregularity",
      short: "Penanganan kendala",
      statements: [
        "Kendala saya ditangani dengan serius dan cepat oleh petugas",
        "Saya mendapat informasi/update perkembangan penanganan hingga selesai",
        "Saya tidak perlu mengurus masalah sendiri ke berbagai pihak",
        "Jika saya menyampaikan komplain, keluhan saya didengarkan dengan empati",
        "Saya menerima permohonan maaf dan solusi/tindak lanjut resmi dari manajemen",
        "Waktu penyelesaian kendala/komplain sesuai harapan saya",
      ],
    },
    {
      code: "G",
      title: "Keamanan & Kepatuhan Prosedur",
      short: "Keamanan",
      statements: [
        "Saya memahami prosedur keamanan/deklarasi barang khusus (mis. senjata api/security item) sejak sebelum tiba di bandara",
        "Proses screening keamanan berjalan lancar dengan pendampingan petugas",
      ],
    },
    {
      code: "H",
      title: "Kepuasan Keseluruhan & Loyalitas",
      short: "Kepuasan keseluruhan",
      statements: [
        "Secara keseluruhan, saya puas dengan layanan JOUMPA yang saya terima",
        "Petugas Joumpa bersikap profesional di sepanjang perjalanan saya",
        "Layanan JOUMPA memberikan nilai lebih dibandingkan menggunakan layanan bandara reguler",
      ],
    },
  ],
  b2b: [
    {
      code: "B",
      title: "Reservasi & Koordinasi Awal",
      short: "Reservasi & koordinasi",
      statements: [
        "Proses reservasi/permintaan layanan melalui kanal yang tersedia (email/telepon/website/JMS) mudah dan efisien",
        "Data yang kami sampaikan tidak perlu diinput ulang saat berpindah kanal komunikasi dengan JOUMPA",
        "Petugas reservasi JOUMPA merespons permintaan kami dengan cepat dan sesuai kesepakatan waktu layanan",
        "Konfirmasi tertulis (email/dokumen resmi) diterima tepat waktu dan berisi informasi yang lengkap",
        "Ketentuan force majeure, kebijakan pembatalan, dan estimasi biaya tambahan dikomunikasikan secara jelas sejak awal",
      ],
    },
    {
      code: "C",
      title: "Kualitas Layanan Operasional & Kepatuhan SLA",
      short: "Operasional & SLA",
      statements: [
        "Petugas JOUMPA di lapangan hadir tepat waktu sesuai jadwal yang disepakati (drop zone/pick-up area)",
        "Petugas JOUMPA bersikap profesional, rapi, dan sesuai standar layanan yang disepakati dalam kontrak",
        "Penanganan penumpang/tamu kami (bagasi, pendampingan check-in, transit, kedatangan) berjalan sesuai prosedur",
        "JOUMPA konsisten memenuhi indikator kinerja (KPI/SLA) yang telah disepakati bersama",
        "Ketersediaan transportasi mitra (jika relevan) dapat dipastikan tepat waktu tanpa hambatan koordinasi",
      ],
    },
    {
      code: "D",
      title: "Komunikasi & Koordinasi Real-Time",
      short: "Komunikasi real-time",
      statements: [
        "JOUMPA menginformasikan perubahan jadwal (ETA/delay/reschedule) kepada kami secara real-time",
        "Kanal komunikasi antara tim operasional kami dan petugas lapangan JOUMPA responsif dan mudah diakses",
        "Notifikasi terkait status tamu/penumpang (nama, waktu, kendaraan, jumlah bagasi) kami terima secara akurat dan tepat waktu",
        "Koordinasi lintas unit (mis. imigrasi, bea cukai, ground handling lain) berjalan lancar tanpa membebani pihak kami",
      ],
    },
    {
      code: "E",
      title: "Penanganan Irregularity & Komplain",
      short: "Irregularity & komplain",
      statements: [
        "Insiden/irregularity (bagasi, keterlambatan, kesalahan data, dsb.) dilaporkan kepada kami secara proaktif dan tepat waktu",
        "JOUMPA menindaklanjuti setiap kasus hingga tuntas dan memberikan update perkembangan secara berkala",
        "Apabila kami menyampaikan komplain, keluhan kami ditanggapi dengan cepat, serius, dan profesional",
        "Kami menerima tindak lanjut resmi (surat/laporan investigasi/corrective action) dalam batas waktu yang wajar",
        "Tindakan korektif dan preventif yang diberikan JOUMPA efektif mencegah terulangnya insiden serupa",
      ],
    },
    {
      code: "F",
      title: "Pelaporan, Dokumentasi & Administrasi",
      short: "Pelaporan & administrasi",
      statements: [
        "Laporan operasional (Handling Report, Service Delivered Form, log book, dsb.) akurat dan mudah diverifikasi",
        "Proses invoicing/penagihan berjalan tepat waktu dan sesuai dengan layanan yang diberikan",
        "Dokumentasi bukti serah terima (bagasi, layanan selesai, dsb.) lengkap dan dapat diandalkan sebagai referensi",
      ],
    },
    {
      code: "G",
      title: "Hubungan Kemitraan & Account Management",
      short: "Hubungan kemitraan",
      statements: [
        "Tim Account Management JOUMPA responsif terhadap kebutuhan dan pertanyaan kami",
        "JOUMPA terbuka terhadap masukan dan bersedia melakukan perbaikan berkelanjutan",
        "Pertemuan evaluasi/review kinerja (jika ada) dilakukan secara berkala dan konstruktif",
        "Secara keseluruhan, JOUMPA merupakan mitra ground handling/concierge yang dapat diandalkan",
      ],
    },
  ],
};

export const OTHER_SECTION = { code: "•", title: "Pernyataan lainnya", short: "Lainnya" };
