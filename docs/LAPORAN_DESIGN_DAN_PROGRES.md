# LAPORAN KOMPREHENSIF DESAIN DAN KESELURUHAN PROGRES SISTEM
## BTN Threads Monitoring — Dashboard Social Listening Bank BTN

**Tanggal Laporan:** 17 Oktober 2026  
**Status Proyek:** Tahap 0 (Scaffold & Basis Data) dan Implementasi UI/UX Penuh Selesai  
**Acuan Spesifikasi:** `docs/SRS.md` (v0.2) dan `docs/DESIGN.md` (v0.3)  
**Tautan Dokumen Terkait:** [SRS.md](file:///home/remoniceguy/Documents/threadsMonitoringBtn/docs/SRS.md) · [DESIGN.md](file:///home/remoniceguy/Documents/threadsMonitoringBtn/docs/DESIGN.md)

---

## 1. Ringkasan Eksekutif (Executive Summary)

Aplikasi **BTN Threads Monitoring** dibangun sebagai dashboard social listening terpusat untuk memantau, menganalisis sentimen, dan mengelola perbincangan publik di platform Threads yang relevan dengan Bank BTN. 

Proyek ini telah menuntaskan dua tonggak pencapaian besar:
1. **Tahap 0 (Scaffold & Kerangka Proyek)**: Setup arsitektur modern Next.js 15 (App Router), TypeScript, Tailwind CSS, Prettier, ESLint, serta Prisma ORM dengan PostgreSQL yang terisolasi dan memiliki skrip seed data sintetis.
2. **Implementasi UI/UX & Fitur Lengkap Sesuai DESIGN.md**: Mengadopsi tata letak **Modern Bento Grid** beridentitas Bank BTN yang bersih, formal, dan ergonomis. Seluruh kartu analitik, alur input cepat 2 langkah, penyamaran PII, deteksi duplikasi, antrean draf dengan penyuntingan inline, sistem alert lonjakan, dan manajemen data contoh telah berfungsi secara terintegrasi dengan basis data.

---

## 2. Kepatuhan Design System & Aturan Penulisan (Rule Compliance)

Implementasi antarmuka secara ketat memenuhi seluruh aturan wajib pada Bagian 0 dan Bagian 1 `docs/DESIGN.md`:

| Aturan | Ketentuan Desain | Status Implementasi |
|---|---|---|
| **Rule 0.1** | Dilarang menampilkan ID requirement (FR-xx, BR-xx, NFR-xx) di antarmuka pengguna. | **100% Patuh** — Seluruh kode UI telah dibersihkan dari ID teknis (termasuk penghapusan label `(BR-09)` pada halaman Alert). |
| **Rule 0.2** | Semua angka wajib dihitung dari database, tidak boleh di-hardcode. | **100% Patuh** — Seluruh metrik berasal dari endpoint `/api/dashboard`, `/api/mentions`, `/api/drafts`, dan `/api/alerts`. |
| **Rule 0.3** | Standar Bahasa Indonesia, format angka `id-ID` (`1.500`, `64,5%`), format tanggal `17 Okt 2026`. | **100% Patuh** — Diterapkan pada seluruh formatting tampilan angka dan tanggal. |
| **Rule 0.4** | Tidak menampilkan nomor versi internal di UI. | **100% Patuh** — Tidak ada string versi internal yang bocor ke komponen visual. |
| **Zero Emoji** | Dilarang memakai emoji Unicode. Semua indikator visual menggunakan ikon garis `lucide-react` (`strokeWidth={2}`). | **100% Patuh** — Menggunakan ikon konsisten (`Activity`, `MessageSquare`, `FolderKanban`, `ShieldAlert`, `Settings`, `AlertTriangle`, `ShieldCheck`). |
| **Role-Aware UI** | Kontrol tulis (input, impor, edit draf, hapus, setujui) hanya dapat dieksekusi oleh Petugas dengan validasi sesi cookie `httpOnly`. | **100% Patuh** — Mode Penonton bersifat read-only dengan indikator terkunci yang ramah pengguna. |
| **Transparansi Data** | Tidak ada klaim real-time palsu. Subjudul halaman menegaskan sifat data yang dicatat petugas. | **100% Patuh** — Subjudul tetap: *"Data berasal dari tautan yang dicatat petugas, bukan pemantauan real-time."* |

---

## 3. Komponen Global dan Tata Letak Bento Grid

### 3.1 Wadah Utama (Outer Frame & Bento Well)
- **Outer Canvas (`bg-[#E4E9F2]`)**: Latar belakang abu-abu kebiruan netral yang membingkai aplikasi.
- **Bingkai Utama (`max-w-[1440px] rounded-[36px] bg-[#F4F7FB] border border-white shadow-2xl`)**: Menghadirkan kesan software perbankan premium.
- **Bento Well (`rounded-[32px] bg-[#E9EEF6]/70 p-4 md:p-6 border border-white`)**: Wadah dalam kartu yang memberikan efek kedalaman visual asimetris khas Bento Grid modern.

### 3.2 Top Header Bar
- **Brand Pill Bank BTN**: Kapsul putih dengan logo vektor SVG presisi Bank BTN (huruf `btn` warna Electric Blue `#0055FF` dengan garis atap merah `#E60012` di atas huruf `n`), garis pemisah vertikal, teks tebal **Threads Monitoring**, dan sub-label **Social Listening**.
- **Quick Action Bar (Khusus Petugas)**:
  - Tombol bulat `Plus` (`h-8 w-8`): Membuka Modal Input 2 Langkah.
  - Tombol bulat `Upload` (`h-8 w-8`): Membuka Modal Impor Massal.
  - Tombol bulat `Database` (`h-8 w-8`): Toggle tampil/sembunyikan Data Contoh (tersedia juga untuk Penonton).
- **Badge Data Contoh**: Menampilkan kapsul putih bergaris biru dengan ikon `FlaskConical` dan teks *"Data Contoh"* saat data demo aktif.
- **Alert Bell Pill**: Kapsul dengan ikon lonceng, tanggal hari ini (*Sab, 17 Okt*), dan badge lingkaran merah `#E60012` berisi jumlah alert belum dibaca yang diperbarui secara reaktif.
- **Tombol Peran Terotentikasi**:
  - Penonton: Latar Deep Navy `#0A192F`, ikon `Lock`, label **Masuk sebagai Petugas** (membuka modal token).
  - Petugas: Latar Electric Blue `#0055FF`, ikon `Unlock`, label **Petugas Input · Keluar** (konfirmasi pengakhiran sesi).

### 3.3 Sidebar Navigasi Melayang
- Format kapsul vertikal melayang desktop (`md:w-[76px] rounded-[32px] bg-white p-2.5 shadow-sm border border-slate-200/60`).
- 5 item navigasi (`w-12 h-12 rounded-full text-[10px] font-bold`):
  1. **Dash** (`Activity`) — Menuju `/`
  2. **Post** (`MessageSquare`) — Menuju `/mention`
  3. **Draf** (`FolderKanban`, dengan badge dinamis jumlah antrean) — Menuju `/draf`
  4. **Alert** (`ShieldAlert`, dengan badge dinamis alert aktif) — Menuju `/alert`
  5. **Topik** (`Settings`) — Menuju `/topik`
- Bagian bawah: Tombol bulat Deep Navy `#0A192F` berikon `ArrowUpRight` dengan `aria-label="Input Cepat Mention"` untuk akses cepat.

### 3.4 Sub-Header & Filter Global
- **Kiri**: Judul halaman dinamis (`Dashboard`, `Daftar Mention`, `Antrean Draf`, `Alert & Lonjakan`, `Topik & Konfigurasi`) dengan subjudul tetap penjelas sumber data.
- **Kanan**:
  - **Pemilih Rentang Tanggal Global**: Kapsul putih ikon `Calendar` dengan opsi rentang (*7 Hari Terakhir*, *14 Hari Terakhir*, *30 Hari Terakhir*, *Bulan Ini*). Perubahan rentang disimpan di state global dan terbawa antar-halaman.
  - **Granularitas**: Kapsul putih ikon `Clock` untuk beralih antara agregasi `Harian` dan `Mingguan`.
  - **Dropdown Ekspor Laporan**: Tombol kapsul `#0A192F` dengan lingkaran putih berisi ikon `Download`. Mendukung ekspor **Laporan CSV (UTF-8 BOM)**, **Laporan Excel (.xlsx)**, dan **Laporan PDF**.

---

## 4. Rincian 7 Kartu Bento Grid (Dashboard Utama)

Dashboard utama tersusun dalam grid 12 kolom (`grid-cols-1 lg:grid-cols-12 gap-5`). Entri berstatus `DRAF` dikecualikan secara ketat dari perhitungan statistik.

```
┌──────────────────────────────────────────────┬──────────────────┬─────────────────┐
│ Kartu 1: Tren Volume & Deteksi Lonjakan     │ Kartu 2: Sentimen│ Kartu 4:        │
│ (7 Kolom)                                    │ Positif (2 Kolom)│ Distribusi      │
│ - Total Mention + Pertumbuhan               ├──────────────────┤ Topik &         │
│ - Mention Negatif + % dari total             │ Kartu 3: Perlu   │ Antrean         │
│ - Bar Chart Waktu (Normal, Lonjakan, Puncak) │ Perhatian        │ (3 Kolom)       │
│ - Filter Topik Kapsul (Global Dashboard)    │ (2 Kolom)        │                 │
├───────────────────────────────┬──────────────┴──────────────────┴─────────────────┤
│ Kartu 5: Fokus Topik Teratas  │ Kartu 6: Indeks Harian 7 Hari    │ Kartu 7:        │
│ (4 Kolom, Biru BTN + Atap)    │ (3 Kolom, Lollipop Chart)        │ Ringkasan &     │
│                               │                                  │ Input Cepat     │
│                               │                                  │ (5 Kolom)       │
└───────────────────────────────┴──────────────────────────────────┴─────────────────┘
```

### 1. Kartu 1: Tren Volume Mention & Deteksi Lonjakan (`lg:col-span-7`)
- **Header**: Kotak indikator biru `#0055FF`, judul kartu, keterangan ambang aktif (mis. `Ambang: 10/hari`), badge `Ditampilkan mingguan` jika rentang melebihi 31 hari atau mode mingguan dipilih, serta tombol toggle **Lihat Grafik / Lihat Tabel**.
- **Angka Kembar**:
  - Total Mention dengan pill pertumbuhan terhadap periode sebelumnya berdurasi sama (menampilkan `Baru` bila periode lalu 0).
  - Mention Negatif dengan pill persentase terhadap total (mis. `14,8% dari total`).
- **Grafik Batang Kapsul Waktu**: Batang abu-abu muda `bg-slate-200` untuk volume normal, biru `#0055FF` berlabel `Lonjakan` bila mencapai ambang, dan label `Tertinggi` untuk nilai puncak. Dilengkapi atribut aksesibilitas `role="img"` dan keyboard-focus ring.
- **Pill Filter Topik Kapsul**: `Semua Topik` dan topik aktif dari basis data. Pemilihan topik di kartu ini memfilter **seluruh kartu pada dashboard**.

### 2. Kartu 2: Persentase Sentimen Positif (`lg:col-span-2`, Atas)
- Menampilkan persentase sentimen positif dalam tipografi besar `text-5xl font-normal` beraksen `%` biru.
- Rincian bawah lengkap: `{positif} positif · {netral} netral · {negatif} negatif`. Jumlah ketiga metrik ini dijamin sama persis dengan total mention.

### 3. Kartu 3: Perlu Perhatian (`lg:col-span-2`, Bawah)
- Permukaan Ice Blue `bg-[#EBF3FF]` dengan border tipis `border-[#0055FF]/15`.
- Ikon merah `AlertTriangle`, jumlah isu berprioritas Perlu Perhatian, dan tautan langsung `Tinjau prioritas tinggi` yang mengarahkan ke `/mention?prioritas=PERLU_PERHATIAN`.

### 4. Kartu 4: Sentimen per Topik dan Antrean (`lg:col-span-3`)
- Bar horizontal tipis persentase per topik dengan legenda warna.
- **Kategori Lainnya Otomatis**: Bila topik melebihi batas tampilan kartu, topik minor digabungkan ke kategori `Lainnya` sehingga jumlah akumulasi batang sama dengan 100% total mention.
- Blok bawah 2 kolom: Tautan cepat ke antrean **DRAF** dan antrean **ALERT** dengan badge merah `Baru`.

### 5. Kartu 5: Fokus Topik Teratas (`lg:col-span-4`)
- Latar biru solid BTN `#0055FF` dengan dekorasi garis atap merah `#E60012` di sudut kanan atas.
- Pill putih porsi persentase topik terhadap keseluruhan volume, 4 lingkaran dekoratif dengan `aria-hidden="true"`, dan nama topik teratas dalam tipografi besar `text-4xl`.

### 6. Kartu 6: Indeks Harian 7 Hari Terakhir (`lg:col-span-3`)
- Grafik lollipop 7 hari berurutan yang berakhir pada hari ini (*17 Okt 2026*).
- Garis vertikal `w-[2px] bg-slate-200` dengan kepala lingkaran biru, dan merah `#E60012` pada hari yang melampaui ambang deteksi lonjakan.
- Angka total perbincangan 7 hari dihitung secara dinamis dari database (tanpa hardcoding).

### 7. Kartu 7: Ringkasan Mingguan dan Input Cepat (`lg:col-span-5`)
- Header judul kartu dan tombol **Salin Ringkasan**. Setelah diklik, label bertransformasi menjadi **Tersalin** selama 2 detik dengan clipboard data berformat kolom `Headline Post` dan `Summary Post`.
- Kotak pratinjau `bg-[#F4F7FB]` berisi Headline dan Ringkasan minggu berjalan.
- **Bar Input Cepat Berbasis Peran**:
  - Mode Penonton: Kapsul terkunci berikon `Lock` dengan keterangan *"Masuk sebagai Petugas untuk menambah mention."*
  - Mode Petugas: Kapsul input berikon `Link` dengan placeholder URL Threads dan tombol submit bulat berikon panah yang langsung meneruskan tautan ke Modal Input.

---

## 5. Fitur Halaman dan Modal Interaktif

### 5.1 Halaman Mention (`/mention`)
- **Pencarian & Multi-Filter**: Bilah pencarian teks (mencari judul, ringkasan, teks postingan, dan kata kunci) dipadukan dengan dropdown Topik, Sentimen, Prioritas, dan Status.
- **Integrasi URL Parameters**: Membaca parameter query `topik`, `prioritas`, dan `search` dari URL sehingga navigasi rujukan dari kartu dashboard atau alert langsung memfilter data yang relevan.
- **Paginasi Server**: 20 item per halaman dengan navigasi halaman Sebelumnya/Selanjutnya dan informasi jumlah hasil total.
- **Kartu Mention Ergonomis**:
  - Pill Topik gelap `#0A192F`, Pill Sentimen semantik, Pill Prioritas semantik, tanggal berformat lokal, dan pill amber *"Contoh"* untuk data demo.
  - Kutipan teks postingan Threads yang telah disamarkan dari data pribadi dalam kotak `bg-[#F4F7FB] italic`.
  - Footer kartu menampilkan chip kata kunci di sisi kiri, serta dropdown pembaruan status dan tombol hapus di sisi kanan (khusus Petugas).
  - **Pelindungan Privasi**: Nama akun pengguna Threads tidak pernah ditampilkan di antarmuka.

### 5.2 Halaman Draf (`/draf`)
- Menampilkan seluruh postingan berstatus `DRAF` dari sumber formulir maupun impor massal dalam kartu bergaris putus-putus (`border-dashed border-slate-300`).
- **Penyuntingan Hasil Analisis Inline**: Petugas dapat membuka panel edit untuk menyesuaikan usulan Headline, Ringkasan, Topik, Sentimen, dan Prioritas sebelum melakukan persetujuan.
- Tombol **Tolak dan Hapus** dengan modal konfirmasi keamanan.
- Penonton hanya dapat melihat daftar draf tanpa tombol aksi.

### 5.3 Halaman Alert (`/alert`)
- Daftar peringatan aktif berkategori **Lonjakan Harian** (border merah) dan **Perlu Perhatian** (border biru).
- Menyajikan perbandingan volume aktual terhadap ambang batas (mis. *"18 mention, ambang 10"*).
- Tautan **Lihat mention** yang otomatis membuka halaman Mention dengan filter topik dan periode terkait.
- Tombol **Tandai dibaca** khusus untuk mode Petugas.

### 5.4 Halaman Topik dan Konfigurasi (`/topik`)
- **Daftar Topik Pantauan**: Menampilkan nama topik, tag kata kunci, sakelar aktif/nonaktif, formulir tambah topik baru, dan tombol hapus topik.
- **Ambang Deteksi Alert**: Konfigurasi ambang lonjakan volume per hari dan ambang sentimen negatif per hari.
- **Kata Kunci Risiko**: Pengelolaan kata kunci ancaman (seperti *penipuan*, *kebocoran data*, *phishing*) yang memicu eskalasi prioritas menjadi Perlu Perhatian.
- **Manajemen Data Contoh**:
  - Tombol **Isi Data Contoh**: Menginjeksi data contoh sintetis ke database melalui API `/api/sample-data` dengan konfirmasi 2 langkah.
  - Tombol **Hapus Semua Data Contoh**: Membersihkan seluruh data bertanda `CONTOH` tanpa menyentuh data nyata.

### 5.5 Modal Input 2 Langkah (`ModalInput.tsx`)
1. **Langkah 1 (Tempel Tautan & Teks)**:
   - Validasi URL berformat HTTPS dari `threads.net` atau `threads.com`.
   - **Pencegahan Duplikat**: Mengecek database secara real-time via `/api/mentions?checkUrl=...`. Menampilkan banner Ice Blue bila tautan sudah ada dan menonaktifkan tombol lanjut.
   - **Pemindai PII Otomatis**: Mendeteksi nomor telepon, email, NIK (16 digit), dan nomor rekening bank. Menampilkan banner Ice Blue `ShieldCheck` dengan rincian data sensitif yang disamarkan otomatis.
2. **Langkah 2 (Tinjau dan Simpan)**:
   - Form editor untuk Topik, Sentimen, Prioritas, Usulan Headline, Ringkasan, dan Kata Kunci.
   - Counter karakter real-time: Headline (`X/100`) dan Ringkasan (`X/400`).
   - Penanganan kedaluwarsa sesi: Jika sesi Petugas habis saat menyimpan (HTTP 403), modal otomatis menampilkan login token tanpa menghilangkan draft isian formulir.

### 5.6 Modal Impor Massal (`ModalImpor.tsx`)
- **Tab Tempel Banyak**: Memungkinkan penempelan hingga 50 tautan sekaligus (format `tautan` atau `tautan | teks`).
- **Tab Unggah Berkas CSV**:
  - Pemrosesan berkas CSV langsung di browser via `FileReader`.
  - Tombol **Unduh Contoh CSV** untuk mendapatkan template standar `tautan,teks`.
- **Indikator Kemajuan**: Bar progres visual dan teks status *"N dari M diproses"*.
- **Laporan Audit Hasil Impor**: Ringkasan jumlah Berhasil, Duplikat, dan Gagal/Format, lengkap dengan tabel rincian nomor baris bermasalah dan alasannya.

### 5.7 Modal Token & Autentikasi (`ModalToken.tsx`)
- Input token berbasis kata sandi dengan toggle intip/sembunyikan karakter.
- Otentikasi server-side yang menyematkan cookie `httpOnly` berumur pendek (`petugas_session=authenticated`). Token tidak pernah disimpan di `localStorage` demi keamanan sesi.

---

## 6. Arsitektur Teknis dan Hasil Pengujian

### 6.1 Tumpukan Teknologi Terpasang
- **Framework**: Next.js 15.5.28 (App Router)
- **Runtime & UI**: React 19.0.0
- **Bahasa**: TypeScript 5.8.2 (Strict Mode)
- **Styling**: Tailwind CSS 3.4.17
- **Database & ORM**: PostgreSQL 16 (Port 5432) & Prisma ORM 6.4.1
- **Ikonografi**: `lucide-react` 1.59.0

### 6.2 Tabel Verifikasi Pengujian

| Pengujian | Perintah / Uji | Hasil | Status |
|---|---|---|:---:|
| **Linting** | `npm run lint` | `✔ No ESLint warnings or errors` | **LULUS** |
| **Code Style** | `npx prettier --check .` | Seluruh berkas sesuai standar formatting | **LULUS** |
| **Kompilasi Produksi** | `npm run build` | Sukses dalam 4.0 detik (8 static/dynamic routes) | **LULUS** |
| **Konektivitas Database** | `GET /api/health` | `{"ok":true,"database":"connected"}` (HTTP 200) | **LULUS** |
| **Pencegahan Duplikasi** | `GET /api/mentions?checkUrl=...` | Mengembalikan status eksistensi tautan secara presisi | **LULUS** |
| **Ekspor Data UTF-8 BOM** | `GET /api/export?format=csv` | File CSV terunduh dengan byte order mark `\uFEFF` | **LULUS** |
| **Isolasi Lingkungan** | `git check-ignore -v .env` | `.env` terbukti diabaikan oleh Git repository | **LULUS** |

---

## 7. Kesimpulan dan Kesiapan Selanjutnya

Seluruh antarmuka pengguna (UI/UX) dan logika operasional **BTN Threads Monitoring** saat ini telah selesai dibangun sesuai dengan standar perbankan Bank BTN dan spesifikasi tunggal `docs/DESIGN.md`. 

Aplikasi siap digunakan untuk pengujian alur kerja petugas, simulasi input tautan, peninjauan draf, pemantauan lonjakan alert, serta ekspor laporan berkala.
