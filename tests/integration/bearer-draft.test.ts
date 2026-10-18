import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock prisma client
vi.mock("@/lib/prisma", () => {
  return {
    prisma: {
      mention: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      topic: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      alert: {
        update: vi.fn(),
      },
      alertConfig: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
    },
  };
});

import { prisma } from "@/lib/prisma";
import { POST as mentionsPost } from "@/app/api/mentions/route";
import {
  PATCH as mentionIdPatch,
  DELETE as mentionIdDelete,
} from "@/app/api/mentions/[id]/route";
import { POST as draftsPost } from "@/app/api/drafts/route";
import { PATCH as alertsPatch } from "@/app/api/alerts/route";
import {
  POST as topicsPost,
  DELETE as topicsDelete,
} from "@/app/api/topics/route";
import { POST as sampleDataPost } from "@/app/api/sample-data/route";

describe("Enforcement Otentikasi Bearer Token (FR-09, AC-06, Tahap 1.8)", () => {
  const host = "localhost:3000";
  const baseUrl = `http://${host}`;
  const extensionToken = "test-extension-token-btn-2026";
  const inputToken = "test-officer-input-token-btn-2026";

  beforeEach(() => {
    process.env.EXTENSION_TOKEN = extensionToken;
    process.env.INPUT_TOKEN = inputToken;
    vi.clearAllMocks();
  });

  describe("POST /api/mentions dengan Bearer Token", () => {
    it("memaksa status=DRAF dan sumberInput=EKSTENSI di server saat menggunakan EXTENSION_TOKEN sah", async () => {
      (prisma.mention.findUnique as any).mockResolvedValue(null);
      (prisma.mention.create as any).mockImplementation((args: any) => {
        return Promise.resolve({
          id: "m-bearer-1",
          ...args.data,
          waktuDitemukan: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });

      const req = new NextRequest(`${baseUrl}/api/mentions`, {
        method: "POST",
        headers: {
          host,
          origin: baseUrl,
          authorization: `Bearer ${extensionToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          linkAsli: "https://www.threads.net/@btn/post/987654",
          teksPostingan:
            "Aplikasi BTN Mobile sangat membantu transaksi harian.",
          status: "BARU", // Klien berusaha memaksa BARU
          sumberInput: "FORM", // Klien berusaha memaksa FORM
        }),
      });

      const res = await mentionsPost(req);
      expect([200, 201]).toContain(res.status);

      expect(prisma.mention.create).toHaveBeenCalledTimes(1);
      const createArgs = (prisma.mention.create as any).mock.calls[0][0];
      const savedData = createArgs.data;

      // Wajib dipaksa di server:
      expect(savedData.status).toBe("DRAF");
      expect(savedData.sumberInput).toBe("EKSTENSI");
    });

    it("MENOLAK INPUT_TOKEN sebagai Bearer token pada POST /api/mentions (harus 401)", async () => {
      const req = new NextRequest(`${baseUrl}/api/mentions`, {
        method: "POST",
        headers: {
          host,
          origin: baseUrl,
          authorization: `Bearer ${inputToken}`, // Mengirim INPUT_TOKEN sebagai Bearer
          "content-type": "application/json",
        },
        body: JSON.stringify({
          linkAsli: "https://www.threads.net/@btn/post/987654",
          teksPostingan: "Uji penolakan input token sebagai bearer.",
        }),
      });

      const res = await mentionsPost(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain("Akses ditolak");
    });

    it("MENOLAK Bearer token sembarang / tidak valid pada POST /api/mentions (401)", async () => {
      const req = new NextRequest(`${baseUrl}/api/mentions`, {
        method: "POST",
        headers: {
          host,
          origin: baseUrl,
          authorization: "Bearer wrong-token-12345",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          linkAsli: "https://www.threads.net/@btn/post/987654",
          teksPostingan: "Uji token sembarang.",
        }),
      });

      const res = await mentionsPost(req);
      expect(res.status).toBe(401);
    });
  });

  describe("Bearer Token (EXTENSION_TOKEN) DITOLAK di Semua Route Tulis Selain POST /api/mentions", () => {
    const makeBearerHeader = () => ({
      host,
      origin: baseUrl,
      authorization: `Bearer ${extensionToken}`,
      "content-type": "application/json",
    });

    it("PATCH /api/mentions/[id] menolak Bearer token (hanya menerima cookie sesi)", async () => {
      const req = new NextRequest(`${baseUrl}/api/mentions/123`, {
        method: "PATCH",
        headers: makeBearerHeader(),
        body: JSON.stringify({ status: "SELESAI" }),
      });
      const res = await mentionIdPatch(req, {
        params: Promise.resolve({ id: "123" }),
      });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain("Akses ditolak");
    });

    it("DELETE /api/mentions/[id] menolak Bearer token", async () => {
      const req = new NextRequest(`${baseUrl}/api/mentions/123`, {
        method: "DELETE",
        headers: makeBearerHeader(),
      });
      const res = await mentionIdDelete(req, {
        params: Promise.resolve({ id: "123" }),
      });
      expect(res.status).toBe(401);
    });

    it("POST /api/drafts menolak Bearer token", async () => {
      const req = new NextRequest(`${baseUrl}/api/drafts`, {
        method: "POST",
        headers: makeBearerHeader(),
        body: JSON.stringify({ id: "123", action: "approve" }),
      });
      const res = await draftsPost(req);
      expect(res.status).toBe(401);
    });

    it("PATCH /api/alerts menolak Bearer token", async () => {
      const req = new NextRequest(`${baseUrl}/api/alerts`, {
        method: "PATCH",
        headers: makeBearerHeader(),
        body: JSON.stringify({ id: "123" }),
      });
      const res = await alertsPatch(req);
      expect(res.status).toBe(401);
    });

    it("POST /api/topics menolak Bearer token", async () => {
      const req = new NextRequest(`${baseUrl}/api/topics`, {
        method: "POST",
        headers: makeBearerHeader(),
        body: JSON.stringify({ nama: "Topik Uji" }),
      });
      const res = await topicsPost(req);
      expect(res.status).toBe(401);
    });

    it("DELETE /api/topics menolak Bearer token", async () => {
      const req = new NextRequest(`${baseUrl}/api/topics?id=123`, {
        method: "DELETE",
        headers: makeBearerHeader(),
      });
      const res = await topicsDelete(req);
      expect(res.status).toBe(401);
    });

    it("POST /api/sample-data menolak Bearer token", async () => {
      const req = new NextRequest(`${baseUrl}/api/sample-data`, {
        method: "POST",
        headers: makeBearerHeader(),
        body: JSON.stringify({ action: "seed" }),
      });
      const res = await sampleDataPost(req);
      expect(res.status).toBe(401);
    });
  });
});
