# Petunjuk Eksekusi Spike & Skrip Evaluasi

Direktori ini berisi skrip utilitas mandiri untuk evaluasi teknis (*spike*) di luar lingkungan aplikasi utama.

---

## 1. Evaluasi Pratinjau Tautan Threads (`scripts/spike-preview.ts`)

Skrip ini digunakan untuk menguji kemampuan ekstraksi metadata publik (`<title>`, `og:title`, `og:description`, `twitter:description`) dari URL Threads tanpa headless browser, tanpa cookie, dan tanpa otentikasi login.

### Ketentuan & Batasan Keamanan
1. **Host & Protokol Diizinkan**: Hanya URL HTTPS dengan hostname `threads.net`, `www.threads.net`, `threads.com`, atau `www.threads.com`.
2. **Batas URL**: Maksimal 10 baris URL aktif per pengujian.
3. **Ukuran Respon**: Maksimal 1 MB (1.048.576 byte).
4. **Timeout**: 8 detik per permintaan.
5. **Jeda Antar Permintaan**: 2 detik untuk menjaga etika lalu lintas jaringan.
6. **Kebijakan Blokir**: Langsung berhenti (*abort*) jika mendeteksi kode HTTP 403 atau HTTP 429 (tidak membobol pembatasan laju atau pemblokiran Meta).

---

## 2. Format Berkas Daftar URL (`scripts/spike-urls.txt`)

Berkas `scripts/spike-urls.txt` berformat teks biasa (.txt) dengan ketentuan:
- Satu URL per baris.
- Baris kosong dan baris yang diawali dengan tanda pagar (`#`) dianggap sebagai komentar dan diabaikan.
- Maksimal 10 URL pertama yang akan dievaluasi.
- Berkas `scripts/spike-urls.txt` dicantumkan dalam `.gitignore` agar URL pengujian tidak terkomit ke repositori publik.

### Contoh Isi `scripts/spike-urls.txt`:
```text
# Daftar URL Threads untuk pengujian manual Spike Q-02 (maksimal 10 baris)
https://www.threads.net/@bankbtn/post/DA123456789
https://www.threads.net/@nasabah_btn/post/DB987654321
https://threads.com/@diskusi_kpr/post/DC112233445
```

---

## 3. Cara Menjalankan Skrip

Pastikan dependensi proyek telah terpasang, lalu jalankan perintah berikut dari direktori utama proyek:

```bash
npx tsx scripts/spike-preview.ts
```

### Hasil Keluaran
Skrip akan mencetak progres per URL dan menampilkan tabel rangkuman:
- `URL`: Tautan yang diuji.
- `Status`: Kode status HTTP respon (misal: 200, 403, 429, INVALID).
- `Pjg Teks`: Jumlah karakter metadata yang berhasil diekstrak.
- `120 Karakter Pertama`: Cuplikan awal teks metadata.
- `Catatan`: Sumber metadata yang dipilih (`og:description`, `title`, dsb.) atau alasan kegagalan.
