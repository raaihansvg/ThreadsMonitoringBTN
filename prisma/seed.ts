import {
  PrismaClient,
  Sentiment,
  Priority,
  MentionStatus,
  InputSourceType,
  AlertType,
} from "@prisma/client";
import { DEFAULT_THRESHOLDS } from "../lib/config/thresholds";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database with BTN sample data...");

  // 1. Topics
  const topicsData = [
    {
      nama: "KPR BTN",
      kataKunci: [
        "kpr",
        "kpr btn",
        "rumah",
        "subsidi",
        "kpr subsidi",
        "cicilan",
        "akad",
        "akad kredit",
        "flpp",
        "bunga",
        "bunga kpr",
        "properti",
        "perumahan",
      ],
      aktif: true,
    },
    {
      nama: "BTN Mobile",
      kataKunci: [
        "btn mobile",
        "mobile",
        "aplikasi",
        "mobile banking",
        "transfer",
        "bifast",
        "bi-fast",
        "qris",
        "login btn",
        "login",
        "topup",
        "m-banking",
        "mbanking",
        "rekening online",
      ],
      aktif: true,
    },
    {
      nama: "Tabungan BTN",
      kataKunci: [
        "tabungan",
        "batara",
        "e-batarapos",
        "saldo",
        "bunga tabungan",
        "atm",
        "kartu debit",
        "buka rekening",
        "simpanan",
      ],
      aktif: true,
    },
    {
      nama: "Tapera",
      kataKunci: [
        "tapera",
        "iuran tapera",
        "bp tapera",
        "rumah pekerja",
        "tabungan perumahan",
        "potongan tapera",
      ],
      aktif: true,
    },
    {
      nama: "Pelayanan & CS",
      kataKunci: [
        "pelayanan",
        "cs",
        "customer service",
        "kantor cabang",
        "cabang",
        "antrean",
        "antri",
        "teller",
        "satpam",
        "satpam btn",
        "kc",
        "kcp",
      ],
      aktif: true,
    },
  ];

  for (const topic of topicsData) {
    await prisma.topic.upsert({
      where: { nama: topic.nama },
      update: topic,
      create: topic,
    });
  }

  // Clear existing sample mentions to allow idempotency
  await prisma.mention.deleteMany({
    where: { sumberInput: InputSourceType.CONTOH },
  });
  await prisma.alert.deleteMany({});

  const now = new Date("2026-10-17T12:00:00.000Z");
  const subDays = (days: number) =>
    new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  // 2. Mentions Sample Data (Realistis seputar Bank BTN)
  const mentionsData = [
    // Hari ini (17 Okt 2026)
    {
      linkAsli: "https://www.threads.net/@user/post/DF_today1",
      linkTernormalisasi: "https://threads.net/post/DF_today1",
      teksPostingan:
        "Alhamdulillah akad KPR BTN akhirnya selesai hari ini di KC Surabaya. Prosesnya jauh lebih cepat dari ekspektasi, petugas ramah dan jelasin rincian angsuran transparan banget.",
      sumberInput: InputSourceType.CONTOH,
      tanggalDitemukan: now,
      tanggalPostingan: now,
      topik: "KPR BTN",
      sentimen: Sentiment.POSITIF,
      prioritas: Priority.RUTIN,
      status: MentionStatus.BARU,
      headline: "Apresiasi Proses Akad KPR BTN Cepat di KC Surabaya",
      ringkasan:
        "Nasabah memuji kelancaran dan kecepatan proses akad KPR BTN di KC Surabaya serta pelayanan petugas yang ramah dan transparan.",
      kataKunci: ["akad kpr", "kc surabaya", "ramah", "transparan"],
      penyediaAnalisis: "gemini",
    },
    {
      linkAsli: "https://www.threads.net/@user/post/DF_today2",
      linkTernormalisasi: "https://threads.net/post/DF_today2",
      teksPostingan:
        "Update terbaru BTN Mobile tampilannya makin modern dan responsif. Fitur pembukaan rekening baru langsung dari aplikasi tanpa antre di bank ngebantu banget.",
      sumberInput: InputSourceType.CONTOH,
      tanggalDitemukan: now,
      tanggalPostingan: now,
      topik: "BTN Mobile",
      sentimen: Sentiment.POSITIF,
      prioritas: Priority.RUTIN,
      status: MentionStatus.BARU,
      headline: "Pujian Antarmuka dan Fitur Buka Rekening Online BTN Mobile",
      ringkasan:
        "Nasabah menyukai UI terbaru BTN Mobile yang responsif dan kemudahan membuka rekening secara daring tanpa perlu ke kantor cabang.",
      kataKunci: ["btn mobile", "buka rekening", "modern"],
      penyediaAnalisis: "gemini",
    },
    {
      linkAsli: "https://www.threads.net/@user/post/DF_today3",
      linkTernormalisasi: "https://threads.net/post/DF_today3",
      teksPostingan:
        "Ada yang ngalamin gagal transfer QRIS di BTN Mobile siang ini? Saldo kepotong tapi status di kasir pending. Mohon dicek [NOMOR_REKENING_TERSEMBUNYI].",
      sumberInput: InputSourceType.CONTOH,
      tanggalDitemukan: now,
      tanggalPostingan: now,
      topik: "BTN Mobile",
      sentimen: Sentiment.NEGATIF,
      prioritas: Priority.PERLU_PERHATIAN,
      status: MentionStatus.DIPANTAU,
      headline: "Keluhan Gagal Transaksi QRIS BTN Mobile Saldo Terpotong",
      ringkasan:
        "Nasabah melaporkan saldo berkurang saat transaksi QRIS namun status merchant pending; membutuhkan pengecekan CS segera.",
      kataKunci: ["gagal transfer", "qris", "saldo kepotong"],
      penyediaAnalisis: "gemini",
    },
    {
      linkAsli: "https://www.threads.net/@user/post/DF_today4",
      linkTernormalisasi: "https://threads.net/post/DF_today4",
      teksPostingan:
        "Bunga KPR BTN fixed 3 tahun ini kompetitif dibanding bank lain, cocok buat pasangan muda yang baru cari rumah pertama.",
      sumberInput: InputSourceType.CONTOH,
      tanggalDitemukan: now,
      tanggalPostingan: now,
      topik: "KPR BTN",
      sentimen: Sentiment.POSITIF,
      prioritas: Priority.RUTIN,
      status: MentionStatus.BARU,
      headline:
        "Perbandingan Bunga KPR BTN Dinilai Kompetitif untuk Pasangan Muda",
      ringkasan:
        "Postingan Threads membahas skema bunga fixed KPR BTN yang menarik bagi pembeli rumah pertama.",
      kataKunci: ["bunga kpr", "rumah pertama", "kompetitif"],
      penyediaAnalisis: "gemini",
    },

    // Kemarin (16 Okt 2026)
    {
      linkAsli: "https://www.threads.net/@user/post/DF_day1_1",
      linkTernormalisasi: "https://threads.net/post/DF_day1_1",
      teksPostingan:
        "Diskusi hangat soal kebijakan dana Tapera di Threads. Banyak yang nanya apakah penyaluran rumah subsidi BTN bakal makin diperluas.",
      sumberInput: InputSourceType.CONTOH,
      tanggalDitemukan: subDays(1),
      tanggalPostingan: subDays(1),
      topik: "Tapera",
      sentimen: Sentiment.NETRAL,
      prioritas: Priority.PANTAU,
      status: MentionStatus.DIPANTAU,
      headline: "Diskusi Publik Kebijakan Tapera dan Penyaluran KPR Subsidi",
      ringkasan:
        "Warganet mendiskusikan integrasi dana Tapera dengan penyaluran rumah subsidi melalui Bank BTN.",
      kataKunci: ["tapera", "rumah subsidi", "kpr btn"],
      penyediaAnalisis: "gemini",
    },
    {
      linkAsli: "https://www.threads.net/@user/post/DF_day1_2",
      linkTernormalisasi: "https://threads.net/post/DF_day1_2",
      teksPostingan:
        "Pelayanan satpam dan customer service di Bank BTN KC Melawai juara banget. Selalu disapa ramah dan dibantu sampai tuntas.",
      sumberInput: InputSourceType.CONTOH,
      tanggalDitemukan: subDays(1),
      tanggalPostingan: subDays(1),
      topik: "Pelayanan & CS",
      sentimen: Sentiment.POSITIF,
      prioritas: Priority.RUTIN,
      status: MentionStatus.SELESAI,
      headline: "Pujian Keramahan Pelayanan KC Melawai",
      ringkasan:
        "Apresiasi nasabah terhadap satpam dan customer service BTN KC Melawai yang membantu penyelesaian urusan rekening.",
      kataKunci: ["pelayanan", "kc melawai", "ramah"],
      penyediaAnalisis: "gemini",
    },
    {
      linkAsli: "https://www.threads.net/@user/post/DF_day1_3",
      linkTernormalisasi: "https://threads.net/post/DF_day1_3",
      teksPostingan:
        "Waspada link penipuan berkedok undian poin BTN di Threads! Jangan sembarangan klik tautan mencurigakan.",
      sumberInput: InputSourceType.CONTOH,
      tanggalDitemukan: subDays(1),
      tanggalPostingan: subDays(1),
      topik: "BTN Mobile",
      sentimen: Sentiment.NEGATIF,
      prioritas: Priority.PERLU_PERHATIAN,
      status: MentionStatus.BARU,
      headline: "Peringatan Waspada Link Penipuan Mengatasnamakan Undian BTN",
      ringkasan:
        "Peringatan dari pengguna Threads mengenai modus phishing undian palsu yang mencatut nama Bank BTN.",
      kataKunci: ["penipuan", "phishing", "undian palsu"],
      penyediaAnalisis: "gemini",
    },

    // 2 Hari lalu (15 Okt 2026)
    {
      linkAsli: "https://www.threads.net/@user/post/DF_day2_1",
      linkTernormalisasi: "https://threads.net/post/DF_day2_1",
      teksPostingan:
        "Program KPR Gaess BTN buat milenial syaratnya beneran gampang. Rekomended buat yang mau punya aset properti sedini mungkin.",
      sumberInput: InputSourceType.CONTOH,
      tanggalDitemukan: subDays(2),
      tanggalPostingan: subDays(2),
      topik: "KPR BTN",
      sentimen: Sentiment.POSITIF,
      prioritas: Priority.RUTIN,
      status: MentionStatus.SELESAI,
      headline: "Ulasan Positif Program KPR Gaess BTN untuk Generasi Milenial",
      ringkasan:
        "Postingan merekomendasikan KPR Gaess BTN karena kemudahan persyaratan bagi generasi muda.",
      kataKunci: ["kpr gaess", "milenial", "properti"],
      penyediaAnalisis: "gemini",
    },
    {
      linkAsli: "https://www.threads.net/@user/post/DF_day2_2",
      linkTernormalisasi: "https://threads.net/post/DF_day2_2",
      teksPostingan:
        "Bandingin KPR BTN vs KPR BCA untuk rumah second, masing-masing ada plus minusnya di tenor dan biaya asuransi.",
      sumberInput: InputSourceType.CONTOH,
      tanggalDitemukan: subDays(2),
      tanggalPostingan: subDays(2),
      topik: "KPR BTN",
      sentimen: Sentiment.NETRAL,
      prioritas: Priority.RUTIN,
      status: MentionStatus.BARU,
      headline: "Komparasi KPR BTN dan KPR BCA untuk Rumah Sekunder",
      ringkasan:
        "Analisis perbandingan biaya dan tenor antara KPR BTN dan perbankan swasta oleh pencari rumah.",
      kataKunci: ["kpr bca", "rumah second", "komparasi"],
      penyediaAnalisis: "gemini",
    },
    {
      linkAsli: "https://www.threads.net/@user/post/DF_day2_3",
      linkTernormalisasi: "https://threads.net/post/DF_day2_3",
      teksPostingan:
        "Antrean customer service di cabang Bekasi agak lama pas jam istirahat siang, semoga kuota antrean online bisa ditambah.",
      sumberInput: InputSourceType.CONTOH,
      tanggalDitemukan: subDays(2),
      tanggalPostingan: subDays(2),
      topik: "Pelayanan & CS",
      sentimen: Sentiment.NEGATIF,
      prioritas: Priority.PANTAU,
      status: MentionStatus.DIPANTAU,
      headline: "Masukan Terkait Waktu Tunggu Antrean CS di Cabang Bekasi",
      ringkasan:
        "Nasabah memberi masukan agar antrean online dioptimalkan guna mengurai kepadatan cabang saat jam istirahat.",
      kataKunci: ["antrean", "cabang bekasi", "cs"],
      penyediaAnalisis: "gemini",
    },

    // 3 Hari lalu (14 Okt 2026) - Hari lonjakan mention KPR BTN
    {
      linkAsli: "https://www.threads.net/@user/post/DF_day3_1",
      linkTernormalisasi: "https://threads.net/post/DF_day3_1",
      teksPostingan:
        "Festival Properti BTN ramai banget di JCC! Banyak promo bunga spesial dan cashback biaya provisi.",
      sumberInput: InputSourceType.CONTOH,
      tanggalDitemukan: subDays(3),
      tanggalPostingan: subDays(3),
      topik: "KPR BTN",
      sentimen: Sentiment.POSITIF,
      prioritas: Priority.RUTIN,
      status: MentionStatus.SELESAI,
      headline: "Antusiasme Pengunjung Festival Properti BTN di JCC",
      ringkasan:
        "Laporan kemeriahan expo perumahan BTN dengan beragam promo suku bunga dan keringanan biaya akad.",
      kataKunci: ["festival properti", "jcc", "promo kpr"],
      penyediaAnalisis: "gemini",
    },
    {
      linkAsli: "https://www.threads.net/@user/post/DF_day3_2",
      linkTernormalisasi: "https://threads.net/post/DF_day3_2",
      teksPostingan:
        "Dapat info promo KPR BTN expo bunga 2.99% fixed 1 tahun. Ada yang udah konsultasi ke booth?",
      sumberInput: InputSourceType.CONTOH,
      tanggalDitemukan: subDays(3),
      tanggalPostingan: subDays(3),
      topik: "KPR BTN",
      sentimen: Sentiment.POSITIF,
      prioritas: Priority.RUTIN,
      status: MentionStatus.SELESAI,
      headline: "Tanya Jawab Promo Suku Bunga KPR BTN Expo 2,99%",
      ringkasan:
        "Pencari hunian menanyakan syarat dan ketentuan skema suku bunga khusus pada pameran properti BTN.",
      kataKunci: ["bunga promo", "kpr expo", "fixed 1 tahun"],
      penyediaAnalisis: "gemini",
    },
    {
      linkAsli: "https://www.threads.net/@user/post/DF_day3_3",
      linkTernormalisasi: "https://threads.net/post/DF_day3_3",
      teksPostingan:
        "Tabungan BTN Batara ngadain program hadiah menarik buat nasabah setia. Lumayan nambah motivasi nabung.",
      sumberInput: InputSourceType.CONTOH,
      tanggalDitemukan: subDays(3),
      tanggalPostingan: subDays(3),
      topik: "Tabungan BTN",
      sentimen: Sentiment.POSITIF,
      prioritas: Priority.RUTIN,
      status: MentionStatus.SELESAI,
      headline: "Respon Positif Program Hadiah Tabungan BTN Batara",
      ringkasan:
        "Nasabah merespons antusias program apresiasi poin dan hadiah dari produk Tabungan BTN Batara.",
      kataKunci: ["tabungan batara", "program hadiah", "nabung"],
      penyediaAnalisis: "gemini",
    },

    // 4 Hari lalu (13 Okt 2026)
    {
      linkAsli: "https://www.threads.net/@user/post/DF_day4_1",
      linkTernormalisasi: "https://threads.net/post/DF_day4_1",
      teksPostingan:
        "Simulasi cicilan KPR BTN di website resmi ngebantu banget ngitung budget bulanan sebelum survei lokasi rumah.",
      sumberInput: InputSourceType.CONTOH,
      tanggalDitemukan: subDays(4),
      tanggalPostingan: subDays(4),
      topik: "KPR BTN",
      sentimen: Sentiment.POSITIF,
      prioritas: Priority.RUTIN,
      status: MentionStatus.BARU,
      headline: "Manfaat Fitur Kalkulator Simulasi Cicilan KPR BTN",
      ringkasan:
        "Pengguna mengapresiasi kemudahan kalkulator simulasi angsuran di situs BTN dalam merencanakan keuangan.",
      kataKunci: ["simulasi cicilan", "kalkulator kpr", "budget rumah"],
      penyediaAnalisis: "gemini",
    },
    {
      linkAsli: "https://www.threads.net/@user/post/DF_day4_2",
      linkTernormalisasi: "https://threads.net/post/DF_day4_2",
      teksPostingan:
        "Notifikasi SMS banking BTN masuk berkali-kali padahal cuma sekali transaksi, mohon perbaikan teknis sistemnya.",
      sumberInput: InputSourceType.CONTOH,
      tanggalDitemukan: subDays(4),
      tanggalPostingan: subDays(4),
      topik: "BTN Mobile",
      sentimen: Sentiment.NEGATIF,
      prioritas: Priority.PANTAU,
      status: MentionStatus.BARU,
      headline: "Keluhan Notifikasi SMS Banking BTN Terkirim Berulang",
      ringkasan:
        "Nasabah melaporkan gangguan anomali pengiriman SMS notifikasi berulang untuk transaksi tunggal.",
      kataKunci: ["sms banking", "notifikasi ganda", "gangguan"],
      penyediaAnalisis: "gemini",
    },

    // 5 Hari lalu (12 Okt 2026)
    {
      linkAsli: "https://www.threads.net/@user/post/DF_day5_1",
      linkTernormalisasi: "https://threads.net/post/DF_day5_1",
      teksPostingan:
        "Tanya dong teman-teman, apakah pencairan subsidi KPR BP2BT lewat BTN proses verifikasi berkasnya lama?",
      sumberInput: InputSourceType.CONTOH,
      tanggalDitemukan: subDays(5),
      tanggalPostingan: subDays(5),
      topik: "KPR BTN",
      sentimen: Sentiment.NETRAL,
      prioritas: Priority.RUTIN,
      status: MentionStatus.BARU,
      headline: "Pertanyaan Prosedur Verifikasi Subsidi KPR BTN",
      ringkasan:
        "Diskusi mengenai estimasi waktu verifikasi dokumen permohonan subsidi perumahan di Bank BTN.",
      kataKunci: ["subsidi kpr", "verifikasi berkas", "bp2bt"],
      penyediaAnalisis: "gemini",
    },

    // 6 Hari lalu (11 Okt 2026)
    {
      linkAsli: "https://www.threads.net/@user/post/DF_day6_1",
      linkTernormalisasi: "https://threads.net/post/DF_day6_1",
      teksPostingan:
        "ATM BTN di rest area KM 57 bersih dan uang pecahan 50 ribuan selalu siap, sangat membantu perjalanan luar kota.",
      sumberInput: InputSourceType.CONTOH,
      tanggalDitemukan: subDays(6),
      tanggalPostingan: subDays(6),
      topik: "Pelayanan & CS",
      sentimen: Sentiment.POSITIF,
      prioritas: Priority.RUTIN,
      status: MentionStatus.SELESAI,
      headline: "Kenyamanan Fasilitas ATM BTN di Rest Area Tol",
      ringkasan:
        "Apresiasi atas ketersediaan dan kebersihan galeri ATM BTN di jalur peristirahatan tol.",
      kataKunci: ["atm btn", "rest area", "uang pecahan"],
      penyediaAnalisis: "gemini",
    },

    // 7 - 14 Hari lalu (Periode historis untuk perbandingan)
    {
      linkAsli: "https://www.threads.net/@user/post/DF_prev1",
      linkTernormalisasi: "https://threads.net/post/DF_prev1",
      teksPostingan:
        "Ikut sosialisasi pembiayaan perumahan ramah lingkungan green housing dari Bank BTN. Konsepnya visioner.",
      sumberInput: InputSourceType.CONTOH,
      tanggalDitemukan: subDays(8),
      tanggalPostingan: subDays(8),
      topik: "KPR BTN",
      sentimen: Sentiment.POSITIF,
      prioritas: Priority.RUTIN,
      status: MentionStatus.SELESAI,
      headline: "Apresiasi Program Pembiayaan Green Housing BTN",
      ringkasan:
        "Nasabah menyambut baik inisiatif pembiayaan perumahan berwawasan lingkungan dari Bank BTN.",
      kataKunci: ["green housing", "ramah lingkungan", "kpr btn"],
      penyediaAnalisis: "gemini",
    },
    {
      linkAsli: "https://www.threads.net/@user/post/DF_prev2",
      linkTernormalisasi: "https://threads.net/post/DF_prev2",
      teksPostingan:
        "Info lowongan karir officer development program BTN banyak berseliweran di timeline, bank idaman para fresh graduate.",
      sumberInput: InputSourceType.CONTOH,
      tanggalDitemukan: subDays(9),
      tanggalPostingan: subDays(9),
      topik: "Pelayanan & CS",
      sentimen: Sentiment.NETRAL,
      prioritas: Priority.RUTIN,
      status: MentionStatus.SELESAI,
      headline: "Perbincangan Rekrutmen ODP Bank BTN",
      ringkasan:
        "Sorotan warganet terkait pembukaan program rekrutmen pegawai baru di Bank BTN.",
      kataKunci: ["odp btn", "karir", "fresh graduate"],
      penyediaAnalisis: "gemini",
    },
    {
      linkAsli: "https://www.threads.net/@user/post/DF_prev3",
      linkTernormalisasi: "https://threads.net/post/DF_prev3",
      teksPostingan:
        "Ada kendala gagal login BTN Mobile setelah update OS ponsel, langsung dibantu CS via WhatsApp resmi dan beres dalam 10 menit.",
      sumberInput: InputSourceType.CONTOH,
      tanggalDitemukan: subDays(10),
      tanggalPostingan: subDays(10),
      topik: "BTN Mobile",
      sentimen: Sentiment.POSITIF,
      prioritas: Priority.RUTIN,
      status: MentionStatus.SELESAI,
      headline: "Kecepatan Respon CS WhatsApp Resmi Tangani Kendala Login",
      ringkasan:
        "Nasabah puas atas kesigapan penanganan keluhan login aplikasi mobile melalui saluran resmi WhatsApp.",
      kataKunci: ["cs whatsapp", "login mobile", "respon cepat"],
      penyediaAnalisis: "gemini",
    },

    // Entri DRAF (untuk Antrean Tinjauan Draf di Halaman Draf, tidak boleh dihitung di dashboard!)
    {
      linkAsli: "https://www.threads.net/@user/post/DF_draft1",
      linkTernormalisasi: "https://threads.net/post/DF_draft1",
      teksPostingan:
        "Baru aja kirim berkas KPR BTN online lewat situs btnproperti.co.id. Tinggal nunggu kabar kelanjutan verifikasi bank.",
      sumberInput: InputSourceType.CONTOH,
      tanggalDitemukan: now,
      tanggalPostingan: now,
      topik: "KPR BTN",
      sentimen: Sentiment.NETRAL,
      prioritas: Priority.RUTIN,
      status: MentionStatus.DRAF,
      headline: "Pengajuan Berkas KPR Online Melalui Portal BTN Properti",
      ringkasan:
        "Pengguna Threads membagikan pengalaman awal pengajuan dokumen KPR secara daring via portal resmi.",
      kataKunci: ["btn properti", "kpr online", "verifikasi"],
      penyediaAnalisis: "gemini",
    },
    {
      linkAsli: "https://www.threads.net/@user/post/DF_draft2",
      linkTernormalisasi: "https://threads.net/post/DF_draft2",
      teksPostingan:
        "Peringatan hoaks pesan broadcast whatsapp yang mengatasnamakan undian berhadiah tabungan batara BTN.",
      sumberInput: InputSourceType.CONTOH,
      tanggalDitemukan: now,
      tanggalPostingan: now,
      topik: "Tabungan BTN",
      sentimen: Sentiment.NEGATIF,
      prioritas: Priority.PERLU_PERHATIAN,
      status: MentionStatus.DRAF,
      headline: "Draf: Waspada Penipuan Broadcast Hoaks Tabungan Batara",
      ringkasan:
        "Laporan pesan berantai penipuan undian palsu yang membutuhkan verifikasi petugas sebelum dipublikasikan.",
      kataKunci: ["hoaks", "undian palsu", "tabungan batara"],
      penyediaAnalisis: "gemini",
    },
  ];

  for (const m of mentionsData) {
    await prisma.mention.create({
      data: m,
    });
  }

  // 3. Alerts Data
  await prisma.alert.createMany({
    data: [
      {
        jenis: AlertType.LONJAKAN,
        topik: "KPR BTN",
        periode: "14 Okt 2026",
        jumlah: 16,
        ambangDipakai: 10,
        dibaca: false,
        sumberInput: InputSourceType.CONTOH,
        dibuatPada: subDays(3),
      },
      {
        jenis: AlertType.PERLU_PERHATIAN,
        topik: "BTN Mobile",
        periode: "17 Okt 2026",
        jumlah: 1,
        ambangDipakai: null,
        dibaca: false,
        sumberInput: InputSourceType.CONTOH,
        dibuatPada: now,
      },
      {
        jenis: AlertType.PERLU_PERHATIAN,
        topik: "Pelayanan & CS",
        periode: "15 Okt 2026",
        jumlah: 1,
        ambangDipakai: null,
        dibaca: true,
        sumberInput: InputSourceType.CONTOH,
        dibuatPada: subDays(2),
      },
    ],
  });

  console.log("Seeding complete: topics, mentions, and alerts ready.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
