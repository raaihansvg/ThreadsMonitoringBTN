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
      expect(json.errorCode).toBe("DISABLED");
      expect(json.canUseManualText).toBe(true);
      expect(json.message).toMatch(/dinonaktifkan/i);
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

    it("mengembalikan fallback LOGIN_WALL bila Threads merespons halaman login wall", async () => {
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
      expect(json.errorCode).toBe("LOGIN_WALL");
      expect(json.canUseManualText).toBe(true);
      expect(json.message).toMatch(/login Threads/i);
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
      expect(json1.errorCode).toBe("CIRCUIT_BREAKER");
      expect(json1.canUseManualText).toBe(true);
      expect(json1.retryAfterSeconds).toBe(900);
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
      expect(json2.errorCode).toBe("CIRCUIT_BREAKER");
      expect(json2.canUseManualText).toBe(true);
      expect(json2.remainingSeconds).toBeGreaterThan(0);
      expect(json2.retryAfterSeconds).toBe(json2.remainingSeconds);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("mengembalikan NOT_FOUND bila Threads merespons HTTP 404", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Not Found", { status: 404 })
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
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.errorCode).toBe("NOT_FOUND");
      expect(json.canUseManualText).toBe(true);
      expect(json.message).toMatch(/HTTP 404/i);
    });

    it("mengembalikan TIMEOUT bila fetchThreadsPreview mengalami timeout (AbortError)", async () => {
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(abortError);

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
      expect(json.errorCode).toBe("TIMEOUT");
      expect(json.canUseManualText).toBe(true);
      expect(json.message).toMatch(/batas waktu/i);
    });

    it("mengembalikan REDIRECT_REJECTED bila target redirect mengarah ke luar Threads (SSRF)", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "https://evil-attacker.com/steal-data" },
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
      expect(json.ok).toBe(false);
      expect(json.errorCode).toBe("REDIRECT_REJECTED");
      expect(json.canUseManualText).toBe(true);
      expect(json.message).toMatch(/domain luar ditolak demi keamanan/i);
    });

    it("mengembalikan REDIRECT_LOOP bila redirect berputar lebih dari 3 kali", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(null, {
          status: 302,
          headers: { location: "https://www.threads.net/@user/post/hop" },
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
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.errorCode).toBe("REDIRECT_LOOP");
      expect(json.canUseManualText).toBe(true);
      expect(json.message).toMatch(/redirect loop/i);
    });

    it("mengembalikan REDIRECT_LOOP bila status 302 tanpa header Location", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(null, { status: 302 })
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
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.errorCode).toBe("REDIRECT_LOOP");
      expect(json.canUseManualText).toBe(true);
    });

    it("mengembalikan EMPTY_PREVIEW bila halaman Threads tidak memiliki og:description", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("<html><head></head><body>No desc</body></html>", {
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
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.errorCode).toBe("EMPTY_PREVIEW");
      expect(json.canUseManualText).toBe(true);
      expect(json.message).toMatch(/tidak ditemukan/i);
    });

    it("mengembalikan NETWORK_ERROR bila koneksi jaringan ke Threads putus", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
        new Error("getaddrinfo ENOTFOUND threads.net")
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
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.errorCode).toBe("NETWORK_ERROR");
      expect(json.canUseManualText).toBe(true);
      expect(json.message).toMatch(/kendala jaringan/i);
    });

    it("mencatat logging console.warn dengan format metadata aman pada kegagalan", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Not Found", { status: 404 })
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

      await previewPost(req);

      expect(warnSpy).toHaveBeenCalled();
      const lastWarnCall = warnSpy.mock.calls[0]?.[0] || "";
      expect(lastWarnCall).toContain("[PREVIEW_FAILURE]");
      expect(lastWarnCall).toContain("errorCode=NOT_FOUND");
      expect(lastWarnCall).toContain("status=404");
      expect(lastWarnCall).toContain("host=www.threads.com");
      expect(lastWarnCall).toContain("circuitBreakerTriggered=false");
      // Memastikan tidak mencatat cookie, authorization, atau URL path lengkap
      expect(lastWarnCall).not.toContain("petugas_session");
      expect(lastWarnCall).not.toContain("/post/");
    });
  });
});
