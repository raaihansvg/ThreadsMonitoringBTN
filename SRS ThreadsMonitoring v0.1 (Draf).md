# Software Requirements Specification (SRS)

Website ThreadsMonitoring: social listening Threads untuk BTN · Versi 0.2 (draf untuk ditinjau) · Proyek magang di Bank BTN

## 1. Pendahuluan

### 1.1 Tujuan Dokumen

SRS ini mendefinisikan kebutuhan fungsional dan nonfungsional website ThreadsMonitoring. Dokumen menjadi acuan bersama saat merancang basis data, antarmuka, proses bisnis, implementasi oleh Antigravity, dan pengujian.

### 1.2 Ruang Lingkup Produk

ThreadsMonitoring adalah aplikasi web dashboard social listening untuk postingan publik di Threads (Meta) tentang BTN, produk BTN (misalnya KPR, BTN Mobile, Tapera), dan kompetitor. Karena akses API resmi Threads tidak tersedia, postingan dimasukkan lewat link: petugas menempel link, mengirim dari halaman lewat ekstensi Chrome, atau mengimpor banyak sekaligus. Sistem mencoba mengambil teks dari link, lalu menganalisis sentimen, topik, dan prioritas secara otomatis. Pegawai kantor melihat hasilnya di dashboard, mencari dan memfilter, menerima alert saat ada lonjakan atau isu berisiko, dan mengunduh laporan.

Tidak termasuk: pengambilan data otomatis berbasis kata kunci (scraping tidak digunakan), integrasi API resmi Threads (dapat ditambahkan bila akses diperoleh), dan integrasi dengan sistem internal BTN.

### 1.3 Aktor

| Aktor         | Deskripsi                                                                 | Akses Utama                                                                                                          |
| ------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Penonton      | Pegawai BTN tanpa login.                                                  | Melihat dashboard, daftar mention, alert; mencari dan memfilter; mengunduh laporan (hanya baca).                     |
| Petugas Input | Pegawai yang mengelola data; mengakses fitur tulis memakai token bersama. | Memasukkan link dan teks, meninjau dan menyetujui draf, mengubah status, menghapus, mengatur topik dan ambang alert. |
| Sistem        | Proses otomatis di aplikasi.                                              | Mengambil pratinjau, menganalisis teks, mendeteksi lonjakan, membuat alert.                                          |

## 2. Gambaran Umum Sistem

### 2.1 Aturan Input dan Analisis

1. Link harus HTTPS dengan host threads.net atau threads.com.
2. Sistem mencoba pratinjau publik dari link lebih dulu; bila gagal atau kosong, petugas menempel teks secara manual.
3. Teks diperiksa untuk data pribadi sebelum disimpan dan sebelum dikirim ke penyedia analisis eksternal.
4. Validasi wajib dilakukan di sisi server, bukan hanya pada form.
5. Entri dari ekstensi Chrome dan impor massal masuk berstatus Draf dan baru dihitung di dashboard setelah disetujui petugas.

### 2.2 Batasan dan Ketentuan Proyek

1. Tidak ada akses API resmi Threads; scraping otomatis berbasis kata kunci tidak digunakan.
2. Stack: Next.js, Prisma, dan database PostgreSQL ter-hosting. Antigravity bertindak sebagai agen pengkodean.
3. Dashboard dan ekspor terbuka tanpa login (keputusan pengguna); semua aksi tulis dilindungi token Petugas Input.
4. Analisis teks memakai LLM gratis lewat antarmuka yang dapat ditukar, dengan kamus kata kunci sebagai cadangan. Pengiriman teks ke layanan LLM eksternal telah diizinkan (keputusan pengguna).
5. Deploy ke layanan gratis seperti Vercel; keputusan akhir ditunda sampai tahap akhir.
6. Kode dipisahkan minimal antara akses database, tampilan, dan logika proses. Struktur folder minimal: /app (halaman dan API), /components, /lib (analisis, input, ekspor, alert), /prisma, /extension.

## 3. Kebutuhan Fungsional

| ID    | Fitur                                | Kebutuhan                                                                                                                                                                                                                                                                          |
| ----- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-01 | Input link                           | Petugas dapat memasukkan link postingan Threads; hanya HTTPS dengan host threads.net atau threads.com yang diterima.                                                                                                                                                               |
| FR-02 | Pratinjau otomatis                   | Setelah link valid, sistem mencoba mengambil teks publik dari link; bila gagal atau kosong, form tempel teks tampil tanpa menghentikan alur.                                                                                                                                       |
| FR-03 | Tempel teks manual                   | Petugas dapat menempel atau mengedit teks postingan secara manual sebagai cadangan atau koreksi.                                                                                                                                                                                   |
| FR-04 | Analisis otomatis                    | Dari teks, sistem menghasilkan sentimen (positif, netral, negatif), topik, kata kunci, usulan prioritas (rutin, pantau, perlu perhatian), headline (maksimal 100 karakter), dan ringkasan (maksimal 400 karakter); bila analisis gagal, nilai default aman dipakai disertai pesan. |
| FR-05 | Tinjau dan koreksi                   | Hasil analisis tampil sebagai usulan yang dapat diedit petugas sebelum disimpan.                                                                                                                                                                                                   |
| FR-06 | Simpan mention                       | Petugas dapat menyimpan mention berstatus Baru, Dipantau, atau Selesai dicatat.                                                                                                                                                                                                    |
| FR-07 | Deteksi duplikat                     | Link dinormalisasi (parameter pelacakan dihapus, host disamakan); link yang sudah ada ditandai dengan pilihan membuka entri lama.                                                                                                                                                  |
| FR-08 | Penyamaran data pribadi              | Teks diperiksa untuk nomor telepon, email, nomor identitas, dan nomor rekening; data terdeteksi disamarkan atau penyimpanan ditolak sampai diperbaiki.                                                                                                                             |
| FR-09 | Kirim dari halaman (ekstensi Chrome) | Petugas yang telah memasukkan token dapat mengirim link dan teks postingan yang sedang dibuka ke aplikasi dengan satu klik; hasil masuk sebagai Draf.                                                                                                                              |
| FR-10 | Tempel banyak dan impor CSV          | Petugas dapat memasukkan banyak link atau teks sekaligus (satu item per baris) atau mengimpor CSV; tiap item dianalisis dan masuk sebagai Draf; sistem melaporkan jumlah berhasil, gagal, dan duplikat.                                                                            |
| FR-11 | Antrean tinjau Draf                  | Petugas dapat melihat daftar Draf, mengoreksi, menyetujui (menjadi Baru) atau menolak (dihapus).                                                                                                                                                                                   |
| FR-12 | Daftar, pencarian, dan filter        | Pengguna dapat mencari teks dan memfilter mention berdasarkan sentimen, topik, prioritas, status, dan rentang tanggal; terbaru di atas.                                                                                                                                            |
| FR-13 | Dashboard                            | Dashboard menampilkan total mention, jumlah per sentimen, jumlah perlu perhatian, tren jumlah mention per hari atau minggu, sentimen per topik, dan topik teratas, mengikuti filter rentang tanggal.                                                                               |
| FR-14 | Deteksi lonjakan                     | Sistem membandingkan jumlah mention (dan mention negatif) per hari dengan rata-rata historis; bila melewati ambang yang dapat dikonfigurasi, sistem membuat alert.                                                                                                                 |
| FR-15 | Alert                                | Alert tampil di dashboard (indikator dan daftar) dengan penyebab (topik, jumlah, periode) dan dapat ditandai sudah dibaca; mention baru berprioritas perlu perhatian juga memunculkan alert.                                                                                       |
| FR-16 | Ringkasan mingguan                   | Sistem menampilkan ringkasan minggu berjalan dan tombol salin dalam format kolom Headline Post dan Summary Post.                                                                                                                                                                   |
| FR-17 | Ekspor laporan                       | Pengguna dapat mengunduh laporan CSV, Excel (.xlsx), dan PDF sesuai filter aktif.                                                                                                                                                                                                  |
| FR-18 | Ubah status dan hapus                | Petugas dapat mengubah status dan menghapus mention dengan konfirmasi.                                                                                                                                                                                                             |
| FR-19 | Konfigurasi                          | Petugas dapat mengubah daftar topik, kata kunci pantauan (BTN, KPR, BTN Mobile, Tapera, kompetitor), dan ambang alert tanpa mengubah kode.                                                                                                                                         |
| FR-20 | Data contoh                          | Tersedia data contoh sintetis yang ditandai jelas untuk demo dan dapat dihapus tanpa memengaruhi data nyata.                                                                                                                                                                       |

## 4. Aturan Bisnis

| ID    | Aturan                                                                                                                                                                                                                                   |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-01 | Sentimen hanya bernilai positif, netral, atau negatif.                                                                                                                                                                                   |
| BR-02 | Prioritas hanya bernilai rutin, pantau, atau perlu perhatian. Usulan awal: perlu perhatian bila sentimen negatif dan memuat kata kunci risiko (misalnya penipuan, hoaks, gagal transaksi, kebocoran data); kriteria final menunggu Q-05. |
| BR-03 | Hasil analisis otomatis hanya usulan; keputusan akhir ada pada petugas. Entri berstatus Draf tidak dihitung di dashboard, laporan, maupun deteksi lonjakan sampai disetujui.                                                             |
| BR-04 | Hanya postingan publik yang dicatat.                                                                                                                                                                                                     |
| BR-05 | Setiap mention wajib menyimpan link sumber; link yang telah dinormalisasi bersifat unik.                                                                                                                                                 |
| BR-06 | Nama akun penulis postingan tidak disimpan dan tidak ditampilkan (usulan awal; keputusan final pada Q-04).                                                                                                                               |
| BR-07 | Dashboard, daftar, dan ekspor terbuka baca-saja tanpa login; semua aksi tulis memerlukan token Petugas Input.                                                                                                                            |
| BR-08 | Teks yang memuat data pribadi tidak disimpan sebelum disamarkan, dan hanya teks yang sudah disamarkan yang dikirim ke penyedia analisis eksternal.                                                                                       |
| BR-09 | Alert hanya mencerminkan data yang telah tercatat di sistem; bukan pemantauan real-time seluruh Threads.                                                                                                                                 |
| BR-10 | Data contoh harus ditandai dan tidak dicampur dengan data nyata dalam laporan.                                                                                                                                                           |

## 5. Kebutuhan Nonfungsional

| ID     | Kategori        | Kebutuhan                                                                                                                                                                   |
| ------ | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-01 | Usability       | Antarmuka berbahasa Indonesia; input satu postingan selesai dalam paling banyak tiga langkah (tempel link, tinjau, simpan).                                                 |
| NFR-02 | Responsif       | Dapat dipakai di laptop (prioritas) dan HP.                                                                                                                                 |
| NFR-03 | Performance     | Dashboard tampil dalam 3 detik pada 5.000 mention; analisis satu postingan selesai dalam 15 detik atau menampilkan status gagal yang jelas.                                 |
| NFR-04 | Reliability     | Kegagalan pratinjau atau analisis tidak memblokir penyimpanan manual.                                                                                                       |
| NFR-05 | Security        | Semua endpoint tulis menolak permintaan tanpa token valid; token disimpan di variabel lingkungan, bukan di kode.                                                            |
| NFR-06 | Security        | Kunci API dan rahasia hanya ada di sisi server; tidak dikirim ke browser dan tidak masuk repositori.                                                                        |
| NFR-07 | Security        | Pengambilan pratinjau dibatasi pada host Threads yang diizinkan, dengan batas waktu dan ukuran respons, untuk mencegah permintaan ke alamat internal atau host lain (SSRF). |
| NFR-08 | Security        | Validasi input di sisi client dan server; output dilindungi dari XSS; endpoint input dan analisis dibatasi lajunya (rate limit).                                            |
| NFR-09 | Security        | Ekstensi Chrome hanya meminta izin minimum, hanya aktif di host Threads, dan mengirim data hanya ke alamat aplikasi dengan token.                                           |
| NFR-10 | Privacy         | Deteksi dan penyamaran data pribadi dijalankan sebelum penyimpanan dan sebelum pengiriman ke LLM; tidak ada data nasabah yang boleh dimasukkan.                             |
| NFR-11 | Architecture    | Akses database, tampilan, dan logika proses dipisahkan; penyedia analisis dan sumber input berada di balik antarmuka internal sehingga dapat ditukar lewat konfigurasi.     |
| NFR-12 | Data integrity  | Link ternormalisasi unik; status dan nilai sentimen dan prioritas dibatasi pada daftar tetap.                                                                               |
| NFR-13 | Scalability     | Cukup untuk puluhan ribu baris dan puluhan input per hari; tanpa infrastruktur khusus.                                                                                      |
| NFR-14 | Accessibility   | Kontras warna memadai dan elemen form berlabel.                                                                                                                             |
| NFR-15 | Maintainability | Kode berstruktur folder jelas pada repositori GitHub bersama; konfigurasi topik, kata kunci, dan ambang berada di luar kode.                                                |
| NFR-16 | Traceability    | Setiap kebutuhan dapat ditelusuri ke user story dan diuji melalui skenario penerimaan (bagian 9).                                                                           |

## 6. Kebutuhan Data

Sistem memiliki empat kelompok data. Detail tipe data dan skema Prisma adalah keputusan desain dan dapat berubah setelah ERD ditetapkan.

| Entitas     | Atribut inti yang dibutuhkan                                                                                                                                                                                                                                                      | Keterangan                                                                                                        |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Mention     | id, linkAsli, linkTernormalisasi (unik), teksPostingan, sumberInput (form, ekstensi, impor, contoh), tanggalDitemukan, tanggalPostingan (opsional), topik, sentimen, prioritas, status, headline, ringkasan, kataKunci, penyediaAnalisis, dikoreksiManual, dibuatPada, diubahPada | Status: Draf, Baru, Dipantau, Selesai dicatat. Penyimpanan teksPostingan penuh dan masa retensinya menunggu Q-04. |
| Topic       | id, nama, kataKunci, aktif                                                                                                                                                                                                                                                        | Daftar topik dan kata kunci pantauan yang dapat dikonfigurasi (FR-19).                                            |
| Alert       | id, jenis (lonjakan, perlu perhatian), topik, periode, jumlah, ambangDipakai, dibaca, dibuatPada                                                                                                                                                                                  | Dibuat oleh deteksi lonjakan dan mention berprioritas perlu perhatian.                                            |
| ImportBatch | id, sumber, jumlahBerhasil, jumlahGagal, jumlahDuplikat, dibuatPada                                                                                                                                                                                                               | Mencatat hasil tempel banyak atau impor CSV (FR-10).                                                              |

## 7. Use Case Ringkas

| Aktor         | Use Case                                                                                                                                                                                                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Penonton      | Lihat dashboard; cari dan filter mention; lihat alert; salin ringkasan mingguan; unduh laporan CSV, Excel, PDF.                                                                                                                                                                  |
| Petugas Input | Masukkan link dan teks; tinjau dan koreksi hasil analisis; simpan mention; kirim dari halaman lewat ekstensi; tempel banyak atau impor CSV; tinjau dan setujui atau tolak Draf; ubah status; hapus mention; atur topik, kata kunci, dan ambang alert; isi dan hapus data contoh. |
| Sistem        | Ambil pratinjau dari link; samarkan data pribadi; analisis sentimen, topik, dan prioritas; deteksi duplikat; deteksi lonjakan; buat alert.                                                                                                                                       |

## 8. Acceptance Criteria Awal

| ID    | Kriteria                                                                                                                                                                                             |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-01 | Link yang bukan HTTPS atau bukan dari threads.net atau threads.com ditolak dengan pesan yang jelas.                                                                                                  |
| AC-02 | Bila pratinjau gagal, form tempel teks tampil dan petugas tetap dapat menganalisis dan menyimpan.                                                                                                    |
| AC-03 | Link yang sama, termasuk dengan parameter pelacakan berbeda, terdeteksi sebagai duplikat dan tidak tersimpan dua kali.                                                                               |
| AC-04 | Pada set uji 30 sampai 50 postingan berlabel, semua kolom hasil analisis terisi, dan kecocokan sentimen terhadap label dilaporkan; target kecocokan ditetapkan bersama pembimbing (usulan awal 70%). |
| AC-05 | Teks berisi nomor telepon, email, nomor identitas, atau nomor rekening disamarkan atau ditolak, dan tidak pernah dikirim ke LLM dalam bentuk asli.                                                   |
| AC-06 | Klik kirim pada ekstensi membuat Draf berisi link dan teks; permintaan tanpa token valid ditolak.                                                                                                    |
| AC-07 | Impor 20 item menghasilkan laporan berhasil, gagal, dan duplikat yang benar, dan item berhasil masuk sebagai Draf.                                                                                   |
| AC-08 | Draf tidak dihitung di dashboard, laporan, dan deteksi lonjakan; setelah disetujui, entri ikut dihitung.                                                                                             |
| AC-09 | Pencarian dan filter hanya mengembalikan mention yang sesuai dengan kriteria yang dipilih.                                                                                                           |
| AC-10 | Angka dan grafik dashboard cocok dengan data tersimpan pada data contoh dan mengikuti rentang tanggal yang dipilih.                                                                                  |
| AC-11 | Pada data uji dengan lonjakan buatan, alert muncul beserta penyebabnya; tanpa lonjakan, alert tidak muncul; perubahan ambang berlaku tanpa mengubah kode.                                            |
| AC-12 | Ringkasan mingguan dapat disalin dalam format Headline Post dan Summary Post.                                                                                                                        |
| AC-13 | CSV (UTF-8 dengan BOM), Excel, dan PDF memuat data sesuai filter; PDF memuat judul, rentang tanggal, filter aktif, ringkasan angka, dan tabel.                                                       |
| AC-14 | Ubah status dan hapus ditolak tanpa token; dengan token berhasil dan meminta konfirmasi.                                                                                                             |
| AC-15 | Perubahan topik dan kata kunci pantauan berlaku pada analisis berikutnya tanpa mengubah kode.                                                                                                        |
| AC-16 | Data contoh tampil bertanda dan dapat dihapus tanpa memengaruhi data nyata.                                                                                                                          |
| AC-17 | Semua endpoint tulis menolak permintaan tanpa token, dan Penonton tidak melihat kontrol tulis.                                                                                                       |
| AC-18 | Saat analisis gagal, entri tetap dapat disimpan dengan nilai default dan pesan bahwa analisis otomatis gagal.                                                                                        |
| AC-19 | Permintaan pratinjau ke host selain Threads atau ke alamat internal ditolak oleh server.                                                                                                             |

## 9. Traceability User Story dan Requirement

| User Story | Cerita pengguna                                                                                      | Requirement         | Acceptance Criteria |
| ---------- | ---------------------------------------------------------------------------------------------------- | ------------------- | ------------------- |
| US-01      | Sebagai petugas, saya memasukkan link postingan agar tercatat tanpa duplikat.                        | FR-01, FR-07        | AC-01, AC-03        |
| US-02      | Sebagai petugas, saya ingin teks postingan terambil otomatis dari link, atau menempelnya bila gagal. | FR-02, FR-03        | AC-02, AC-19        |
| US-03      | Sebagai petugas, saya ingin analisis otomatis yang bisa saya koreksi sebelum disimpan.               | FR-04, FR-05, FR-06 | AC-04, AC-18        |
| US-04      | Sebagai petugas, saya ingin data pribadi tersamarkan sebelum disimpan.                               | FR-08               | AC-05               |
| US-05      | Sebagai petugas, saya ingin mengirim postingan yang sedang saya buka dengan satu klik.               | FR-09               | AC-06               |
| US-06      | Sebagai petugas, saya ingin memasukkan banyak postingan sekaligus.                                   | FR-10               | AC-07               |
| US-07      | Sebagai petugas, saya ingin meninjau Draf sebelum dihitung.                                          | FR-11               | AC-08               |
| US-08      | Sebagai penonton, saya ingin mencari dan memfilter mention.                                          | FR-12               | AC-09               |
| US-09      | Sebagai penonton, saya ingin dashboard tren, sentimen, dan topik.                                    | FR-13               | AC-10               |
| US-10      | Sebagai penonton, saya ingin diberi tahu saat ada lonjakan atau isu berisiko.                        | FR-14, FR-15        | AC-11               |
| US-11      | Sebagai penonton, saya ingin ringkasan mingguan siap salin.                                          | FR-16               | AC-12               |
| US-12      | Sebagai penonton, saya ingin mengunduh laporan CSV, Excel, dan PDF.                                  | FR-17               | AC-13               |
| US-13      | Sebagai petugas, saya ingin mengubah status dan menghapus mention.                                   | FR-18               | AC-14               |
| US-14      | Sebagai petugas, saya ingin mengatur topik, kata kunci, dan ambang alert.                            | FR-19               | AC-11, AC-15        |
| US-15      | Sebagai pengguna, saya ingin data contoh untuk demo.                                                 | FR-20               | AC-16               |
| US-16      | Sebagai pemilik sistem, saya ingin hanya petugas yang dapat mengubah data.                           | BR-07, NFR-05       | AC-17               |

## 10. Risiko dan Pertanyaan Terbuka

### 10.1 Keputusan yang sudah diambil

- Pengiriman teks postingan ke layanan LLM eksternal diizinkan (menjawab Q-001 versi sebelumnya).
- Dashboard terbuka tanpa login diizinkan (menjawab Q-003 versi sebelumnya).
- Fitur fase berikutnya (ekstensi Chrome, tempel banyak, deteksi lonjakan dan alert) digabung ke MVP. Integrasi API resmi Threads tetap di luar lingkup karena akses tidak tersedia.

### 10.2 Risiko

| ID   | Risiko                                                                                                                    | Mitigasi                                                                                                                                             |
| ---- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-01 | Pratinjau link Threads tidak memberi teks (asumsi belum diuji).                                                           | Cadangan tempel teks manual; ekstensi Chrome sebagai jalur utama bila pratinjau gagal.                                                               |
| R-02 | Jatah LLM gratis habis atau syaratnya berubah.                                                                            | Antarmuka penyedia yang dapat ditukar dan kamus kata kunci sebagai cadangan.                                                                         |
| R-03 | Kualitas sentimen kurang untuk bahasa gaul dan campuran.                                                                  | Set uji berlabel (AC-04) dan koreksi manual oleh petugas.                                                                                            |
| R-04 | Cakupan MVP besar untuk waktu magang.                                                                                     | Urutan pembangunan bertahap dengan hasil yang dapat didemokan pada tiap tahap; fitur terakhir dalam urutan yang ditunda lebih dulu bila waktu habis. |
| R-05 | Alert hanya akurat sebanyak data yang dimasukkan (BR-09).                                                                 | Pernyataan jelas di antarmuka; jangan menyebutnya pemantauan real-time.                                                                              |
| R-06 | Ekstensi Chrome mungkin memerlukan persetujuan IT di laptop kantor dan dapat rusak bila struktur halaman Threads berubah. | Tanyakan lebih awal kepada pembimbing; sediakan tempel manual sebagai cadangan.                                                                      |
| R-07 | Dashboard publik tanpa login terlihat oleh siapa pun yang tahu tautannya.                                                 | Data berupa agregat dan ringkasan tanpa nama akun (BR-06); token hanya untuk aksi tulis.                                                             |

### 10.3 Pertanyaan terbuka

- **Q-02:** Apakah pratinjau publik link Threads memuat teks postingan? (uji teknis awal)
- **Q-04:** Apakah teks postingan penuh disimpan atau hanya ringkasan dan link, berapa lama retensinya, dan perlukah nama akun disimpan?
- **Q-05:** Kriteria final "perlu perhatian" dan daftar kategori topik.
- **Q-06:** Perkiraan volume harian dan siapa pemegang token Petugas Input.
- **Q-07:** Penyedia LLM gratis mana yang dipilih setelah evaluasi dengan set uji.
- **Q-08:** Saluran alert: cukup di dalam dashboard, atau perlu email atau notifikasi lain?
- **Q-09:** Cara distribusi ekstensi Chrome untuk pegawai (dimuat manual atau lewat toko ekstensi) dan apakah perlu persetujuan IT.
