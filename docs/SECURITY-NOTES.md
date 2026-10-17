# SECURITY NOTES & DEPENDENCY AUDIT REVIEW
**BTN Threads Monitoring System (SRS v0.2)**  
Tanggal Audit: 18 Oktober 2026  
Status: Terverifikasi, Tidak Ada Kerentanan Kritis yang Terekspos ke Produksi

Dokumen ini mencatat tinjauan menyeluruh terhadap hasil `npm audit` (dependensi produksi dan lingkungan pengembangan) serta analisis risiko untuk setiap paket. Sesuai panduan keamanan, perintah destruktif `npm audit fix --force` **tidak dijalankan** karena berpotensi merusak kompatibilitas dependensi tersemat (*breaking changes*).

---

## 1. Ringkasan Eksekutif

| Lingkup | Total Temuan | Low | Moderate | High | Critical | Status Risiko Produksi |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **Produksi (`--omit=dev`)** | 4 | 0 | 3 | 1 | 0 | **Dapat Diterima (Mitigasi Terverifikasi)** |
| **Pengembangan (Dev Tools)** | 17 | 2 | 5 | 8 | 2 | **Aman (Hanya Berjalan Saat Build/Test Lokal)** |

---

## 2. Analisis Dependensi Produksi (`npm audit --omit=dev`)

### A. Paket `uuid` via `exceljs`
- **Advisory ID**: GHSA-w5hq-g745-h8pq / CVE-2024-34351
- **Tingkat Keparahan**: Moderate (CVSS 5.3)
- **Jalur Ketergantungan**: `exceljs` -> `uuid@^8.3.2`
- **Deskripsi Kerentanan**:
  *Missing buffer bounds check in v3/v5/v6 when buf is provided*. Kerentanan terjadi bila fungsi UUID dipanggil dengan menyediakan buffer eksternal (`buf`) yang tidak divalidasi batas ukurannya.
- **Pemeriksaan Kode Sumber ExcelJS**:
  Pemeriksaan menyeluruh pada pustaka ExcelJS (`node_modules/exceljs/lib/xlsx/xform/sheet/cf-ext/cf-rule-ext-xform.js` baris 1, 43, dan 77) menunjukkan bahwa:
  1. ExcelJS hanya mengimpor dan memanggil generator versi 4 (`const {v4: uuidv4} = require('uuid')`).
  2. Pemanggilan dilakukan **tanpa argumen apa pun**:
     ```javascript
     model.x14Id = `{${uuidv4()}}`.toUpperCase();
     id: model.x14Id || `{${uuidv4()}}`,
     ```
  3. ExcelJS tidak pernah memberikan parameter `buf` dan tidak memanggil varian `v3`, `v5`, atau `v6`.
- **Kesimpulan & Keputusan**:
  **Kerentanan TIDAK DAPAT DIEKSPLOITASI (Not Exploitable)** dalam alur kerja aplikasi ini.
- **Rencana Perbaikan**:
  Memantau rilis pembaruan ExcelJS versi berikutnya yang memperbarui versi dependensi transitif `uuid` ke `>= 11.1.1`.

---

### B. Paket `postcss` via `next` (Internal Runtime)
- **Advisory ID**: GHSA-qx2v-qp2m-jg93, GHSA-6g55-p6wh-862q, GHSA-fxqj-rqcc-2cmp, GHSA-r28c-9q8g-f849
- **Tingkat Keparahan**: High (CVSS 7.5)
- **Jalur Ketergantungan**: `next@15.5.28` -> `postcss@8.5.22`
- **Deskripsi Kerentanan**:
  XSS melalui unescaped tag `</style>` pada keluaran stringify CSS dan kebocoran informasi melalui manipulasi parameter `sourceMappingURL` pada komentar CSS.
- **Analisis Risiko & Alasan Dapat Diterima**:
  1. Aplikasi BTN Threads Monitoring adalah sistem internal yang tidak mengizinkan pengguna luar mengunggah atau mengompilasi berkas CSS kustom secara dinamis.
  2. Seluruh stylesheet dihasilkan statis pada saat `next build` menggunakan Tailwind CSS terkurasi.
  3. `next@15.5.28` adalah rilis LTS paling mutakhir pada lini Next 15 (`npm view next@15 version` mengonfirmasi 15.5.28 sebagai versi tertinggi). Saran audit untuk beralih ke Next 16 (`next@16.4.2`) adalah *breaking change* arsitektur mayor.
- **Rencana Perbaikan**:
  Mengaplikasikan patch minor Next 15 jika Vercel merilis patch backport, atau merencanakan migrasi ke Next 16 pada fase rilis skala besar terpisah.

---

## 3. Analisis Dependensi Pengembangan (Dev Dependencies)

Seluruh temuan pada dependensi dev hanya dieksekusi di workstation developer atau pipeline CI saat pengujian/kompilasi, dan tidak pernah disertakan dalam berkas runtime produksi:

| Paket & Advisory | Tingkat | Lokasi Penggunaan | Analisis Risiko & Mitigasi |
| :--- | :---: | :--- | :--- |
| **`tinypool`** (GHSA-5gmw-xhrv-c9v3, GHSA-85c8-ppgw-ccpr) | Critical | Ketergantungan Vitest test runner | Hanya berjalan saat mengeksekusi `npm test` di mesin lokal/CI. Tidak ada input dari penyerang luar. |
| **`braces` / `fast-glob`** (GHSA-vfj7-8cjw-p6xm) | High | Tailwind CSS v3 & ESLint matcher | Berjalan saat kompilasi build statis. Pola glob internal statis. |
| **`@eslint/plugin-kit`** (GHSA-xffm-g5w8-qvg7) | Low | ESLint CLI v9 | Hanya dipanggil saat `npm run lint`. |
| **`@vitest/mocker`** (GHSA-82fw-gwwq-j7x9) | Moderate | Vitest module mock | Berjalan terbatas pada lingkungan pengujian unit internal. |
| **`esbuild`** (GHSA-67mh-4wv8-2f99) | Moderate | Bundler Vite untuk Vitest | Dev server Vitest hanya mendengarkan proses internal. |
| **`postcss-selector-parser`** (GHSA-rj75-hqrm-r3gf) | Moderate | Parser Tailwind nested | Build-time parser pada berkas CSS lokal. |

---

## 4. Kebijakan Audit & Rekomendasi Pemeliharaan

1. **Larangan `npm audit fix --force`**:
   Opsi `--force` secara paksa akan memasang paket versi mayor yang tidak kompatibel (mis. Tailwind v4 yang mengubah seluruh skema konfigurasi CSS, Next 16 yang mengubah API Async Request/Cookies, dan versi usang exceljs 3.4.0). Hal ini dilarang keras demi menjaga stabilitas sistem.
2. **Pustaka Manipulasi Berkas Excel**:
   Paket lama `xlsx 0.18.5` (SheetJS) yang memiliki kerentanan Prototype Pollution (CVE-2023-30533) dan ReDoS (CVE-2024-22363) telah **dihapus permanen** dan digantikan dengan `exceljs 4.4.0` yang aman dan terawat aktif.
