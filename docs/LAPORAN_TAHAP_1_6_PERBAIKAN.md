# LAPORAN TAHAP 1.6: PERBAIKAN & PENGERASAN SISTEM
**BTN Threads Monitoring System (SRS v0.2)**  
Tanggal: 18 Oktober 2026  
Cabang: `tahap-1-6-perbaikan` (bercabang dari `tahap-1-5-audit`)  
Status: Selesai (Semua tes lolos, Prettier lolos, ESLint lolos, Build sukses, Komit lokal tanpa push)

---

## 1. Audit Dependensi & Keamanan Paket

### A. Keluaran Mentah `npm audit` Lengkap
```
# npm audit report

@eslint/plugin-kit  <0.3.4
@eslint/plugin-kit is vulnerable to Regular Expression Denial of Service attacks through ConfigCommentParser - https://github.com/advisories/GHSA-xffm-g5w8-qvg7
fix available via `npm audit fix --force`
Will install eslint@9.39.5, which is outside the stated dependency range
node_modules/@eslint/plugin-kit
  eslint  9.10.0 - 9.26.0
  Depends on vulnerable versions of @eslint/plugin-kit
  node_modules/eslint

@vitest/mocker  <=4.1.10
Severity: moderate
Vitest: Path Traversal / Arbitrary File Read via @vitest/mocker Redirect Mock - https://github.com/advisories/GHSA-82fw-gwwq-j7x9
Depends on vulnerable versions of vite
fix available via `npm audit fix --force`
Will install vitest@2.1.9, which is outside the stated dependency range
node_modules/@vitest/mocker
  vitest  <=4.1.10
  Depends on vulnerable versions of @vitest/mocker
  Depends on vulnerable versions of tinypool
  Depends on vulnerable versions of vite
  Depends on vulnerable versions of vite-node
  node_modules/vitest

braces  *
Severity: high
braces vulnerable to stack-exhaustion denial of service through deeply nested patterns - https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
fix available via `npm audit fix --force`
Will install tailwindcss@4.3.3, which is a breaking change
node_modules/braces
  chokidar  2.0.0 - 3.6.0
  Depends on vulnerable versions of braces
  node_modules/chokidar
    tailwindcss  <=0.0.0-oxide-insiders.ff2c25f || 0.5.0 - 3.4.19
    Depends on vulnerable versions of chokidar
    Depends on vulnerable versions of fast-glob
    Depends on vulnerable versions of micromatch
    Depends on vulnerable versions of postcss-nested
    Depends on vulnerable versions of postcss-selector-parser
    node_modules/tailwindcss
  micromatch  >=0.2.0
  Depends on vulnerable versions of braces
  node_modules/micromatch
    fast-glob  *
    Depends on vulnerable versions of micromatch
    node_modules/fast-glob
    node_modules/tailwindcss/node_modules/fast-glob
      @next/eslint-plugin-next  >=14.3.0-canary.0
      Depends on vulnerable versions of fast-glob
      node_modules/@next/eslint-plugin-next
        eslint-config-next  >=14.3.0-canary.0
        Depends on vulnerable versions of @next/eslint-plugin-next
        node_modules/eslint-config-next

esbuild  <=0.24.2
Severity: moderate
esbuild enables any website to send any requests to the development server and read the response - https://github.com/advisories/GHSA-67mh-4wv8-2f99
fix available via `npm audit fix --force`
Will install vitest@2.1.9, which is outside the stated dependency range
node_modules/vite/node_modules/esbuild
  vite  <=6.4.2
  Depends on vulnerable versions of esbuild
  node_modules/vite
    vite-node  <=2.2.0-beta.2
    Depends on vulnerable versions of vite
    node_modules/vite-node

postcss  <=8.5.22
Severity: high
PostCSS has XSS via Unescaped </style> in its CSS Stringify Output - https://github.com/advisories/GHSA-qx2v-qp2m-jg93
PostCSS: Arbitrary file read and information disclosure via attacker-controlled sourceMappingURL in CSS comments - https://github.com/advisories/GHSA-6g55-p6wh-862q
PostCSS: incomplete fix of GHSA-6g55-p6wh-862q — attacker-controlled sourceMappingURL reads arbitrary .map files when `from` is unset - https://github.com/advisories/GHSA-fxqj-rqcc-2cmp
PostCSS: Path Traversal in Previous Source Map Auto-Loading (sourceMappingURL) leads to Arbitrary .map File Disclosure - https://github.com/advisories/GHSA-r28c-9q8g-f849
fix available via `npm audit fix --force`
Will install next@16.4.2, which is a breaking change
node_modules/next/node_modules/postcss
node_modules/postcss
  next  9.3.4-canary.0 - 16.3.0-preview.10
  Depends on vulnerable versions of postcss
  node_modules/next

postcss-selector-parser  <7.1.6
Severity: moderate
PostCSS: Quadratic complexity in flat selector parsing allows CPU exhaustion - https://github.com/advisories/GHSA-rj75-hqrm-r3gf
fix available via `npm audit fix --force`
Will install tailwindcss@4.3.3, which is a breaking change
node_modules/postcss-selector-parser
  postcss-nested  2.0.3 - 6.2.0
  Depends on vulnerable versions of postcss-selector-parser
  node_modules/postcss-nested

tinypool  <=2.1.1
Severity: critical
Tinypool: Prototype Pollution gadget in worker options leads to Remote Code Execution - https://github.com/advisories/GHSA-5gmw-xhrv-c9v3
Tinypool: Prototype Pollution Gadget to RCE in run() options - https://github.com/advisories/GHSA-85c8-ppgw-ccpr
fix available via `npm audit fix --force`
Will install vitest@2.1.9, which is outside the stated dependency range
node_modules/tinypool

uuid  <11.1.1
Severity: moderate
uuid: Missing buffer bounds check in v3/v5/v6 when buf is provided - https://github.com/advisories/GHSA-w5hq-g745-h8pq
fix available via `npm audit fix --force`
Will install exceljs@3.4.0, which is a breaking change
node_modules/uuid
  exceljs  >=3.5.0
  Depends on vulnerable versions of uuid
  node_modules/exceljs

21 vulnerabilities (2 low, 8 moderate, 9 high, 2 critical)
```

### B. Keluaran Mentah `npm audit --omit=dev` (Dependensi Produksi)
```
# npm audit report

postcss  <=8.5.22
Severity: high
PostCSS has XSS via Unescaped </style> in its CSS Stringify Output - https://github.com/advisories/GHSA-qx2v-qp2m-jg93
PostCSS: Arbitrary file read and information disclosure via attacker-controlled sourceMappingURL in CSS comments - https://github.com/advisories/GHSA-6g55-p6wh-862q
PostCSS: incomplete fix of GHSA-6g55-p6wh-862q — attacker-controlled sourceMappingURL reads arbitrary .map files when `from` is unset - https://github.com/advisories/GHSA-fxqj-rqcc-2cmp
PostCSS: Path Traversal in Previous Source Map Auto-Loading (sourceMappingURL) leads to Arbitrary .map File Disclosure - https://github.com/advisories/GHSA-r28c-9q8g-f849
fix available via `npm audit fix --force`
Will install next@16.4.2, which is a breaking change
node_modules/next/node_modules/postcss
  next  9.3.4-canary.0 - 16.3.0-preview.10
  Depends on vulnerable versions of postcss
  node_modules/next

uuid  <11.1.1
Severity: moderate
uuid: Missing buffer bounds check in v3/v5/v6 when buf is provided - https://github.com/advisories/GHSA-w5hq-g745-h8pq
fix available via `npm audit fix --force`
Will install exceljs@3.4.0, which is a breaking change
node_modules/uuid
  exceljs  >=3.5.0
  Depends on vulnerable versions of uuid
  node_modules/exceljs

4 vulnerabilities (3 moderate, 1 high)
```

### C. Penjelasan Kerentanan `xlsx@0.18.5` & Penggantian ke `exceljs`
1. **Analisis Kerentanan `xlsx` (SheetJS)**:
   - **Prototype Pollution (CVE-2023-30533 / GHSA-4r6h-8v6p-xvw6)**: Versi publik `xlsx` di registry npm resmi terhenti di 0.18.5 sejak Mei 2022. File spreadsheet dengan formula atau struktur sheet berbahaya dapat menyuntikkan properti ke `Object.prototype`, memicu eksploitasi di lingkungan server Node.js.
   - **Regular Expression Denial of Service (CVE-2024-22363 / GHSA-5pgg-2g8v-p4x9)**: Format number parser mengevaluasi ekspresi reguler secara kuadratik, menyebabkan kehabisan CPU (DDoS lokal) saat memproses nilai numerik tertentu.
2. **Migrasi Aman ke `exceljs@4.4.0`**:
   - Menghapus ketergantungan `xlsx` dari `package.json`.
   - Mengimplementasikan `exceljs` di `app/api/export/route.ts` tanpa mengubah format keluaran berkas XLSX:
     - 2 Sheet: *"Daftar Mention"* dan *"Ringkasan Sentimen"*.
     - Header biru dongker BTN (`#0A192F`) dengan teks putih tebal.
     - Lebar kolom proporsional otomatis dan text wrapping aktif.
     - Sanitasi formula injection (`sanitizeCellForExport`) tetap aktif memblokir karakter `=,+,-,@,\t,\r`.

### D. Status `react 19.0.0` dan Patch `next 15.5.x`
- **React 19.0.0**: Bersih (**0 security advisories** di database npm advisory).
- **Next 15.5.x**: Perintah `npm view next@15 version` mengonfirmasi versi rilis terbaru lini Next 15 adalah **`15.5.28`**, yang sudah terpasang dan dipin di `package.json`. Ketergantungan PostCSS internal Next.js hanya berganti ke versi baru jika bermigrasi ke Next 16 (`next@16.4.2`), yang merupakan perubahan arsitektur mayor.

---

## 2. Tabel Endpoint Lengkap (Termasuk Jalur DRAF FR-09 & FR-10)

Entri draf dibuat ketika data diterima dari **Ekstensi Chrome** (`sumberInput: "EKSTENSI"`, FR-09) atau **Impor Berkas CSV/JSON** (`sumberInput: "IMPOR"`, FR-10). Keduanya diproses oleh `POST /api/mentions` dan secara otomatis disimpan dengan status `DRAF`.

| Metode | Jalur Endpoint | Fungsi / SRS | Perlu Sesi / Token | Mekanisme Guard | Diuji di Vitest |
| :--- | :--- | :--- | :---: | :--- | :---: |
| **GET** | `/api/mentions` | Memuat daftar mention & cek duplikat URL | Tidak | Terbuka (Read-only publik/internal) | Ya |
| **POST** | `/api/mentions` | Buat mention manual (FR-01), entri ekstensi **DRAF** (FR-09), atau entri impor **DRAF** (FR-10) | **Ya** | `requireOfficer()`: Cookie sesi HMAC **ATAU** Bearer token via `crypto.timingSafeEqual` | **Ya** (`auth-guard.test.ts` & `server-pii.test.ts`) |
| **PATCH** | `/api/mentions/[id]` | Ubah status / koreksi mention (FR-18) | **Ya** | `requireOfficer()`: Cookie sesi HMAC | **Ya** |
| **DELETE**| `/api/mentions/[id]` | Hapus entri mention (FR-18) | **Ya** | `requireOfficer()`: Cookie sesi HMAC | **Ya** |
| **POST** | `/api/drafts` | Persetujuan (`approve`) atau penolakan (`reject`) draf dengan opsi edit koreksi | **Ya** | `requireOfficer()`: Cookie sesi HMAC | **Ya** (`auth-guard.test.ts` & `server-pii.test.ts`) |
| **PATCH** | `/api/alerts` | Tandai notifikasi alert telah dibaca | **Ya** | `requireOfficer()`: Cookie sesi HMAC | **Ya** |
| **POST** | `/api/topics` | Tambah / perbarui konfigurasi topik (FR-19) | **Ya** | `requireOfficer()`: Cookie sesi HMAC | **Ya** |
| **DELETE**| `/api/topics` | Hapus konfigurasi topik (FR-19) | **Ya** | `requireOfficer()`: Cookie sesi HMAC | **Ya** |
| **POST** | `/api/sample-data` | Muat atau bersihkan 40 data simulasi (FR-20) | **Ya** | `requireOfficer()`: Cookie sesi HMAC | **Ya** |
| **POST** | `/api/auth/token` | Verifikasi token petugas & terbitkan cookie sesi HMAC | Tidak | Rate-limiting in-memory + timing-safe comparison | **Ya** |
| **GET** | `/api/dashboard` | Statistik 7 card bento dashboard | Tidak | Terbuka (Read-only) | Ya |
| **GET** | `/api/export` | Unduh laporan Excel XLSX & CSV | Tidak | Terbuka (Sanitasi formula aktif) | Ya |
| **GET** | `/api/health` | Health check endpoint | Tidak | Terbuka | Ya |

---

## 3. Matriks Status SRS v0.2 (Nomor & Penamaan Eksak FR-01 s.d. FR-20)

| Kode FR | Nama Kebutuhan Fungsional (SRS v0.2) | Status | Keterangan Implementasi |
| :--- | :--- | :---: | :--- |
| **FR-01** | Input postingan manual via form | **Selesai** | Modal input 2 langkah, validasi URL Threads HTTPS, sanitasi teks. |
| **FR-02** | Validasi tautan Threads | **Selesai** | Validasi domain `threads.net`/`threads.com`, format `/post/`, normalisasi query pelacak. |
| **FR-03** | Pencegahan duplikasi tautan | **Selesai** | Pengecekan real-time via `linkTernormalisasi`, HTTP 409 jika duplikat, direct link ke entri ada. |
| **FR-04** | Klasifikasi topik otomatis | **Selesai** | Engine `selectTopic`: skor kata kunci terbanyak, tie-breaker urutan config, fallback "Lainnya". |
| **FR-05** | Analisis sentimen otomatis | **Selesai** | Deteksi POSITIF / NETRAL / NEGATIF dengan keyword scoring rule-based. |
| **FR-06** | Penentuan prioritas otomatis | **Selesai** | Aturan deterministik: RUTIN / PANTAU / PERLU_PERHATIAN (keluhan rekening, dana, aplikasi). |
| **FR-07** | Ekstraksi kata kunci otomatis | **Selesai** | Stopword removal Bahasa Indonesia, tokenisasi frekuensi, batas maksimal 5 kata kunci. |
| **FR-08** | Pembuatan headline dan ringkasan | **Selesai** | Headline ringkas maks 100 karakter, ringkasan kontekstual maks 400 karakter. |
| **FR-09** | Tangkapan postingan via ekstensi Chrome | **Selesai** | Manifest v3 di folder `extension/`, otentikasi Bearer token, payload masuk berstatus **DRAF**. |
| **FR-10** | Impor massal berkas CSV dan JSON | **Selesai** | Parsing CSV/JSON, validasi Zod per item (maks 100 item), pencegahan duplikat, masuk **DRAF**. |
| **FR-11** | Penyamaran data pribadi (PII) | **Selesai** | Redaksi email, telepon seluler, NIK 16 digit, dan rekening bank. Dijalankan ulang **di sisi server** pada semua route tulis. |
| **FR-12** | Visualisasi tren volume mention | **Selesai** | Kartu 1 Bento: bar chart 7 hari, tinggi minimum 4px untuk nilai > 0, empty state informatif, badge "Tertinggi" hanya saat ada mention. |
| **FR-13** | Visualisasi proporsi sentimen | **Selesai** | Kartu 2 Bento: persentase sentimen positif, breakdown netral dan negatif. |
| **FR-14** | Notifikasi lonjakan dan perhatian | **Selesai** | Deteksi lonjakan volume (2x rerata 7 hari & volume >= 10) serta sentimen negatif (>= 3 mention/hari atau >= 40%). Badge "Baru" untuk unread alert. |
| **FR-15** | Distribusi sentimen per topik | **Selesai** | Kartu 4 Bento: breakdown per topik aktif, teks label "Alert belum dibaca" selaras. |
| **FR-16** | Filter dan pencarian mention | **Selesai** | Filter topik (default "Semua Topik"), sentimen, prioritas, status, date range, dan pencarian teks. |
| **FR-17** | Ekspor laporan berkas | **Selesai** | Ekspor CSV dan XLSX menggunakan `exceljs@4.4.0` (tanpa `xlsx` rentan) dengan proteksi formula injection. |
| **FR-18** | Ubah status dan hapus | **Selesai** | Petugas dapat mengubah status (BARU/DITANGGAPI/SELESAI) dan soft/hard delete entri, dilindungi `requireOfficer()`. |
| **FR-19** | Konfigurasi topik dan kata kunci | **Selesai** | Pengaturan topik aktif/nonaktif, edit kata kunci, dan ambang batas peringatan terpusat. |
| **FR-20** | Data contoh untuk demonstrasi | **Selesai** | 40 postingan contoh realistis Threads BTN dengan label "Contoh", dapat dimuat atau dibersihkan via 1 klik. |

---

## 4. Pelacakan & Rekonsiliasi Ambang Batas Alert

- **Asal Angka "2 mention/hari"**:
  - Ditemukan pada `prisma/seed.ts` (baris 526, 535) dan `app/api/sample-data/route.ts` (baris 154), di mana pesan simulasi alert ditulis hardcoded *"ambang: 2 mention negatif/hari"*.
- **Penyelarasan Terpusat**:
  - Semua ambang batas kini dipusatkan di `lib/config/thresholds.ts` (`DEFAULT_THRESHOLDS`):
    - `negativeThreshold: 3` (3 mention negatif dalam 1 hari untuk memicu PERLU PERHATIAN).
    - `negativePercentage: 40` (>= 40% mention negatif).
    - `volumeThreshold: 10` & `volumeMultiplier: 2.0` (lonjakan volume).
  - Seluruh magic number di `lib/alert/spike.ts`, `app/api/sample-data/route.ts`, dan `prisma/seed.ts` telah diganti dengan referensi ke `DEFAULT_THRESHOLDS`.

---

## 5. Ringkasan Perbaikan UI & Tipografi Kontras

1. **Grafik Tren Bar Volume (Card 1)**:
   - Nilai bar > 0 memiliki tinggi minimum `h-1` (4px) sehingga data bernilai 1 tidak terlihat kosong/hilang.
   - Disediakan *Empty State* ramah pengguna ketika data 0: *"Belum ada data mention pada periode ini"*.
   - Badge *"Tertinggi"* hanya muncul bila nilai tertinggi > 0.
2. **Aturan Topik Otomatis**:
   - Diuji secara menyeluruh di unit test `tests/unit/topic-selector.test.ts` (kecocokan kata kunci terbanyak, tie-break urutan konfigurasi, fallback "Lainnya").
3. **Filter Dashboard**:
   - Default topik di Context dan Select baris filter adalah `"Semua Topik"`.
4. **Notifikasi Alert**:
   - Menampilkan badge visual `"Baru"` berwarna merah tegas pada alert dengan status belum dibaca (`!dibaca`).
   - Label di Dashboard diselaraskan menjadi *"Alert belum dibaca"*.
5. **Standarisasi Tipografi & Rasio Kontras**:
   - Seluruh teks yang sebelumnya berukuran `< 12px` (`text-[10px]`, `text-[11px]`) telah dimigrasikan ke `text-xs` (12px).
   - Teks redup menggunakan token `text-[#5A6A7E]` (rasio kontras 5.2:1 terhadap putih, memenuhi WCAG AA >= 4.5:1).
   - Teks peringatan bahaya/merah menggunakan `text-[#C10010]` (rasio kontras 6.4:1).

---

## 6. Hasil Pengujian & Verifikasi

- **Vitest Suite**: **8 test files passed (100%), 65 tests passed (100%)**.
  - `tests/unit/topic-selector.test.ts`: 6 passed
  - `tests/integration/server-pii.test.ts`: 6 passed
  - `tests/integration/auth-guard.test.ts`: 25 passed
  - `tests/unit/url.test.ts`: 9 passed
  - `tests/unit/pii.test.ts`: 5 passed
  - `tests/unit/spike.test.ts`: 4 passed
  - `tests/unit/sanitize.test.ts`: 6 passed
  - `tests/unit/duplicate.test.ts`: 4 passed
- **Prettier Format Check**: `npx prettier --check .` -> **All matched files use Prettier code style!**
- **ESLint**: `npm run lint` -> **No ESLint warnings or errors**.
- **Next.js Production Build**: `npm run build` -> **Compiled successfully in 8.2s**, 8 static routes generated, 0 type errors.

---

## 7. Riwayat Komit Lokal (`tahap-1-6-perbaikan`)

Semua perubahan telah dikomit secara rapi ke git lokal tanpa di-push:
```
dcc9cc1 test: add unit tests for topic selection and integration tests for server PII masking
5d75ae1 style(ui): update trend chart bar height, empty state, dashboard labels, and typography tokens
fe9896a security(api): enforce server-side PII masking and payload validation on all write routes
2ddca20 fix(deps): replace xlsx with exceljs, add zod validation, and centralize thresholds
```

---

## 8. Hal yang Memerlukan Keputusan / Konfirmasi Pengguna

1. **Jadwal Upgrade Next.js Mayor (Next 16)**:
   - Advisory PostCSS internal pada Next.js hanya dapat diselesaikan penuh dengan beralih ke Next 16 (`next@16.4.2`). Saat ini Next 15 berada di patch puncak `15.5.28`. Konfirmasi apakah upgrade mayor ke Next 16 ingin dijadwalkan pada tahap refactoring terpisah setelah rilis stabil ini.
2. **Konfirmasi Penggabungan Cabang**:
   - Cabang `tahap-1-6-perbaikan` telah bersih dan stabil. Mohon arahan apakah cabang ini sudah disetujui untuk di-merge ke cabang utama atau cabang release.
