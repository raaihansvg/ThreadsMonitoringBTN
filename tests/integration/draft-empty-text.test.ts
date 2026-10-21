import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as mentionsPost } from "@/app/api/mentions/route";
import { POST as draftsPost } from "@/app/api/drafts/route";
import { createSignedSessionToken } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

describe("Draf Tanpa Teks & Status Kanonik Tautan /share/ (Tahap 3B)", () => {
  const host = "localhost:3000";
  const baseUrl = `http://${host}`;
  let cookieHeader: Record<string, string>;

  beforeEach(async () => {
    const token = createSignedSessionToken();
    cookieHeader = {
      host,
      origin: baseUrl,
      cookie: `petugas_session=${token}`,
      "content-type": "application/json",
    };
  });

  it("draf tanpa teks tersimpan sebagai DRAF dan TIDAK dianalisis (tanpa placeholder)", async () => {
    const uniqueUrl = `https://www.threads.net/@user/post/TEST_EMPTY_${Date.now()}`;
    const req = new NextRequest(`${baseUrl}/api/mentions`, {
      method: "POST",
      headers: cookieHeader,
      body: JSON.stringify({
        linkAsli: uniqueUrl,
        teksPostingan: "", // Teks kosong
        status: "DRAF",
        sumberInput: "IMPOR",
      }),
    });

    const res = await mentionsPost(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(json.mention.status).toBe("DRAF");
    expect(json.mention.teksPostingan).toBe("");
    // TIDAK dianalisis:
    expect(json.mention.topik).toBeNull();
    expect(json.mention.headline).toBe("");
    expect(json.mention.ringkasan).toBe("");
    expect(json.mention.penyediaAnalisis).toBeNull();
    expect(json.mention.kataKunci).toEqual([]);

    // Bersihkan
    await prisma.mention.delete({ where: { id: json.mention.id } });
  });

  it("draf tanpa teks TIDAK dapat disetujui sebelum teks diisi oleh petugas", async () => {
    // 1. Buat draf tanpa teks di basis data
    const uniqueUrl = `https://www.threads.net/@user/post/TEST_APPROVE_EMPTY_${Date.now()}`;
    const draft = await prisma.mention.create({
      data: {
        linkAsli: uniqueUrl,
        linkTernormalisasi: uniqueUrl,
        teksPostingan: "",
        sumberInput: "IMPOR",
        status: "DRAF",
        statusKanonik: "DIKETAHUI",
      },
    });

    // 2. Coba setujui tanpa memberikan suntingan teks postingan
    const req = new NextRequest(`${baseUrl}/api/drafts`, {
      method: "POST",
      headers: cookieHeader,
      body: JSON.stringify({
        id: draft.id,
        action: "approve",
      }),
    });

    const res = await draftsPost(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error).toMatch(
      /tidak dapat disetujui sebelum teks postingan diisi/i
    );

    // Pastikan status di database masih tetap DRAF (tidak bocor ke BARU)
    const checkDb = await prisma.mention.findUnique({
      where: { id: draft.id },
    });
    expect(checkDb?.status).toBe("DRAF");

    // 3. Setujui dengan memberikan suntingan teks postingan oleh petugas
    const reqWithText = new NextRequest(`${baseUrl}/api/drafts`, {
      method: "POST",
      headers: cookieHeader,
      body: JSON.stringify({
        id: draft.id,
        action: "approve",
        edits: {
          teksPostingan:
            "Aplikasi BTN Mobile kini semakin cepat dan mudah digunakan.",
        },
      }),
    });

    const resWithText = await draftsPost(reqWithText);
    expect(resWithText.status).toBe(200);
    const approvedJson = await resWithText.json();
    expect(approvedJson.ok).toBe(true);
    expect(approvedJson.mention.status).toBe("BARU");
    expect(approvedJson.mention.teksPostingan).toContain("BTN Mobile");
    expect(approvedJson.mention.topik).toBe("Lainnya");
    expect(approvedJson.mention.dikoreksiManual).toBe(true);

    // Bersihkan
    await prisma.mention.delete({ where: { id: draft.id } });
  });

  it("persetujuan draf memakai topik dari database (Tahap 2B-1)", async () => {
    // 1. Masukkan topik ke database
    await prisma.topic.create({
      data: {
        nama: "BTN Mobile",
        kataKunci: ["btn mobile", "aplikasi"],
        aktif: true,
      },
    });

    const uniqueUrl = `https://www.threads.net/@user/post/TEST_APPROVE_TOPIC_${Date.now()}`;
    const draft = await prisma.mention.create({
      data: {
        linkAsli: uniqueUrl,
        linkTernormalisasi: uniqueUrl,
        teksPostingan: "",
        sumberInput: "IMPOR",
        status: "DRAF",
        statusKanonik: "DIKETAHUI",
      },
    });

    const reqWithText = new NextRequest(`${baseUrl}/api/drafts`, {
      method: "POST",
      headers: cookieHeader,
      body: JSON.stringify({
        id: draft.id,
        action: "approve",
        edits: {
          teksPostingan:
            "Aplikasi BTN Mobile kini semakin cepat dan mudah digunakan.",
        },
      }),
    });

    const resWithText = await draftsPost(reqWithText);
    expect(resWithText.status).toBe(200);
    const approvedJson = await resWithText.json();
    expect(approvedJson.ok).toBe(true);
    expect(approvedJson.mention.status).toBe("BARU");
    expect(approvedJson.mention.teksPostingan).toContain("BTN Mobile");
    expect(approvedJson.mention.topik).toBe("BTN Mobile");
    expect(approvedJson.mention.penyediaAnalisis).toBe("keyword");
    expect(approvedJson.mention.dikoreksiManual).toBe(true);

    // Bersihkan
    await prisma.mention.delete({ where: { id: draft.id } });
  });

  it("tautan /share/ tanpa pratinjau tersimpan dengan statusKanonik 'BELUM_DIKETAHUI'", async () => {
    const rawShareUrl = `https://www.threads.net/share/SHARE_${Date.now()}?xmt=AQG123`;
    const req = new NextRequest(`${baseUrl}/api/mentions`, {
      method: "POST",
      headers: cookieHeader,
      body: JSON.stringify({
        linkAsli: rawShareUrl,
        teksPostingan: "Pertanyaan mengenai persyaratan KPR BTN subsidi.",
        status: "DRAF",
      }),
    });

    const res = await mentionsPost(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.ok).toBe(true);
    // Tautan asli tersimpan apa adanya
    expect(json.mention.linkAsli).toBe(rawShareUrl);
    // Ditandai "BELUM_DIKETAHUI"
    expect(json.mention.statusKanonik).toBe("BELUM_DIKETAHUI");

    // Bersihkan
    await prisma.mention.delete({ where: { id: json.mention.id } });
  });
});
