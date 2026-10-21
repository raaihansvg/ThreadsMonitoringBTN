import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock prisma client
vi.mock("@/lib/prisma", () => {
  return {
    prisma: {
      topic: {
        findMany: vi.fn(),
      },
    },
  };
});

import { prisma } from "@/lib/prisma";
import { POST as analyzePost } from "@/app/api/analyze/route";
import {
  createSignedSessionToken,
  resetAnalyzeRateLimit,
} from "@/lib/auth/session";
import { TEST_TOPICS } from "@/tests/fixtures/topics";

describe("Endpoint POST /api/analyze (Tahap 2B-1)", () => {
  const host = "localhost:3000";
  const baseUrl = `http://${host}`;

  beforeEach(() => {
    vi.clearAllMocks();
    resetAnalyzeRateLimit();
    (prisma.topic.findMany as any).mockResolvedValue(
      TEST_TOPICS.map((t, idx) => ({
        id: `topic-${idx}`,
        nama: t.nama,
        kataKunci: t.kataKunci,
        aktif: true,
        dibuatPada: new Date("2026-01-01T00:00:00Z"),
        diubahPada: new Date("2026-01-01T00:00:00Z"),
      }))
    );
  });

  it("menolak request tanpa sesi login petugas (401)", async () => {
    const req = new NextRequest(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: {
        host,
        origin: baseUrl,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        text: "Teks postingan tentang BTN",
      }),
    });

    const res = await analyzePost(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.ok).toBe(false);
  });

  it("menolak request dengan body teks kosong atau melebihi 5000 karakter (400)", async () => {
    const sessionToken = createSignedSessionToken();

    // Teks kosong
    const emptyReq = new NextRequest(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: {
        host,
        origin: baseUrl,
        cookie: `petugas_session=${sessionToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        text: "",
      }),
    });
    const emptyRes = await analyzePost(emptyReq);
    expect(emptyRes.status).toBe(400);

    // Teks > 5000 karakter
    const longText = "a".repeat(5001);
    const longReq = new NextRequest(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: {
        host,
        origin: baseUrl,
        cookie: `petugas_session=${sessionToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        text: longText,
      }),
    });
    const longRes = await analyzePost(longReq);
    expect(longRes.status).toBe(400);
  });

  it("mengembalikan 200 beserta data analisis, penyedia, dan fallbackDipakai untuk sesi sah", async () => {
    const sessionToken = createSignedSessionToken();

    const req = new NextRequest(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: {
        host,
        origin: baseUrl,
        cookie: `petugas_session=${sessionToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        text: "Pengajuan KPR BTN subsidi rumah prosesnya cepat dan memuaskan",
      }),
    });

    const res = await analyzePost(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.topik).toBe("KPR BTN");
    expect(body.sentimen).toBe("POSITIF");
    expect(body.penyedia).toBe("keyword");
    expect(body.fallbackDipakai).toBe(false);
  });

  it("membatasi frekuensi permintaan maksimal 20 req/menit per sesi (429 + Retry-After)", async () => {
    const sessionToken = createSignedSessionToken();

    // Jalankan 20 request sah
    for (let i = 1; i <= 20; i++) {
      const req = new NextRequest(`${baseUrl}/api/analyze`, {
        method: "POST",
        headers: {
          host,
          origin: baseUrl,
          cookie: `petugas_session=${sessionToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          text: `Uji request analisis ke-${i}`,
        }),
      });

      const res = await analyzePost(req);
      expect(res.status).toBe(200);
    }

    // Request ke-21 harus ditolak dengan status 429
    const req21 = new NextRequest(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: {
        host,
        origin: baseUrl,
        cookie: `petugas_session=${sessionToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        text: "Request ke-21 yang melampaui batas rate limit",
      }),
    });

    const res21 = await analyzePost(req21);
    expect(res21.status).toBe(429);
    expect(res21.headers.get("Retry-After")).toBeDefined();

    const body21 = await res21.json();
    expect(body21.ok).toBe(false);
    expect(body21.error).toContain("Terlalu banyak permintaan analisis");
  });
});
