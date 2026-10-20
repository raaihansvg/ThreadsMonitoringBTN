import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock prisma client
vi.mock("@/lib/prisma", () => {
  return {
    prisma: {
      mention: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      topic: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      alertConfig: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    },
  };
});

import { prisma } from "@/lib/prisma";
import { POST as mentionsPost } from "@/app/api/mentions/route";
import {
  createSignedSessionToken,
  resetMentionRateLimit,
} from "@/lib/auth/session";

describe("Rate Limiting POST /api/mentions (Tahap 3G)", () => {
  const host = "localhost:3000";
  const baseUrl = `http://${host}`;

  beforeEach(() => {
    vi.clearAllMocks();
    resetMentionRateLimit();
    (prisma.mention.findUnique as any).mockResolvedValue(null);
    (prisma.mention.create as any).mockImplementation((args: any) =>
      Promise.resolve({
        id: "m-" + Math.random(),
        ...args.data,
      })
    );
  });

  it("50 request beruntun dari sesi yang sama berhasil (200/201) untuk mendukung impor massal", async () => {
    const sessionToken = createSignedSessionToken();

    for (let i = 1; i <= 50; i++) {
      const req = new NextRequest(`${baseUrl}/api/mentions`, {
        method: "POST",
        headers: {
          host,
          origin: baseUrl,
          cookie: `petugas_session=${sessionToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          linkAsli: `https://www.threads.net/@btn/post/batch${i}`,
          teksPostingan: `Postingan impor massal ${i}`,
          status: "DRAF",
          sumberInput: "IMPOR",
        }),
      });

      const res = await mentionsPost(req);
      expect([200, 201]).toContain(res.status);
    }
  });

  it("request ke-61 dalam 1 menit yang sama menghasilkan 429 Too Many Requests dengan header Retry-After", async () => {
    const sessionToken = createSignedSessionToken();

    // 60 request pertama harus berhasil
    for (let i = 1; i <= 60; i++) {
      const req = new NextRequest(`${baseUrl}/api/mentions`, {
        method: "POST",
        headers: {
          host,
          origin: baseUrl,
          cookie: `petugas_session=${sessionToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          linkAsli: `https://www.threads.net/@btn/post/item${i}`,
          teksPostingan: `Postingan uji batas ${i}`,
          status: "DRAF",
          sumberInput: "IMPOR",
        }),
      });

      const res = await mentionsPost(req);
      expect([200, 201]).toContain(res.status);
    }

    // Request ke-61 harus ditolak dengan status 429
    const req61 = new NextRequest(`${baseUrl}/api/mentions`, {
      method: "POST",
      headers: {
        host,
        origin: baseUrl,
        cookie: `petugas_session=${sessionToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        linkAsli: "https://www.threads.net/@btn/post/item61",
        teksPostingan: "Postingan ke-61 harus dibatasi",
        status: "DRAF",
        sumberInput: "IMPOR",
      }),
    });

    const res61 = await mentionsPost(req61);
    expect(res61.status).toBe(429);

    const retryAfter = res61.headers.get("retry-after");
    expect(retryAfter).toBeDefined();
    expect(Number(retryAfter)).toBeGreaterThan(0);

    const body = await res61.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain("Terlalu banyak permintaan");
  });

  it("menolak payload batch array bila melebihi 50 item sekaligus (pertahanan berlapis)", async () => {
    const sessionToken = createSignedSessionToken();

    const overLimitBatch = Array.from({ length: 51 }, (_, i) => ({
      linkAsli: `https://www.threads.net/@btn/post/over${i}`,
      teksPostingan: `Teks ${i}`,
    }));

    const req = new NextRequest(`${baseUrl}/api/mentions`, {
      method: "POST",
      headers: {
        host,
        origin: baseUrl,
        cookie: `petugas_session=${sessionToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(overLimitBatch),
    });

    const res = await mentionsPost(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain("Batas maksimal impor massal adalah 50 item");
  });
});
