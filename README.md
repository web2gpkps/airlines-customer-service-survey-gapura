# AIRLINE CSS SURVEY DASHBOARD

Dashboard indeks kepuasan pelanggan maskapai dari tab `CSS Airline Tally` di [Google Sheets](https://docs.google.com/spreadsheets/d/1co2q6Xt0co2yoOyLN_vFE1FtWFlqyECdRGqMMVFNKfg/edit). Aplikasi membaca data dengan service account Google yang hanya memiliki akses baca. Judul halaman untuk Vercel: **Airline Customer CSS Survey**.

## Menjalankan

1. Salin `.env.example` menjadi `.env`.
2. Isi `GOOGLE_SERVICE_ACCOUNT` dengan service account yang sudah diberi akses Viewer ke spreadsheet. `GOOGLE_SHEET_ID` sudah menunjuk ke sheet Airline.
3. Jalankan `npm ci`, lalu `npm run dev`.

Periksa dengan `npm run typecheck` dan `npm run build` sebelum memasang di Vercel. Di Vercel, isi `GOOGLE_SERVICE_ACCOUNT` dan `GOOGLE_SHEET_ID` sebagai environment variables. Judul halaman sudah diatur menjadi **Airline Customer CSS Survey**.

## Data dan perhitungan

Satu tab sumber berisi identitas respons, waktu pengisian, profil perjalanan, 38 pertanyaan Likert, satu pertanyaan rekomendasi 0–10, dan tiga kolom komentar. Pertanyaan Likert dikelompokkan menjadi check-in, bagasi dan biaya, boarding, transit, gangguan dan komplain, Lost & Found, keamanan, serta kepuasan dan loyalitas. Pengelompokan ini didasarkan pada urutan dan isi header karena sheet tidak memiliki nama bagian tersendiri. Header baru yang belum dikenal tetap dihitung dalam **Pernyataan lainnya**.

Indeks adalah rata-rata semua jawaban Likert 1–5 yang terisi, dibulatkan dua desimal sebelum kategori ditentukan. Nilai kosong tidak ikut dalam pembagi. KPI minimum **4,50** berlaku untuk indeks keseluruhan, bagian, dan pernyataan.

| Indeks | Kategori | Status |
|---|---|---|
| ≤ 1,00 | Sangat tidak puas | Belum memenuhi standar |
| 1,01–2,00 | Tidak puas | Belum memenuhi standar |
| 2,01–3,00 | Cukup / netral | Belum memenuhi standar |
| 3,01–4,49 | Puas | Perlu peningkatan / belum memenuhi standar |
| 4,50–5,00 | Sangat puas | Memenuhi standar KPI |

NPS dihitung terpisah dari indeks Likert. Filter memakai waktu `Submitted at`, maskapai, jenis penerbangan, tujuan perjalanan, dan rute bila tersedia. Bagian yang tidak punya sumber data disembunyikan.

## Arah tampilan

Tampilan mengikuti dashboard Joumpa milik Gapura. Hijau dan lime berasal dari logo Gapura; warna status membantu membedakan hasil KPI dan selalu disertai teks. Plus Jakarta Sans dipakai agar pernyataan panjang mudah dibaca, sedangkan IBM Plex Mono menjaga angka dan metadata mudah dipindai. Ringkasan ditempatkan sebelum indeks bagian dan rincian agar pengguna dapat melihat status lalu mencari penyebabnya. Kartu dan jarak antarkelompok memisahkan ringkasan dari bukti pernyataan. Motif garis halus pada header merujuk jalur landasan, terbatas pada header agar isi survei tetap dominan. Gerak hanya dipakai saat elemen masuk atau nilai batang berubah.

Seluruh respons yang terbaca dari sheet diperlakukan sebagai data survei. Pertanyaan kondisional seperti transit dan Lost & Found hanya memengaruhi indeks bila dijawab.

## Halaman dan ekspor

| Rute | Fungsi |
|---|---|
| `/` | Dashboard dengan filter dan rincian survei. |
| `/presentasi` | Laporan satu halaman yang dapat dibagikan lewat URL. |
| `/api/export?format=pdf` | Unduh laporan PDF sesuai cakupan URL. |
| `/api/export?format=xlsx` | Unduh sheet sumber terfilter, rekap dengan rumus, dan tabel standar KPI. |

Dashboard mengambil ulang data tiap dua menit selama terbuka, halaman presentasi tiap lima menit. Server menyimpan hasil baca Sheets selama 60 detik. Tombol **Muat ulang** melewati cache tersebut.
