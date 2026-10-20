import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  MentionStatus,
  InputSourceType,
  Priority,
  Sentiment,
} from "@prisma/client";
import { GET as getDashboard } from "@/app/api/dashboard/route";
import { getStartOfWIBWeek } from "@/lib/time";

describe("Weekly Summary 5 Important Mentions (Senin WIB s/d Hari Ini)", () => {
  const createdIds: string[] = [];

  beforeEach(async () => {
    if (createdIds.length > 0) {
      await prisma.mention.deleteMany({ where: { id: { in: createdIds } } });
      createdIds.length = 0;
    }
  });

  afterAll(async () => {
    if (createdIds.length > 0) {
      await prisma.mention.deleteMany({ where: { id: { in: createdIds } } });
    }
  });

  it("Menghasilkan maksimal 5 mention penting berurutan: Perlu Perhatian, lalu Negatif, lalu terbaru", async () => {
    const mondayWib = getStartOfWIBWeek();
    // Buat waktu pengujian di dalam pekan berjalan (Senin + beberapa jam)
    const baseTime = new Date(mondayWib.getTime() + 10 * 3600 * 1000);

    // 1. Mention Rutin Positif (terbaru dalam waktu)
    const m1 = await prisma.mention.create({
      data: {
        linkAsli: "https://threads.net/@user1/post/week_1",
        linkTernormalisasi: "https://threads.net/post/week_1",
        teksPostingan:
          "Aplikasi BTN Mobile sangat membantu transaksi perumahan hari ini.",
        sumberInput: InputSourceType.FORM,
        status: MentionStatus.BARU,
        sentimen: Sentiment.POSITIF,
        prioritas: Priority.RUTIN,
        headline: "Aplikasi Sangat Membantu",
        ringkasan: "Transaksi lancar dengan BTN Mobile.",
        tanggalDitemukan: new Date(baseTime.getTime() + 5000),
      },
    });
    createdIds.push(m1.id);

    // 2. Mention Negatif (bukan perlu perhatian)
    const m2 = await prisma.mention.create({
      data: {
        linkAsli: "https://threads.net/@user2/post/week_2",
        linkTernormalisasi: "https://threads.net/post/week_2",
        teksPostingan:
          "Antrean kantor cabang sangat panjang dan teller lambat melayani.",
        sumberInput: InputSourceType.FORM,
        status: MentionStatus.BARU,
        sentimen: Sentiment.NEGATIF,
        prioritas: Priority.PANTAU,
        headline: "Antrean Panjang Teller Lambat",
        ringkasan: "", // summary kosong -> harus fallback ke 200 karakter pertama teks
        tanggalDitemukan: new Date(baseTime.getTime() + 2000),
      },
    });
    createdIds.push(m2.id);

    // 3. Mention Perlu Perhatian (prioritas tertinggi)
    const m3 = await prisma.mention.create({
      data: {
        linkAsli: "https://threads.net/@user3/post/week_3",
        linkTernormalisasi: "https://threads.net/post/week_3",
        teksPostingan:
          "KOK BISA UANG 17M LENYAP DI BANK BTN? SEKALI LAGI 17M WOIIII",
        sumberInput: InputSourceType.FORM,
        status: MentionStatus.BARU,
        sentimen: Sentiment.NEGATIF,
        prioritas: Priority.PERLU_PERHATIAN,
        headline: "Uang 17M Lenyap di Bank BTN",
        ringkasan: "Uang 17M Lenyap di Bank BTN", // sama dengan headline -> harus fallback ke 200 karakter teks
        tanggalDitemukan: new Date(baseTime.getTime() + 1000),
      },
    });
    createdIds.push(m3.id);

    const req = new NextRequest(
      "http://localhost:3000/api/dashboard?includeSample=false"
    );
    const res = await getDashboard(req);
    const data = await res.json();

    expect(data.weeklySummary.hasData).toBe(true);
    expect(data.weeklySummary.items).toBeDefined();
    expect(Array.isArray(data.weeklySummary.items)).toBe(true);
    expect(data.weeklySummary.items.length).toBeLessThanOrEqual(5);

    const items = data.weeklySummary.items;
    // Item pertama HARUS yang berprioritas PERLU_PERHATIAN (m3)
    expect(items[0].id).toBe(m3.id);
    expect(items[0].headline).toBe("Uang 17M Lenyap di Bank BTN");
    // Karena summary sama dengan headline, summary harus fallback ke 200 karakter teks
    expect(items[0].summary).toBe(
      "KOK BISA UANG 17M LENYAP DI BANK BTN? SEKALI LAGI 17M WOIIII"
    );

    // Item kedua HARUS yang bersentimen NEGATIF (m2)
    expect(items[1].id).toBe(m2.id);
    // Karena summary kosong, harus fallback ke 200 karakter teks
    expect(items[1].summary).toBe(m2.teksPostingan.slice(0, 200));

    // Item ketiga adalah yang positif/rutin (m1)
    expect(items[2].id).toBe(m1.id);
  });
});
