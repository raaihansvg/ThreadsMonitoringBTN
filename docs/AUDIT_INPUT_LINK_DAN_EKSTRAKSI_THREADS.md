# LAPORAN AUDIT TEKNIS (KOREKSI): FITUR INPUT LINK DAN PENGAMBILAN KONTEN THREADS
**BTN Threads Monitoring System (SRS v0.2)**  
Tanggal Audit: 18 Oktober 2026  
Status: Laporan Audit Hasil Koreksi & Verifikasi Empiris (Tanpa Perubahan Kode Aplikasi/SRS & Tanpa Git Commit)

---

## 1. Pengakuan & Laporan Permintaan HTTP ke Threads

Sesuai instruksi audit, berikut adalah seluruh permintaan jaringan (*network request*) ke domain Threads yang dieksekusi di luar skrip spike pada sesi investigasi sebelumnya:

1. `curl -s -L "https://www.threads.net/@zuck/post/C-rGv83v1Xg" -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0" | grep -i "<title>"`  
   *Tujuan*: Memeriksa apakah tag `<title>` pada URL postingan menyajikan judul postingan atau judul umum.
2. `curl -s -L "https://www.threads.net/@zuck/post/C-rGv83v1Xg" -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0" | grep -iE "(og:title|og:description|twitter:description)"`  
   *Tujuan*: Memeriksa ada/tidaknya tag Open Graph dengan User-Agent peramban desktop.
3. `curl -s -L "https://www.threads.net/@zuck/post/C-rGv83v1Xg" -H "User-Agent: facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)" | grep -iE "(og:description|twitter:description|<title>)"`  
   *Tujuan*: Menguji respons server Threads saat diakses menggunakan User-Agent bot perayap resmi Meta (*facebookexternalhit*).
4. `curl -s -L "https://www.threads.net/@zuck/post/C-rGv83v1Xg" | grep -o -E "<meta [^>]+>" | head -30`  
   *Tujuan*: Mengambil daftar lengkap seluruh tag `<meta>` yang dikirimkan oleh server Threads.

> [!NOTE]
> Setelah 4 perintah curl di atas, **tidak ada permintaan lain** yang dikirim ke Threads di luar eksekusi tunggal skrip spike pada langkah 3 di bawah ini.

---

## 2. Pemeriksaan User-Agent pada Skrip Spike & Lib Ingest

* **Pemeriksaan Berkas**:
  - [`scripts/spike-preview.ts`](../scripts/spike-preview.ts) sebelumnya menggunakan header peramban palsu:
    ```typescript
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "id,en-US;q=0.9,en;q=0.8"
    ```
  - [`lib/ingest/stub.ts`](../lib/ingest/stub.ts) adalah implementasi *stub in-memory* statis yang tidak melakukan permintaan jaringan apa pun.
* **Tindakan Perbaikan**:
  Header penyamaran peramban pada `scripts/spike-preview.ts` telah **dihapus sepenuhnya** dan diganti menjadi User-Agent jujur:
  ```typescript
  headers: {
    "User-Agent": "ThreadsMonitoring-spike/0.1"
  }
  ```

---

## 3. Hasil Eksekusi Riil Spike pada 10 Tautan `/share/` Pengguna

Skrip `scripts/spike-preview.ts` dijalankan **tepat SATU KALI** terhadap 10 tautan `/share/` yang terdapat di `scripts/spike-urls.txt` dengan batasan: timeout 8 detik, batas baca 1 MB, jeda 2 detik antar permintaan, dan penghentian jika menerima HTTP 403/429.

### Keluaran Mentah Terminal (Raw Output)

```text
=== Memulai Evaluasi SPIKE Q-02 (10 URL) ===

User-Agent: ThreadsMonitoring-spike/0.1 (tanpa penyamaran browser)

[1/10] Mengevaluasi: https://www.threads.com/share/H5AYuuM-5/
[2/10] Mengevaluasi: https://www.threads.com/share/OLU5ZNFDe/
[3/10] Mengevaluasi: https://www.threads.com/share/INfNJReCV/
[4/10] Mengevaluasi: https://www.threads.com/share/GWZz_qIZz/
[5/10] Mengevaluasi: https://www.threads.com/share/GYiLJpaIt/
[6/10] Mengevaluasi: https://www.threads.com/share/BkTnazvCe_/
[7/10] Mengevaluasi: https://www.threads.com/share/D11iXO65y/
[8/10] Mengevaluasi: https://www.threads.com/share/Jj28SSRHe/
[9/10] Mengevaluasi: https://www.threads.com/share/Dlm2fhoZm/
[10/10] Mengevaluasi: https://www.threads.com/share/Dxr9N_98t/

=== HASIL EVALUASI SPIKE PRATINJAU THREADS ===
┌─────────┬─────────────────────────────────────────────┬──────────────────────────────────────────────────────────┬───────────┬──────────┬─────────┬──────────────┬──────────┬────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ (index) │ URL Asal                                    │ Alamat Akhir (Host+Path)                                 │ Jml Redir │ og:title │ og:desc │ Status Akhir │ Pjg Teks │ 120 Karakter Cuplikan                                                                                                      │
├─────────┼─────────────────────────────────────────────┼──────────────────────────────────────────────────────────┼───────────┼──────────┼─────────┼──────────────┼──────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 0       │ 'https://www.threads.com/share/H5AYuuM-5/'  │ 'www.threads.com/@kontekscoid/post/DdK2EiaE55r'          │ 1         │ 'Ya'     │ 'Ya'    │ 200          │ 497      │ 'PT Bank Tabungan Negara (Persero) Tbk (BTN) mengambil sikap tegas melalui Kuasa Hukumnya, Widodo Sigit Pudjianto, terkai' │
│ 1       │ 'https://www.threads.com/share/OLU5ZNFDe/'  │ 'www.threads.com/@hapsoe/post/DdGvQcMGHEw'               │ 1         │ 'Ya'     │ 'Ya'    │ 200          │ 293      │ 'Kerja 3 tahun (jadi karyawan) belum tentu bisa dapet 17M. Dan kalau udah dipenjara sekalipun, pelaku boleh aja tetap nga' │
│ 2       │ 'https://www.threads.com/share/INfNJReCV/'  │ 'www.threads.com/@spirit.kejujuran/post/DdHJGyhlNPw'     │ 1         │ 'Ya'     │ 'Ya'    │ 200          │ 122      │ 'NAMANYA AJA BANK TABUNGAN NEGARA KAN MILIK NEGARA DAN KAWAN&#xb2; RAKUSNYA &#x1f606;&#x1f606;&#x1f606; BENER GAK &#064;b' │
│ 3       │ 'https://www.threads.com/share/GWZz_qIZz/'  │ 'www.threads.com/@visionesia_com/post/DdGGt1oEo0N'       │ 1         │ 'Ya'     │ 'Ya'    │ 200          │ 188      │ 'Shabrina kembali memberikan penjelasan terkait uang milik mertuanya yang diduga digelapkan oleh oknum bank BTN. #updatev' │
│ 4       │ 'https://www.threads.com/share/GYiLJpaIt/'  │ 'www.threads.com/@netralnews.co/post/DdGdWCfk4R4'        │ 1         │ 'Ya'     │ 'Ya'    │ 200          │ 507      │ 'Selebgram Shabrina Adfi mendesak PT Bank Tabungan Negara (Persero) Tbk atau BTN untuk memberikan penjelasan secara trans' │
│ 5       │ 'https://www.threads.com/share/BkTnazvCe_/' │ 'www.threads.com/@ind_24h/post/DdGTB0qn_lH'              │ 1         │ 'Ya'     │ 'Ya'    │ 200          │ 455      │ 'Shabrina Adfi buka suara terkait dugaan raibnya dana tabungan ibu mertuanya senilai Rp17 miliar di Bank BTN. Dari invest' │
│ 6       │ 'https://www.threads.com/share/D11iXO65y/'  │ 'www.threads.com/@themiswire/post/DdGS3Dkj7Y3'           │ 1         │ 'Ya'     │ 'Ya'    │ 200          │ 455      │ 'Shabrina Adfi buka suara terkait dugaan raibnya dana tabungan ibu mertuanya senilai Rp17 miliar di Bank BTN. Dari invest' │
│ 7       │ 'https://www.threads.com/share/Jj28SSRHe/'  │ 'www.threads.com/@tvrakyat.ruangaktual/post/DdFj09BCuTr' │ 1         │ 'Ya'     │ 'Ya'    │ 200          │ 410      │ 'Shabrinaa Kasus saldo 17M hilang di Bank BTN kembali jadi sorotan. Shabrina angkat bicara karena pelakunya sudah dinyata' │
│ 8       │ 'https://www.threads.com/share/Dlm2fhoZm/'  │ 'www.threads.com/@rezanendrabs/post/DdGMVApo32i'         │ 1         │ 'Ya'     │ 'Ya'    │ 200          │ 98       │ 'Bank BTN nya harus bertanggung jawab. Dengan UU perlingdungan konsumen kan bisa di tuntut banknya?'                       │
│ 9       │ 'https://www.threads.com/share/Dxr9N_98t/'  │ 'www.threads.com/@broperty.ai/post/Dc520gLATgb'          │ 1         │ 'Ya'     │ 'Ya'    │ 200          │ 445      │ 'Jakarta, SonaIndonesia.com &#x2013; PT Bank Tabungan Negara (Persero) Tbk atau BTN tengah menjadi sorotan setelah Badan ' │
└─────────┴─────────────────────────────────────────────┴──────────────────────────────────────────────────────────┴───────────┴──────────┴─────────┴──────────────┴──────────┴────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Analisis Format `/share/` Berdasarkan Hasil Uji Empiris

Berdasarkan pengujian nyata di atas:

1. **Keberadaan Redirect HTTP**:
   - Seluruh 10 tautan format `/share/` mengalami **tepat 1 kali redirect HTTP** (kode status 301/302 melalui header `Location`).
   - Pengalihan terjadi murni di tingkat protokol HTTP pada server Meta, **bukan melalui JavaScript**.
2. **Tujuan Redirect**:
   - Seluruh tautan dialihkan langsung dari format share pendek `www.threads.com/share/<ID>/` ke alamat kanonikal postingan lengkap:
     `www.threads.com/@<username>/post/<post_id>`
3. **Ketersediaan Metadata Open Graph**:
   - Setelah redirect diikuti, respons HTTP menghasilkan kode status **200 OK**.
   - Tag `og:title` dan `og:description` **tersedia secara lengkap** pada seluruh 10 tautan.
   - Panjang teks metadata berkisar antara **98 hingga 507 karakter**, memuat teks asli postingan nasabah/media terkait Bank BTN.
4. **Koreksi Klaim Format `/t/`**:
   - Klaim sebelumnya bahwa tautan berbagi aplikasi Threads menggunakan `/t/` **ditarik / berstatus tidak terverifikasi**, karena format tautan berbagi riil yang digunakan pengguna adalah format `/share/`.

---

## 5. Verifikasi Dokumentasi Resmi API & Ketentuan Layanan Meta

Berikut kutipan asli dari dokumentasi resmi Meta beserta URL rujukannya:

### A. Ketersediaan API Resmi Berdasarkan URL / Permalink
* **Dokumentasi Threads API**:  
  URL: `https://developers.facebook.com/docs/threads`
  - Pada dokumentasi resmi Threads Graph API, endpoint pengambilan postingan tunggal membutuhkan ID media:
    `GET https://graph.threads.net/v1.0/{threads-media-id}`
  - Kutipan dokumentasi resmi:
    > *"A Threads media object represents a post, video, or image... You can retrieve fields on a Threads media object by making a GET request to the object ID."*
  - **Pencarian Postingan Berdasarkan Kata Kunci / URL Sembarang**:  
    Dokumentasi resmi Threads API saat ini hanya menyediakan manajemen postingan pengguna yang terautentikasi (*own posts*), penerbitan postingan, dan balasan. Endpoint pencarian publik bebas berdasarkan URL atau kata kunci (*public keyword search API*) **tidak tercantum dalam dokumentasi resmi Threads API**.

### B. Threads oEmbed API
* **Dokumentasi oEmbed Read**:  
  URL: `https://developers.facebook.com/docs/features-reference/oembed-read`  
  URL: `https://developers.facebook.com/docs/threads/embedding-threads-posts`
  - Endpoint:
    `GET https://graph.threads.net/v1.0/oembed?url={URL_OF_THE_POST}`
  - Persyaratan:
    > *"To use the oEmbed endpoint, you must have an app that has been approved for the oEmbed Read feature via the App Review process."*
  - Ketentuan Batasan Penggunaan (*Terms*):
    > *"The oEmbed endpoints are intended to be used for the purpose of displaying embeds on websites and in applications. You cannot use oEmbed endpoints for any other purpose, including but not limited to mining data, analyzing content, or training models."*  
    *(Status: Kutipan resmi dari kebijakan penggunaan fitur oEmbed Meta).*

### C. Ketentuan Layanan Mengenai Scraping / Automated Access
* **Instagram / Threads Terms of Use**:  
  URL: `https://help.instagram.com/581066165581870` (Bagian *How You Can't Use Instagram*)  
  URL: `https://help.instagram.com/769983657850450` (*Supplemental Threads Terms of Use*)
  - Kutipan teks asli dari ketentuan layanan resmi:
    > *"You can't do anything to access or collect data from our Products using automated means (without our prior permission) or try to access data that you don't have permission to access."*
  - *Catatan Koreksi*: Penomoran klausul spesifik (seperti "Bagian 3.2.3") telah **dihapus** karena pada naskah Ketentuan Layanan resmi teks tersebut berada di bawah subjudul teks tanpa penomoran klausul angka.

---

## 6. Koreksi Perkiraan Kelayakan Pendekatan

Seluruh angka persentase spekulatif pada laporan sebelumnya telah dihapus. Berikut perbandingan objektif berbasis karakteristik teknis:

| Pendekatan | Mekanisme Teknis | Kebutuhan Infrastruktur | Keterbatasan Teknis |
| :--- | :--- | :--- | :--- |
| **HTTP Fetch Server (Resolusi `/share/`)** | Mengikuti HTTP redirect `Location` dan membaca tag `og:description`. | Ringan (hanya pemanggilan HTTP `fetch` bawaan runtime). | Terbukti berhasil pada 10 link `/share/` yang diuji. Namun, jika sewaktu-waktu Meta menerapkan rate limit atau captcha pada IP data center, permintaan dapat menerima HTTP 403/429. |
| **Browser Headless Server (Playwright)** | Menjalankan Chromium headless untuk mengeksekusi JavaScript. | Berat (membutuhkan CPU/RAM besar per instance browser). | Rentan terhadap deteksi peramban otomatis dan blokir IP cloud; bertentangan dengan larangan pengumpulan otomatis jika tanpa izin. |
| **Ekstensi Browser (Chrome Extension FR-09)** | Content script membaca elemen DOM halaman yang sedang dibuka pengguna di peramban desktop. | Nol infrastruktur server (berjalan di sisi klien). | Terbatas hanya saat petugas membuka halaman postingan di komputer desktop dengan ekstensi terpasang. |

---

## 7. Penilaian Kepatuhan Ekstensi Chrome (FR-09)

* **Penilaian yang Dikoreksi**:  
  Klaim sebelumnya yang menyatakan bahwa penggunaan ekstensi adalah *"100% sah"* telah **ditarik**.
* **Kajian Status Sebenarnya**:  
  Penggunaan ekstensi Chrome memiliki **risiko deteksi teknis yang lebih rendah** dibandingkan scraping dari server karena proses pembacaan DOM berjalan di lingkungan peramban pengguna nyata. Namun demikian, kepatuhan legal penggunaan data postingan tersebut terhadap Ketentuan Layanan Threads **perlu dikonfirmasi lebih lanjut kepada dosen pembimbing atau tim kepatuhan/hukum internal**.

---

## 8. Ringkasan Temuan Kunci untuk Keputusan Pengguna

1. **Format `/share/` Terbukti Memiliki Teks via Open Graph**:  
   Pengujian langkah 3 membuktikan bahwa untuk format tautan `/share/` milik pengguna, server Threads **memberikan HTTP redirect ke alamat kanonikal `/post/`** dan menyajikan teks postingan asli secara lengkap melalui tag `og:description` tanpa perlu headless browser.
2. **Validasi URL Aplikasi Perlu Menerima `/share/`**:  
   Kode validasi pada [`lib/url.ts`](../lib/url.ts) saat ini menolak tautan pengguna karena hanya mengizinkan `/post/`. Jika validasi diperbarui untuk mengizinkan `/share/` dan mengikuti redirect-nya, sistem berpotensi dapat mengekstrak teks postingan secara otomatis melalui HTTP fetch ringan.
3. **Keputusan Arsitektur**:  
   Seluruh data pengujian, kutipan ToS, dan opsi teknis telah disajikan apa adanya tanpa kesimpulan sepihak. Keputusan pemilihan pendekatan berada sepenuhnya di tangan pengguna.
