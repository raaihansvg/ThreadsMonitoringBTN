import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { POST as draftsPost } from "@/app/api/drafts/route";
import { createSignedSessionToken } from "@/lib/auth/session";
import * as analysisService from "@/lib/analysis/service";

describe("Alur Persetujuan Draf - Pakai Hasil Analisis Tersimpan (Tahap 2B-2)", () => {
  const host = "localhost:3000";
  const baseUrl = `http://${host}`;
  let cookieHeader: Record<string, string>;
  const createdMentionIds: string[] = [];

  beforeEach(() => {
    vi.restoreAllMocks();
    const token = createSignedSessionToken();
    cookieHeader = {
      host,
      origin: baseUrl,
      cookie: `petugas_session=${token}`,
      "content-type": "application/json",
    };
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (createdMentionIds.length > 0) {
      await prisma.mention.deleteMany({
        where: { id: { in: createdMentionIds } },
      });
      createdMentionIds.length = 0;
    }
  });

  it("saat setujui draf dengan analisis tersimpan, analyzeText TIDAK dipanggil lagi", async () => {
    const uniqueUrl = `https://www.threads.net/@user/post/TEST_APPROVE_STORED_${Date.now()}`;
    const draft = await prisma.mention.create({
      data: {
        linkAsli: uniqueUrl,
        linkTernormalisasi: uniqueUrl,
        teksPostingan:
          "Pengalaman KPR BTN sangat memuaskan, proses cepat dan transparan",
        sumberInput: "FORM",
        status: "DRAF",
        topik: "KPR BTN",
        sentimen: "POSITIF",
        prioritas: "RUTIN",
        headline: "Headline Tersimpan Sebelumnya",
        ringkasan: "Ringkasan Tersimpan Sebelumnya",
        penyediaAnalisis: "keyword",
        dikoreksiManual: false,
      },
    });
    createdMentionIds.push(draft.id);

    const analyzeSpy = vi.spyOn(analysisService, "analyzeText");

    const req = new NextRequest(`${baseUrl}/api/drafts`, {
      method: "POST",
      headers: cookieHeader,
      body: JSON.stringify({
        id: draft.id,
        action: "approve",
      }),
    });

    const res = await draftsPost(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);

    // BUKTI: analyzeText TIDAK dipanggil saat persetujuan draf
    expect(analyzeSpy).not.toHaveBeenCalled();

    // Data yang disetujui persis memakai analisis yang tersimpan
    const approved = await prisma.mention.findUnique({
      where: { id: draft.id },
    });
    expect(approved?.status).toBe("BARU");
    expect(approved?.topik).toBe("KPR BTN");
    expect(approved?.sentimen).toBe("POSITIF");
    expect(approved?.headline).toBe("Headline Tersimpan Sebelumnya");
    expect(approved?.ringkasan).toBe("Ringkasan Tersimpan Sebelumnya");
  });

  it("fallback: saat field analisis kosong pada draf lama, analyzeText dipanggil sebagai fallback", async () => {
    const uniqueUrl = `https://www.threads.net/@user/post/TEST_APPROVE_FALLBACK_${Date.now()}`;
    const draft = await prisma.mention.create({
      data: {
        linkAsli: uniqueUrl,
        linkTernormalisasi: uniqueUrl,
        teksPostingan:
          "Update terbaru aplikasi BTN Mobile tampilannya makin modern",
        sumberInput: "IMPOR",
        status: "DRAF",
        topik: null,
        headline: null,
        ringkasan: null,
        sentimen: "NETRAL",
        prioritas: "RUTIN",
      },
    });
    createdMentionIds.push(draft.id);

    const analyzeSpy = vi.spyOn(analysisService, "analyzeText");

    const req = new NextRequest(`${baseUrl}/api/drafts`, {
      method: "POST",
      headers: cookieHeader,
      body: JSON.stringify({
        id: draft.id,
        action: "approve",
      }),
    });

    const res = await draftsPost(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);

    // Fallback analyzeText dipanggil karena draf belum memiliki analisis
    expect(analyzeSpy).toHaveBeenCalledTimes(1);

    const approved = await prisma.mention.findUnique({
      where: { id: draft.id },
    });
    expect(approved?.status).toBe("BARU");
    expect(approved?.headline).toBeTruthy();
    expect(approved?.ringkasan).toBeTruthy();
  });
});
