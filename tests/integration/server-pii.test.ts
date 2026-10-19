import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createSignedSessionToken } from "@/lib/auth/session";

// Mock prisma client
vi.mock("@/lib/prisma", () => {
  return {
    prisma: {
      mention: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      topic: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      alert: {
        create: vi.fn(),
      },
    },
  };
});

import { prisma } from "@/lib/prisma";
import { POST as mentionsPost } from "@/app/api/mentions/route";
import { POST as draftsPost } from "@/app/api/drafts/route";

describe("Validasi Payload Zod & Penyamaran PII di Server (Tahap 1.6)", () => {
  const host = "localhost:3000";
  const baseUrl = `http://${host}`;
  const validToken = createSignedSessionToken();

  const makeAuthHeader = () => ({
    host,
    origin: baseUrl,
    cookie: `petugas_session=${validToken}`,
    "content-type": "application/json",
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Server-Side PII Masking pada POST /api/mentions", () => {
    it("menyamarkan email, telepon, NIK, dan rekening bank di server sebelum disimpan ke database", async () => {
      const rawPiiText =
        "Halo nasabah.btn@gmail.com dengan telp 081234567890 dan NIK 3171012304950001, rek BTN 001234567890 komplain KPR.";

      (prisma.mention.findUnique as any).mockResolvedValue(null);
      (prisma.mention.create as any).mockImplementation((args: any) => {
        return Promise.resolve({
          id: "m-test-1",
          ...args.data,
          waktuDitemukan: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });

      const req = new NextRequest(`${baseUrl}/api/mentions`, {
        method: "POST",
        headers: makeAuthHeader(),
        body: JSON.stringify({
          linkAsli: "https://www.threads.net/@user/post/123456",
          teksPostingan: rawPiiText,
          headline: "Keluhan KPR dari nasabah.btn@gmail.com",
          ringkasan:
            "Nasabah 081234567890 rekening 001234567890 gagal bayar KPR",
          topik: "KPR BTN",
          sentimen: "NEGATIF",
          prioritas: "PERLU_PERHATIAN",
          sumberInput: "FORM",
        }),
      });

      const res = await mentionsPost(req);
      expect([200, 201]).toContain(res.status);

      // Verifikasi argumen yang dikirim ke prisma.mention.create
      expect(prisma.mention.create).toHaveBeenCalledTimes(1);
      const createArgs = (prisma.mention.create as any).mock.calls[0][0];
      const savedData = createArgs.data;

      // 1. Teks postingan wajib disamarkan
      expect(savedData.teksPostingan).not.toContain("nasabah.btn@gmail.com");
      expect(savedData.teksPostingan).not.toContain("081234567890");
      expect(savedData.teksPostingan).not.toContain("3171012304950001");
      expect(savedData.teksPostingan).not.toContain("001234567890");
      expect(savedData.teksPostingan).toContain("[EMAIL_TERSEMBUNYI]");
      expect(savedData.teksPostingan).toContain("[NOMOR_TELEPON_TERSEMBUNYI]");
      expect(savedData.teksPostingan).toContain("[NIK_TERSEMBUNYI]");
      expect(savedData.teksPostingan).toContain("[NOMOR_REKENING_TERSEMBUNYI]");

      // 2. Headline wajib disamarkan
      expect(savedData.headline).not.toContain("nasabah.btn@gmail.com");
      expect(savedData.headline).toContain("[EMAIL_TERSEMBUNYI]");

      // 3. Ringkasan wajib disamarkan
      expect(savedData.ringkasan).not.toContain("081234567890");
      expect(savedData.ringkasan).not.toContain("001234567890");
      expect(savedData.ringkasan).toContain("[NOMOR_TELEPON_TERSEMBUNYI]");
      expect(savedData.ringkasan).toContain("[NOMOR_REKENING_TERSEMBUNYI]");
    });
  });

  describe("Server-Side PII Masking pada POST /api/drafts (Aksi Approve dengan Edits)", () => {
    it("menyamarkan PII pada update headline dan ringkasan saat menyetujui draf dengan perubahan", async () => {
      (prisma.mention.findUnique as any).mockResolvedValue({
        id: "draft-123",
        status: "DRAF",
        teksPostingan: "Teks postingan draf awal seputar BTN.",
      });

      (prisma.mention.update as any).mockImplementation((args: any) => {
        return Promise.resolve({
          id: args.where.id,
          ...args.data,
        });
      });

      const req = new NextRequest(`${baseUrl}/api/drafts`, {
        method: "POST",
        headers: makeAuthHeader(),
        body: JSON.stringify({
          id: "draft-123",
          action: "approve",
          edits: {
            headline: "Update kontak telp 081234567890",
            ringkasan: "Update NIK 3171012304950001 dan rek 001234567890",
            topik: "KPR BTN",
            sentimen: "NEGATIF",
            prioritas: "PANTAU",
          },
        }),
      });

      const res = await draftsPost(req);
      expect(res.status).toBe(200);

      expect(prisma.mention.update).toHaveBeenCalledTimes(1);
      const updateArgs = (prisma.mention.update as any).mock.calls[0][0];
      const updatedData = updateArgs.data;

      expect(updatedData.headline).not.toContain("081234567890");
      expect(updatedData.headline).toContain("[NOMOR_TELEPON_TERSEMBUNYI]");

      expect(updatedData.ringkasan).not.toContain("3171012304950001");
      expect(updatedData.ringkasan).not.toContain("001234567890");
      expect(updatedData.ringkasan).toContain("[NIK_TERSEMBUNYI]");
      expect(updatedData.ringkasan).toContain("[NOMOR_REKENING_TERSEMBUNYI]");
    });
  });

  describe("Validasi Payload Zod", () => {
    it("menolak nilai enum sentimen yang tidak valid", async () => {
      const req = new NextRequest(`${baseUrl}/api/mentions`, {
        method: "POST",
        headers: makeAuthHeader(),
        body: JSON.stringify({
          linkAsli: "https://www.threads.net/@user/post/123",
          teksPostingan: "Uji coba validasi sentimen",
          sentimen: "INVALID_SENTIMENT",
        }),
      });

      const res = await mentionsPost(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Validasi gagal");
    });

    it("menolak panjang headline yang melebihi 100 karakter", async () => {
      const req = new NextRequest(`${baseUrl}/api/mentions`, {
        method: "POST",
        headers: makeAuthHeader(),
        body: JSON.stringify({
          linkAsli: "https://www.threads.net/@user/post/123",
          teksPostingan: "Uji coba validasi headline",
          headline: "H".repeat(101),
        }),
      });

      const res = await mentionsPost(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Validasi gagal");
      expect(data.error).toContain("100");
    });

    it("menolak panjang ringkasan yang melebihi 400 karakter", async () => {
      const req = new NextRequest(`${baseUrl}/api/mentions`, {
        method: "POST",
        headers: makeAuthHeader(),
        body: JSON.stringify({
          linkAsli: "https://www.threads.net/@user/post/123",
          teksPostingan: "Uji coba validasi ringkasan",
          ringkasan: "R".repeat(401),
        }),
      });

      const res = await mentionsPost(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Validasi gagal");
      expect(data.error).toContain("400");
    });

    it("menolak URL postingan yang bukan URL valid", async () => {
      const req = new NextRequest(`${baseUrl}/api/mentions`, {
        method: "POST",
        headers: makeAuthHeader(),
        body: JSON.stringify({
          linkAsli: "bukan-url-yang-valid",
          teksPostingan: "Uji coba invalid url",
        }),
      });

      const res = await mentionsPost(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Format URL tidak valid");
    });
  });
});
