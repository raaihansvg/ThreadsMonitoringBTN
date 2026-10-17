# UI/UX & DESIGN SYSTEM SPECIFICATION — BTN Threads Monitoring

Versi 0.3 (revisi dari 0.2). Acuan tunggal (Single Source of Truth) untuk antarmuka dan pengalaman pengguna aplikasi **BTN Threads Monitoring**. Dokumen ini mengikuti SRS v0.2 (`docs/SRS.md`). Fokus desain: tata letak **Modern Bento Grid** dengan identitas **Bank BTN** yang bersih, formal, dan ergonomis.

---

## 0. Aturan Penulisan Antarmuka (Wajib)

1. **Dilarang menampilkan ID requirement** (FR-xx, BR-xx, NFR-xx, AC-xx) di antarmuka pengguna: tidak pada judul kartu, label, badge, maupun placeholder. Keterlacakan hanya ada di dokumen ini (bagian 9) dan komentar kode.
2. **Semua angka dihitung dari data di database**, tidak boleh di-hardcode. Tampilan data contoh harus berasal dari data contoh sungguhan (sumber input `CONTOH`).
3. **Bahasa Indonesia**; format angka `id-ID` (1.500; 64,5%), format tanggal `17 Okt 2026`.
4. Tidak menampilkan nomor versi internal (misalnya "v0.2") di antarmuka.

---

## 1. Prinsip Utama UI/UX

1. **Bento Grid Modularity:** informasi disajikan dalam kartu asimetris bersudut sangat membulat (`rounded-[28px]`) yang dikelompokkan dalam satu bingkai aplikasi (`rounded-[36px]`).
2. **BTN Modern Banking Identity:** kombinasi **BTN Electric Blue (`#0055FF`)**, **BTN Roof Red (`#E60012`)**, **Ice Blue (`#EBF3FF`)**, dan **Deep Navy (`#0A192F`)** di atas permukaan terang.
3. **Zero Emoji Policy:** dilarang memakai emoji Unicode. Semua indikator memakai ikon garis `lucide-react` dengan `strokeWidth={2}`.
4. **Input maksimal 3 langkah (NFR-01):** tempel tautan, tinjau, simpan, tanpa pindah halaman (bar input cepat atau modal terfokus).
5. **Role-Aware UI:**
   * **Mode Penonton (default, tanpa login):** kontrol tulis (Tambah, Impor, Ubah Status, Hapus, Setujui/Tolak Draf, Ubah Topik/Ambang, Tandai Dibaca, Kelola Data Contoh) disembunyikan atau dikunci dengan keterangan singkat.
   * **Mode Petugas Input (token valid):** kontrol tulis muncul dengan transisi halus.
   * **Penyembunyian tombol bukan pengamanan.** Semua aksi tulis wajib ditolak server tanpa sesi token valid.
6. **Tidak ada klaim real-time.** Data berasal dari tautan yang dicatat petugas.
7. **Status tidak boleh hanya dibedakan lewat warna:** selalu disertai teks atau ikon.
8. **Aksesibilitas sebagai syarat dasar** (lihat bagian 7).

---

## 2. Design Tokens

### A. Palet Warna
* **Canvas & Surfaces:**
  * `bg-canvas-outer`: `#E4E9F2` (latar halaman luar)
  * `bg-frame-main`: `#F4F7FB` (bingkai utama aplikasi)
  * `bg-bento-well`: `#E9EEF6` opasitas `70%` (wadah dalam kartu Bento)
  * `bg-card`: `#FFFFFF`
  * `bg-card-tinted`: `#EBF3FF` (Ice Blue)
  * `bg-card-brand`: `#0055FF` (BTN Electric Blue)
* **Teks:**
  * `text-primary`: `#0A192F` (judul, angka utama)
  * `text-secondary`: `#475569` (deskripsi, ringkasan)
  * `text-muted`: `#5A6A7E` (label kecil, sumbu grafik, timestamp). **Menggantikan `#94A3B8`** yang kontrasnya sekitar 2,6:1; nilai baru kira-kira 5:1 di atas putih dan Ice Blue. Verifikasi dengan alat kontras sebelum rilis.
  * `text-danger`: `#C10010` (teks merah di atas latar muda seperti `#FEF2F2`). `#E60012` hanya untuk elemen solid (pill, ikon besar) dengan teks putih.
* **Warna Semantik:**
  * Sentimen Positif: latar `#EBF3FF`, teks `#0055FF`, titik `#0055FF`
  * Sentimen Netral: latar `#F1F5F9`, teks `#475569`, titik `#64748B`
  * Sentimen Negatif: latar `#FEF2F2`, teks `#C10010`, titik `#E60012`
  * Prioritas Perlu Perhatian: pill solid `#E60012`, teks `#FFFFFF`
  * Prioritas Pantau: pill `#EBF3FF`, teks `#0055FF`
  * Prioritas Rutin: pill `#F1F5F9`, teks `#475569`
* **Fokus:** ring `ring-2 ring-[#0055FF] ring-offset-2` pada semua elemen interaktif.

### B. Tipografi (Plus Jakarta Sans, cadangan Inter; dimuat lewat `next/font`)
* **Ukuran minimum 12px** untuk semua teks (tidak ada `text-[10px]`).
* H1: `text-3xl md:text-4xl font-normal tracking-tight text-[#0A192F]`
* Angka Metrik Besar: `text-4xl xl:text-5xl font-normal tracking-tight text-[#0A192F]` (tanpa `font-bold`)
* Judul Kartu (H2): `text-xs font-bold uppercase tracking-wider text-slate-600`
* Headline Mention (H3): `text-base font-bold text-[#0A192F] leading-snug`
* Isi dan Ringkasan: `text-sm text-slate-600 leading-relaxed`

### C. Radius dan Elevasi
* Outer App Frame: `rounded-[36px] shadow-xl border border-white`
* Bento Well dan Sidebar: `rounded-[32px]`
* Bento Cards: `rounded-[28px] bg-white p-6 shadow-sm border border-slate-100`
* Pills dan Tombol: `rounded-full`, tinggi sentuh minimal 44px pada layar sentuh

---

## 3. Komponen Global

### 3.1 Top Header Bar
1. **Kiri, Brand Pill:** kapsul putih dengan `<BtnLogo />` (huruf `btn` biru `#0055FF`, atap merah `#E60012` di atas `n`), pemisah vertikal, teks **Threads Monitoring** (`text-xs font-extrabold`) dan sub-teks **Social Listening** (`text-xs text-slate-600`).
2. **Tengah-Kiri, Quick Action Bar** (hanya Mode Petugas; untuk Penonton disembunyikan): tiga tombol ikon bulat `h-10 w-10`:
   * `Plus`: membuka Modal Input.
   * `Upload`: membuka Modal Impor.
   * `Database`: toggle tampil/sembunyi Data Contoh (aktif: `bg-[#EBF3FF] text-[#0055FF]`).
   Untuk Penonton, toggle Data Contoh tetap tersedia (hanya mengubah tampilan, bukan data).
3. **Kanan:**
   * **Badge Data Contoh:** tampil bila data contoh sedang ditampilkan (`bg-white border border-[#0055FF]/20 text-[#0055FF] rounded-full px-3.5 py-2 text-xs font-bold`, ikon `FlaskConical`, teks "Data Contoh").
   * **Alert Bell Pill:** ikon `Bell`, tanggal hari ini, badge lingkaran `bg-[#E60012] text-white` berisi jumlah alert belum dibaca (disertai `aria-label`). Klik membuka halaman Alert.
   * **Tombol Peran:**
     * Penonton: `bg-[#0A192F] text-white`, ikon `Lock`, label **Masuk sebagai Petugas** (membuka Modal Token).
     * Petugas: `bg-[#0055FF] text-white`, ikon `Unlock`, label **Petugas Input · Keluar** (klik mengakhiri sesi dengan konfirmasi singkat).

### 3.2 Sidebar Navigasi (kapsul vertikal melayang)
* Desktop: `md:w-[88px] rounded-[32px] bg-white p-2.5`. Mobile (`< md`): bilah horizontal di atas konten.
* **Lima item** (`w-[68px] h-14 rounded-2xl flex flex-col items-center justify-center gap-0.5 text-xs font-bold`):
  1. **Dashboard** (`Activity`)
  2. **Mention** (`MessageSquare`)
  3. **Draf** (`FolderKanban`, badge angka antrean di sudut)
  4. **Alert** (`ShieldAlert`, badge angka belum dibaca)
  5. **Topik** (`Settings`)
* Aktif: `bg-[#0055FF] text-white shadow-sm`. Tidak aktif: `text-slate-600 hover:bg-slate-100`.
* Item **Draf** dan tombol tulis lain tetap terlihat oleh Penonton (hanya baca); aksi di dalamnya yang dikunci.
* Bagian bawah: tombol bulat `bg-[#0A192F] text-white hover:bg-[#0055FF]` ikon `ArrowUpRight` (ke tautan sumber/panduan; label `aria-label` wajib).

### 3.3 Sub-Header dan Filter Global
* **Kiri:** judul halaman aktif dan subjudul tetap: *"Data berasal dari tautan yang dicatat petugas, bukan pemantauan real-time."*
* **Kanan:**
  * **Rentang Tanggal (GLOBAL):** kapsul putih ikon `Calendar`. Berlaku untuk Dashboard, Mention, dan Ekspor; perubahannya dibawa saat pindah halaman.
  * **Granularitas** (hanya Dashboard): kapsul putih ikon `Clock`, pilihan `Harian` atau `Mingguan`.
  * **Dropdown Ekspor:** kapsul `bg-[#0A192F] text-white` dengan lingkaran putih berisi `Download`. Menu: **Laporan CSV (UTF-8 BOM)**, **Laporan Excel (.xlsx)**, **Laporan PDF**. Ekspor mengikuti rentang tanggal dan filter aktif; PDF memuat judul, rentang tanggal, filter aktif, ringkasan angka, dan tabel.

---

## 4. Dashboard: Tujuh Kartu Bento

Grid `grid-cols-1 lg:grid-cols-12 gap-5`. Seluruh angka mengikuti rentang tanggal global dan filter topik, kecuali kartu 6 yang selalu 7 hari terakhir. Entri berstatus Draf **tidak dihitung**.

1. **Kartu 1: Tren Volume Mention (`lg:col-span-7`)**
   * Baris atas: kotak indikator biru, judul kartu "Tren Mention dan Deteksi Lonjakan", dan keterangan ambang di kanan (mis. "Ambang: 10 per hari", nilai dari konfigurasi).
   * Angka kembar: **Total Mention** dengan pill pertumbuhan terhadap **periode sebelumnya dengan panjang yang sama** (tampil "Baru" bila periode sebelumnya 0), dan **Mention Negatif** dengan pill berisi persentase negatif dari total (mis. "14,8% dari total").
   * Grafik batang kapsul **hanya untuk sumbu waktu** (tidak boleh bercampur dengan perbandingan topik). Batang normal `bg-slate-200`; batang lonjakan `bg-[#0055FF]` disertai label teks "Lonjakan"; batang tertinggi diberi label "Tertinggi".
   * **Batas:** maksimal 31 batang. Bila rentang melebihi itu, otomatis agregasi mingguan dengan catatan kecil "Ditampilkan mingguan".
   * **Aksesibilitas:** wadah grafik `role="img"` dengan `aria-label` ringkasan; tersedia tombol **Lihat sebagai tabel**; tooltip dapat dibuka dengan fokus keyboard.
   * Baris bawah: pill filter topik (`Semua` plus topik aktif dari konfigurasi). Filter ini menyaring **seluruh dashboard**, bukan hanya grafik.

2. **Kartu 2: Persentase Sentimen Positif (`lg:col-span-2`, atas)**
   * Rumus: positif ÷ total mention × 100, satu desimal. Rincian di bawah: "N positif · N netral · N negatif". Total ketiganya harus sama dengan total mention.

3. **Kartu 3: Perlu Perhatian (`lg:col-span-2`, bawah, `bg-[#EBF3FF]`, border `border-[#0055FF]/15`)**
   * Ikon `AlertTriangle` merah, angka jumlah mention berprioritas Perlu Perhatian, tautan **Tinjau prioritas tinggi** ke halaman Mention dengan filter prioritas tersebut.

4. **Kartu 4: Sentimen per Topik dan Antrean (`lg:col-span-3`)**
   * Atas: legenda, total entri, dan batang horizontal tipis per topik. **Wajib menyertakan kategori Lainnya** sehingga jumlah semua batang sama dengan total mention.
   * Bawah (dua kolom, dipisah `border-t`): jumlah **Draf** menunggu tinjauan dan jumlah **Alert** aktif dengan badge merah "Baru" untuk yang belum dibaca. Keduanya dapat diklik ke halaman masing-masing.

5. **Kartu 5: Fokus Topik Teratas (`lg:col-span-4`, `bg-[#0055FF] text-white`)**
   * Dekorasi garis atap merah (`bg-[#E60012] h-1.5 w-20 rounded-b-full`) di kanan atas. Pill putih berisi porsi topik teratas terhadap total, empat lingkaran dekoratif (`aria-hidden`), dan nama topik dalam `text-4xl`.

6. **Kartu 6: Indeks Harian 7 Hari Terakhir (`lg:col-span-3`)**
   * Grafik lollipop 7 hari berakhir hari ini (label hari `S S R K J S M`). Garis `w-[2px] bg-slate-200`, kepala `h-2.5 w-2.5 rounded-full` biru; merah (`#E60012`) pada hari melampaui ambang disertai teks "Lonjakan" di tooltip dan di tabel alternatif.

7. **Kartu 7: Ringkasan Mingguan dan Input Cepat (`lg:col-span-5`)**
   * Header: judul "RINGKASAN MINGGUAN", sub-teks "Format kolom Headline Post dan Summary Post", tombol `Salin Ringkasan` (`bg-[#0A192F] text-white`). Setelah klik, label berubah menjadi "Tersalin" selama 2 detik.
   * Kotak pratinjau `rounded-2xl bg-[#F4F7FB] p-3` berisi Headline dan Summary minggu berjalan (Senin sampai hari ini).
   * **Bar Input Cepat** (hanya Mode Petugas): kapsul `rounded-full bg-[#F4F7FB] p-1.5 pl-4 border border-slate-200`, ikon `Link`, kolom tautan dengan placeholder "Tempel tautan https://www.threads.com/@.../post/...", dan tombol bulat `bg-[#0055FF] text-white` ber-`aria-label` "Analisis tautan". **Tanpa badge ID requirement.** Untuk Penonton, area ini menampilkan keterangan terkunci: "Masuk sebagai Petugas untuk menambah mention."

---

## 5. Halaman dan Modal

### 5.1 Halaman Mention
* **Filter dan Pencarian:** satu kartu (`rounded-[24px] bg-white p-4`) dengan input pencarian teks (ikon `Search`) dan dropdown **Topik**, **Sentimen**, **Prioritas**, **Status**. Rentang tanggal mengikuti filter global.
* **Daftar:** paginasi **di sisi server**, 20 item per halaman, urutan terbaru di atas. Menampilkan jumlah hasil.
* **Kartu Mention (`rounded-[24px] bg-white p-5`):**
  * Baris atas: pill Topik (`bg-[#0A192F] text-white`), pill Sentimen, pill Prioritas, tanggal ditemukan, tautan keluar **Sumber Threads** (ikon `ExternalLink`, `target="_blank" rel="noopener noreferrer"`). Entri data contoh diberi pill "Contoh". **Nama akun penulis tidak ditampilkan di mana pun.**
  * Isi: Headline tebal, Ringkasan, dan kutipan teks postingan yang sudah disamarkan PII dalam kotak `rounded-2xl bg-[#F4F7FB] p-3 italic`.
  * Footer: tag kata kunci di kiri; di kanan (hanya Petugas) dropdown status (`Baru`, `Dipantau`, `Selesai dicatat`) dan tombol `Trash2` dengan dialog konfirmasi.
* **Empty State:** kartu putih, ikon `Search`, pesan "Tidak ada mention yang sesuai dengan filter aktif", tombol `Reset Filter`.

### 5.2 Halaman Draf
* Kartu bergaris putus-putus (`border border-dashed border-slate-300 rounded-[24px] bg-white p-5`).
* Badge sumber: "Sumber: Ekstensi Chrome" atau "Sumber: Impor".
* Aksi untuk Petugas: **Setujui ke Dashboard** (`bg-[#0055FF] text-white`) dan **Tolak dan Hapus** (`bg-red-50 text-[#C10010]`, dengan konfirmasi). Petugas dapat mengedit hasil analisis sebelum menyetujui.
* Penonton melihat daftar tanpa tombol aksi. Empty state: "Tidak ada Draf menunggu tinjauan."

### 5.3 Halaman Alert (BARU)
* Daftar alert terbaru di atas, dengan filter **Semua** / **Belum dibaca**.
* Tiap alert menampilkan: jenis (**Lonjakan** atau **Perlu Perhatian**) dengan ikon dan teks, topik, periode, jumlah dibanding ambang (mis. "18 mention, ambang 10"), dan waktu dibuat.
* Tautan **Lihat mention terkait** membuka halaman Mention dengan topik dan periode tersebut sebagai filter.
* **Tandai dibaca** hanya untuk Petugas (menulis data). Penonton hanya melihat.
* Empty state: "Belum ada alert."
* Teks penjelas di atas daftar: "Alert hanya mencerminkan mention yang sudah dicatat."

### 5.4 Halaman Topik dan Konfigurasi (BARU)
* **Daftar Topik:** tabel/kartu berisi nama topik, kata kunci (chip), dan sakelar aktif. Petugas dapat menambah, mengubah, dan menghapus (dengan konfirmasi); Penonton hanya melihat.
* **Ambang Alert:** dua kolom angka: ambang lonjakan mention per hari dan ambang mention negatif per hari. Disertai teks bantuan singkat.
* **Kata Kunci Risiko:** daftar kata kunci yang menaikkan usulan prioritas menjadi Perlu Perhatian bila sentimen negatif.
* **Data Contoh:** tombol **Isi Data Contoh** dan **Hapus Semua Data Contoh** (konfirmasi dua langkah). Data contoh tidak pernah memengaruhi data nyata.
* Tombol **Simpan** aktif hanya setelah ada perubahan; pesan sukses atau galat jelas.

### 5.5 Modal Input (dua langkah)
* Overlay `bg-slate-900/50 backdrop-blur-xs`, kartu `rounded-[32px] bg-white p-6 shadow-2xl max-w-xl`; fokus terjebak di dalam modal dan `Esc` menutup (dengan konfirmasi bila ada isian).
* **Langkah 1 dari 2, Tempel Tautan:** kolom tautan (wajib) dan kolom teks postingan (opsional bila pratinjau berhasil). Keadaan:
  * *Memeriksa tautan:* spinner kecil.
  * *Tautan tidak valid:* pesan "Gunakan tautan HTTPS dari threads.net atau threads.com."
  * *Tautan duplikat:* banner Ice Blue "Tautan ini sudah tercatat" dengan tombol **Buka entri lama**; tombol Lanjut dinonaktifkan.
  * *Mengambil pratinjau:* skeleton pulse `bg-slate-200` pada area teks.
  * *Pratinjau berhasil:* teks terisi dan dapat diedit.
  * *Pratinjau gagal:* banner netral "Teks tidak dapat diambil otomatis. Tempel teks postingan di bawah." dengan fokus ke kolom teks.
* **Banner PII:** bila terdeteksi nomor telepon, email, NIK, atau rekening, tampilkan banner `bg-[#EBF3FF] border border-[#0055FF]/20 rounded-2xl p-3` berikon `ShieldCheck`: "Data sensitif telah disamarkan otomatis" beserta jenis yang ditemukan.
* **Langkah 2 dari 2, Tinjau dan Simpan:** kolom hasil analisis dapat diedit: Topik, Sentimen, Prioritas, Headline (penghitung 100 karakter), Ringkasan (penghitung 400 karakter), kata kunci, status awal `Baru`.
  * *Menganalisis:* skeleton hingga 15 detik, lalu pesan galat.
  * *Analisis gagal:* banner "Analisis otomatis gagal. Nilai bawaan dipakai (Netral, Rutin); mohon periksa sebelum menyimpan." Penyimpanan tetap diperbolehkan.
  * Tombol **Kembali** dan **Simpan mention**; setelah berhasil, modal menutup dan muncul notifikasi singkat.
* Jika sesi token berakhir saat menyimpan, tampilkan Modal Token tanpa kehilangan isian.

### 5.6 Modal Impor (BARU)
* Dua tab: **Tempel Banyak** dan **Unggah CSV**.
  * Tempel banyak: satu item per baris dengan format `tautan` atau `tautan | teks postingan`.
  * CSV: kolom `tautan` dan `teks` (teks opsional); tersedia tautan **Unduh contoh CSV**.
* Batas awal **50 item per kali** (usulan, menyesuaikan kuota LLM gratis; dapat diubah setelah evaluasi).
* Proses: indikator kemajuan "N dari M diproses".
* Hasil: ringkasan **Berhasil**, **Gagal**, **Duplikat** (jumlah dan daftar baris bermasalah dengan alasan), serta tombol **Lihat di Draf**. Semua item berhasil masuk sebagai Draf.

### 5.7 Modal Token (BARU)
* Kolom token bertipe kata sandi (dengan tombol tampilkan/sembunyikan), tombol **Masuk**.
* Galat: "Token tidak valid." (tanpa petunjuk lain). Pembatasan percobaan ditangani server.
* Server memeriksa token dan membuat **sesi dengan cookie httpOnly berumur pendek**; token **tidak boleh disimpan di localStorage/sessionStorage**.
* Setelah masuk, tombol peran berubah ke Mode Petugas. **Keluar** mengakhiri sesi.

---

## 6. Responsivitas dan Micro-States
* **Desktop (`lg` ke atas):** sidebar melayang 88px, grid 12 kolom. **Tablet/HP (`< md`):** navigasi horizontal di atas, kartu satu kolom (`grid-cols-1`, `p-4`), tabel digantikan kartu.
* **Loading:** skeleton `bg-slate-200 animate-pulse` untuk kartu dashboard, daftar, dan modal.
* **Galat jaringan:** kartu galat dengan tombol **Coba Lagi**.
* **Empty state** di setiap halaman yang berisi daftar (pesan khusus dan satu tindakan).
* Hormati `prefers-reduced-motion`: matikan animasi dan transisi non-esensial.

---

## 7. Aksesibilitas (NFR-14) Checklist
1. Kontras teks minimal 4,5:1 (teks besar 3:1), termasuk teks di atas `#EBF3FF`, `#F4F7FB`, dan `#0055FF`.
2. Ukuran teks minimal 12px; target sentuh minimal 44px.
3. Semua kontrol berlabel (`<label>` atau `aria-label`); tombol ikon wajib `aria-label`.
4. Navigasi penuh dengan keyboard; urutan fokus logis; ring fokus terlihat.
5. Modal: fokus terjebak, `Esc` menutup, fokus kembali ke pemicu.
6. Grafik: alternatif teks dan tabel; informasi tidak hanya lewat warna.
7. Pesan galat dan status diumumkan lewat `aria-live`.
8. Elemen dekoratif (lingkaran, garis atap) diberi `aria-hidden`.

---

## 8. Keputusan Teknis Terkait UI
1. **Tailwind v4 (usulan, perlu persetujuan):** prototipe memakai Tailwind v4 (Play). Proyek Tahap 0 memakai v3.4.17 dan beberapa kelas berbeda (mis. `backdrop-blur-xs` hanya ada di v4). Rekomendasi: naikkan proyek ke Tailwind v4 (konfigurasi berbasis CSS, `@tailwindcss/postcss`) sebelum kode UI dimulai; pin versi.
2. **Ikon:** `lucide-react` (pin versi).
3. **Font:** Plus Jakarta Sans lewat `next/font`.
4. **Grafik:** komponen CSS/SVG buatan sendiri (tanpa pustaka grafik) selama batas 31 batang dipatuhi.
5. Komponen UI tidak membaca data dari file contoh; semua data dari API (`/api/...`) yang membaca database.

---

## 9. Keterlacakan Layar ke Requirement (hanya di dokumen ini)

| Layar / Komponen | Requirement terkait |
|---|---|
| Modal Input (5.5) | FR-01, FR-02, FR-03, FR-04, FR-05, FR-06, FR-07, FR-08, NFR-01 |
| Modal Impor (5.6) | FR-10 |
| Halaman Draf (5.2) | FR-09, FR-10, FR-11, BR-03 |
| Halaman Mention (5.1) | FR-12, FR-18, BR-06 |
| Dashboard (4) | FR-13, FR-14, FR-16, BR-03, BR-09 |
| Halaman Alert (5.3) | FR-14, FR-15 |
| Topik dan Konfigurasi (5.4) | FR-19, FR-20, BR-02 |
| Ekspor (3.3) | FR-17 |
| Modal Token dan Mode Peran (3.1, 5.7) | BR-07, NFR-05, AC-17 |
| Aksesibilitas dan responsif (6, 7) | NFR-02, NFR-14 |

---

## 10. Pertanyaan Terbuka
1. **Popup ekstensi Chrome (FR-09):** desain belum dibuat (dokumen terpisah).
2. **Tandai dibaca pada alert:** diputuskan hanya Petugas (data tersimpan di server). Apakah Penonton perlu status baca per-perangkat?
3. **Batas impor 50 item** dan **rentang 31 batang** adalah usulan awal; sesuaikan setelah uji performa dan kuota LLM.
4. Persetujuan penggunaan Tailwind v4 (bagian 8).

---

## 11. Riwayat Revisi
**v0.3** (dari v0.2): menghapus ID requirement dari UI; mengganti `text-muted` dan warna teks merah demi kontras; ukuran teks minimal 12px; memisahkan grafik tren waktu dari perbandingan topik; menambah batas grafik, definisi persentase pertumbuhan dan sentimen, kategori Lainnya; menjadikan rentang tanggal global; menyamakan navigasi menjadi lima item (Dashboard, Mention, Draf, Alert, Topik); menambah spesifikasi halaman Alert, Topik/Konfigurasi, Modal Impor, Modal Token, dan status galat/duplikat/analisis gagal; menambah paginasi server dan checklist aksesibilitas; mencatat keputusan teknis Tailwind v4.
