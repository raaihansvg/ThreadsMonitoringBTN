import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GET as getDashboard } from "@/app/api/dashboard/route";
import { prisma } from "@/lib/prisma";
import {
  Sentiment,
  Priority,
  MentionStatus,
  InputSourceType,
  AlertType,
} from "@prisma/client";
import { getPresetDateRanges } from "@/lib/time";
import { NextRequest } from "next/server";

describe("Rentang Tanggal Dashboard & Ringkasan Mingguan (WIB) - Tahap 3C", () => {
  const createdMentionIds: string[] = [];
  const createdAlertIds: string[] = [];

  // Tetapkan waktu sistem mock: 2026-10-19 12:00 WIB (05:00 UTC)
  const MOCK_NOW_UTC = "2026-10-19T05:00:00.000Z";

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(MOCK_NOW_UTC));
  });

  afterEach(async () => {
    vi.useRealTimers();
    if (createdMentionIds.length > 0) {
      await prisma.mention.deleteMany({
        where: { id: { in: createdMentionIds } },
      });
      createdMentionIds.length = 0;
    }
    if (createdAlertIds.length > 0) {
      await prisma.alert.deleteMany({
        where: { id: { in: createdAlertIds } },
      });
      createdAlertIds.length = 0;
    }
  });

  it("mention bertanggal hari ini muncul pada rentang Bulan Ini dan 30 Hari Terakhir", async () => {
    // Buat mention bertanggal hari ini (19 Okt 2026, 12:00 WIB = 05:00 UTC)
    const todayMention = await prisma.mention.create({
      data: {
        linkAsli: "https://threads.net/@user/post/today123",
        linkTernormalisasi: "https://threads.net/post/today123",
        teksPostingan:
          "Uji coba transaksi QRIS BTN Mobile hari ini lancar jaya.",
        sumberInput: InputSourceType.FORM,
        tanggalDitemukan: new Date("2026-10-19T05:00:00.000Z"),
        status: MentionStatus.BARU,
        sentimen: Sentiment.POSITIF,
        prioritas: Priority.RUTIN,
        headline: "Uji Coba QRIS BTN Mobile",
        ringkasan: "Transaksi QRIS lancar.",
      },
    });
    createdMentionIds.push(todayMention.id);

    const presets = getPresetDateRanges(new Date());
    const d30 = presets[2]; // 30 Hari Terakhir
    const month = presets[3]; // Bulan Ini

    // 1. Uji rentang default (30 Hari Terakhir)
    const reqDefault = new NextRequest("http://localhost:3000/api/dashboard");
    const resDefault = await getDashboard(reqDefault);
    const dataDefault = await resDefault.json();

    expect(dataDefault.totalMentions).toBeGreaterThanOrEqual(1);

    // 2. Uji rentang Bulan Ini eksplisit
    const reqMonth = new NextRequest(
      `http://localhost:3000/api/dashboard?startDate=${month.startDate}&endDate=${month.endDate}`
    );
    const resMonth = await getDashboard(reqMonth);
    const dataMonth = await resMonth.json();

    expect(dataMonth.totalMentions).toBeGreaterThanOrEqual(1);

    // 3. Uji rentang 30 Hari Terakhir eksplisit
    const reqD30 = new NextRequest(
      `http://localhost:3000/api/dashboard?startDate=${d30.startDate}&endDate=${d30.endDate}`
    );
    const resD30 = await getDashboard(reqD30);
    const dataD30 = await resD30.json();

    expect(dataD30.totalMentions).toBeGreaterThanOrEqual(1);
  });

  it("mention bertanggal dekat tengah malam WIB (00:05 WIB & 23:55 WIB) tetap tercakup dalam rentang hari ini", async () => {
    // Mention 1: Tepat 5 menit setelah tengah malam WIB (00:05 WIB = 17:05 UTC kemarin)
    const nearMidnightStart = await prisma.mention.create({
      data: {
        linkAsli: "https://threads.net/@user/post/midnight_start",
        linkTernormalisasi: "https://threads.net/post/midnight_start",
        teksPostingan: "Postingan dini hari 00:05 WIB tentang BTN Mobile.",
        sumberInput: InputSourceType.FORM,
        tanggalDitemukan: new Date("2026-10-18T17:05:00.000Z"), // 00:05 WIB 19 Okt
        status: MentionStatus.BARU,
        sentimen: Sentiment.POSITIF,
        prioritas: Priority.RUTIN,
        headline: "Dini Hari 00:05 WIB",
        ringkasan: "Postingan dini hari.",
      },
    });
    createdMentionIds.push(nearMidnightStart.id);

    // Mention 2: Tepat 5 menit sebelum tengah malam WIB berakhir (23:55 WIB = 16:55 UTC hari yang sama)
    const nearMidnightEnd = await prisma.mention.create({
      data: {
        linkAsli: "https://threads.net/@user/post/midnight_end",
        linkTernormalisasi: "https://threads.net/post/midnight_end",
        teksPostingan: "Postingan larut malam 23:55 WIB tentang KPR BTN.",
        sumberInput: InputSourceType.FORM,
        tanggalDitemukan: new Date("2026-10-19T16:55:00.000Z"), // 23:55 WIB 19 Okt
        status: MentionStatus.BARU,
        sentimen: Sentiment.NETRAL,
        prioritas: Priority.RUTIN,
        headline: "Larut Malam 23:55 WIB",
        ringkasan: "Postingan larut malam.",
      },
    });
    createdMentionIds.push(nearMidnightEnd.id);

    const presets = getPresetDateRanges(new Date());
    const month = presets[3]; // Bulan Ini

    const req = new NextRequest(
      `http://localhost:3000/api/dashboard?startDate=${month.startDate}&endDate=${month.endDate}`
    );
    const res = await getDashboard(req);
    const data = await res.json();

    // Pastikan kedua postingan dekat tengah malam WIB masuk ke dalam hasil
    expect(data.totalMentions).toBeGreaterThanOrEqual(2);
  });

  it("Ringkasan Mingguan menampilkan hasData false bila tidak ada data pekan ini dan tidak menghasilkan teks palsu", async () => {
    // Pindahkan waktu ke masa depan di mana belum ada data pekan tersebut
    vi.setSystemTime(new Date("2027-05-10T05:00:00.000Z"));

    const req = new NextRequest(
      "http://localhost:3000/api/dashboard?includeSample=false"
    );
    const res = await getDashboard(req);
    const data = await res.json();

    expect(data.weeklySummary.hasData).toBe(false);
    expect(data.weeklySummary.headline).toBe("");
    expect(data.weeklySummary.summary).toBe("");
  });

  it("hitungan Draf dan Alert di dashboard konsisten dengan toggle includeSample", async () => {
    // Hitung baseline awal sebelum menambah entri uji
    const baselineManualDrafts = await prisma.mention.count({
      where: {
        status: MentionStatus.DRAF,
        sumberInput: { not: InputSourceType.CONTOH },
      },
    });
    const baselineManualAlerts = await prisma.alert.count({
      where: {
        dibaca: false,
        sumberInput: { not: InputSourceType.CONTOH },
      },
    });

    // 1. Buat 1 Draf sampel dan 1 Draf manual
    const sampleDraft = await prisma.mention.create({
      data: {
        linkAsli: "https://threads.net/@user/post/sample_draft",
        linkTernormalisasi: "https://threads.net/post/sample_draft",
        sumberInput: InputSourceType.CONTOH,
        status: MentionStatus.DRAF,
        tanggalDitemukan: new Date(),
        teksPostingan: "Draf contoh",
      },
    });
    createdMentionIds.push(sampleDraft.id);

    const manualDraft = await prisma.mention.create({
      data: {
        linkAsli: "https://threads.net/@user/post/manual_draft",
        linkTernormalisasi: "https://threads.net/post/manual_draft",
        sumberInput: InputSourceType.FORM,
        status: MentionStatus.DRAF,
        tanggalDitemukan: new Date(),
        teksPostingan: "Draf manual",
      },
    });
    createdMentionIds.push(manualDraft.id);

    // 2. Buat 1 Alert sampel dan 1 Alert manual
    const sampleAlert = await prisma.alert.create({
      data: {
        jenis: AlertType.LONJAKAN,
        topik: "KPR BTN",
        jumlah: 15,
        dibaca: false,
        sumberInput: InputSourceType.CONTOH,
      },
    });
    createdAlertIds.push(sampleAlert.id);

    const manualAlert = await prisma.alert.create({
      data: {
        jenis: AlertType.PERLU_PERHATIAN,
        topik: "BTN Mobile",
        jumlah: 5,
        dibaca: false,
        sumberInput: InputSourceType.FORM,
      },
    });
    createdAlertIds.push(manualAlert.id);

    // Saat includeSample = false:
    const reqNoSample = new NextRequest(
      "http://localhost:3000/api/dashboard?includeSample=false"
    );
    const resNoSample = await getDashboard(reqNoSample);
    const dataNoSample = await resNoSample.json();

    // Hanya draf & alert manual yang bertambah (+1 dari baseline)
    expect(dataNoSample.draftsCount).toBe(baselineManualDrafts + 1);
    expect(dataNoSample.unreadAlertsCount).toBe(baselineManualAlerts + 1);

    // Saat includeSample = true:
    const reqWithSample = new NextRequest(
      "http://localhost:3000/api/dashboard?includeSample=true"
    );
    const resWithSample = await getDashboard(reqWithSample);
    const dataWithSample = await resWithSample.json();

    expect(dataWithSample.draftsCount).toBeGreaterThan(
      dataNoSample.draftsCount
    );
    expect(dataWithSample.unreadAlertsCount).toBeGreaterThan(
      dataNoSample.unreadAlertsCount
    );
  });
});
