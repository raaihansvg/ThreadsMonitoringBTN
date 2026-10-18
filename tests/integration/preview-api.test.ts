import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as previewPost } from "@/app/api/preview/route";
import { createSignedSessionToken } from "@/lib/auth/session";
import { resetPreviewLimits } from "@/lib/ingest/previewLimiter";

describe("Integration Test: POST /api/preview (Tahap 3A)", () => {
  const host = "localhost:3000";
  const baseUrl = `http://${host}`;
  const validUrl = "https://www.threads.com/@user/post/DF_123456";
  const validShareUrl = "https://www.threads.net/share/BC_789";

  let validCookie: string;

  beforeEach(() => {
    validCookie = `petugas_session=${createSignedSessionToken()}`;
    resetPreviewLimits();
    delete process.env.PREVIEW_ENABLED;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Autentikasi & Proteksi CSRF", () => {
    it("menolak permintaan tanpa cookie sesi (401)", async () => {
      const req = new NextRequest(`${baseUrl}/api/preview`, {
        method: "POST",
        headers: { host, "content-type": "application/json" },
        body: JSON.stringify({ url: validUrl }),
      });
      const res = await previewPost(req);
      expect([401, 403]).toContain(res.status);
    });

    it("menolak permintaan dengan token Bearer (allowBearer: false pada route preview)", async () => {
      const req = new NextRequest(`${baseUrl}/api/preview`, {
        method: "POST",
        headers: {
          host,
          "content-type": "application/json",
          authorization: "Bearer valid_or_invalid_token",
        },
        body: JSON.stringify({ url: validUrl }),
      });
      const res = await previewPost(req);
      expect([401, 403]).toContain(res.status);
    });

    it("menolak permintaan bila Origin tidak cocok (CSRF attack)", async () => {
      const req = new NextRequest(`${baseUrl}/api/preview`, {
        method: "POST",
        headers: {
          host,
          origin: "https://evil-site.com",
          cookie: validCookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({ url: validUrl }),
      });
      const res = await previewPost(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toMatch(/CSRF/i);
    });
  });

  describe("Validasi Parameter Input", () => {
    it("menolak jika body tidak menyertakan url (400)", async () => {
      const req = new NextRequest(`${baseUrl}/api/preview`, {
        method: "POST",
        headers: {
          host,
          origin: baseUrl,
          cookie: validCookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const res = await previewPost(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/URL Threads wajib diisi/i);
    });

    it("menolak URL selain Threads (400)", async () => {
      const req = new NextRequest(`${baseUrl}/api/preview`, {
        method: "POST",
        headers: {
          host,
          origin: baseUrl,
          cookie: validCookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({ url: "https://twitter.com/btn/status/123" }),
      });
      const res = await previewPost(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/threads/i);
    });
  });

  describe("Kill Switch: PREVIEW_ENABLED", () => {
    it("mengembalikan pesan fallback langsung tanpa menghubungi Threads bila PREVIEW_ENABLED=false", async () => {
      process.env.PREVIEW_ENABLED = "false";
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      const req = new NextRequest(`${baseUrl}/api/preview`, {
        method: "POST",
        headers: {
          host,
          origin: baseUrl,
          cookie: validCookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({ url: validUrl }),
      });

      const res = await previewPost(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.disabled).toBe(true);
      expect(json.error).toBe(
        "Teks tidak dapat diambil otomatis. Tempel teks postingan."
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("Ekstraksi Pratinjau dengan Mock Fetch", () => {
    it("berhasil mengekstrak og:description dan mengembalikan URL kanonik", async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta property="og:title" content="Akun BTN di Threads: Komentar">
          <meta property="og:description" content="Aplikasi mobile banking BTN lancar &amp; responsif pagi ini.">
        </head>
        <body>Halaman Konten</body>
        </html>
      `;

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(mockHtml, {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        })
      );

      const req = new NextRequest(`${baseUrl}/api/preview`, {
        method: "POST",
        headers: {
          host,
          origin: baseUrl,
          cookie: validCookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({ url: validShareUrl }),
      });

      const res = await previewPost(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.text).toBe(
        "Aplikasi mobile banking BTN lancar & responsif pagi ini."
      );
      // og:title atau nama akun TIDAK boleh disertakan
      expect(json.title).toBeUndefined();
      expect(json.account).toBeUndefined();
    });

    it("mengembalikan fallback bila Threads merespons halaman login wall", async () => {
      const mockLoginHtml = `
        <html>
        <head>
          <meta property="og:description" content="Log in to see photos and videos from friends and discover other accounts.">
        </head>
        <body>Log in with your Instagram account</body>
        </html>
      `;

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(mockLoginHtml, {
          status: 200,
          headers: { "content-type": "text/html" },
        })
      );

      const req = new NextRequest(`${baseUrl}/api/preview`, {
        method: "POST",
        headers: {
          host,
          origin: baseUrl,
          cookie: validCookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({ url: validUrl }),
      });

      const res = await previewPost(req);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.error).toBe(
        "Teks tidak dapat diambil otomatis. Tempel teks postingan."
      );
    });

    it("mengaktifkan circuit breaker 15 menit jika Threads mengembalikan status 403 atau 429", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Forbidden", { status: 403 })
      );

      const req1 = new NextRequest(`${baseUrl}/api/preview`, {
        method: "POST",
        headers: {
          host,
          origin: baseUrl,
          cookie: validCookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({ url: validUrl }),
      });

      const res1 = await previewPost(req1);
      expect(res1.status).toBe(429);
      const json1 = await res1.json();
      expect(json1.circuitBreaker).toBe(true);
      expect(json1.error).toMatch(/dijeda 15 menit/i);

      // Panggilan berikutnya langsung diblokir oleh circuit breaker tanpa menghubungi Threads
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const req2 = new NextRequest(`${baseUrl}/api/preview`, {
        method: "POST",
        headers: {
          host,
          origin: baseUrl,
          cookie: validCookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({ url: validUrl }),
      });

      const res2 = await previewPost(req2);
      expect(res2.status).toBe(429);
      const json2 = await res2.json();
      expect(json2.circuitBreaker).toBe(true);
      expect(json2.remainingSeconds).toBeGreaterThan(0);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});
