import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  MentionStatus,
  InputSourceType,
  AlertType,
  Priority,
  Sentiment,
} from "@prisma/client";
import { GET as getDrafts } from "@/app/api/drafts/route";
import { GET as getAlerts } from "@/app/api/alerts/route";

describe("Sidebar Badges includeSample Filtering", () => {
  const createdMentionIds: string[] = [];
  const createdAlertIds: string[] = [];

  beforeEach(async () => {
    // Bersihkan entri uji sebelumnya jika ada
    if (createdMentionIds.length > 0) {
      await prisma.mention.deleteMany({
        where: { id: { in: createdMentionIds } },
      });
      createdMentionIds.length = 0;
    }
    if (createdAlertIds.length > 0) {
      await prisma.alert.deleteMany({ where: { id: { in: createdAlertIds } } });
      createdAlertIds.length = 0;
    }
  });

  afterAll(async () => {
    if (createdMentionIds.length > 0) {
      await prisma.mention.deleteMany({
        where: { id: { in: createdMentionIds } },
      });
    }
    if (createdAlertIds.length > 0) {
      await prisma.alert.deleteMany({ where: { id: { in: createdAlertIds } } });
    }
  });

  it("Lencana Draf dan Alert bernilai 0 bila Data Contoh mati (includeSample=false) dan hanya ada data draf/alert contoh", async () => {
    // Buat draf contoh (sumberInput = CONTOH)
    const sampleDraft = await prisma.mention.create({
      data: {
        linkAsli: "https://threads.net/@sample_user/post/sidebar_draft_sample",
        linkTernormalisasi: "https://threads.net/post/sidebar_draft_sample",
        teksPostingan: "Ini draf sintetis contoh untuk pengujian sidebar.",
        sumberInput: InputSourceType.CONTOH,
        status: MentionStatus.DRAF,
        sentimen: Sentiment.NETRAL,
        prioritas: Priority.RUTIN,
        tanggalDitemukan: new Date(),
      },
    });
    createdMentionIds.push(sampleDraft.id);

    // Buat alert contoh (sumberInput = CONTOH, dibaca = false)
    const sampleAlert = await prisma.alert.create({
      data: {
        jenis: AlertType.PERLU_PERHATIAN,
        topik: "KPR BTN",
        periode: "Hari Ini",
        jumlah: 1,
        dibaca: false,
        sumberInput: InputSourceType.CONTOH,
      },
    });
    createdAlertIds.push(sampleAlert.id);

    // 1. Panggil /api/drafts?includeSample=false (simulasi pemanggilan di Sidebar saat showSampleData=false)
    const reqDraftsNoSample = new NextRequest(
      "http://localhost:3000/api/drafts?includeSample=false"
    );
    const resDraftsNoSample = await getDrafts(reqDraftsNoSample);
    const jsonDraftsNoSample = await resDraftsNoSample.json();

    expect(jsonDraftsNoSample.ok).toBe(true);
    // Pastikan tidak menyertakan draf contoh
    const hasSampleDraft = jsonDraftsNoSample.drafts.some(
      (d: { id: string }) => d.id === sampleDraft.id
    );
    expect(hasSampleDraft).toBe(false);

    // 2. Panggil /api/alerts?filter=unread&includeSample=false
    const reqAlertsNoSample = new NextRequest(
      "http://localhost:3000/api/alerts?filter=unread&includeSample=false"
    );
    const resAlertsNoSample = await getAlerts(reqAlertsNoSample);
    const jsonAlertsNoSample = await resAlertsNoSample.json();

    expect(jsonAlertsNoSample.ok).toBe(true);
    // Pastikan tidak menyertakan alert contoh
    const hasSampleAlert = jsonAlertsNoSample.alerts.some(
      (a: { id: string }) => a.id === sampleAlert.id
    );
    expect(hasSampleAlert).toBe(false);

    // 3. Bila includeSample=true, data contoh harus muncul
    const reqDraftsSample = new NextRequest(
      "http://localhost:3000/api/drafts?includeSample=true"
    );
    const resDraftsSample = await getDrafts(reqDraftsSample);
    const jsonDraftsSample = await resDraftsSample.json();
    expect(
      jsonDraftsSample.drafts.some(
        (d: { id: string }) => d.id === sampleDraft.id
      )
    ).toBe(true);

    const reqAlertsSample = new NextRequest(
      "http://localhost:3000/api/alerts?filter=unread&includeSample=true"
    );
    const resAlertsSample = await getAlerts(reqAlertsSample);
    const jsonAlertsSample = await resAlertsSample.json();
    expect(
      jsonAlertsSample.alerts.some(
        (a: { id: string }) => a.id === sampleAlert.id
      )
    ).toBe(true);
  });
});
