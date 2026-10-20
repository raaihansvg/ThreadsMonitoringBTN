# Laporan Teknis Tahap 3F: Perbaikan Dari Uji Manual

**Tanggal**: 20 Oktober 2026  
**Cabang Git**: `tahap-3f-perbaikan` (bercabang dari commit `05edab7` pada `tahap-3e-koreksi`)  
**Status Pengujian**: **30 Test Files Lolos, 167 Tests Passed (100%)**  
**Integritas Kode**: 0 ESLint warnings/errors, Prettier terformat rapi, Build produksi sukses.

---

## 1. Latar Belakang & Ruang Lingkup

Tahap 3F merupakan fase penyempurnaan berdasarkan evaluasi dan pengujian manual komprehensif, murni melakukan koreksi bug dan penyesuaian fungsionalitas tanpa penambahan fitur baru di luar spesifikasi.

Terdapat 5 poin perbaikan utama:
1. **Lencana Draf dan Alert di Sidebar**: Sinkronisasi dengan filter `includeSample` (toggle Data Contoh).
2. **Kartu 4 Dashboard (Distribusi Per Topik)**: Penggabungan satu baris "Lainnya", jaminan keunikan React key, dan kesesuaian total hitungan.
3. **Ringkasan Mingguan**: Menjadi daftar maksimal 5 mention penting pekan berjalan (Senin WIB s/d hari ini) berurutan `PERLU_PERHATIAN` → `NEGATIF` → terbaru, dengan format Headline Post & Summary Post dan tombol Salin massal.
4. **Ekspor PDF**: Membuka dokumen laporan siap cetak di tab baru tanpa `window.print()` pada halaman web aplikasi utama.
5. **Analisis Cadangan (Kata Kunci)**: Fungsi bersama klien-server untuk membaca teks nyata, menentukan topik via `topicSelector`, sentimen leksikon Indonesia, eskalasi prioritas risiko, dan ekstraksi kata kunci.

---

## 2. Rincian Implementasi 5 Poin Perbaikan

### Poin 1: Lencana Draf dan Alert di Sidebar
* **Berkas yang Diubah**: `components/Sidebar.tsx`
* **Akar Masalah**: Panggilan fetch `/api/drafts` dan `/api/alerts?filter=unread` tidak meneruskan parameter `includeSample`. Akibatnya, saat Data Contoh dimatikan (`showSampleData = false`), lencana sidebar tetap menghitung data contoh.
* **Solusi**:
  - Mengambil `showSampleData` dari context `useApp()`.
  - Meneruskan `?includeSample=${showSampleData}` pada endpoint draf dan alert.
  - Memasukkan `showSampleData` ke dalam dependency array `useEffect`.
* **Pengujian**: `tests/integration/sidebar-badges-sample.test.ts` memverifikasi saat `includeSample=false` dan hanya ada data contoh di database, kedua lencana bernilai 0.

### Poin 2: Kartu 4 Dashboard (Satu "Lainnya" & Total Mention Cocok)
* **Berkas yang Diubah**: `components/dashboard/Card4SentimentByTopic.tsx`
* **Akar Masalah Duplikat**: Logika lama memotong `slice(0, 3)` untuk `mainTopics` dan mengambil sisa `otherTopics`. Jika topik `"Lainnya"` masuk di 3 besar dan ada topik ke-4 dst, kode melakukan `.push({ nama: "Lainnya", ... })` kedua. Hal ini menyebabkan:
  1. Peringatan React key ganda: `Encountered two children with the same key, 'Lainnya'`.
  2. Tampil dua baris terpisah dengan nama "Lainnya".
  3. Angka hitungan "Lainnya" terpecah menjadi dua bagian.
* **Solusi**: Dibuat fungsi utilitas murni `aggregateTopicsForCard4`:
  1. Menggabungkan duplikat nama yang sama (jika ada).
  2. Memisahkan topik spesifik dari entri "Lainnya".
  3. Mengurutkan topik spesifik berdasarkan hitungan tertinggi dan mengambil top 3.
  4. Menggabungkan sisa topik (ke-4 dst) bersama seluruh entri "Lainnya" menjadi **tepat satu** baris "Lainnya".
  5. Menjamin key unik dan jumlah baris sama persis dengan `totalMentions`.
* **Pengujian**: `tests/unit/card4-topics-aggregation.test.ts` memverifikasi penggabungan ini dengan berbagai skenario data.

### Poin 3: Ringkasan Mingguan (Daftar 5 Mention Penting & Salin)
* **Berkas yang Diubah**:
  - `app/api/dashboard/route.ts`
  - `components/dashboard/Card7WeeklySummaryQuickInput.tsx`
* **Solusi Teknis**:
  - **Backend**: Mengambil mention non-draf pada pekan berjalan (`tanggalDitemukan >= startOfWIBWeek`) sesuai toggle `includeSample`. Mengurutkan dengan prioritas:
    1. `prioritas = PERLU_PERHATIAN` (tertinggi)
    2. `sentimen = NEGATIF`
    3. `tanggalDitemukan` descending (terbaru)
    Mengambil maksimal 5 item teratas. Bila ringkasan kosong atau sama persis dengan headline, otomatis menggunakan 200 karakter pertama dari `teksPostingan`.
  - **Frontend**: Merender daftar kartu ringkas dengan label `Headline Post: ...` dan `Summary Post: ...`. Tombol "Salin Ringkasan" menyalin seluruh daftar secara terstruktur ke clipboard. Jika tidak ada data, menampilkan *"Belum ada data minggu ini"*.
* **Pengujian**: `tests/integration/weekly-summary-list.test.ts`.

### Poin 4: Ekspor PDF Dokumen Siap Cetak Mandiri
* **Berkas yang Diubah**: `components/SubHeader.tsx` dan `tests/integration/export.test.ts`
* **Akar Masalah**: Tombol PDF sebelumnya memanggil `window.print()` langsung pada browser di halaman web aplikasi utama, sehingga sidebar dan antarmuka aplikasi ikut tercetak.
* **Solusi**: Mengubah `handleExport` untuk membuka URL `/api/export?format=pdf&...` pada tab baru peramban (`window.open(url, "_blank")`).
* **Format Dokumen PDF/HTML**: Menghasilkan dokumen cetak bersih mandiri:
  - Kop surat resmi: *PT Bank Tabungan Negara (Persero) Tbk* & *Laporan Monitoring Media Sosial Threads (Social Listening & Analytics)*.
  - Tanggal cetak (WIB) & rentang tanggal aktif.
  - Filter aktif (Topik, Sentimen, Status Data Contoh).
  - Ringkasan metrik angka (Total Mention, Positif, Netral, Negatif, Perlu Perhatian).
  - Tabel mention lengkap (Draf dikecualikan, data contoh ber-badge `CONTOH`).
  - Gaya cetak `@page { size: A4 landscape; margin: 12mm; }`.
  - Tombol `"Cetak / Simpan PDF"` untuk memicu cetak dokumen tanpa app chrome.
* **Pengujian**: `tests/integration/export.test.ts`.

### Poin 5: Analisis Cadangan (Kata Kunci) Bersama Klien & Server
* **Berkas yang Ditambahkan / Diubah**:
  - `lib/analysis/fallbackAnalysis.ts` (Fungsi bersama baru)
  - `lib/analysis/stub.ts` (Provider stub menggunakan fungsi bersama)
  - `components/modals/ModalInput.tsx` (Klien form input)
  - `app/api/mentions/route.ts` (Server endpoint simpan mention)
  - `app/api/drafts/route.ts` (Server endpoint persetujuan draf)
* **Akar Masalah Nilai Statis**:
  State di `ModalInput.tsx` memiliki nilai bawaan statis `topik = "BTN Mobile"`, `sentimen = "NETRAL"`, `prioritas = "RUTIN"`, `kataKunciInput = "btn mobile, layanan"`. Handler `handleProceedToStep2` hanya menjalankan timer dummy 600ms tanpa pernah mengevaluasi teks postingan.
* **Solusi**:
  Mengimplementasikan fungsi bersama `analyzeFallback(text, topics)`:
  1. **Topik**: Memakai `selectTopic(text, topics)` (aturan kecocokan kata kunci terbanyak, urutan konfigurasi topik, dan fallback `"Lainnya"`).
  2. **Sentimen**: Memakai leksikon kata positif vs negatif bahasa Indonesia.
  3. **Prioritas**: Menetapkan `PERLU_PERHATIAN` bila sentimen `NEGATIF` **DAN** teks memuat kata kunci risiko (mis. `lenyap`, `17m`, `bobol`, `skandal`, `penipuan`, dll.), `PANTAU` untuk negatif umum, dan `RUTIN` untuk lainnya.
  4. **Kata Kunci**: Mengekstrak kata kunci topik, sentimen, dan risiko yang benar-benar cocok dari teks.
  5. **Headline & Ringkasan**: Dihasilkan secara proporsional dari teks asli.

---

## 3. Bukti Verifikasi 3 Kasus Teks Uji

Pengujian pada `tests/unit/fallback-keyword-analysis.test.ts` membuktikan keluaran yang tepat sesuai instruksi:

### Kasus A:
> **Teks**: `"KOK BISA UANG 17M LENYAP DI BANK BTN? SEKALI LAGI 17M WOIIII"`
* **Topik**: `"Lainnya"` *(tidak ada kata kunci produk, fallback ke Lainnya)*
* **Sentimen**: `"NEGATIF"` *(kata negatif: lenyap, woiiii)*
* **Prioritas**: `"PERLU_PERHATIAN"` *(sentimen negatif + kata kunci risiko lenyap & 17m)*
* **Kata Kunci**: `["lenyap", "17m", "bank btn", "woi", "woii", "woiii", "woiiii"]`

### Kasus B:
> **Teks**: `"boleh bagi info nya kak yg memilih kpp BTN daripada take over KPR bank lain?? terima kasih"`
* **Topik**: `"KPR BTN"` *(cocok kata kunci topik: kpr)*
* **Sentimen**: `"POSITIF"` *(kata apresiasi: terima kasih)*
* **Prioritas**: `"RUTIN"`
* **Kata Kunci**: `["kpr", "terima kasih", "memilih", "btn"]`

### Kasus C:
> **Teks**: `"Update terbaru BTN Mobile tampilannya makin modern dan responsif"`
* **Topik**: `"BTN Mobile"` *(cocok kata kunci topik: btn mobile, mobile)*
* **Sentimen**: `"POSITIF"` *(kata positif: modern, responsif)*
* **Prioritas**: `"RUTIN"`
* **Kata Kunci**: `["btn mobile", "mobile", "modern", "responsif", "btn"]`

---

## 4. Hasil Verifikasi Sistem

1. **Suite Pengujian Unit & Integrasi (`npm test`)**:
   ```text
   Test Files  30 passed (30)
        Tests  167 passed (167)
     Duration  16.12s (database: threads_monitoring_test)
   ```
2. **Pemeriksaan Linter (`npm run lint`)**:
   ```text
   ✔ No ESLint warnings or errors
   ```
3. **Pemeriksaan Gaya Kode Prettier (`npm run format:check`)**:
   ```text
   All matched files use Prettier code style!
   ```
4. **Verifikasi Build Produksi (`npm run build`)**:
   ```text
   ✓ Compiled successfully in 4.5s
   ✓ Generating static pages (8/8)
   ✓ Finalizing page optimization
   ```

---

## 5. Daftar Komit Atomik pada Cabang `tahap-3f-perbaikan`

1. `aafc621` - `fix(sidebar): sync draft and alert badge counts with includeSample toggle`
2. `7985e73` - `fix(dashboard): eliminate duplicate Lainnya in Card 4, guarantee unique keys and match total count`
3. `f2cbb27` - `feat(dashboard): show top 5 important mentions in weekly summary and support bulk copy`
4. `4c2cd41` - `fix(export): open printable PDF report document in new tab without app chrome`
5. `664dbe3` - `feat(analysis): unified fallback keyword analyzer for client and server with genuine sentiment and risk priority`
6. `9628f53` - `style: apply prettier formatting and clean up unused imports`
