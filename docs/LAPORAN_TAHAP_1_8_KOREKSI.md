# LAPORAN TAHAP 1.8: KOREKSI KECIL DAN PENGERASAN EKSTENSI
**BTN Threads Monitoring System (SRS v0.2)**  
Tanggal: 18 Oktober 2026  
Cabang: `tahap-1-8-koreksi` (dari `tahap-1-7-koreksi`)  
Status: Selesai, Terverifikasi 100%, Tanpa Fitur Baru, Siap Diperiksa

---

## 1. Ringkasan Eksekutif

Tahap 1.8 berfokus murni pada perbaikan kecil, pemisahan kredensial otentikasi ekstensi, pengerasan validasi ekstensi Chrome Manifest V3, penegakan kebijakan pratinjau FR-02 (tanpa fabrikasi teks simulasi pada tautan nyata), pembersihan nomor CVE/CVSS eksternal pada catatan keamanan, pembuktian dukungan tempel banyak pada ModalImpor, serta dokumentasi pengujian manual spike.

Seluruh kriteria berhasil dipenuhi tanpa menambahkan fitur baru. Semua 81 pengujian otomatis (12 berkas uji unit & integrasi Vitest), pemeriksaan pemformatan Prettier, linter ESLint, dan `next build` lolos tanpa peringatan/kegagalan.

---

## 2. Rincian Realisasi 6 Poin Koreksi

### 1. Ekstensi Chrome: Hardening Domain & Validasi Input (`extension/`)
- **Penambahan Domain Threads**:
  - Menambahkan `https://www.threads.com/*` dan `https://threads.com/*` ke dalam `host_permissions` dan `content_scripts.matches` pada `extension/manifest.json` berdampingan dengan `threads.net`.
- **Validasi Ketat Sebelum Kirim (`extension/popup.js`)**:
  - Bila tautan bukan berasal dari domain Threads atau tidak memuat pola postingan spesifik (`/post/`), tombol kirim menolak proses dengan pesan:
    `"Halaman aktif bukan postingan Threads yang spesifik (harus memuat /post/). Data tidak dikirim."`
  - Bila ekstraksi teks kosong atau hanya berisi spasi putih, pengiriman ditolak dengan pesan:
    `"Teks postingan kosong atau tidak berhasil diekstraksi dari halaman. Data tidak dikirim."`
  - Data sama sekali **tidak dikirimkan** ke server bila salah satu kondisi di atas tidak terpenuhi.
- **Dokumentasi Lengkap (`extension/README.md`)**:
  - Panduan pemasangan ekstensi (*Load unpacked* di `chrome://extensions`).
  - Pengisian alamat server (penggantian `http://localhost:3000` dengan domain HTTPS produksi).
  - Penegasan bahwa selektor DOM saat ini (`div[dir="auto"]`) adalah asumsi berbasis struktur awal dan belum teruji langsung pada antarmuka Threads langsung.
  - Daftar uji manual lengkap (5 skenario pengujian).

---

### 2. Pemisahan Token: `EXTENSION_TOKEN` vs `INPUT_TOKEN`
- **Arsitektur Pemisahan Token**:
  - `INPUT_TOKEN`: Digunakan secara eksklusif untuk otentikasi login formulir Petugas Input via sesi cookie HMAC-SHA256 (`POST /api/auth/token`). Token ini **tidak lagi diterima** sebagai Bearer token di endpoint mana pun.
  - `EXTENSION_TOKEN`: Variabel lingkungan baru yang dikhususkan hanya untuk otentikasi ekstensi Chrome via header `Authorization: Bearer <EXTENSION_TOKEN>`.
- **Penegakan Rute Terpusat (`lib/auth/session.ts`)**:
  - Fungsi `isBearerAuth(req)` diperbarui hanya membaca dan memverifikasi token terhadap `process.env.EXTENSION_TOKEN` menggunakan `crypto.timingSafeEqual`.
  - Token Bearer **hanya diizinkan di satu endpoint**: `POST /api/mentions` (otomatis dipaksa menjadi status `DRAF` dan sumber input `EKSTENSI`).
- **Verifikasi Pengujian (`tests/integration/bearer-draft.test.ts`)**:
  - `POST /api/mentions` berhasil memproses draf dengan `EXTENSION_TOKEN` yang sah.
  - `POST /api/mentions` secara tegas menolak `INPUT_TOKEN` bila dikirimkan sebagai Bearer token (HTTP 401).
  - Seluruh rute tulis lainnya (`PATCH /api/mentions/[id]`, `DELETE /api/mentions/[id]`, `POST /api/drafts`, `PATCH /api/alerts`, `POST /api/topics`, `DELETE /api/topics`, `POST /api/sample-data`) secara tegas menolak `EXTENSION_TOKEN` (HTTP 401).

---

### 3. FR-02: Kebijakan Pratinjau Tautan Nyata (Tanpa Teks Simulasi)
- **Larangan Fabrikasi Teks**:
  - Untuk tautan nyata yang dimasukkan petugas, sistem **tidak pernah** lagi membuat atau menyimulasikan teks postingan tiruan ke dalam formulir.
  - Teks tiruan sintetis diisolasi dan dipertahankan **hanya** pada modul data contoh (`CONTOH` via `/api/sample-data`).
- **Antarmuka & Fallback Modal Input (`components/modals/ModalInput.tsx`)**:
  - Saat petugas memasukkan tautan Threads nyata dan pratinjau publik belum tersedia / gagal, sistem menampilkan pesan instruksi baku:
    > `"Teks tidak dapat diambil otomatis. Tempel teks postingan."`
  - Kolom teks (`textarea`) dibiarkan **kosong** agar petugas menempelkan teks kutipan asli secara manual (FR-03).
  - Tombol *"Lanjut ke Tinjau"* dinonaktifkan (`disabled`) sampai petugas menempelkan teks postingan asli, dan validasi server `createMentionSchema` tetap mewajibkan `teksPostingan.min(1)`.
- **Implementasi Stub & Unit Test**:
  - `lib/ingest/stub.ts` mengembalikan `{ ok: false, text: "", error: "Teks tidak dapat diambil otomatis. Tempel teks postingan." }`.
  - Berkas uji `tests/unit/preview-fallback.test.ts` memverifikasi bahwa URL nyata tidak menghasilkan teks simulasi dan selalu menampilkan pesan fallback baku.

---

### 4. Pembersihan Catatan Keamanan (`docs/SECURITY-NOTES.md`)
- **Pembersihan Nomor CVE & Skor CVSS Eksternal**:
  - Seluruh nomor CVE dan skor CVSS yang tidak terdapat dalam luaran mentah `npm audit` telah dihapus.
  - Seluruh rujukan kerentanan hanya mengutip ID GHSA resmi langsung dari audit (`GHSA-w5hq-g745-h8pq`, `GHSA-qx2v-qp2m-jg93`, `GHSA-6g55-p6wh-862q`, `GHSA-fxqj-rqcc-2cmp`, `GHSA-r28c-9q8g-f849`, `GHSA-5gmw-xhrv-c9v3`, dsb.).
- **Bukti Mentah Grep Pemanggilan UUID pada ExcelJS**:
  - Perintah:
    ```bash
    grep -rn "uuid" node_modules/exceljs/lib | head -20
    ```
  - Keluaran mentah:
    ```text
    node_modules/exceljs/lib/xlsx/xform/sheet/cf-ext/cf-rule-ext-xform.js:1:const {v4: uuidv4} = require('uuid');
    node_modules/exceljs/lib/xlsx/xform/sheet/cf-ext/cf-rule-ext-xform.js:43:      model.x14Id = `{${uuidv4()}}`.toUpperCase();
    node_modules/exceljs/lib/xlsx/xform/sheet/cf-ext/cf-rule-ext-xform.js:77:      id: model.x14Id || `{${uuidv4()}}`,
    ```
  - **Fakta Teknis**: ExcelJS hanya memanggil generator versi 4 (`uuidv4()`) dengan **0 argumen** (tanpa penyediaan parameter `buf`), sehingga kerentanan *buffer bounds check* pada `uuid` versi 3/5/6 terbukti tidak dapat dieksploitasi (*not exploitable*).

---

### 5. Konfirmasi Dukungan "Tempel Banyak" pada ModalImpor (`components/modals/ModalImpor.tsx`)
Modal impor telah diverifikasi dan dibuktikan mendukung mode masukan massal berikut:
1. **Mode Tempel Banyak (Tab Baku)**:
   - Menerima teks multiline pada textarea dengan format:
     - **Tautan Tunggal**: `https://www.threads.net/@user/post/1` (masuk sebagai draf dengan placeholder status impor).
     - **Tautan Berpasangan dengan Teks**: `https://www.threads.net/@user/post/2 | Teks kutipan nasabah`.
   - Logika pemisahan baris:
     ```typescript
     const lines = pasteContent.split("\n").map(l => l.trim()).filter(Boolean);
     const items = lines.map(line => {
       const parts = line.split("|");
       return {
         url: parts[0]?.trim() || "",
         text: parts[1]?.trim()
       };
     });
     ```
2. **Mode Berkas CSV & JSON**:
   - Mendukung berkas `.csv` (kolom `tautan,teks`) dan berkas `.json` hingga batas 50 item per batch transaksi.

---

### 6. Dokumentasi Spike Pratinjau Threads (`scripts/README.md`)
- Membuat berkas dokumentasi resmi `scripts/README.md` yang memuat:
  - Perintah eksekusi:
    ```bash
    npx tsx scripts/spike-preview.ts
    ```
  - Format berkas `scripts/spike-urls.txt` (satu URL per baris, mendukung komentar dengan `#`, batas maksimal 10 URL).
  - Ketentuan keamanan (timeout 8 detik, pembatasan 1 MB, jeda 2 detik, penghentian langsung bila terdeteksi HTTP 403 atau 429).
  - Format tabel luaran evaluasi.

---

## 3. Hasil Pengujian dan Verifikasi Akhir

| Komponen Uji | Perintah | Status | Keterangan |
| :--- | :--- | :---: | :--- |
| **Pengujian Unit & Integrasi** | `npm test` | **LOLOS** | 12 test files passed, 81 tests passed (100% green) |
| **Pemeriksaan Gaya Kode** | `npx prettier --check .` | **LOLOS** | Semua berkas sesuai panduan format Prettier |
| **Analisis Statis Linting** | `npm run lint` | **LOLOS** | Zero warning, zero error |
| **Kompilasi Produksi** | `npm run build` | **LOLOS** | Seluruh 8 rute Next.js berhasil dikompilasi |

---

## 4. Struktur Komit Git

Sesuai instruksi Tahap 1.8, seluruh komit dikelompokkan secara logis, dilakukan secara lokal pada cabang `tahap-1-8-koreksi`, dan **tidak di-push atau di-merge** ke remote:

1. `git commit -m "fix(extension): hardens domain matching and empty text validation, adds extension README"`
2. `git commit -m "feat(auth): separates EXTENSION_TOKEN from INPUT_TOKEN and rejects INPUT_TOKEN as Bearer"`
3. `git commit -m "fix(preview): implements FR-02 fallback message without text fabrication on real links and adds unit test"`
4. `git commit -m "docs(security): cleans up CVE/CVSS citations and appends exceljs uuid grep proof in SECURITY-NOTES.md"`
5. `git commit -m "docs(scripts): adds README for spike-preview script execution and spike-urls format"`
6. `git commit -m "docs: adds Tahap 1.8 final correction report"`
