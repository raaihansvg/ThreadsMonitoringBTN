# Panduan Ekstensi Chrome: BTN Threads Monitoring Quick Ingest (FR-09)

Ekstensi Chrome Manifest V3 ini dirancang khusus untuk Petugas Input agar dapat mengirimkan postingan Threads yang sedang dibuka di browser langsung ke antrean **Draf** aplikasi BTN Threads Monitoring dengan satu klik.

---

## 1. Cara Pemasangan (Load Unpacked) di Google Chrome

1. Buka peramban Google Chrome atau peramban berbasis Chromium (Edge, Brave).
2. Akses halaman manajemen ekstensi dengan mengetikkan `chrome://extensions` pada bilah alamat.
3. Aktifkan toggle **"Developer mode"** (Mode pengembang) di sudut kanan atas.
4. Klik tombol **"Load unpacked"** (Muat yang belum dibongkar).
5. Pilih folder `extension/` dari repositori proyek ini (`threadsMonitoringBtn/extension`).
6. Ekstensi **"BTN Threads Monitoring - Quick Ingest"** akan muncul di daftar ekstensi peramban.

---

## 2. Konfigurasi Alamat Server & Token

Saat popup ekstensi pertama kali dibuka melalui ikon ekstensi di toolbar:
1. **Alamat Server Aplikasi**:
   - **Lingkungan Pengembangan Lokal**: `http://localhost:3000`
   - **Lingkungan Produksi**: **Wajib diganti** menggunakan alamat HTTPS resmi aplikasi (misal `https://threads-monitoring.btn.co.id`).
2. **Token Ekstensi (EXTENSION_TOKEN)**:
   - Masukkan token yang dikonfigurasikan pada variabel lingkungan server `EXTENSION_TOKEN`.
   - Token disimpan secara aman di penyimpanan lokal peramban (`chrome.storage.local`) dan tidak perlu dimasukkan berulang kali.

---

## 3. Catatan Keterbatasan Teknis (Asumsi Selektor DOM)

> **PENTING**:
> Selektor DOM pada berkas `content.js` (menggunakan query `article[data-pressable-container='true']`, `span[dir='auto']`, dan meta tag `og:description`) dibuat berdasarkan observasi struktur semantik umum Threads Web.
> **Selektor DOM ini belum diuji secara langsung pada antarmuka Threads asli yang dinamis (asumsi)**, karena struktur HTML dan class obfuscation Threads dapat berubah sewaktu-waktu oleh Meta.
> Petugas Input disarankan untuk memeriksa teks postingan di textarea popup sebelum mengklik tombol kirim, atau menyorot (*highlight*) teks pada postingan untuk memastikan teks yang diambil akurat.

---

## 4. Validasi Keamanan Popup Ekstensi

Popup ekstensi dilengkapi proteksi sisi klien:
- **Pemeriksaan Tautan Postingan**: Halaman aktif harus berasal dari domain `threads.net` atau `threads.com` dan **wajib mengarah ke postingan spesifik (memuat `/post/`)**. Bila bukan halaman postingan, popup menampilkan pesan error:
  `"Halaman aktif bukan postingan Threads yang spesifik (harus memuat /post/). Data tidak dikirim."`
  dan tombol kirim tidak akan mengeksekusi pengiriman data.
- **Pemeriksaan Teks Kosong**: Bila ekstraksi teks kosong, popup menampilkan pesan:
  `"Teks postingan kosong atau tidak berhasil diekstraksi dari halaman. Data tidak dikirim."`
  dan pengiriman dibatalkan.
- **Otentikasi Server-Side**: Permintaan dikirim dengan header `Authorization: Bearer <EXTENSION_TOKEN>`. Di server, entri yang masuk otomatis dipaksa menjadi `status: "DRAF"` dan `sumberInput: "EKSTENSI"`.

---

## 5. Daftar Uji Manual (Checklist Verifikasi)

| No | Skenario Uji | Prosedur | Hasil yang Diharapkan |
| :---: | :--- | :--- | :--- |
| 1 | **Pemasangan Ekstensi** | Buka `chrome://extensions` -> Load unpacked folder `extension/`. | Ekstensi terpasang tanpa error manifest. |
| 2 | **Validasi Halaman Non-Post** | Buka profil Threads (misal `https://www.threads.net/@bankbtn`), klik ikon popup ekstensi, klik Kirim. | Muncul pesan error dan permintaan **TIDAK dikirim**. |
| 3 | **Validasi Teks Kosong** | Buka postingan Threads, kosongkan isi textarea teks postingan pada popup, klik Kirim. | Muncul pesan *"Teks postingan kosong atau tidak berhasil diekstraksi. Data tidak dikirim"* dan request dibatalkan. |
| 4 | **Validasi Token Salah** | Isi kolom token dengan nilai acak/salah, klik Kirim. | Server menolak dengan HTTP 401 (*"Token ekstensi tidak valid"*). |
| 5 | **Pengiriman Berhasil ke Draf** | Isi token `EXTENSION_TOKEN` yang benar, klik Kirim. | Muncul notifikasi *"Berhasil! Postingan tersimpan sebagai Draf"*. Buka halaman `/draf` aplikasi untuk memverifikasi entri baru muncul di antrean Draf. |
| 6 | **Deteksi Duplikasi** | Klik Kirim kembali untuk URL postingan yang sama persis. | Muncul pesan HTTP 409 (*"Tautan ini sudah pernah tercatat di sistem"*). |
