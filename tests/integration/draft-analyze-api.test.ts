import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { POST as analyzeDraftPost } from "@/app/api/drafts/[id]/analyze/route";
import {
  createSignedSessionToken,
  resetDraftAnalyzeRateLimit,
} from "@/lib/auth/session";
import * as analysisService from "@/lib/analysis/service";

describe("Endpoint POST /api/drafts/[id]/analyze (Tahap 2B-2)", () => {
  const host = "localhost:3000";
  const baseUrl = `http://${host}`;
  let cookieHeader: Record<string, string>;
  const createdMentionIds: string[] = [];

  beforeEach(() => {
    vi.restoreAllMocks();
    resetDraftAnalyzeRateLimit();
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

  it("1. berhasil menganalisis ulang draf dan memperbarui data di database", async () => {
    const uniqueUrl = `https://www.threads.net/@user/post/TEST_ANALYZE_OK_${Date.now()}`;
    const draft = await prisma.mention.create({
      data: {
        linkAsli: uniqueUrl,
        linkTernormalisasi: uniqueUrl,
        teksPostingan:
          "KPR BTN sangat membantu pengajuan rumah subsidi keluarga kami dengan bunga ringan",
        sumberInput: "FORM",
        status: "DRAF",
        topik: "Lainnya",
        sentimen: "NETRAL",
        prioritas: "RUTIN",
        headline: "Draf Awal",
        ringkasan: "Ringkasan Awal",
        dikoreksiManual: false,
      },
    });
    createdMentionIds.push(draft.id);

    const req = new NextRequest(`${baseUrl}/api/drafts/${draft.id}/analyze`, {
      method: "POST",
      headers: cookieHeader,
      body: JSON.stringify({}),
    });

    const res = await analyzeDraftPost(req, {
      params: Promise.resolve({ id: draft.id }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.fallback).toBe(false);
    expect(json.message).toBe("Analisis ulang selesai");
    expect(json.result).toBeDefined();
    expect(json.result.sentimen).toBe("POSITIF");

    // Periksa bahwa record di basis data ikut diperbarui
    const updated = await prisma.mention.findUnique({
      where: { id: draft.id },
    });
    expect(updated).not.toBeNull();
    expect(updated?.sentimen).toBe("POSITIF");
    expect(updated?.dikoreksiManual).toBe(false);
  });

  it("2. menolak draf dengan teks kosong (400)", async () => {
    const uniqueUrl = `https://www.threads.net/@user/post/TEST_ANALYZE_EMPTY_${Date.now()}`;
    const draft = await prisma.mention.create({
      data: {
        linkAsli: uniqueUrl,
        linkTernormalisasi: uniqueUrl,
        teksPostingan: "   ", // Teks kosong / whitespace
        sumberInput: "IMPOR",
        status: "DRAF",
        topik: "Lainnya",
        sentimen: "NETRAL",
        prioritas: "RUTIN",
      },
    });
    createdMentionIds.push(draft.id);

    const req = new NextRequest(`${baseUrl}/api/drafts/${draft.id}/analyze`, {
      method: "POST",
      headers: cookieHeader,
      body: JSON.stringify({}),
    });

    const res = await analyzeDraftPost(req, {
      params: Promise.resolve({ id: draft.id }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error).toMatch(/teks/i);
  });

  it("3. analisis gagal -> 200 + fallback: true, DB tidak berubah", async () => {
    const uniqueUrl = `https://www.threads.net/@user/post/TEST_ANALYZE_FAIL_${Date.now()}`;
    const draft = await prisma.mention.create({
      data: {
        linkAsli: uniqueUrl,
        linkTernormalisasi: uniqueUrl,
        teksPostingan: "Aplikasi BTN Mobile lambat dan tidak responsif",
        sumberInput: "FORM",
        status: "DRAF",
        topik: "BTN Mobile",
        sentimen: "NEGATIF",
        prioritas: "PANTAU",
        headline: "Headline Asli Lama",
        ringkasan: "Ringkasan Asli Lama",
        penyediaAnalisis: "keyword",
        dikoreksiManual: false,
      },
    });
    createdMentionIds.push(draft.id);

    // Mock analyzeText agar mengembalikan fallbackDipakai: true (atau melemparkan error)
    vi.spyOn(analysisService, "analyzeText").mockResolvedValueOnce({
      topik: "Lainnya",
      sentimen: "NETRAL",
      prioritas: "RUTIN",
      headline: "Fallback",
      ringkasan: "Fallback",
      kataKunci: [],
      penyedia: "keyword",
      fallbackDipakai: true,
    });

    const req = new NextRequest(`${baseUrl}/api/drafts/${draft.id}/analyze`, {
      method: "POST",
      headers: cookieHeader,
      body: JSON.stringify({}),
    });

    const res = await analyzeDraftPost(req, {
      params: Promise.resolve({ id: draft.id }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.fallback).toBe(true);
    expect(json.message).toBe("Analisis AI gagal, hasil lama dipertahankan.");
    expect(json.result.headline).toBe("Headline Asli Lama");
    expect(json.result.ringkasan).toBe("Ringkasan Asli Lama");

    // Periksa bahwa basis data TIDAK berubah
    const unchanged = await prisma.mention.findUnique({
      where: { id: draft.id },
    });
    expect(unchanged?.headline).toBe("Headline Asli Lama");
    expect(unchanged?.ringkasan).toBe("Ringkasan Asli Lama");
    expect(unchanged?.sentimen).toBe("NEGATIF");
  });

  it("4. dikoreksiManual tanpa confirmOverwrite -> 409", async () => {
    const uniqueUrl = `https://www.threads.net/@user/post/TEST_ANALYZE_MANUAL_${Date.now()}`;
    const draft = await prisma.mention.create({
      data: {
        linkAsli: uniqueUrl,
        linkTernormalisasi: uniqueUrl,
        teksPostingan: "Pelayanan di kantor cabang BTN sangat ramah dan cepat",
        sumberInput: "FORM",
        status: "DRAF",
        topik: "Pelayanan & CS",
        sentimen: "POSITIF",
        prioritas: "RUTIN",
        headline: "Hasil Suntingan Petugas",
        ringkasan: "Ringkasan Manual Petugas",
        dikoreksiManual: true, // Manual correction flag aktif
      },
    });
    createdMentionIds.push(draft.id);

    // Panggilan pertama: tanpa confirmOverwrite
    const reqWithoutConfirm = new NextRequest(
      `${baseUrl}/api/drafts/${draft.id}/analyze`,
      {
        method: "POST",
        headers: cookieHeader,
        body: JSON.stringify({}),
      }
    );

    const resWithoutConfirm = await analyzeDraftPost(reqWithoutConfirm, {
      params: Promise.resolve({ id: draft.id }),
    });

    expect(resWithoutConfirm.status).toBe(409);
    const jsonWithoutConfirm = await resWithoutConfirm.json();
    expect(jsonWithoutConfirm.ok).toBe(false);
    expect(jsonWithoutConfirm.error).toMatch(/konfirmasi/i);

    // Basis data tetap mempertahankan dikoreksiManual: true
    const checkDraft = await prisma.mention.findUnique({
      where: { id: draft.id },
    });
    expect(checkDraft?.dikoreksiManual).toBe(true);

    // Panggilan kedua: dengan confirmOverwrite = true -> harus berhasil (200)
    const reqWithConfirm = new NextRequest(
      `${baseUrl}/api/drafts/${draft.id}/analyze`,
      {
        method: "POST",
        headers: cookieHeader,
        body: JSON.stringify({ confirmOverwrite: true }),
      }
    );

    const resWithConfirm = await analyzeDraftPost(reqWithConfirm, {
      params: Promise.resolve({ id: draft.id }),
    });

    expect(resWithConfirm.status).toBe(200);
    const jsonWithConfirm = await resWithConfirm.json();
    expect(jsonWithConfirm.ok).toBe(true);

    const updatedDraft = await prisma.mention.findUnique({
      where: { id: draft.id },
    });
    expect(updatedDraft?.dikoreksiManual).toBe(false);
  });
});
