# Software Requirements Specification (SRS)

Website ThreadsMonitoring: social listening Threads untuk BTN · Versi 0.3 · Proyek magang di Bank BTN

---

## Riwayat Perubahan

| Versi | Tanggal | Penulis / Peran | Ringkasan Perubahan |
| ----- | ------- | --------------- | ------------------- |
| 0.1 | 15 Okt 2026 | Analis Sistem | Draf awal spesifikasi kebutuhan social listening Threads untuk BTN. |
| 0.2 | 17 Okt 2026 | Analis Sistem | Penyelarasan lingkup MVP: integrasi ekstensi Chrome, tempel banyak, deteksi lonjakan dan alert ke dalam MVP. |
| 0.3 | 20 Okt 2026 | Penulis Dokumentasi Teknis | **Sinkronisasi Pasca-Tahap 3G:**<br>1. Pembuktian pratinjau publik (10/10 link lokal), batas 10 req/menit, cooldown 15 menit, dan toggle (Q-02 terjawab).<br>2. Dukungan link `/share/` dan status "Kanonik belum diketahui".<br>3. Klarifikasi penyimpanan teks penuh pasca-penyamaran PII, nama akun tidak disimpan sebagai kolom database namun terlihat di link (Q-04 sebagian terjawab, BR-06).<br>4. Penguatan aturan Draf (form kosong menjadi Draf, persetujuan wajib memuat teks, ekstensi & impor selalu Draf).<br>5. Konsolidasi logika Alert (hanya non-Draf, isolasi data nyata vs contoh, tanpa alert ganda).<br>6. Pengerasan keamanan: dua token terpisah (`INPUT_TOKEN`, `EXTENSION_TOKEN`), sesi bertanda tangan HMAC 8 jam, `SESSION_SECRET` wajib $\ge 32$ karakter, perlindungan CSRF, pembatasan laju (login 5/menit, mention 60/menit, pratinjau 10/menit), serta escape HTML dan CSP ketat pada ekspor cetak.<br>7. Aturan impor massal: batas 50 item di server, pemecahan pada pipa (`\|`) pertama, penghentian seketika saat rate limit 429 dan pelaporan `belumDiproses`.<br>8. Penambahan deteksi nomor kartu 16 digit pada penyamaran PII (FR-08, AC-05).<br>9. Pembaruan Ringkasan Mingguan: maksimal 5 mention Senin WIB s.d. hari ini, urut Perlu Perhatian $\rightarrow$ Negatif $\rightarrow$ terbaru (FR-16).<br>10. Penyesuaian ekspor PDF: dokumen HTML siap cetak di tab baru (FR-17, AC-13).<br>11. Penyempurnaan definisi sentimen: sikap penulis terhadap BTN, sopan di kalimat tanya bukan positif (BR-01).<br>12. Standarisasi seluruh penanggalan dan rentang waktu mengacu Waktu Indonesia Barat (WIB, Asia/Jakarta).<br>13. Status konfigurasi FR-19 (topik & ambang alert via UI; kata kunci risiko tetap di kode).<br>14. Klarifikasi daftar topik resmi dan nama "Pelayanan & CS" (Q-05 sebagian terjawab).<br>15. Penambahan bagian "Keterbatasan yang Diketahui". |

---

## 1. Pendahuluan

### 1.1 Tujuan Dokumen

SRS ini mendefinisikan kebutuhan fungsional dan nonfungsional website ThreadsMonitoring. Dokumen menjadi acuan bersama saat merancang basis data, antarmuka, proses bisnis, implementasi oleh Antigravity, dan pengujian.

### 1.2 Ruang Lingkup Produk

ThreadsMonitoring adalah aplikasi web dashboard social listening untuk postingan publik di Threads (Meta) tentang BTN, produk BTN (misalnya KPR, BTN Mobile, Tapera), dan kompetitor. Karena akses API resmi Threads tidak tersedia, postingan dimasukkan lewat link: petugas menempel link, mengirim dari halaman lewat ekstensi Chrome, atau mengimpor banyak sekaligus. Sistem mencoba mengambil teks dari link, lalu menganalisis sentimen, topik, dan prioritas secara otomatis. Pegawai kantor melihat hasilnya di dashboard, mencari dan memfilter, menerima alert saat ada lonjakan atau isu berisiko, dan mengunduh laporan.

Tidak termasuk: pengambilan data otomatis berbasis kata kunci (scraping massal otomatis tidak digunakan), integrasi API resmi Threads (dapat ditambahkan bila akses diperoleh di masa depan), dan integrasi langsung dengan sistem perbankan internal BTN.

### 1.3 Aktor

| Aktor | Deskripsi | Akses Utama |
| ----- | --------- | ----------- |
| Penonton | Pegawai BTN tanpa login. | Melihat dashboard, daftar mention, alert; mencari dan memfilter; melihat dan mencetak ringkasan/laporan (hanya baca). |
| Petugas Input | Pegawai pengelola data yang diautentikasi lewat `INPUT_TOKEN` dan sesi bertanda tangan (cookie). | Memasukkan link dan teks, meninjau dan menyetujui Draf, mengubah status, menghapus entri, mengatur topik dan ambang alert. |
| Pengguna Ekstensi | Petugas yang memasang ekstensi Chrome dengan `EXTENSION_TOKEN`. | Mengirim postingan Threads yang sedang dibuka langsung ke antrean Draf aplikasi. |
| Sistem | Proses otomatis di aplikasi. | Mengambil pratinjau publik, menganalisis teks, mendeteksi lonjakan, membuat alert, dan menegakkan batas laju (rate limit). |

---

## 2. Gambaran Umum Sistem

### 2.1 Aturan Input, Waktu, dan Analisis

1. Link harus HTTPS dengan host `threads.net` atau `threads.com` (mendukung path `/post/` maupun `/share/`).
2. Bila link berupa `/share/` dan alamat tujuan kanoniknya belum dapat diselesaikan, sistem mencatat status *"Kanonik belum diketahui"*.
3. Sistem mencoba mengambil pratinjau publik dari link terlebih dahulu secara on-demand (hanya saat tombol diklik); bila gagal atau kosong, formulir tempel teks tampil tanpa menghentikan alur kerja petugas.
4. Teks diperiksa untuk data pribadi (PII) sebelum disimpan dan sebelum dikirim ke penyedia analisis eksternal.
5. Formulir input manual yang disimpan tanpa teks secara otomatis disimpan sebagai berstatus **Draf**.
6. Persetujuan Draf menjadi mention aktif wajib memiliki teks (petugas wajib mengisi/mengoreksi teks sebelum draf disetujui).
7. Entri dari ekstensi Chrome dan impor massal selalu masuk berstatus **Draf** dan baru dihitung di dashboard setelah disetujui petugas.
8. Sentimen adalah representasi sikap penulis terhadap BTN. Ungkapan sopan di dalam kalimat tanya tidak dihitung sebagai sentimen positif.
9. **Standar Waktu:** Seluruh tanggal, jam, rentang filter, grafik, dan agregasi waktu sistem mengacu pada Waktu Indonesia Barat (**WIB**, Asia/Jakarta, UTC+7).

### 2.2 Batasan dan Ketentuan Proyek

1. Tidak ada akses API resmi Threads; scraping massal latar belakang berbasis kata kunci tidak digunakan.
2. Stack teknologi: Next.js (App Router), Prisma ORM, PostgreSQL ter-hosting, Vitest, dan Tailwind CSS.
3. Dashboard dan ekspor terbuka untuk dibaca tanpa login (keputusan pengguna); seluruh aksi tulis dilindungi sistem keamanan:
   - Akses tulis web menggunakan `INPUT_TOKEN` yang menghasilkan sesi bertanda tangan HMAC-SHA256 (cookie `HttpOnly`, `SameSite=Lax`, masa berlaku 8 jam).
   - Pengiriman dari ekstensi Chrome menggunakan token terpisah: `EXTENSION_TOKEN` (Bearer token).
   - Variabel rahasia `SESSION_SECRET` wajib memiliki panjang minimal 32 karakter demi keamanan kriptografi tanda tangan sesi.
   - Endpoint mutasi dilindungi dari serangan pemalsuan permintaan lintas situs (CSRF).
   - Pembatasan laju permintaan (rate limiting) diterapkan pada endpoint sensitif: percobaan login dibatasi 5 kali/menit, penyimpanan mention dibatasi 60 kali/menit (mengakomodasi impor 50 item), dan permintaan pratinjau dibatasi 10 kali/menit.
   - Halaman ekspor laporan cetak dilindungi sanitasi XSS (HTML escaping) dan kebijakan keamanan konten (CSP) ketat.
4. Analisis teks dirancang memakai LLM lewat antarmuka yang dapat ditukar, dengan kamus kata kunci sebagai cadangan (fallback). Pengiriman teks ke layanan LLM eksternal telah diizinkan (keputusan pengguna), asalkan teks telah disamarkan dari data pribadi.
5. Deploy ke lingkungan hosting awan; keputusan infrastruktur final ditentukan pada tahap rilis.
6. Pemisahan kode: struktur arsitektur modular memisahkan `/app` (halaman antarmuka dan rute API), `/components` (komponen UI), `/lib` (analisis, ingest, alert, keamanan, ekspor, utilitas), `/prisma` (skema dan migrasi), dan `/extension` (ekstensi peramban).

---

## 3. Kebutuhan Fungsional

| ID | Fitur | Kebutuhan |
| -- | ----- | --------- |
| FR-01 | Input link | Petugas dapat memasukkan link postingan Threads HTTPS dengan host `threads.net` atau `threads.com` (baik format `/post/` maupun `/share/`). Bila format `/share/` belum terselesaikan alamat aslinya, sistem menandai *"Kanonik belum diketahui"*. |
| FR-02 | Pratinjau otomatis | Sistem menyediakan fungsi pratinjau on-demand (hanya saat tombol ditekan). Terbukti berfungsi mengambil teks pada pengujian jaringan lokal (10 dari 10 link), namun belum diuji pada server deploy publik. Syarat operasional: dibatasi 10 permintaan/menit, jeda otomatis (cooldown) 15 menit jika Threads menolak/memblokir permintaan, fitur dapat dimatikan lewat konfigurasi, dan memerlukan izin kepatuhan sebelum diaktifkan di produksi. Bila pratinjau gagal/kosong/nonaktif, alur beralih ke input teks manual. |
| FR-03 | Tempel teks manual | Petugas dapat menempel atau mengedit teks postingan secara manual. Formulir yang disimpan tanpa teks otomatis berstatus Draf. |
| FR-04 | Analisis otomatis | Dari teks postingan, sistem menganalisis sentimen (positif, netral, negatif), topik, kata kunci, usulan prioritas (rutin, pantau, perlu perhatian), headline (maksimal 100 karakter), dan ringkasan (maksimal 400 karakter). Sentimen mengukur sikap terhadap BTN (ungkapan sopan di kalimat tanya tidak dihitung positif). Bila analisis gagal, nilai default aman digunakan disertai pesan informatif. |
| FR-05 | Tinjau dan koreksi | Hasil analisis otomatis tampil sebagai rekomendasi awal yang dapat diedit secara leluasa oleh petugas sebelum disimpan. |
| FR-06 | Simpan mention | Petugas dapat menyimpan mention berstatus Baru, Dipantau, atau Selesai dicatat. Menyimpan tanpa teks hanya diizinkan untuk status Draf. |
| FR-07 | Deteksi duplikat | Link dinormalisasi (menghapus parameter pelacakan, standardisasi host); tautan yang sudah ada ditolak dengan status konflik (409) atau diberi opsi membuka entri lama. |
| FR-08 | Penyamaran data pribadi | Teks dipindai untuk mendeteksi data pribadi nasabah/masyarakat: nomor telepon, email, NIK (16 digit), nomor rekening bank (10-15 digit), dan nomor kartu debit/kredit 16 digit (baik dengan pemisah spasi, tanda hubung/dash, maupun tanpa pemisah). Data pribadi wajib disamarkan menjadi token pengenal (misal `[NOMOR_KARTU_TERSEMBUNYI]`) sebelum disimpan di database dan sebelum dikirim ke mesin analisis eksternal. |
| FR-09 | Kirim dari halaman (ekstensi Chrome) | Petugas yang telah mengonfigurasi `EXTENSION_TOKEN` dapat mengirim URL dan teks postingan yang sedang dibuka di peramban ke aplikasi dengan satu klik; seluruh entri dari ekstensi otomatis berstatus Draf. |
| FR-10 | Tempel banyak dan impor CSV | Petugas dapat mengimpor banyak postingan sekaligus (tempel banyak atau berkas CSV). Batas seragam maksimal 50 item per proses ditegakkan di antarmuka dan di server. Pada tempel banyak, pemisahan hanya dilakukan pada tanda pipa (`\|`) pertama (tanda pipa berikutnya tetap menjadi bagian teks). Seluruh item berhasil masuk sebagai Draf. Bila server merespons pembatasan laju (HTTP 429), proses impor seketika dihentikan dan sisa item yang belum terkirim dilaporkan sebagai *"belum diproses"*, disertai informasi waktu tunggu `Retry-After`. |
| FR-11 | Antrean tinjau Draf | Petugas dapat melihat daftar antrean Draf, melakukan pengeditan teks dan klasifikasi, menyetujui Draf (berubah status menjadi Baru), atau menolak/menghapus Draf. Persetujuan Draf wajib memastikan teks postingan telah terisi (draf tanpa teks tidak dapat disetujui). |
| FR-12 | Daftar, pencarian, dan filter | Pengguna dapat mencari teks dan memfilter mention berdasarkan sentimen, topik, prioritas, status, rentang tanggal (berdasarkan WIB), dan opsi penyertaan data contoh; urutan default adalah terbaru di atas. |
| FR-13 | Dashboard | Menampilkan ringkasan metrik: total mention, proporsi sentimen, jumlah perlu perhatian, tren harian/mingguan (WIB), sentimen per topik, dan fokus topik teratas, yang secara dinamis mengikuti filter rentang tanggal dan filter data contoh. |
| FR-14 | Deteksi lonjakan | Sistem membandingkan volume mention harian dan mention bersentimen negatif terhadap rata-rata historis menggunakan satu logika deteksi terpusat. Deteksi hanya mengevaluasi entri non-Draf, memisahkan data nyata dan data contoh, serta menerapkan mekanisme deduplikasi sehingga tidak menghasilkan alert ganda untuk periode yang sama. |
| FR-15 | Alert | Indikator lonjakan dan mention berisiko tinggi (prioritas perlu perhatian) memicu alert yang dapat ditandai sudah dibaca oleh petugas. |
| FR-16 | Ringkasan mingguan | Menampilkan ringkasan postingan penting minggu berjalan (Senin 00:00 WIB hingga saat ini). Daftar dibatasi maksimal 5 mention terpenting dengan urutan prioritas: Perlu Perhatian, lalu sentimen Negatif, lalu tanggal terbaru. Setiap item menyajikan format *"Headline Post: ..."* dan *"Summary Post: ..."* (dengan cadangan 200 karakter pertama bila ringkasan kosong/sama dengan headline). Tersedia tombol satu klik untuk menyalin seluruh daftar ringkasan. |
| FR-17 | Ekspor laporan | Pengguna dapat mengekspor data mention sesuai filter aktif ke dalam format CSV (UTF-8 dengan BOM dan sanitasi formula), Excel (.xlsx), dan PDF. Format PDF disediakan berupa halaman dokumen web siap cetak di tab baru (`/api/export?format=pdf`) yang dapat disimpan sebagai PDF lewat dialog cetak peramban pengguna, bukan unduhan file `.pdf` biner mentah. |
| FR-18 | Ubah status dan hapus | Petugas yang terautentikasi dapat memperbarui status mention (Draf, Baru, Dipantau, Selesai) atau menghapus mention secara permanen melalui modal konfirmasi. |
| FR-19 | Konfigurasi | Petugas dapat mengonfigurasi daftar topik pantauan, kata kunci topik, dan ambang batas alert (persentase lonjakan dan minimum mention) melalui antarmuka web dan database tanpa perlu mengubah kode sumber. Konfigurasi kata kunci risiko saat ini masih dikelola di dalam kode (status konfigurasi penuh ditunda atas keputusan pemilik proyek). |
| FR-20 | Data contoh | Tersedia data contoh sintetis yang ditandai secara jelas (`isSample = true`). Pengguna dapat mengaktifkan atau menonaktifkan tampilan data contoh pada dashboard, sidebar, antrean draf, dan ekspor, serta dapat menghapus seluruh data contoh tanpa memengaruhi data nyata. |

---

## 4. Aturan Bisnis

| ID | Aturan |
| -- | ------ |
| BR-01 | **Definisi Sentimen:** Sentimen mencerminkan sikap penulis postingan terhadap Bank BTN, yang diklasifikasikan ke dalam: **positif**, **netral**, atau **negatif**. Ungkapan kesopanan atau tata krama di dalam kalimat tanya (misalnya *"terima kasih"*, *"makasih"*, *"mohon"*, *"tolong"*) tidak dihitung sebagai sentimen positif. |
| BR-02 | **Prioritas:** Prioritas bernilai **rutin**, **pantau**, atau **perlu perhatian**. Usulan awal menetapkan *perlu perhatian* bila sentimen bernilai negatif dan teks memuat kata kunci risiko (seperti penipuan, raib, lenyap, bobol, somasi); kriteria final menunggu penegasan Q-05. |
| BR-03 | **Status Draf:** Seluruh entri yang berasal dari formulir tanpa teks, ekstensi Chrome, dan impor massal wajib berstatus Draf. Entri Draf tidak dihitung dalam metrik dashboard, deteksi alert lonjakan, maupun laporan ekspor. Draf hanya dapat dinaikkan menjadi Baru bila teks postingan telah diisi. |
| BR-04 | **Data Publik:** Hanya postingan publik di Threads yang diizinkan untuk disimpan dan diolah di dalam sistem. |
| BR-05 | **Keunikan Tautan Sumber:** Setiap mention wajib memiliki tautan sumber asli (`linkAsli`) dan tautan hasil normalisasi (`linkTernormalisasi`) yang bersifat unik. Tautan `/share/` diterima dan ditandai status kanoniknya. |
| BR-06 | **Privasi Akun Penulis:** Nama akun penulis postingan tidak disimpan sebagai kolom tersendiri di basis data dan tidak ditampilkan sebagai atribut pengguna. Namun demikian, nama pengguna dapat terlihat secara inheren pada teks URL sumber karena struktur penamaan URL Threads (misalnya `threads.net/@nama_pengguna/post/...`). |
| BR-07 | **Model Hak Akses Bertingkat:** Dashboard, visualisasi grafik, pencarian, dan fitur ekspor terbuka untuk dibaca tanpa login oleh seluruh pegawai BTN (Penonton). Seluruh aksi mutasi data (tambah, impor, ubah status, setujui draf, hapus, kelola topik/ambang) memerlukan autentikasi Petugas Input melalui sesi web bertanda tangan (`INPUT_TOKEN`) atau token ekstensi (`EXTENSION_TOKEN`). |
| BR-08 | **Perlindungan Data Pribadi (PII):** Teks postingan yang memuat data pribadi (telepon, email, NIK, nomor rekening, atau nomor kartu 16 digit) wajib disamarkan sebelum disimpan permanen di database dan sebelum dikirim ke mesin inferensi LLM eksternal. |
| BR-09 | **Karakteristik Alert:** Alert lonjakan dan alert risiko hanya mencerminkan data yang telah disetujui di dalam sistem, dievaluasi melalui logika terpusat, mengisolasi data nyata dari data contoh, serta menerapkan deduplikasi agar tidak memicu alert ganda pada periode yang sama. Alert bukan pemantauan real-time terhadap seluruh ekosistem Threads. |
| BR-10 | **Isolasi Data Contoh:** Data sintetis contoh bertanda khusus tidak boleh digabungkan dengan data operasional nyata saat penyusunan laporan resmi dan perhitungan alert riil. |
| BR-11 | **Standarisasi Zona Waktu:** Seluruh pencatatan stempel waktu, interpretasi tanggal hari ini, batasan awal minggu (Senin 00:00 WIB), dan agregasi rentang waktu wajib dihitung berdasarkan Waktu Indonesia Barat (WIB, Asia/Jakarta, UTC+7). |

---

## 5. Kebutuhan Nonfungsional

| ID | Kategori | Kebutuhan |
| -- | -------- | --------- |
| NFR-01 | Usability | Antarmuka disajikan sepenuhnya dalam bahasa Indonesia yang baku; alur input manual selesai dalam maksimal 3 langkah (tempel tautan, tinjau hasil analisis, simpan). |
| NFR-02 | Responsif | Tata letak responsif dan dioptimalkan untuk layar monitor/laptop (resolusi standar kantor) serta dapat diakses dengan baik melalui perangkat seluler. |
| NFR-03 | Performance | Dashboard memuat data dalam waktu kurang dari 3 detik pada volume 5.000 mention; analisis otomatis berbasis kata kunci selesai seketika (< 500 ms), sementara analisis cadangan LLM selesai dalam maksimal 15 detik atau menampilkan fallback yang aman. |
| NFR-04 | Reliability | Kegagalan pada layanan pihak ketiga (pratinjau Threads atau API analisis) tidak boleh menghentikan sistem; formulir input manual dan analisis berbasis leksikon kata kunci selalu siap bekerja sebagai cadangan andal. |
| NFR-05 | Security (Autentikasi & Rahasia) | Akses tulis web menggunakan `INPUT_TOKEN` bersama dengan mekanisme sesi bertanda tangan kriptografis HMAC-SHA256 (cookie `HttpOnly`, `SameSite=Lax`, masa berlaku 8 jam). Token ekstensi menggunakan `EXTENSION_TOKEN` terpisah. Kunci rahasia `SESSION_SECRET` wajib memiliki panjang minimal 32 karakter dan server menolak berjalan bila bernilai default atau kurang dari 32 karakter. Seluruh token dan kunci rahasia disimpan di variabel lingkungan (.env), bukan di repositori kode. |
| NFR-06 | Security (Isolasi Server) | Kunci API pihak ketiga, token database, dan rahasia enkripsi hanya tersimpan dan dieksekusi di sisi server; tidak pernah dibocorkan ke bundel skrip klien peramban. |
| NFR-07 | Security (Perlindungan SSRF) | Permintaan pratinjau tautan Threads dibatasi secara ketat hanya pada domain yang diizinkan (`threads.net` dan `threads.com`), dengan resolusi DNS yang menolak alamat IP privat, loopback (localhost), dan rentang IP internal, serta dilengkapi batas waktu timeout (maksimal 5 detik) dan batas ukuran transfer data. |
| NFR-08 | Security (XSS, CSRF, & Rate Limit) | Seluruh input disanitasi di sisi server. Dokumen cetak HTML dilindungi dari serangan XSS melalui HTML entity escaping dan kebijakan keamanan konten (CSP) ketat. Endpoint mutasi dilindungi dari CSRF. Endpoint publik dibatasi lajunya (rate limiting): login maksimal 5 percobaan/menit, pembuatan mention maksimal 60 request/menit, dan pratinjau maksimal 10 request/menit. |
| NFR-09 | Security (Ekstensi Peramban) | Ekstensi Chrome hanya meminta izin minimum (`activeTab`, `scripting`, `storage`), hanya beroperasi pada halaman Threads aktif, dan hanya berkomunikasi dengan alamat server aplikasi yang telah ditentukan pengguna melalui otorisasi `EXTENSION_TOKEN`. |
| NFR-10 | Privacy | Penyamaran data pribadi (nomor ponsel, email, NIK, rekening, kartu debit/kredit 16 digit) dieksekusi di server sebelum data disimpan ke disk atau dikirim ke API eksternal. |
| NFR-11 | Architecture | Arsitektur modular memisahkan lapisan akses data (Prisma), logika bisnis/layanan (`lib/`), dan lapisan penyajian (`app/` dan `components/`). Komponen penyedia analisis berada di balik antarmuka seragam sehingga dapat dialihkan antara LLM dan leksikon kata kunci. |
| NFR-12 | Data Integrity | Integritas data ditegakkan melalui konstrain keunikan tautan ternormalisasi di tingkat basis data PostgreSQL, serta validasi tipe data menggunakan enum ketat (Status, Sentimen, Prioritas, Tipe Input). |
| NFR-13 | Scalability | Mampu menampung puluhan ribu entri mention dan melayani puluhan proses impor harian secara efisien tanpa memerlukan infrastruktur kluster khusus. |
| NFR-14 | Accessibility | Memenuhi standar rasio kontras visual palet warna korporat BTN dan menyediakan label formulir yang ramah pembaca layar (screen reader). |
| NFR-15 | Maintainability | Repositori terstruktur rapi dengan dokumentasi lengkap, panduan pengetesan otomatis komprehensif, serta konfigurasi topik dan ambang dinamis di basis data. |
| NFR-16 | Traceability | Seluruh kebutuhan fungsional dan aturan bisnis dapat ditelusuri secara konsisten ke user story dan skenario penerimaan (Acceptance Criteria). |

---

## 6. Kebutuhan Data

Sistem mengelola kelompok entitas data relasional utama di dalam PostgreSQL melalui Prisma:

| Entitas | Atribut Inti yang Dibutuhkan | Keterangan |
| ------- | ---------------------------- | ---------- |
| **Mention** | `id`, `linkAsli`, `linkTernormalisasi` (unik), `teksPostingan`, `sumberInput` (`FORM`, `EKSTENSI`, `IMPOR`, `SAMPLE`), `tanggalDitemukan`, `tanggalPostingan`, `topik`, `sentimen` (`POSITIF`, `NETRAL`, `NEGATIF`), `prioritas` (`RUTIN`, `PANTAU`, `PERLU_PERHATIAN`), `status` (`DRAF`, `BARU`, `DIPANTAU`, `SELESAI`), `statusKanonik` (`DIKETAHUI`, `BELUM_DIKETAHUI`), `headline`, `ringkasan`, `kataKunci`, `penyediaAnalisis`, `isSample`, `dibuatPada`, `diubahPada`. | Teks postingan penuh disimpan setelah penyamaran PII. Status awal impor/ekstensi/form kosong adalah Draf. |
| **Topic** | `id`, `nama`, `kataKunci`, `aktif`, `urutan`, `dibuatPada`, `diubahPada`. | Topik dan kata kunci pantauan dinamis yang dapat dikonfigurasi melalui UI (FR-19). |
| **Alert** | `id`, `jenis` (`LONJAKAN`, `PERLU_PERHATIAN`), `topik`, `periode`, `jumlah`, `ambangDipakai`, `sumberInput` (`REAL`, `SAMPLE`), `dibaca`, `dibuatPada`. | Memiliki batasan unik (`topik_periode_jenis_sumberInput`) untuk mencegah timbulnya alert ganda. |
| **ThresholdConfig** | `id`, `persenLonjakan`, `minMentionHarian`, `diubahPada`. | Parameter ambang deteksi lonjakan dinamis yang dapat diedit via UI. |
| **PreviewLimiterState** | `id`, `requestCount`, `windowStart`, `cooldownUntil`, `diubahPada`. | Pelacak status rate limit dan jeda 15 menit pengambilan pratinjau Threads. |

---

## 7. Use Case Ringkas

| Aktor | Use Case |
| ----- | -------- |
| **Penonton** | Melihat dashboard metrik dan grafik tren; mencari dan memfilter mention berdasarkan topik, sentimen, status, rentang tanggal WIB, dan saklar data contoh; melihat indikator dan daftar alert; menyalin ringkasan mingguan; membuka dan mencetak laporan PDF siap cetak; mengunduh berkas CSV dan Excel. |
| **Petugas Input** | Membuka sesi tulis dengan `INPUT_TOKEN`; memasukkan tautan dan mengambil pratinjau; menempel teks manual; mengoreksi hasil analisis; menyimpan mention; mengimpor tautan secara massal (tempel banyak / CSV); mengelola antrean Draf (mengisi teks draf, menyetujui draf menjadi Baru, atau menghapus draf); memperbarui status dan menghapus mention; mengatur topik pantauan dan ambang alert; mengaktifkan/menghapus data contoh sintetis. |
| **Pengguna Ekstensi** | Memasang ekstensi Chrome dengan `EXTENSION_TOKEN`; mengirim halaman postingan Threads yang sedang dibuka ke aplikasi menjadi antrean Draf. |
| **Sistem** | Mengeksekusi penyamaran data pribadi (PII); menjalankan analisis sentimen, topik, prioritas, dan ringkasan; mendeteksi duplikasi tautan; menghitung ambang lonjakan pada data non-Draf; membuat alert terisolasi; memberlakukan pembatasan laju (rate limiting) dan cooldown. |

---

## 8. Acceptance Criteria (AC)

| ID | Kriteria Penerimaan |
| -- | ------------------- |
| AC-01 | Tautan yang bukan HTTPS atau bukan dari host `threads.net` / `threads.com` ditolak dengan pesan kesalahan yang jelas. Tautan berformat `/share/` diterima dan ditandai status kanoniknya. |
| AC-02 | Pratinjau otomatis hanya berjalan saat tombol ditekan; bila pratinjau gagal atau nonaktif, formulir tempel teks tampil dan petugas tetap dapat melanjutkan analisis dan penyimpanan tanpa gangguan. |
| AC-03 | Tautan yang sama (termasuk variasi parameter pelacakan) terdeteksi sebagai duplikat dan ditolak agar tidak tersimpan dua kali. |
| AC-04 | Pada pengujian dengan korpus postingan uji, fungsi analisis menghasilkan topik, sentimen, prioritas, kata kunci, headline, dan ringkasan yang konsisten. Kalimat tanya yang hanya memuat kata sopan menghasilkan sentimen netral dan prioritas rutin. |
| AC-05 | Teks yang memuat nomor telepon, email, NIK (16 digit), nomor rekening bank, atau nomor kartu debit/kredit 16 digit (baik dengan pemisah spasi, tanda strip, atau tanpa pemisah) disamarkan secara otomatis di server sebelum disimpan atau dikirim ke layanan analisis eksternal. |
| AC-06 | Pengiriman dari ekstensi Chrome dengan `EXTENSION_TOKEN` valid berhasil mencatat tautan dan teks ke antrean Draf; permintaan tanpa token valid ditolak (401/403). |
| AC-07 | Impor massal (tempel banyak / CSV) dibatasi maksimal 50 item per proses di server; tempel banyak memecah pada tanda pipa (`\|`) pertama; bila terkena pembatasan laju (HTTP 429), antrean impor seketika berhenti, sisa item dihitung sebagai *"belum diproses"*, dan antarmuka menyajikan informasi waktu tunggu yang jelas. |
| AC-08 | Entri berstatus Draf tidak dihitung di dashboard, grafik tren, alert, maupun ekspor laporan. Persetujuan Draf menjadi status Baru wajib memvalidasi ketersediaan teks postingan. |
| AC-09 | Pencarian kata kunci dan filter multi-kriteria (sentimen, topik, prioritas, status, rentang tanggal WIB, penyertaan data contoh) menghasilkan data yang akurat sesuai kriteria aktif. |
| AC-10 | Angka statistik dan visualisasi grafik dashboard selaras dengan data tersimpan di basis data sesuai rentang tanggal WIB dan filter data contoh yang dipilih. |
| AC-11 | Deteksi lonjakan mengevaluasi data non-Draf secara terpusat, memisahkan data nyata dari data contoh, memicu alert saat melampaui ambang, dan tidak menghasilkan alert duplikat untuk topik dan periode yang sama. |
| AC-12 | Ringkasan mingguan menampilkan maksimal 5 mention penting minggu berjalan (Senin 00:00 WIB s.d. hari ini) dengan urutan Perlu Perhatian $\rightarrow$ Negatif $\rightarrow$ terbaru, menyajikan Headline Post dan Summary Post, serta dapat disalin lengkap dengan satu tombol. |
| AC-13 | Ekspor CSV (UTF-8 dengan BOM dan sanitasi simbol formula) dan Excel memuat data sesuai filter aktif. Ekspor PDF membuka halaman dokumen HTML siap cetak di tab baru dengan tata letak laporan rapi, ringkasan metrik, filter aktif, dan daftar mention yang siap disimpan via fitur cetak peramban. |
| AC-14 | Perubahan status dan penghapusan mention ditolak bila tanpa sesi petugas yang valid; dengan sesi valid, aksi berhasil dieksekusi dengan konfirmasi modal. |
| AC-15 | Perubahan daftar topik, kata kunci topik, dan ambang batas alert melalui antarmuka web langsung diterapkan pada proses analisis dan deteksi berikutnya tanpa mengubah kode sumber. |
| AC-16 | Data contoh sintetis tampil dengan penanda visual khusus, dapat disaring secara terpisah, dan dapat dihapus secara menyeluruh tanpa merusak data operasional nyata. |
| AC-17 | Seluruh endpoint mutasi (`POST`, `PATCH`, `DELETE`) menolak permintaan tanpa autentikasi token/sesi yang sah (HTTP 401/403); elemen kontrol tulis disembunyikan dari Penonton yang tidak login. |
| AC-18 | Saat mesin analisis eksternal gagal atau mengalami timeout, sistem secara transparan mengalihkan proses ke analisis leksikon kata kunci lokal (fallback) dengan nilai aman dan pesan informatif. |
| AC-19 | Permintaan pengambilan pratinjau tautan ke alamat IP privat/lokal (SSRF) atau ke domain selain Threads secara ketat ditolak dan diblokir oleh server. |

---

## 9. Traceability User Story dan Requirement

| User Story | Cerita Pengguna | Requirement Terkait | Acceptance Criteria |
| ---------- | --------------- | ------------------- | ------------------- |
| US-01 | Sebagai petugas, saya memasukkan tautan postingan agar tercatat tanpa duplikat. | FR-01, FR-07 | AC-01, AC-03 |
| US-02 | Sebagai petugas, saya ingin teks postingan diambil otomatis dari tautan secara aman, atau menempel teks manual bila pratinjau gagal. | FR-02, FR-03 | AC-02, AC-19 |
| US-03 | Sebagai petugas, saya ingin analisis otomatis terhadap sentimen, topik, dan prioritas yang dapat saya koreksi sebelum disimpan. | FR-04, FR-05, FR-06 | AC-04, AC-18 |
| US-04 | Sebagai petugas, saya ingin data pribadi nasabah tersamarkan secara otomatis sebelum disimpan. | FR-08 | AC-05 |
| US-05 | Sebagai petugas, saya ingin mengirim postingan Threads yang sedang saya buka di peramban ke antrean Draf aplikasi dengan satu klik. | FR-09 | AC-06 |
| US-06 | Sebagai petugas, saya ingin memasukkan hingga 50 postingan sekaligus lewat tempel banyak atau CSV dengan proteksi batas laju. | FR-10 | AC-07 |
| US-07 | Sebagai petugas, saya ingin meninjau antrean Draf, melengkapi teks, dan menyetujuinya sebelum data dihitung di sistem. | FR-11 | AC-08 |
| US-08 | Sebagai penonton, saya ingin mencari teks dan memfilter mention berdasarkan berbagai parameter dan tanggal WIB. | FR-12 | AC-09 |
| US-09 | Sebagai penonton, saya ingin dashboard visual yang menyajikan tren, sentimen, dan fokus topik secara akurat. | FR-13 | AC-10 |
| US-10 | Sebagai penonton, saya ingin mendapatkan pemberitahuan alert yang akurat saat terjadi lonjakan keluhan atau isu berisiko tinggi tanpa alert ganda. | FR-14, FR-15 | AC-11 |
| US-11 | Sebagai penonton, saya ingin melihat dan menyalin ringkasan mingguan (maksimal 5 mention terpenting) untuk laporan cepat. | FR-16 | AC-12 |
| US-12 | Sebagai penonton, saya ingin mengunduh data dalam format CSV dan Excel, serta membuka dokumen PDF siap cetak di tab baru. | FR-17 | AC-13 |
| US-13 | Sebagai petugas, saya ingin memperbarui status tindak lanjut mention atau menghapus data yang tidak relevan. | FR-18 | AC-14 |
| US-14 | Sebagai petugas, saya ingin mengonfigurasi topik pantauan dan parameter ambang alert melalui antarmuka web. | FR-19 | AC-11, AC-15 |
| US-15 | Sebagai pengguna, saya ingin dapat memuat dan membersihkan data contoh sintetis untuk keperluan uji coba dan demonstrasi. | FR-20 | AC-16 |
| US-16 | Sebagai pemilik sistem, saya ingin memastikan seluruh aksi perubahan data terlindungi oleh otorisasi token dan sesi yang aman. | BR-07, NFR-05, NFR-08 | AC-17 |

---

## 10. Keterbatasan yang Diketahui (Known Limitations)

Bagian ini mendokumentasikan keterbatasan teknis aplikasi saat ini yang diketahui dan telah disepakati untuk disempurnakan pada fase rilis berikutnya:

1. **Batas Laju Berbasis Memori di Lingkungan Serverless:**
   Mekanisme pembatasan laju (*in-memory rate limiter*) saat ini menyimpan status hitungan di dalam memori proses server lokal. Pada lingkungan hosting *serverless* multi-instans atau *auto-scaling*, status memori tidak dibagi antar-instans sehingga keandalan kuota laju permintaan berkurang. Solusi terpusat (seperti Redis / Upstash atau penyimpanan tabel basis data) akan dibereskan saat persiapan deploy produksi.
2. **Perbedaan Daftar Topik Bawaan Kode dengan Seed Database:**
   Daftar topik bawaan di kode sumber ([`lib/analysis/topicSelector.ts`](file:///home/remoniceguy/Documents/threadsMonitoringBtn/lib/analysis/topicSelector.ts)) saat ini mencantumkan topik *"Layanan Kantor Cabang"*, sedangkan seed basis data ([`prisma/seed.ts`](file:///home/remoniceguy/Documents/threadsMonitoringBtn/prisma/seed.ts)) menggunakan nama *"Pelayanan & CS"*. Meskipun sistem berjalan dengan baik karena fallback topik dinamis, daftar topik statis di kode akan disatukan dengan seed database pada tahap berikutnya.
3. **Keterbatasan Analisis Cadangan Berbasis Kamus Kata:**
   Analisis sentimen dan topik cadangan (fallback) berbasis leksikon kata kunci memiliki keterbatasan alami dalam memahami struktur bahasa Indonesia informal (variasi imbuhan kompleks, sarkasme, dan kata-kata baru yang belum tercantum di kamus). Analisis cerdas utama berbasis LLM eksternal belum diimplementasikan dan saat ini aplikasi mengandalkan analisis cadangan berbasis leksikon ini.

---

## 11. Risiko dan Pertanyaan Terbuka

### 11.1 Keputusan yang Sudah Diambil

- Pengiriman teks postingan ke layanan LLM eksternal diizinkan setelah melalui tahapan penyamaran data pribadi (menjawab Q-001 versi awal).
- Dashboard, daftar pencarian, dan fitur ekspor laporan dibuka untuk dibaca tanpa login oleh pegawai BTN (menjawab Q-003 versi awal).
- Fitur ekstensi Chrome, tempel banyak / impor CSV, serta deteksi lonjakan dan sistem alert digabungkan ke dalam ruang lingkup MVP aplikasi.
- **Pemisahan Token dan Pengerasan Sesi:** Menggunakan dua token terpisah (`INPUT_TOKEN` untuk web dan `EXTENSION_TOKEN` untuk ekstensi Chrome). Sesi web menggunakan tanda tangan HMAC-SHA256 bervaliditas 8 jam dengan kewajiban `SESSION_SECRET` minimal 32 karakter (menjawab kebutuhan keamanan Tahap 3G).
- **Format Ekspor PDF:** Format PDF ditetapkan bukan sebagai berkas biner `.pdf` unduhan langsung, melainkan berupa dokumen laporan HTML terstruktur dan siap cetak di tab baru peramban (`/api/export?format=pdf`) yang disimpan sebagai PDF melalui dialog cetak sistem operasi / browser pengguna (keputusan pemilik proyek).
- **Format Impor Massal & Penanganan 429:** Batas seragam 50 item per batch ditegakkan di server; pembagian teks pada tanda pipa (`\|`) pertama; proses impor seketika berhenti saat mendapati HTTP 429 dan mencatat sisa antrean sebagai `belumDiproses`.
- **Standarisasi Waktu:** Seluruh representasi waktu menggunakan WIB (Asia/Jakarta, UTC+7).

### 11.2 Risiko

| ID | Risiko | Mitigasi |
| -- | ------ | -------- |
| R-01 | Pratinjau link Threads diblokir atau gagal pada server deploy publik (meskipun terbukti berhasil 10 dari 10 tautan pada lingkungan jaringan lokal). | Disediakan formulir tempel teks manual sebagai jalur cadangan utama, saklar penonaktifan pratinjau, jeda otomatis (cooldown) 15 menit bila terkena pemblokiran, dan penggunaan ekstensi Chrome. |
| R-02 | Kuota layanan LLM eksternal habis, tarif berubah, atau mengalami gangguan jaringan. | Tersedia antarmuka penyedia analisis yang modular dan analisis cadangan berbasis leksikon kata kunci lokal yang mandiri dan cepat. |
| R-03 | Penurunan akurasi analisis sentimen pada teks berbahasa gaul, singkatan daerah, atau bahasa campuran. | Penyediaan antarmuka koreksi manual oleh petugas input sebelum atau sesudah data disimpan, serta normalisasi pemanjangan karakter vokal. |
| R-04 | Cakupan fitur yang luas melampaui batas waktu magang. | Pembangunan perangkat lunak secara bertahap dan teruji otomatis (unit & integrasi) pada setiap tahapan rilis. |
| R-05 | Alert hanya mencerminkan data yang telah berhasil dihimpun ke dalam sistem (BR-09), bukan seluruh obrolan di jagat Threads. | Penyampaian informasi disclaimer yang transparan pada antarmuka bahwa sistem menyajikan social listening berbasis entri terpantau. |
| R-06 | Pemasangan ekstensi Chrome memerlukan hak administratif atau kebijakan peramban korporat kantor. | Disediakan jalur input manual dan impor CSV sebagai alternatif penuh tanpa ketergantungan pada ekstensi. |
| R-07 | Dashboard publik internal dapat diakses oleh siapa saja yang memiliki tautan jaringan. | Seluruh data yang disajikan bersifat publik tanpa menampilkan nama akun penulis (BR-06) dan data pribadi telah disamarkan (BR-08); seluruh tombol manipulasi data disembunyikan dan dilindungi otorisasi ketat. |

### 11.3 Status Pertanyaan Terbuka

- **Q-02: Terjawab.** Pratinjau publik tautan Threads terbukti memuat teks postingan dan berhasil diekstraksi pada pengujian jaringan lokal (10 dari 10 tautan). Operasionalnya dilengkapi proteksi kuota 10 req/menit, jeda otomatis 15 menit, dan saklar kontrol kepatuhan.
- **Q-04: Sebagian Terjawab.** Teks postingan penuh diizinkan untuk disimpan di basis data setelah melalui pemindaian dan penyamaran data pribadi (PII). Nama akun penulis disepakati untuk tidak disimpan sebagai kolom tersendiri di basis data. Kebijakan mengenai masa retensi data (berapa lama data disimpan sebelum diarsipkan/dihapus) masih menunggu ketetapan resmi pembimbing lapangan.
- **Q-05: Sebagian Terjawab.** Nama resmi kategori layanan disepakati menggunakan nama **"Pelayanan & CS"**. Daftar topik resmi terdiri dari 6 kategori: **KPR BTN**, **BTN Mobile**, **Tabungan BTN**, **Tapera**, **Pelayanan & CS**, dan **Lainnya**. Kriteria kuantitatif final mengenai eskalasi prioritas *"perlu perhatian"* masih terbuka untuk disempurnakan bersama unit kerja terkait.
- **Q-06: Terbuka.** Perkiraan volume mention harian rata-rata dan penetapan daftar pegawai pemegang `INPUT_TOKEN` definitif di lingkungan divisi kerja Bank BTN.
- **Q-07: Terbuka.** Pemilihan penyedia layanan LLM gratis/berbiaya rendah yang paling andal setelah evaluasi perbandingan korpus uji.
- **Q-08: Terbuka.** Kebutuhan saluran notifikasi alert eksternal lanjutan (misalnya integrasi pesan instan Telegram atau notifikasi email ke penanggung jawab divisi terkait).
- **Q-09: Terbuka.** Mekanisme distribusi dan registrasi ekstensi Chrome untuk peramban komputer kerja pegawai (apakah dimuat secara manual melalui *developer mode* atau melalui *Chrome Web Store* internal perusahaan).
