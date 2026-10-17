import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  Sentiment,
  Priority,
  MentionStatus,
  InputSourceType,
  AlertType,
} from "@prisma/client";
import { requireOfficer } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const authError = await requireOfficer(req);
    if (authError) return authError;

    const body = await req.json();
    const { action } = body;

    if (action === "clear") {
      await prisma.mention.deleteMany({
        where: { sumberInput: InputSourceType.CONTOH },
      });
      await prisma.alert.deleteMany({});
      return NextResponse.json({
        ok: true,
        message: "Semua data contoh berhasil dihapus.",
      });
    }

    if (action === "seed") {
      // Re-seed data contoh
      await prisma.mention.deleteMany({
        where: { sumberInput: InputSourceType.CONTOH },
      });
      await prisma.alert.deleteMany({});

      const now = new Date("2026-10-17T12:00:00.000Z");
      const subDays = (days: number) =>
        new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

      const sampleMentions = [
        {
          linkAsli: "https://www.threads.net/@user/post/DF_today1",
          linkTernormalisasi: "https://threads.net/post/DF_today1",
          teksPostingan:
            "Alhamdulillah akad KPR BTN akhirnya selesai hari ini di KC Surabaya. Prosesnya jauh lebih cepat dari ekspektasi, petugas ramah dan transparan.",
          sumberInput: InputSourceType.CONTOH,
          tanggalDitemukan: now,
          topik: "KPR BTN",
          sentimen: Sentiment.POSITIF,
          prioritas: Priority.RUTIN,
          status: MentionStatus.BARU,
          headline: "Apresiasi Proses Akad KPR BTN Cepat di KC Surabaya",
          ringkasan:
            "Nasabah memuji kelancaran dan kecepatan proses akad KPR BTN di KC Surabaya serta pelayanan petugas yang ramah.",
          kataKunci: ["akad kpr", "kc surabaya", "ramah"],
          penyediaAnalisis: "gemini",
        },
        {
          linkAsli: "https://www.threads.net/@user/post/DF_today2",
          linkTernormalisasi: "https://threads.net/post/DF_today2",
          teksPostingan:
            "Update terbaru BTN Mobile tampilannya makin modern dan responsif. Buka rekening online lancar jaya.",
          sumberInput: InputSourceType.CONTOH,
          tanggalDitemukan: now,
          topik: "BTN Mobile",
          sentimen: Sentiment.POSITIF,
          prioritas: Priority.RUTIN,
          status: MentionStatus.BARU,
          headline:
            "Pujian Antarmuka dan Fitur Buka Rekening Online BTN Mobile",
          ringkasan:
            "Nasabah menyukai UI terbaru BTN Mobile yang responsif dan kemudahan membuka rekening secara daring.",
          kataKunci: ["btn mobile", "buka rekening"],
          penyediaAnalisis: "gemini",
        },
        {
          linkAsli: "https://www.threads.net/@user/post/DF_today3",
          linkTernormalisasi: "https://threads.net/post/DF_today3",
          teksPostingan:
            "Ada yang ngalamin gagal transfer QRIS di BTN Mobile siang ini? Saldo kepotong tapi status di kasir pending. No rek [NOMOR_REKENING_TERSEMBUNYI].",
          sumberInput: InputSourceType.CONTOH,
          tanggalDitemukan: now,
          topik: "BTN Mobile",
          sentimen: Sentiment.NEGATIF,
          prioritas: Priority.PERLU_PERHATIAN,
          status: MentionStatus.DIPANTAU,
          headline: "Keluhan Gagal Transaksi QRIS BTN Mobile Saldo Terpotong",
          ringkasan:
            "Nasabah melaporkan saldo berkurang saat transaksi QRIS namun status merchant pending.",
          kataKunci: ["gagal transfer", "qris", "saldo kepotong"],
          penyediaAnalisis: "gemini",
        },
        {
          linkAsli: "https://www.threads.net/@user/post/DF_day1_1",
          linkTernormalisasi: "https://threads.net/post/DF_day1_1",
          teksPostingan:
            "Diskusi hangat soal kebijakan dana Tapera di Threads. Penyaluran rumah subsidi BTN dinantikan pekerja muda.",
          sumberInput: InputSourceType.CONTOH,
          tanggalDitemukan: subDays(1),
          topik: "Tapera",
          sentimen: Sentiment.NETRAL,
          prioritas: Priority.PANTAU,
          status: MentionStatus.DIPANTAU,
          headline:
            "Diskusi Publik Kebijakan Tapera dan Penyaluran KPR Subsidi",
          ringkasan:
            "Warganet mendiskusikan integrasi dana Tapera dengan penyaluran rumah subsidi melalui Bank BTN.",
          kataKunci: ["tapera", "rumah subsidi"],
          penyediaAnalisis: "gemini",
        },
        {
          linkAsli: "https://www.threads.net/@user/post/DF_day3_1",
          linkTernormalisasi: "https://threads.net/post/DF_day3_1",
          teksPostingan:
            "Festival Properti BTN ramai banget di JCC! Promo bunga spesial 2.99% fixed 1 tahun menarik banyak pengunjung.",
          sumberInput: InputSourceType.CONTOH,
          tanggalDitemukan: subDays(3),
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
      ];

      for (const m of sampleMentions) {
        await prisma.mention.create({ data: m });
      }

      await prisma.alert.createMany({
        data: [
          {
            jenis: AlertType.LONJAKAN,
            topik: "KPR BTN",
            periode: "14 Okt 2026",
            jumlah: 16,
            ambangDipakai: 10,
            dibaca: false,
            dibuatPada: subDays(3),
          },
          {
            jenis: AlertType.PERLU_PERHATIAN,
            topik: "BTN Mobile",
            periode: "17 Okt 2026",
            jumlah: 4,
            ambangDipakai: 2,
            dibaca: false,
            dibuatPada: now,
          },
        ],
      });

      return NextResponse.json({
        ok: true,
        message: "Data contoh berhasil diisi kembali.",
      });
    }

    return NextResponse.json(
      { ok: false, error: "Aksi tidak dikenali." },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Gagal mengelola data contoh",
      },
      { status: 500 }
    );
  }
}
