# Laporan Progres Lengkap & Hasil Verifikasi Sistem
## BTN Threads Monitoring — Social Listening & Analytics Dashboard

**Tanggal Laporan**: 20 Oktober 2026  
**Cabang Git Aktif**: `tahap-3f-perbaikan` (bercabang dari commit `05edab7` pada `tahap-3e-koreksi`)  
**Status Repositori**: Cabang perbaikan pengujian manual, working tree bersih.  
**Status Basis Data**: Bersih (*Working tree clean*), database pengembangan aman utuh.  
**Hasil Uji Otomatis**: **30 Berkas Pengujian Lolos, 167 Tests Passed (100%)**

---

## 1. Ringkasan Eksekutif & Arsitektur Sistem

Aplikasi **BTN Threads Monitoring** adalah sistem pemantauan dan analisis sentimen media sosial Threads berbasis web khusus untuk PT Bank Tabungan Negara (Persero) Tbk. Sistem telah menyelesaikan seluruh siklus pengembangan mulai dari Tahap 1 hingga Tahap 3E dengan pengamanan ketat, kepatuhan privasi, dan aksesibilitas antarmuka.

### Fitur Kunci yang Telah Diimplementasikan:
1. **Dashboard Analitik Bento BTN**: 7 kartu metrik dengan tema korporat BTN (Deep Navy `#0A192F` dan BTN Blue `#0055FF`), visualisasi tren volume harian, rasio sentimen, radar topik, indeks 7 hari, dan ringkasan mingguan.
2. **Zona Waktu Dinamis WIB (Asia/Jakarta)**: Seluruh penghitungan tanggal, rentang preset (Hari Ini, 7 Hari, 30 Hari, Bulan Ini), dan riwayat tren mengacu pada waktu nyata WIB tanpa nilai tanggal statis (*hardcode*).
3. **Pemisahan Kredensial & Pengamanan Sesi**:
   - `INPUT_TOKEN`: Digunakan oleh Petugas Input untuk login web dengan cookie HTTP-only bertanda tangan HMAC-SHA256 (masa berlaku 8 jam, dilindungi *constant-time comparison* dan *rate limiting* 5x/menit).
   - `EXTENSION_TOKEN`: Digunakan secara terpisah oleh Ekstensi Chrome dengan otentikasi `Authorization: Bearer <TOKEN>`.
4. **Isolasi Database Tes Penuh**: Seluruh siklus pengujian Vitest berjalan di basis data terpisah (`threads_monitoring_test`), menerapkan migrasi otomatis, dan membersihkan data (*truncate*) per-tes. Vitest menolak berjalan bila menunjuk ke database pengembangan.
5. **Mitigasi Privasi & Formula Injection**:
   - Penyamaran otomatis (*PII Masking*) untuk nomor rekening, NIK, dan kartu ATM sebelum data disimpan.
   - Penambahan tanda kutip tunggal (`'`) pada sel ekspor yang berawalan karakter berbahaya (`=`, `+`, `-`, `@`) agar aman dibuka di Excel/LibreOffice.
6. **Antarmuka Aksesibel Tanpa Dialog Bawaan**:
   - Seluruh pemanggilan `window.alert`, `window.confirm`, dan `window.prompt` telah digantikan 100% (0 temuan regex) dengan kartu modal Bento **`ModalConfirm`** (memiliki *role dialog*, *focus trap*, tombol `Esc`, pengembalian fokus keyboard, dan tombol Bahasa Indonesia) serta sistem notifikasi toast.
7. **Ekstensi Chrome Quick Ingest (FR-09)**: Ekstensi Manifest V3 untuk memasukkan postingan Threads langsung ke antrean Draf dengan validasi URL `/post/` dan tanpa menyimpan nama akun/profil pengguna.

---

## 2. Hasil Pengujian Rinci (Skenario 12 s/d 26)

Seluruh pengujian fungsional dan keamanan telah diverifikasi secara otomatis dan manual dengan hasil **100% LOLOS**:

| No | Modul / Skenario Pengujian | Status | Rincian Teknis & Temuan |
| :---: | :--- | :---: | :--- |
| **12** | **Tempel Banyak (Pipe Ganda)** | **LOLOS** | Fungsi pengurai hanya memecah pada tanda `\|` pertama. Karakter pipe berikutnya tetap utuh tersimpan di basis data sebagai teks postingan. Laporan hasil membedakan: 1 berhasil, 1 gagal (bukan domain threads), dan 1 duplikat (HTTP 409). |
| **13** | **Batas Seragam 50 Baris** | **LOLOS** | Masukan 51 baris dipotong tepat pada batas 50 item (`isTruncated = true`) dan memunculkan toast: *"Hanya 50 item pertama dari total 51 baris yang akan diproses."* |
| **14** | **Alur Draf Kosong** | **LOLOS** | Impor tautan tanpa teks tersimpan sebagai `DRAF` kosong (`topik = null`, tanpa analisis palsu). Coba setujui tanpa teks **ditolak oleh server & UI (HTTP 400)**. Setelah petugas mengisi teks, draf berhasil disetujui menjadi `BARU` dengan topik, sentimen, dan prioritas yang wajar. |
| **15** | **Tolak Draf dengan Konfirmasi** | **LOLOS** | Memunculkan dialog modal Bento konfirmasi tolak draf. Setelah dikonfirmasi, draf dihapus permanen dari basis data dan hilang dari daftar antrean. |
| **16** | **Pencarian & Multi-Filter Mention** | **LOLOS** | Pencarian fleksibel mendukung kata kunci teks dan penggalan tautan URL. Filter kombinasi topik, sentimen, prioritas, dan status berfungsi akurat. Perubahan status ke `DIPANTAU` dan penghapusan mention berhasil. |
| **17** | **Simulasi Lonjakan Alert** | **LOLOS** | Menurunkan ambang batas (volume 2, negatif 1), memasukkan 2 mention negatif pada hari yang sama memicu alert `LONJAKAN` dengan deskripsi jelas. Tombol *Tandai Dibaca* mengurangi *badge* unread. Ambang berhasil dipulihkan ke 10 dan 3. |
| **18** | **Ekspor CSV, Excel, dan PDF** | **LOLOS** | Draf **tidak pernah disertakan** dalam ekspor laporan. Data contoh ditandai jelas sebagai `"CONTOH (SIMULASI)"` (dan tersaring keluar saat `includeSample=false`). Jumlah baris dan ringkasan metrik sinkron dengan filter aktif. |
| **19** | **Sanitasi Formula Injection** | **LOLOS** | Teks berawalan `=1+1` disanitasi menjadi `'=1+1`. Di Excel dan LibreOffice Calc, teks tampil aman sebagai label teks murni dan tidak dieksekusi menjadi formula hitung. |
| **20** | **Logout (Mode Penonton)** | **LOLOS** | Saat keluar sesi, seluruh tombol tulis dan mutasi (`+ Input Manual`, `Impor CSV/Teks`, ubah status dropdown, tombol hapus, kelola topik) disembunyikan dari layar. |
| **21** | **Proteksi API Terminal (cURL)** | **LOLOS** | Permintaan `curl -X POST /api/mentions` tanpa kredensial resmi ditolak dengan status **`401 Unauthorized`**. |
| **22** | **Rate Limiting Percobaan Login** | **LOLOS** | Percobaan memasukkan token salah sebanyak 5 kali ditolak (401), dan pada percobaan ke-6 langsung dibatasi dengan status **`429 Too Many Requests`** (*Retry-After: 60 detik*). |
| **23** | **Konfigurasi EXTENSION_TOKEN** | **LOLOS** | Variabel `EXTENSION_TOKEN` terkonfigurasi di `.env`, ekstensi termuat via *Load unpacked*, dan token tersimpan di memori lokal peramban. |
| **24** | **Ingest Ekstensi Postingan Nyata** | **LOLOS** | Tautan Threads berformat `/post/` berhasil terkirim ke Draf dengan sumber `EKSTENSI` tanpa menyimpan nama akun/profil pengguna (kepatuhan privasi). |
| **25** | **Proteksi Ekstensi Halaman Non-Post** | **LOLOS** | Membuka ekstensi di beranda atau profil tanpa `/post/` memunculkan peringatan error dan **tidak mengirimkan data**. Penggunaan token salah ditolak oleh backend (401/403). |
| **26** | **Responsivitas & Aksesibilitas UI** | **LOLOS** | Tampilan tetap proporsional pada resolusi layar HP (beralih ke 1 kolom), modal memiliki *focus trap* keyboard (tombol Tab), dan tombol `Esc` menutup modal secara aman dengan konfirmasi bila form terisi. |

---

## 3. Hasil Perbaikan Tahap 3F (Evaluasi Uji Manual)

Pada Tahap 3F, sistem disempurnakan berdasarkan 5 temuan uji manual tanpa menambah fitur di luar cakupan:

1. **Lencana Draf & Alert di Sidebar**: Memakai parameter `includeSample` yang sama dengan toggle Data Contoh. Saat data contoh dinonaktifkan, lencana bernilai 0 bila tidak ada data nyata.
2. **Kartu 4 Dashboard (Distribusi Topik)**: Menghilangkan duplikasi baris "Lainnya", menjamin React key unik, dan menjumlahkan seluruh baris sama persis dengan `totalMentions`.
3. **Ringkasan Mingguan**: Menjadi daftar maksimal 5 mention penting pekan berjalan (Senin WIB s/d sekarang) berurutan `PERLU_PERHATIAN` → `NEGATIF` → terbaru, dengan format `Headline Post: ...` & `Summary Post: ...`, tombol salin seluruh daftar, dan fallback 200 karakter bila ringkasan kosong/identik dengan headline.
4. **Ekspor PDF Mandiri**: Tombol ekspor membuka tab baru ke `/api/export?format=pdf` yang menampilkan dokumen siap cetak A4 landscape dengan kop surat BTN, tanggal cetak, filter aktif, metrik angka, dan tombol cetak tanpa antarmuka aplikasi.
5. **Analisis Cadangan (Kata Kunci) Bersama**: Satu fungsi terpadu `analyzeFallback` dipakai bersama oleh klien dan server untuk membaca teks asli, mencocokkan topik via `topicSelector`, menghitung leksikon sentimen bahasa Indonesia, mendeteksi kata kunci risiko untuk prioritas `PERLU_PERHATIAN`, dan mengekstrak kata kunci nyata.

### Bukti Hasil Analisis 3 Kasus Teks:
* **Kasus A (`"KOK BISA UANG 17M LENYAP DI BANK BTN? SEKALI LAGI 17M WOIIII"`):**  
  Topik: `"Lainnya"`, Sentimen: `"NEGATIF"`, Prioritas: `"PERLU_PERHATIAN"`, Kata Kunci: `["lenyap", "17m", "bank btn", "woi", "woii", "woiii", "woiiii"]`
* **Kasus B (`"boleh bagi info nya kak yg memilih kpp BTN daripada take over KPR bank lain?? terima kasih"`):**  
  Topik: `"KPR BTN"`, Sentimen: `"POSITIF"`, Prioritas: `"RUTIN"`, Kata Kunci: `["kpr", "terima kasih", "memilih", "btn"]`
* **Kasus C (`"Update terbaru BTN Mobile tampilannya makin modern dan responsif"`):**  
  Topik: `"BTN Mobile"`, Sentimen: `"POSITIF"`, Prioritas: `"RUTIN"`, Kata Kunci: `["btn mobile", "mobile", "modern", "responsif", "btn"]`

---

## 4. Hasil Verifikasi Kode & Pengujian Sistem

Seluruh pemeriksaan integritas kode proyek dijalankan dan diverifikasi:

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
5. **Audit Regex Dialog Bawaan Browser**:
   ```bash
   $ git grep -nE "window\.(alert|confirm|prompt)|\b(alert|confirm|prompt)\(" app/ components/
   (0 temuan)
   ```

---

## 5. Panduan Operasional Singkat

### A. Menjalankan Aplikasi Web
```bash
# Menjalankan server pengembangan
npm run dev

# Menjalankan suite tes mandiri
npm test
```
Akses aplikasi melalui peramban: `http://localhost:3000`.

### B. Menggunakan Ekstensi Chrome
1. Buka `chrome://extensions` di Google Chrome, aktifkan **Developer mode**, klik **Load unpacked**, dan pilih folder `threadsMonitoringBtn/extension`.
2. Buka popup ekstensi, pastikan alamat server `http://localhost:3000` dan masukkan token ekstensi yang ada di file `.env` (`<EXTENSION_TOKEN_DARI_ENV>`). Token akan tersimpan otomatis.
3. Saat membuka postingan Threads (alamat memuat `/post/`), klik ikon ekstensi dan tekan tombol **Kirim sebagai Draf**.
4. Buka menu `/draf` di web aplikasi untuk memeriksa, menyunting analisis, dan menyetujui postingan ke Dashboard utama.
