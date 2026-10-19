# ThreadsMonitoring BTN

Website ThreadsMonitoring adalah aplikasi web dashboard social listening untuk postingan publik di Threads (Meta) seputar Bank BTN, produk BTN (KPR, BTN Mobile, Tapera), dan kompetitor.

---

## Versi Dependensi Utama (Pinned)

Proyek ini menggunakan versi dependensi yang dipin secara eksplisit:

- **Next.js**: `15.5.28` (App Router, TypeScript)
- **React**: `19.0.0`
- **React DOM**: `19.0.0`
- **Prisma**: `6.4.1`
- **@prisma/client**: `6.4.1`
- **Tailwind CSS**: `3.4.17` (dengan PostCSS `8.5.3` dan Autoprefixer `10.4.20`)
- **lucide-react**: `1.59.0` (icon library)
- **ESLint**: `9.21.0` (dengan `eslint-config-next: 15.5.28`)
- **Prettier**: `3.5.2` (dengan `prettier-plugin-tailwindcss: 0.6.11`)
- **tsx**: `4.19.3`
- **TypeScript**: `5.7.3`

---

## Struktur Direktori

Sesuai dengan SRS Bagian 2.2, struktur folder diatur sebagai berikut:

```
threadsMonitoringBtn/
├── app/                  # Next.js App Router (halaman & route handler API)
│   ├── api/
│   │   └── health/       # Healthcheck endpoint (GET /api/health)
│   ├── globals.css       # Tailwind CSS base styles
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Landing page
├── components/           # Komponen UI antarmuka
├── lib/                  # Logika inti dan modul aplikasi
│   ├── alert/            # Modul deteksi lonjakan & alert
│   ├── analysis/         # Kontrak AnalysisProvider & stub implementasi
│   ├── export/           # Modul ekspor laporan (CSV, Excel, PDF)
│   ├── ingest/           # Kontrak InputSource & stub implementasi
│   └── prisma.ts         # Singleton Prisma Client
├── prisma/               # Konfigurasi basis data & ORM
│   ├── schema.prisma     # Definisi schema (Mention, Topic, Alert, ImportBatch)
│   ├── seed.ts           # Skrip database seed
│   └── migrations/       # Riwayat migrasi Prisma
├── extension/            # Sumber kode ekstensi Chrome
├── docs/                 # Dokumen spesifikasi kebutuhan perangkat lunak (SRS)
│   └── SRS.md
├── .env.example          # Template variabel lingkungan
└── README.md             # Dokumentasi proyek
```

---

## Prasyarat

- **Node.js**: v20+
- **PostgreSQL**: v15+ (atau via Docker)

---

## Panduan Menjalankan

### 1. Salin Variabel Lingkungan

Salin file `.env.example` ke `.env`:

```bash
cp .env.example .env
```

Sesuaikan konfigurasi `DATABASE_URL` di `.env`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/DATABASE?schema=public"
INPUT_TOKEN="change_me"
LLM_PROVIDER="gemini"
```

### 2. Instalasi Dependensi

```bash
npm install
```

### 3. Migrasi & Seed Basis Data

Jalankan migrasi Prisma untuk menerapkan skema ke PostgreSQL:

```bash
npx prisma migrate dev
```

Jalankan perintah seed (skrip kosong di Tahap 0):

```bash
npx prisma db seed
```

Validasi skema Prisma:

```bash
npx prisma validate
```

### 4. Menjalankan Server Pengembangan

```bash
npm run dev
```

Aplikasi berjalan di [http://localhost:3000](http://localhost:3000).

### 5. Memeriksa Endpoint Health

```bash
curl -s http://localhost:3000/api/health
```

Respons yang diharapkan saat basis data terhubung:

```json
{ "ok": true, "database": "connected" }
```

---

## Skrip yang Tersedia

- `npm run dev`: Menjalankan Next.js development server.
- `npm run build`: Melakukan compile aplikasi untuk produksi.
- `npm run start`: Menjalankan aplikasi dalam mode produksi.
- `npm run lint`: Menjalankan pemeriksaan ESLint.
- `npm run format`: Memformat seluruh file dengan Prettier.
- `npm run format:check`: Memeriksa format file tanpa mengubah.

---

## Pratinjau Otomatis Tautan Threads (FR-02, Tahap 3A)

Aplikasi menyediakan fitur pengambilan pratinjau teks postingan Threads publik secara otomatis saat Petugas Input memasukkan tautan:

### 1. Perilaku & Format yang Didukung
- Mendukung tautan postingan langsung (`/@akun/post/<id>`) dan tautan berbagi (`/share/<id>`) untuk domain `threads.net` dan `threads.com` (baik dengan `www` maupun tanpa `www`).
- Mengikuti pengalihan HTTP (maksimal 3 pengalihan, protokol HTTPS wajib, dan host tujuan divalidasi ketat pada setiap lompatan).
- URL kanonik yang dihasilkan digunakan sebagai `linkTernormalisasi` untuk mencegah duplikasi data (FR-07).
- Mengekstrak **HANYA** metadata `og:description` dan mendekode entitas HTML. **Tidak** menyimpan `og:title` maupun nama akun Threads.
- Menandai peringatan teks *"mungkin terpotong"* pada antarmuka jika teks postingan berakhiran elipsis (`...` / `…`) atau berukuran $\ge 480$ karakter.
- Jika halaman mengindikasikan dinding masuk (*login wall* seperti *"Log in with your Instagram"* atau *"Join Threads to share ideas"*), pengambilan dibatalkan dan pengguna diarahkan menempel teks secara manual.

### 2. Pengaman & Integritas Akses
- **User-Agent Jujur**: Menggunakan identitas jujur `User-Agent: ThreadsMonitoring/0.1` tanpa cookie, tanpa sesi peramban, dan tanpa header penyamaran browser (`Mozilla`, `Chrome`, atau crawler lain).
- **Batas Unduhan & Waktu**: Batas waktu (*timeout*) 8 detik per permintaan dan batas ukuran respon maksimal 1 MB untuk mencegah eksploitasi Denial-of-Service.
- **Pemicu Eksplisit**: Pengambilan pratinjau hanya dipicu satu kali per klik tombol eksplisit oleh petugas yang telah terotentikasi (`requireOfficer`), bukan otomatis pada saat halaman dimuat atau secara massal (*bulk*).

### 3. Batas Frekuensi & Circuit Breaker (Database-Backed)
- **Batas Sesi**: Maksimal 10 permintaan pratinjau per menit per sesi petugas.
- **Batas Global**: Maksimal 60 permintaan pratinjau per jam di seluruh sistem.
- **Circuit Breaker**: Jika server Threads merespons dengan status HTTP `403` (Forbidden) atau `429` (Too Many Requests), sistem secara otomatis menghentikan (*pause*) seluruh permintaan pratinjau keluar selama **15 menit** demi melindungi IP server dan mematuhi batasan penyedia.
- **Persistensi Serverless**: Seluruh state pembatas frekuensi dan jeda circuit breaker disimpan secara persisten di tabel basis data `PreviewLimitState` dengan fallback in-memory, sehingga bekerja konsisten di lingkungan multi-instance maupun arsitektur *serverless* (AWS Lambda, Vercel, Google Cloud Run) tanpa kehilangan status antar proses.

### 4. Kill Switch & Kepatuhan Produksi (`PREVIEW_ENABLED`)
- Fitur ini dikontrol melalui variabel lingkungan `PREVIEW_ENABLED`.
- Secara default, fitur aktif (`true`) di lingkungan pengembangan (*development*) dan pengujian (*test*), namun **dinonaktifkan secara bawaan (`false`) di lingkungan produksi**.
- Bila dinonaktifkan, endpoint API langsung merespons dengan pesan fallback (*"Teks tidak dapat diambil otomatis. Tempel teks postingan."*) tanpa melakukan kontak jaringan ke Threads sama sekali.
- **PERINGATAN KEPATUHAN**: Sebelum mengaktifkan `PREVIEW_ENABLED=true` di lingkungan produksi, kepatuhan teknis terhadap ketentuan layanan Meta/Threads harus dikaji dan disetujui secara resmi oleh penasihat hukum (*legal counsel*) atau tim kepatuhan (*compliance team*) organisasi.

### 5. Penanganan Tautan `/share/` Tanpa Pratinjau (FR-01, FR-07, Tahap 3B)
- Jika Petugas menyimpan tautan `/share/<id>` tanpa melalui pratinjau (misalnya ketika `PREVIEW_ENABLED=false` atau pratinjau dilewati), sistem menyimpan tautan asli apa adanya di kolom `linkAsli`.
- Sistem **TIDAK melakukan permintaan jaringan** apa pun ke Threads untuk mencari URL kanonikal postingan tersebut.
- Entri ditandai dengan `statusKanonik: "BELUM_DIKETAHUI"` dan menampilkan lencana peringatan *"Kanonik belum diketahui"* di antarmuka Draf dan Mention.

### 6. Kebijakan Draf Tanpa Teks (FR-10, FR-11, Tahap 3B)
- Postingan yang diimpor hanya dengan URL (tanpa teks) disimpan dengan status `DRAF`.
- Draf tanpa teks **TIDAK dianalisis** (topik `null`, sentimen `NETRAL`, prioritas `RUTIN`, headline dan ringkasan kosong, tanpa penyedia analisis).
- Draf tanpa teks **TIDAK DAPAT DISETUJUI** ke Dashboard (`POST /api/drafts` dengan aksi `approve` ditolak) sebelum Petugas menyunting dan mengisi teks postingan yang sah.
- Tidak ada teks *placeholder* tiruan yang diizinkan masuk ke Dashboard maupun laporan ekspor (FR-17).

### 7. Tempel Banyak & Batas Impor Seragam 50 Item (FR-10, Tahap 3B)
- Format tempel banyak (`tautan | teks`) diurai dengan memecah **HANYA** pada tanda pipa (`|`) pertama, sehingga karakter `|` berikutnya di dalam isi postingan tetap utuh sebagai bagian teks.
- Batas impor diseragamkan menjadi **maksimal 50 item** di seluruh lapisan aplikasi (antarmuka UI `ModalImpor`, skema validasi `importBatchSchema`, dan rute API).

