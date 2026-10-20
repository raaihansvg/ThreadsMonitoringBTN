import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  requireOfficer,
  createSignedSessionToken,
  verifySessionToken,
  verifyInputToken,
  isBearerAuth,
  checkLoginRateLimit,
  recordLoginAttempt,
  resetLoginRateLimit,
} from "@/lib/auth/session";

// Import semua handler route tulis
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
import { POST as previewPost } from "@/app/api/preview/route";

describe("Audit Keamanan Sesi & Guard Terpusat requireOfficer (Tahap 1.5)", () => {
  const host = "localhost:3000";
  const baseUrl = `http://${host}`;

  describe("Token Bertanda Tangan HMAC-SHA256", () => {
    it("menghasilkan token sesi dengan format valid <payload>.<signature>", () => {
      const token = createSignedSessionToken();
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(2);
    });

    it("memverifikasi token sah dan mengekstrak payload iat, exp, nonce, role", () => {
      const token = createSignedSessionToken();
      const payload = verifySessionToken(token);
      expect(payload).not.toBeNull();
      expect(payload?.role).toBe("petugas");
      expect(payload?.nonce).toBeDefined();
      expect(payload?.exp).toBeGreaterThan(payload?.iat || 0);
    });

    it("menolak token yang dipalsukan / signature rusak", () => {
      const token = createSignedSessionToken();
      const tampered = token.slice(0, -4) + "XXXX";
      expect(verifySessionToken(tampered)).toBeNull();
    });

    it("menolak cookie bernilai statis usang 'authenticated'", () => {
      expect(verifySessionToken("authenticated")).toBeNull();
    });

    it("melempar Error bila SESSION_SECRET tidak ada atau kurang dari 32 karakter", () => {
      const originalSecret = process.env.SESSION_SECRET;
      try {
        delete process.env.SESSION_SECRET;
        expect(() => createSignedSessionToken()).toThrow(
          "SESSION_SECRET wajib dikonfigurasi minimal 32 karakter."
        );

        process.env.SESSION_SECRET = "too-short";
        expect(() => createSignedSessionToken()).toThrow(
          "SESSION_SECRET wajib dikonfigurasi minimal 32 karakter."
        );
      } finally {
        process.env.SESSION_SECRET = originalSecret;
      }
    });
  });

  describe("Constant-Time Token Comparison (crypto.timingSafeEqual)", () => {
    it("menerima token yang cocok persis", () => {
      expect(verifyInputToken("BTN_SECRET_2026", "BTN_SECRET_2026")).toBe(true);
    });

    it("menolak token yang tidak cocok atau beda panjang tanpa timing leak", () => {
      expect(verifyInputToken("WRONG", "BTN_SECRET_2026")).toBe(false);
      expect(verifyInputToken("BTN_SECRET_2027", "BTN_SECRET_2026")).toBe(
        false
      );
      expect(verifyInputToken("", "BTN_SECRET_2026")).toBe(false);
      expect(verifyInputToken(null, "BTN_SECRET_2026")).toBe(false);
    });

    it("token kosong atau serverToken kosong tidak pernah lolos autentikasi", () => {
      expect(verifyInputToken("", "")).toBe(false);
      expect(verifyInputToken("   ", "   ")).toBe(false);
      expect(verifyInputToken("", "BTN_SECRET_2026")).toBe(false);
      expect(verifyInputToken("BTN_SECRET_2026", "")).toBe(false);
      expect(verifyInputToken("BTN_SECRET_2026", "   ")).toBe(false);
      expect(verifyInputToken(undefined, undefined)).toBe(false);
      expect(verifyInputToken(null, null)).toBe(false);
    });

    it("isBearerAuth menolak otentikasi bila EXTENSION_TOKEN di env kosong atau undefined", () => {
      const originalExt = process.env.EXTENSION_TOKEN;
      try {
        delete process.env.EXTENSION_TOKEN;
        const req1 = new NextRequest("http://localhost:3000/api/mentions", {
          method: "POST",
          headers: { authorization: "Bearer some-token" },
        });
        expect(isBearerAuth(req1)).toBe(false);

        process.env.EXTENSION_TOKEN = "   ";
        const req2 = new NextRequest("http://localhost:3000/api/mentions", {
          method: "POST",
          headers: { authorization: "Bearer some-token" },
        });
        expect(isBearerAuth(req2)).toBe(false);
      } finally {
        process.env.EXTENSION_TOKEN = originalExt;
      }
    });
  });

  describe("Rate Limiting Percobaan Login (5 per menit per IP)", () => {
    const testIp = "192.168.1.100";

    beforeEach(() => {
      resetLoginRateLimit(testIp);
    });

    it("mengizinkan hingga 5 percobaan dalam 1 menit", () => {
      for (let i = 0; i < 5; i++) {
        const check = checkLoginRateLimit(testIp);
        expect(check.allowed).toBe(true);
        recordLoginAttempt(testIp);
      }
    });

    it("memblokir percobaan ke-6 dengan status allowed = false dan retryAfterSeconds", () => {
      for (let i = 0; i < 5; i++) {
        recordLoginAttempt(testIp);
      }
      const check = checkLoginRateLimit(testIp);
      expect(check.allowed).toBe(false);
      expect(check.remaining).toBe(0);
      expect(check.retryAfterSeconds).toBeGreaterThan(0);
    });
  });

  describe("Semua Route Tulis Menolak Permintaan Tanpa Sesi (401/403)", () => {
    it("POST /api/mentions menolak tanpa cookie", async () => {
      const req = new NextRequest(`${baseUrl}/api/mentions`, {
        method: "POST",
        headers: { host, "content-type": "application/json" },
        body: JSON.stringify({ linkAsli: "https://threads.net/@user/post/1" }),
      });
      const res = await mentionsPost(req);
      expect([401, 403]).toContain(res.status);
    });

    it("PATCH /api/mentions/[id] menolak tanpa cookie", async () => {
      const req = new NextRequest(`${baseUrl}/api/mentions/123`, {
        method: "PATCH",
        headers: { host, "content-type": "application/json" },
        body: JSON.stringify({ status: "SELESAI" }),
      });
      const res = await mentionIdPatch(req, {
        params: Promise.resolve({ id: "123" }),
      });
      expect([401, 403]).toContain(res.status);
    });

    it("DELETE /api/mentions/[id] menolak tanpa cookie", async () => {
      const req = new NextRequest(`${baseUrl}/api/mentions/123`, {
        method: "DELETE",
        headers: { host },
      });
      const res = await mentionIdDelete(req, {
        params: Promise.resolve({ id: "123" }),
      });
      expect([401, 403]).toContain(res.status);
    });

    it("POST /api/drafts menolak tanpa cookie", async () => {
      const req = new NextRequest(`${baseUrl}/api/drafts`, {
        method: "POST",
        headers: { host, "content-type": "application/json" },
        body: JSON.stringify({ id: "123", action: "approve" }),
      });
      const res = await draftsPost(req);
      expect([401, 403]).toContain(res.status);
    });

    it("PATCH /api/alerts menolak tanpa cookie", async () => {
      const req = new NextRequest(`${baseUrl}/api/alerts`, {
        method: "PATCH",
        headers: { host, "content-type": "application/json" },
        body: JSON.stringify({ id: "123" }),
      });
      const res = await alertsPatch(req);
      expect([401, 403]).toContain(res.status);
    });

    it("POST /api/topics menolak tanpa cookie", async () => {
      const req = new NextRequest(`${baseUrl}/api/topics`, {
        method: "POST",
        headers: { host, "content-type": "application/json" },
        body: JSON.stringify({ nama: "Tabungan BTN" }),
      });
      const res = await topicsPost(req);
      expect([401, 403]).toContain(res.status);
    });

    it("DELETE /api/topics menolak tanpa cookie", async () => {
      const req = new NextRequest(`${baseUrl}/api/topics?id=123`, {
        method: "DELETE",
        headers: { host },
      });
      const res = await topicsDelete(req);
      expect([401, 403]).toContain(res.status);
    });

    it("POST /api/sample-data menolak tanpa cookie", async () => {
      const req = new NextRequest(`${baseUrl}/api/sample-data`, {
        method: "POST",
        headers: { host, "content-type": "application/json" },
        body: JSON.stringify({ action: "clear" }),
      });
      const res = await sampleDataPost(req);
      expect([401, 403]).toContain(res.status);
    });

    it("POST /api/preview menolak tanpa cookie", async () => {
      const req = new NextRequest(`${baseUrl}/api/preview`, {
        method: "POST",
        headers: { host, "content-type": "application/json" },
        body: JSON.stringify({ url: "https://www.threads.net/@user/post/123" }),
      });
      const res = await previewPost(req);
      expect([401, 403]).toContain(res.status);
    });
  });

  describe("Semua Route Tulis Menolak Cookie Statis Lama 'authenticated'", () => {
    const makeLegacyCookieHeader = () => ({
      host,
      cookie: "petugas_session=authenticated",
      "content-type": "application/json",
    });

    it("POST /api/mentions menolak cookie lama", async () => {
      const req = new NextRequest(`${baseUrl}/api/mentions`, {
        method: "POST",
        headers: makeLegacyCookieHeader(),
        body: JSON.stringify({ linkAsli: "https://threads.net/@user/post/1" }),
      });
      const res = await mentionsPost(req);
      expect([401, 403]).toContain(res.status);
    });

    it("PATCH /api/mentions/[id] menolak cookie lama", async () => {
      const req = new NextRequest(`${baseUrl}/api/mentions/123`, {
        method: "PATCH",
        headers: makeLegacyCookieHeader(),
        body: JSON.stringify({ status: "SELESAI" }),
      });
      const res = await mentionIdPatch(req, {
        params: Promise.resolve({ id: "123" }),
      });
      expect([401, 403]).toContain(res.status);
    });

    it("DELETE /api/mentions/[id] menolak cookie lama", async () => {
      const req = new NextRequest(`${baseUrl}/api/mentions/123`, {
        method: "DELETE",
        headers: makeLegacyCookieHeader(),
      });
      const res = await mentionIdDelete(req, {
        params: Promise.resolve({ id: "123" }),
      });
      expect([401, 403]).toContain(res.status);
    });

    it("POST /api/drafts menolak cookie lama", async () => {
      const req = new NextRequest(`${baseUrl}/api/drafts`, {
        method: "POST",
        headers: makeLegacyCookieHeader(),
        body: JSON.stringify({ id: "123", action: "approve" }),
      });
      const res = await draftsPost(req);
      expect([401, 403]).toContain(res.status);
    });

    it("PATCH /api/alerts menolak cookie lama", async () => {
      const req = new NextRequest(`${baseUrl}/api/alerts`, {
        method: "PATCH",
        headers: makeLegacyCookieHeader(),
        body: JSON.stringify({ id: "123" }),
      });
      const res = await alertsPatch(req);
      expect([401, 403]).toContain(res.status);
    });

    it("POST /api/topics menolak cookie lama", async () => {
      const req = new NextRequest(`${baseUrl}/api/topics`, {
        method: "POST",
        headers: makeLegacyCookieHeader(),
        body: JSON.stringify({ nama: "Tabungan BTN" }),
      });
      const res = await topicsPost(req);
      expect([401, 403]).toContain(res.status);
    });

    it("DELETE /api/topics menolak cookie lama", async () => {
      const req = new NextRequest(`${baseUrl}/api/topics?id=123`, {
        method: "DELETE",
        headers: makeLegacyCookieHeader(),
      });
      const res = await topicsDelete(req);
      expect([401, 403]).toContain(res.status);
    });

    it("POST /api/sample-data menolak cookie lama", async () => {
      const req = new NextRequest(`${baseUrl}/api/sample-data`, {
        method: "POST",
        headers: makeLegacyCookieHeader(),
        body: JSON.stringify({ action: "clear" }),
      });
      const res = await sampleDataPost(req);
      expect([401, 403]).toContain(res.status);
    });

    it("POST /api/preview menolak cookie lama", async () => {
      const req = new NextRequest(`${baseUrl}/api/preview`, {
        method: "POST",
        headers: makeLegacyCookieHeader(),
        body: JSON.stringify({ url: "https://www.threads.net/@user/post/123" }),
      });
      const res = await previewPost(req);
      expect([401, 403]).toContain(res.status);
    });
  });

  describe("Sesi Sah dengan Token HMAC Terverifikasi", () => {
    it("meloloskan guard requireOfficer jika token HMAC valid", async () => {
      const validToken = createSignedSessionToken();
      const req = new NextRequest(`${baseUrl}/api/mentions`, {
        method: "POST",
        headers: {
          host,
          origin: baseUrl,
          cookie: `petugas_session=${validToken}`,
        },
      });

      const errorResponse = await requireOfficer(req);
      expect(errorResponse).toBeNull(); // null menandakan guard meloloskan request
    });
  });
});
