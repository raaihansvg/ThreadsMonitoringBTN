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
DATABASE_URL="postgresql://threads_monitoring:threads_monitoring@localhost:5432/threads_monitoring?schema=public"
INPUT_TOKEN="dev_secret_token_123"
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
