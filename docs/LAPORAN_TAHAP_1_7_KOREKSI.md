# LAPORAN TAHAP 1.7: KOREKSI LAPORAN & TINJAUAN EKSTENSI
**BTN Threads Monitoring System (SRS v0.2)**  
Tanggal: 18 Oktober 2026  
Cabang: `tahap-1-7-koreksi` (bercabang dari `tahap-1-6-perbaikan`)  
Status: Selesai (Semua tes lolos, Prettier lolos, ESLint lolos, Build sukses, Komit lokal tanpa push)

---

## 1. Matriks Status FR Resmi (Sesuai docs/SRS.md Bagian 3)

Matriks berikut menggunakan nomor dan nama kebutuhan fungsional PERSIS dari dokumen `docs/SRS.md` Bagian 3. Status dinilai secara objektif dan jujur (*Selesai / Sebagian / Stub / Belum*) dengan satu kalimat bukti per baris.

| ID FR | Nama Fitur (docs/SRS.md) | Status | Bukti Implementasi / Status Terkini |
| :--- | :--- | :---: | :--- |
| **FR-01** | Input link | **Selesai** | Modal input memvalidasi protokol HTTPS dan host threads.net/threads.com serta jalur /post/ dengan pesan error jelas bila tidak valid. |
| **FR-02** | Pratinjau otomatis | **Sebagian** | Form saat ini memakai simulasi fallback pratinjau karena scraping web langsung Threads tertahan autentikasi; skrip spike manual `scripts/spike-preview.ts` telah disiapkan untuk evaluasi non-blokir. |
| **FR-03** | Tempel teks manual | **Selesai** | Tersedia textarea input postingan pada modal input yang memungkinkan petugas menempel atau mengedit teks secara manual tanpa terhalang kegagalan pratinjau. |
| **FR-04** | Analisis otomatis | **Sebagian** | Analisis sentimen, topik, prioritas, headline, dan ringkasan saat ini masih berbasis aturan leksikon/kata kunci (*rule-based stub*), belum terhubung ke LLM eksternal dan belum dievaluasi akurasinya terhadap set uji berlabel. |
| **FR-05** | Tinjau dan koreksi | **Selesai** | Hasil analisis ditampilkan pada Langkah 2 modal input dan modal edit draf, memungkinkan petugas mengoreksi seluruh nilai usulan sebelum disimpan. |
| **FR-06** | Simpan mention | **Selesai** | Petugas dapat menyimpan mention dengan status Baru, Dipantau, atau Selesai dicatat ke dalam basis data PostgreSQL via Prisma. |
| **FR-07** | Deteksi duplikat | **Selesai** | Normalisasi tautan membersihkan parameter pelacak query, mendeteksi duplikat dengan respon HTTP 409, dan menyediakan tombol untuk langsung membuka entri lama. |
| **FR-08** | Penyamaran data pribadi | **Selesai** | Redaksi email, nomor telepon, NIK 16 digit, dan nomor rekening dijalankan ulang di sisi server (`maskPii`) pada seluruh rute tulis sebelum data disimpan ke database. |
| **FR-09** | Kirim dari halaman (ekstensi Chrome) | **Selesai** | Ekstensi Chrome Manifest V3 di folder `extension/` mengekstrak teks/URL halaman aktif dan mengirimkannya ke API dengan token Bearer, otomatis dipaksa menjadi status Draf. |
| **FR-10** | Tempel banyak dan impor CSV | **Selesai** | Modal impor mendukung pemrosesan berkas CSV dan JSON dengan validasi Zod per item (maks 100 baris), pencegahan duplikat, dan pencatatan hasil ke Draf. |
| **FR-11** | Antrean tinjau Draf | **Selesai** | Halaman `/draf` menyajikan seluruh entri berstatus DRAF dan mengizinkan petugas mengoreksi, menyetujui (menjadi Baru), atau menolak/menghapus draf. |
| **FR-12** | Daftar, pencarian, dan filter | **Selesai** | Halaman `/mention` menyediakan pencarian teks bebas dan filter multi-kriteria (topik, sentimen, prioritas, status, rentang tanggal) terurut dari yang terbaru. |
| **FR-13** | Dashboard | **Selesai** | Dashboard Bento 7 kartu menampilkan metrik total mention, proporsi sentimen, kartu lonjakan perhatian, tren volume 7 hari, sentimen per topik, dan topik teratas. |
| **FR-14** | Deteksi lonjakan | **Selesai** | Logika `detectSpike` dan `detectSpikeAsync` mendeteksi lonjakan volume dan sentimen negatif berdasarkan nilai ambang yang tersimpan dinamis di database. |
| **FR-15** | Alert | **Selesai** | Alert ditampilkan pada TopHeader, Card 3 dashboard, dan halaman `/alert` dengan penyebab lonjakan serta indikator badge "Baru" untuk yang belum dibaca. |
| **FR-16** | Ringkasan mingguan | **Selesai** | Card 7 dashboard menyajikan ringkasan naratif periode berjalan dan tombol salin instan berformat Headline Post dan Summary Post. |
| **FR-17** | Ekspor laporan | **Selesai** | Endpoint `/api/export` menghasilkan laporan CSV (UTF-8 BOM), Excel XLSX via ExcelJS (bebas dari xlsx rentan), dan PDF cetak, mengecualikan DRAF dan menandai data CONTOH. |
| **FR-18** | Ubah status dan hapus | **Selesai** | Petugas dapat mengubah status (Baru, Dipantau, Selesai dicatat) dan menghapus entri mention secara permanen dengan dialog konfirmasi. |
| **FR-19** | Konfigurasi | **Selesai** | Halaman `/topik` mengizinkan petugas mengatur topik aktif/nonaktif, kata kunci risiko, serta ambang batas alert (volume, pengali, negatif, persentase) yang tersimpan di database. |
| **FR-20** | Data contoh | **Selesai** | Endpoint `/api/sample-data` menyediakan 40 postingan contoh sintetis realistis yang ditandai dengan label "Contoh" dan dapat dimuat/dibersihkan dengan satu klik. |

---

## 2. Penyeragaman Status Mention

Sesuai aturan bisnis SRS v0.2:
- Status mention resmi yang didukung sistem **hanya 4**:
  1. `DRAF` (Entri awal dari ekstensi atau impor CSV yang belum ditinjau)
  2. `BARU` (Mention aktif baru yang terhitung pada statistik)
  3. `DIPANTAU` (Mention yang sedang dalam penanganan/pantauan tim)
  4. `SELESAI` (Label antarmuka: *"Selesai dicatat"*)
- Istilah usang `DITANGGAPI` dan mekanisme *soft delete* telah **dihapus sepenuhnya** dari kode, dokumentasi, dan antarmuka. Seluruh aksi penghapusan mention merupakan *hard delete* permanen (`prisma.mention.delete`).

---

## 3. Penegakan Otentikasi Bearer Token (Ekstensi Chrome)

1. **Pembatasan Jalur Bearer Token**:
   - Guard `requireOfficer()` diubah dengan opsi `{ allowBearer: false }` secara baku.
   - Token Bearer **HANYA diterima di satu endpoint**: `POST /api/mentions`.
   - Seluruh rute tulis lainnya (`PATCH /api/mentions/[id]`, `DELETE /api/mentions/[id]`, `POST /api/drafts`, `PATCH /api/alerts`, `POST /api/topics`, `POST /api/sample-data`) secara tegas **menolak** token Bearer (mengembalikan HTTP 401: *"Akses ditolak. Masuk sebagai Petugas Input terlebih dahulu"*).
2. **Paksaan Status Server-Side**:
   - Setiap permintaan `POST /api/mentions` yang terautentikasi melalui Bearer token dipaksa oleh server menjadi:
     - `status = "DRAF"`
     - `sumberInput = "EKSTENSI"`
   - Nilai apa pun yang dikirimkan oleh payload klien diabaikan secara mutlak demi integritas data.
3. **Pengujian Integrasi**:
   - Diuji pada `tests/integration/bearer-draft.test.ts` (8 pengujian lolos 100%).

---

## 4. Ambang Batas Alert Dinamis Tersimpan di Database

1. **Model Basis Data `AlertConfig`**:
   - Dibuat tabel `AlertConfig` pada skema Prisma:
     - `volumeThreshold` (Int, default 10 mention/hari)
     - `volumeMultiplier` (Float, default 2.0x baseline)
     - `negativeThreshold` (Int, default 3 mention/hari)
     - `negativePercentage` (Float, default 40.0%)
     - `diubahPada` (DateTime, updatedAt)
   - Migrasi berhasil dijalankan (`20261017182133_add_alert_config`).
2. **Form Konfigurasi Halaman Topik**:
   - Menambahkan input untuk `pengaliVolume` (step 0.1, min 1.0) dan `persentaseNegatif` (1-100%).
   - Nilai dimuat otomatis dari database saat halaman `/topik` dibuka.
   - Tombol *"Simpan Perubahan Ambang"* mengirimkan `POST /api/topics` dengan payload ambang batas dan menyimpannya permanen ke tabel `AlertConfig`.
3. **Pengujian Dinamis**:
   - Diuji pada `tests/integration/thresholds-db.test.ts`: mengubah ambang batas di database secara langsung mengubah hasil pemicu `detectSpikeAsync` pada kumpulan data yang sama tanpa perlu mengubah satu baris kode pun.

---

## 5. Tabel Endpoint Lengkap

| No | Metode | Jalur Endpoint | Fungsi / SRS | Perlu Sesi / Token | Mekanisme Guard | Diuji di Vitest |
| :---: | :--- | :--- | :--- | :---: | :--- | :---: |
| 1 | **GET** | `/api/dashboard` | Statistik 7 card bento dashboard (FR-13) | Tidak | Terbuka (Read-only) | Ya |
| 2 | **GET** | `/api/mentions` | Daftar mention terpaginasi, filter, dan cek duplikat URL | Tidak | Terbuka (Read-only) | Ya |
| 3 | **POST**| `/api/mentions` | Buat mention manual (FR-01), ekstensi DRAF (FR-09), atau impor (FR-10) | **Ya** | Cookie sesi Petugas **ATAU** Bearer token (Bearer dipaksa DRAF & EKSTENSI) | **Ya** (`server-pii.test.ts`, `bearer-draft.test.ts`) |
| 4 | **PATCH**| `/api/mentions/[id]` | Perbarui status mention (BARU, DIPANTAU, SELESAI) (FR-18) | **Ya** | Cookie sesi Petugas (`requireOfficer()`, tolak Bearer) | **Ya** (`auth-guard.test.ts`, `bearer-draft.test.ts`) |
| 5 | **DELETE**| `/api/mentions/[id]` | Hapus permanen mention dari sistem (FR-18) | **Ya** | Cookie sesi Petugas (`requireOfficer()`, tolak Bearer) | **Ya** (`auth-guard.test.ts`, `bearer-draft.test.ts`) |
| 6 | **GET** | `/api/drafts` | Memuat antrean entri berstatus DRAF (FR-11) | Tidak | Terbuka / internal read | Ya |
| 7 | **POST**| `/api/drafts` | Menyetujui (`approve` -> BARU) atau menolak (`reject` -> hapus) draf (FR-11) | **Ya** | Cookie sesi Petugas (`requireOfficer()`, tolak Bearer) | **Ya** (`auth-guard.test.ts`, `server-pii.test.ts`, `bearer-draft.test.ts`) |
| 8 | **GET** | `/api/alerts` | Memuat daftar notifikasi alert sistem (FR-15) | Tidak | Terbuka (Read-only) | Ya |
| 9 | **PATCH**| `/api/alerts` | Menandai alert telah dibaca oleh petugas (FR-15) | **Ya** | Cookie sesi Petugas (`requireOfficer()`, tolak Bearer) | **Ya** (`auth-guard.test.ts`, `bearer-draft.test.ts`) |
| 10 | **GET** | `/api/topics` | Memuat daftar topik pantauan dan ambang alert aktif dari DB (FR-19) | Tidak | Terbuka (Read-only) | Ya |
| 11 | **POST**| `/api/topics` | Tambah/ubah topik atau simpan pembaruan ambang alert ke DB (FR-19) | **Ya** | Cookie sesi Petugas (`requireOfficer()`, tolak Bearer) | **Ya** (`auth-guard.test.ts`, `thresholds-db.test.ts`, `bearer-draft.test.ts`) |
| 12 | **DELETE**| `/api/topics` | Hapus topik pantauan dari konfigurasi (FR-19) | **Ya** | Cookie sesi Petugas (`requireOfficer()`, tolak Bearer) | **Ya** (`auth-guard.test.ts`, `bearer-draft.test.ts`) |
| 13 | **POST**| `/api/sample-data` | Mengisi (`seed`) atau membersihkan (`clear`) 40 data contoh demo (FR-20) | **Ya** | Cookie sesi Petugas (`requireOfficer()`, tolak Bearer) | **Ya** (`auth-guard.test.ts`, `bearer-draft.test.ts`) |
| 14 | **GET** | `/api/export` | Unduh laporan berformat CSV, Excel XLSX, atau PDF (FR-17) | Tidak | Terbuka (DRAF dikecualikan, formula disanitasi) | **Ya** (`export.test.ts`) |
| 15 | **GET** | `/api/auth/token` | Memeriksa status otentikasi sesi aktif klien | Tidak | Terbuka (Verifikasi cookie HMAC) | Ya |
| 16 | **POST**| `/api/auth/token` | Login: validasi token petugas via timingSafeEqual & terbitkan cookie sesi HMAC | Tidak | Rate-limiting in-memory (5x/menit/IP) | **Ya** (`auth-guard.test.ts`) |
| 17 | **DELETE**| `/api/auth/token` | Logout: menghapus cookie sesi petugas | Tidak | Menghapus cookie `petugas_session` | Ya |
| 18 | **GET** | `/api/health` | Health check liveness sistem & konektivitas database | Tidak | Terbuka | Ya |

---

## 6. Tinjauan Arsitektur Ekstensi Chrome (FR-09 & NFR-09)

Ekstensi dibangun minimal pada direktori `extension/`:

### A. Berkas `extension/manifest.json`
```json
{
  "manifest_version": 3,
  "name": "BTN Threads Monitoring - Quick Ingest",
  "version": "1.0.0",
  "description": "Ekstensi Chrome Petugas Input untuk mengirim postingan Threads langsung ke BTN Threads Monitoring sebagai Draf (FR-09).",
  "permissions": [
    "storage"
  ],
  "host_permissions": [
    "https://www.threads.net/*",
    "https://threads.net/*",
    "http://localhost:3000/*",
    "http://127.0.0.1:3000/*"
  ],
  "action": {
    "default_popup": "popup.html",
    "default_title": "Kirim Postingan ke BTN Monitoring"
  },
  "content_scripts": [
    {
      "matches": [
        "https://www.threads.net/*",
        "https://threads.net/*"
      ],
      "js": [
        "content.js"
      ],
      "run_at": "document_idle"
    }
  ]
}
```

### B. Penjelasan Hak Akses dan Arsitektur Ekstensi:
1. **Izin Minimum (`permissions`)**:
   - Hanya meminta `"storage"` untuk menyimpan URL server aplikasi dan token petugas secara lokal di browser petugas. Tidak ada izin berbahaya seperti `webRequest`, `cookies`, `management`, atau `tabs` yang berlebihan.
2. **Host Permissions & Host Aktif**:
   - `host_permissions` dibatasi ketat hanya pada domain resmi Threads (`https://www.threads.net/*`, `https://threads.net/*`) dan alamat server aplikasi lokal (`http://localhost:3000/*`, `http://127.0.0.1:3000/*`).
3. **Alamat Tujuan Pengiriman**:
   - Mengirim ke endpoint `${serverUrl}/api/mentions` via `POST` dengan header `Authorization: Bearer <TOKEN>`.
4. **Penyimpanan Token Petugas**:
   - Disimpan di media penyimpanan internal peramban petugas melalui `chrome.storage.local`. Token tidak pernah di-broadcast atau dikirimkan ke pihak ketiga selain server aplikasi yang dikonfigurasi.
5. **Mekanisme Ekstraksi Teks (`content.js`)**:
   - Pertama, memeriksa apakah petugas sedang menyorot/menyeleksi teks tertentu (`window.getSelection()`).
   - Bila tidak ada seleksi, mencari elemen postingan aktif (`article[data-pressable-container='true']` atau elemen `span[dir='auto']` artikel) dan mengambil konten teks postingan secara bersih (mengabaikan tombol Balas, Suka, Bagikan).
   - Mengambil URL postingan dari `window.location.href` dan membuang query string pelacak.

---

## 7. Skrip SPIKE Q-02 (`scripts/spike-preview.ts`)

- Berkas implementasi skrip evaluasi pratinjau telah dibuat di `scripts/spike-preview.ts`.
- Template berkas target URL dibuat di `scripts/spike-urls.txt` dan telah didaftarkan ke `.gitignore` sehingga tidak akan ter-commit.
- **Karakteristik Keamanan**:
  - Batas maksimal 10 URL.
  - Memvalidasi protokol HTTPS dan host Threads pada setiap lompatan redirect (maksimal 3 redirect).
  - Timeout 8 detik per request.
  - Pembatasan ukuran respon maksimal 1 MB.
  - Jeda 2 detik berurutan antar request.
  - Berhenti seketika dan melaporkan bila menerima status HTTP 403 atau 429 (tidak menembus blokir, tidak menggunakan headless browser).
- **Status Eksekusi**: Sesuai instruksi, **skrip ini belum dijalankan** menunggu pengisian URL riil oleh pengguna.

---

## 8. Hasil Pengujian & Verifikasi Mutu

- **Vitest Suite**: **11 test files passed (100%), 77 tests passed (100%)**.
  - `tests/integration/bearer-draft.test.ts`: 8 passed
  - `tests/integration/thresholds-db.test.ts`: 2 passed
  - `tests/integration/export.test.ts`: 2 passed
  - `tests/integration/server-pii.test.ts`: 6 passed
  - `tests/integration/auth-guard.test.ts`: 25 passed
  - `tests/unit/topic-selector.test.ts`: 6 passed
  - `tests/unit/url.test.ts`: 9 passed
  - `tests/unit/pii.test.ts`: 5 passed
  - `tests/unit/spike.test.ts`: 4 passed
  - `tests/unit/sanitize.test.ts`: 6 passed
  - `tests/unit/duplicate.test.ts`: 4 passed
- **Prettier Format Check**: `npx prettier --check .` -> **All matched files use Prettier code style!**
- **ESLint**: `npm run lint` -> **No ESLint warnings or errors**.
- **Next.js Production Build**: `npm run build` -> **Compiled successfully in 8.3s**, 8 static routes generated, 0 type errors.
