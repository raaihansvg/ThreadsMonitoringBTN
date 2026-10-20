import { describe, it, expect, afterEach } from "vitest";
import { POST as postMention } from "@/app/api/mentions/route";
import { prisma } from "@/lib/prisma";
import { createSignedSessionToken } from "@/lib/auth/session";
import { NextRequest } from "next/server";

describe("Simpan Mention & Respons Duplikat 409 (Tahap 3C)", () => {
  const createdIds: string[] = [];

  afterEach(async () => {
    if (createdIds.length > 0) {
      await prisma.mention.deleteMany({
        where: { id: { in: createdIds } },
      });
      createdIds.length = 0;
    }
  });

  it("POST /api/mentions menyimpan mention baru dengan tanggal hari ini, status BARU, dan sumber FORM", async () => {
    const sessionToken = createSignedSessionToken();
    const testUrl = `https://www.threads.com/@btn_nasabah/post/tahap3c_${Date.now()}`;
    const req = new NextRequest("http://localhost:3000/api/mentions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Host: "localhost:3000",
        Origin: "http://localhost:3000",
        Cookie: `petugas_session=${sessionToken}`,
      },
      body: JSON.stringify({
        linkAsli: testUrl,
        teksPostingan:
          "Aplikasi BTN Mobile semakin responsif dan cepat untuk transaksi.",
        topik: "BTN Mobile",
        sentimen: "POSITIF",
        prioritas: "RUTIN",
        headline: "Aplikasi BTN Mobile Semakin Responsif",
        ringkasan:
          "Nasabah mengapresiasi peningkatan kecepatan aplikasi BTN Mobile.",
      }),
    });

    const res = await postMention(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.mention).toBeDefined();
    createdIds.push(data.mention.id);

    // Ambil baris langsung dari database
    const saved = await prisma.mention.findUnique({
      where: { id: data.mention.id },
      select: {
        id: true,
        tanggalDitemukan: true,
        status: true,
        sumberInput: true,
      },
    });

    expect(saved).not.toBeNull();
    expect(saved?.id).toBe(data.mention.id);
    expect(saved?.status).toBe("BARU");
    expect(saved?.sumberInput).toBe("FORM");
    expect(saved?.tanggalDitemukan).toBeInstanceOf(Date);

    // Uji Duplikat: Permintaan kedua dengan URL sama menghasilkan HTTP 409
    const reqDup = new NextRequest("http://localhost:3000/api/mentions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Host: "localhost:3000",
        Origin: "http://localhost:3000",
        Cookie: `petugas_session=${sessionToken}`,
      },
      body: JSON.stringify({
        linkAsli: testUrl,
        teksPostingan: "Percobaan simpan ulang dengan link yang sama.",
      }),
    });

    const resDup = await postMention(reqDup);
    expect(resDup.status).toBe(409);
    const dataDup = await resDup.json();
    expect(dataDup.ok).toBe(false);
    expect(dataDup.error).toContain("sudah tercatat");
    expect(dataDup.existingId).toBe(data.mention.id);
  });
});
