import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as mentionsPost } from "@/app/api/mentions/route";
import { POST as draftsPost } from "@/app/api/drafts/route";
import { createSignedSessionToken } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

describe("Pembuktian Tidak Ada Kontak Jaringan ke Threads di Luar POST /api/preview (Tahap 3B)", () => {
  const host = "localhost:3000";
  const baseUrl = `http://${host}`;
  let sessionCookie: Record<string, string>;
  const createdIds: string[] = [];

  beforeEach(() => {
    process.env.PREVIEW_ENABLED = "false";
    process.env.EXTENSION_TOKEN = "TEST_EXT_TOKEN_2026";
    const token = createSignedSessionToken();
    sessionCookie = {
      host,
      origin: baseUrl,
      cookie: `petugas_session=${token}`,
      "content-type": "application/json",
    };
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    delete process.env.PREVIEW_ENABLED;
    vi.restoreAllMocks();
    if (createdIds.length > 0) {
      await prisma.mention.deleteMany({
        where: { id: { in: createdIds } },
      });
      createdIds.length = 0;
    }
  });

  it("POST /api/mentions (penyimpanan form standar) TIDAK memanggil fetch ke luar sama sekali", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const uniqueUrl = `https://www.threads.net/@btn/post/NOCONTACT_FORM_${Date.now()}`;
    const req = new NextRequest(`${baseUrl}/api/mentions`, {
      method: "POST",
      headers: sessionCookie,
      body: JSON.stringify({
        linkAsli: uniqueUrl,
        teksPostingan:
          "Uji integritas: form input tidak boleh memicu fetch keluar.",
        topik: "Tabungan BTN",
      }),
    });

    const res = await mentionsPost(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    createdIds.push(json.mention.id);

    // BUKTI: fetch TIDAK PERNAH dipanggil
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("POST /api/mentions (tautan /share/ tanpa pratinjau) TIDAK memanggil fetch ke luar", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const shareUrl = `https://www.threads.com/share/NOCONTACT_SHARE_${Date.now()}`;
    const req = new NextRequest(`${baseUrl}/api/mentions`, {
      method: "POST",
      headers: sessionCookie,
      body: JSON.stringify({
        linkAsli: shareUrl,
        teksPostingan:
          "Uji tautan share tanpa pratinjau: dilarang melakukan permintaan jaringan untuk mencari kanonikal.",
        status: "DRAF",
      }),
    });

    const res = await mentionsPost(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    createdIds.push(json.mention.id);

    expect(json.mention.statusKanonik).toBe("BELUM_DIKETAHUI");
    // BUKTI: fetch TIDAK PERNAH dipanggil untuk menelusuri redirect tautan share
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("POST /api/mentions (draf dari Ekstensi Chrome dengan Bearer) TIDAK memanggil fetch ke luar", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const extUrl = `https://www.threads.net/@btn/post/NOCONTACT_EXT_${Date.now()}`;
    const req = new NextRequest(`${baseUrl}/api/mentions`, {
      method: "POST",
      headers: {
        host,
        authorization: "Bearer TEST_EXT_TOKEN_2026",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        linkAsli: extUrl,
        teksPostingan:
          "Teks dari ekstensi Chrome tanpa fetch server-side ke Threads.",
      }),
    });

    const res = await mentionsPost(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    createdIds.push(json.mention.id);

    expect(json.mention.status).toBe("DRAF");
    expect(json.mention.sumberInput).toBe("EKSTENSI");
    // BUKTI: fetch TIDAK PERNAH dipanggil
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("POST /api/drafts (persetujuan draf) TIDAK memanggil fetch ke luar", async () => {
    // 1. Buat draf awal
    const draftUrl = `https://www.threads.net/@btn/post/NOCONTACT_DRAFT_${Date.now()}`;
    const draft = await prisma.mention.create({
      data: {
        linkAsli: draftUrl,
        linkTernormalisasi: draftUrl,
        teksPostingan: "Postingan awal draf.",
        sumberInput: "EKSTENSI",
        status: "DRAF",
      },
    });
    createdIds.push(draft.id);

    const fetchSpy = vi.spyOn(globalThis, "fetch");

    // 2. Setujui draf
    const req = new NextRequest(`${baseUrl}/api/drafts`, {
      method: "POST",
      headers: sessionCookie,
      body: JSON.stringify({
        id: draft.id,
        action: "approve",
        edits: {
          headline: "Headline yang disetujui petugas",
        },
      }),
    });

    const res = await draftsPost(req);
    expect(res.status).toBe(200);

    // BUKTI: fetch TIDAK PERNAH dipanggil
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
