import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchThreadsPreview,
  decodeHtmlEntities,
} from "@/lib/ingest/threadsPreview";
import {
  isPreviewEnabled,
  isCircuitBreakerActive,
  triggerCircuitBreaker,
  resetCircuitBreaker,
  checkPreviewRateLimit,
  recordPreviewAttempt,
  resetPreviewRateLimits,
  PREVIEW_FALLBACK_TEXT,
} from "@/lib/ingest/previewLimiter";

describe("FR-02: threadsPreview Unit Tests (Tahap 3A)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    resetCircuitBreaker();
    resetPreviewRateLimits();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("decodeHtmlEntities", () => {
    it("mendekode entitas heksadesimal, desimal, dan entitas bernama dengan benar", () => {
      const raw =
        "Jakarta, SonaIndonesia.com &#x2013; PT Bank Tabungan Negara &amp; Kawan&#xb2; &#064;btn &quot;Mobile&quot; &#x1f606;";
      const decoded = decodeHtmlEntities(raw);

      expect(decoded).toContain("–"); // &#x2013;
      expect(decoded).toContain("&"); // &amp;
      expect(decoded).toContain("²"); // &#xb2;
      expect(decoded).toContain("@btn"); // &#064;
      expect(decoded).toContain('"Mobile"'); // &quot;
      expect(decoded).toContain("😆"); // &#x1f606;
    });

    it("mengembalikan string kosong jika input kosong", () => {
      expect(decodeHtmlEntities("")).toBe("");
    });
  });

  describe("fetchThreadsPreview dengan Mock Fetch", () => {
    it("berhasil mengekstrak og:description dan mendekode entitas HTML", async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Threads</title>
            <meta property="og:title" content="Abaikan Title Ini" />
            <meta property="og:description" content="Pelayanan teller Kantor Cabang BTN sangat ramah &amp; cepat. Terima kasih &#064;bankbtn! &#x1f44d;" />
          </head>
          <body><div>Content</div></body>
        </html>
      `;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(mockHtml),
        headers: new Headers(),
      } as any);

      const res = await fetchThreadsPreview(
        "https://www.threads.com/@nasabah/post/12345"
      );

      expect(res.ok).toBe(true);
      expect(res.text).toBe(
        "Pelayanan teller Kantor Cabang BTN sangat ramah & cepat. Terima kasih @bankbtn! 👍"
      );
      expect(res.canonicalUrl).toBe("https://threads.net/@nasabah/post/12345");
      expect(res.isTruncated).toBe(false);
      // Memastikan tidak menyimpan og:title
      expect(res.text).not.toContain("Abaikan Title Ini");
    });

    it("menandai isTruncated jika teks berakhiran elipsis atau panjang >= 480 karakter", async () => {
      const longText = "A".repeat(485);
      const mockHtml = `<meta property="og:description" content="${longText}..." />`;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(mockHtml),
        headers: new Headers(),
      } as any);

      const res = await fetchThreadsPreview(
        "https://www.threads.net/@user/post/999"
      );
      expect(res.ok).toBe(true);
      expect(res.isTruncated).toBe(true);
    });

    it("menolak redirect ke host selain Threads (SSRF Protection)", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 302,
        headers: new Headers({
          location: "https://evil-attacker.com/steal-data",
        }),
      } as any);

      const res = await fetchThreadsPreview("https://threads.net/share/XYZ");
      expect(res.ok).toBe(false);
      expect(res.error).toContain("Target redirect ditolak");
    });

    it("menolak teks yang menyerupai halaman login wall Threads", async () => {
      const loginHtml = `
        <meta property="og:description" content="Join Threads to share ideas, ask questions, post random thoughts, find your people and more. Log in with your Instagram." />
      `;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(loginHtml),
        headers: new Headers(),
      } as any);

      const res = await fetchThreadsPreview(
        "https://www.threads.net/@user/post/111"
      );
      expect(res.ok).toBe(false);
      expect(res.text).toBe("");
      expect(res.error).toContain("halaman login Threads");
    });

    it("mengembalikan status 403 atau 429 tanpa crash", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        headers: new Headers(),
        text: () => Promise.resolve("Too Many Requests"),
      } as any);

      const res = await fetchThreadsPreview(
        "https://www.threads.net/@user/post/222"
      );
      expect(res.ok).toBe(false);
      expect(res.statusCode).toBe(429);
      expect(res.error).toContain("429");
    });

    it("membatasi pembacaan HTML maksimal 1 MB", async () => {
      // 1.5 MB string
      const hugeHtml =
        `<meta property="og:description" content="Teks valid" />` +
        "B".repeat(1.5 * 1024 * 1024);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(hugeHtml),
        headers: new Headers(),
      } as any);

      const res = await fetchThreadsPreview(
        "https://www.threads.net/@user/post/333"
      );
      expect(res.ok).toBe(true);
      expect(res.text).toBe("Teks valid");
    });

    it("mengembalikan NOT_FOUND saat menerima status HTTP 404 dari Threads", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        headers: new Headers(),
        text: () => Promise.resolve("Not Found"),
      } as any);

      const res = await fetchThreadsPreview(
        "https://www.threads.net/@user/post/404404"
      );
      expect(res.ok).toBe(false);
      expect(res.statusCode).toBe(404);
      expect(res.errorCode).toBe("NOT_FOUND");
      expect(res.error).toContain("404");
    });

    it("mengembalikan TIMEOUT saat fetch melebihi batas waktu (AbortError)", async () => {
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";
      global.fetch = vi.fn().mockRejectedValue(abortError);

      const res = await fetchThreadsPreview(
        "https://www.threads.net/@user/post/timeout-post"
      );
      expect(res.ok).toBe(false);
      expect(res.errorCode).toBe("TIMEOUT");
      expect(res.error).toContain("Timeout");
    });

    it("mengembalikan REDIRECT_LOOP saat redirect lebih dari 3 hop", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 302,
        headers: new Headers({
          location: "https://www.threads.net/@user/post/hop",
        }),
      } as any);

      const res = await fetchThreadsPreview(
        "https://www.threads.net/@user/post/infinite-loop"
      );
      expect(res.ok).toBe(false);
      expect(res.errorCode).toBe("REDIRECT_LOOP");
      expect(res.error).toContain("Melebihi batas maksimal redirect");
    });

    it("mengembalikan REDIRECT_LOOP saat menerima status redirect tanpa header Location", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 301,
        headers: new Headers(),
      } as any);

      const res = await fetchThreadsPreview(
        "https://www.threads.net/@user/post/no-location"
      );
      expect(res.ok).toBe(false);
      expect(res.errorCode).toBe("REDIRECT_LOOP");
      expect(res.error).toContain("tanpa header Location");
    });

    it("mengembalikan EMPTY_PREVIEW saat tag og:description tidak ditemukan pada HTML", async () => {
      const emptyMetaHtml = `<html><head><title>Threads</title></head><body>No meta</body></html>`;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(emptyMetaHtml),
        headers: new Headers(),
      } as any);

      const res = await fetchThreadsPreview(
        "https://www.threads.net/@user/post/no-meta"
      );
      expect(res.ok).toBe(false);
      expect(res.errorCode).toBe("EMPTY_PREVIEW");
      expect(res.error).toContain("og:description tidak ditemukan");
    });

    it("mengembalikan EMPTY_PREVIEW saat isi tag og:description hanya berupa spasi", async () => {
      const blankOgHtml = `<meta property="og:description" content="   " />`;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(blankOgHtml),
        headers: new Headers(),
      } as any);

      const res = await fetchThreadsPreview(
        "https://www.threads.net/@user/post/blank-meta"
      );
      expect(res.ok).toBe(false);
      expect(res.errorCode).toBe("EMPTY_PREVIEW");
      expect(res.error).toContain("og:description kosong");
    });

    it("mengembalikan NETWORK_ERROR saat terjadi kendala jaringan/koneksi", async () => {
      global.fetch = vi
        .fn()
        .mockRejectedValue(new Error("fetch failed: ECONNREFUSED"));

      const res = await fetchThreadsPreview(
        "https://www.threads.net/@user/post/net-err"
      );
      expect(res.ok).toBe(false);
      expect(res.errorCode).toBe("NETWORK_ERROR");
      expect(res.error).toContain("ECONNREFUSED");
    });
  });

  describe("Circuit Breaker & Rate Limiter (previewLimiter)", () => {
    it("memicu circuit breaker selama 15 menit jika menerima status 403 atau 429", async () => {
      expect((await isCircuitBreakerActive()).active).toBe(false);

      await triggerCircuitBreaker(429);

      const activeStatus = await isCircuitBreakerActive();
      expect(activeStatus.active).toBe(true);
      expect(activeStatus.remainingSeconds).toBeGreaterThan(0);
      expect(activeStatus.reason).toContain("429");

      await resetCircuitBreaker();
      expect((await isCircuitBreakerActive()).active).toBe(false);
    });

    it("membatasi frekuensi maksimal 10 permintaan per menit per sesi", async () => {
      const sessionId = "session-officer-1";

      for (let i = 0; i < 10; i++) {
        const check = await checkPreviewRateLimit(sessionId);
        expect(check.allowed).toBe(true);
        await recordPreviewAttempt(sessionId);
      }

      // Percobaan ke-11 harus ditolak
      const eleventh = await checkPreviewRateLimit(sessionId);
      expect(eleventh.allowed).toBe(false);
      expect(eleventh.error).toContain("10/menit");
    });

    it("membatasi frekuensi maksimal 60 permintaan per jam global", async () => {
      // Rekam 60 request dari berbagai sesi
      for (let i = 0; i < 60; i++) {
        await recordPreviewAttempt(`session-${i}`);
      }

      // Permintaan global ke-61 harus ditolak
      const check = await checkPreviewRateLimit("new-session");
      expect(check.allowed).toBe(false);
      expect(check.error).toContain("60/jam");
    });

    it("menghormati flag PREVIEW_ENABLED", () => {
      process.env.PREVIEW_ENABLED = "false";
      expect(isPreviewEnabled()).toBe(false);

      process.env.PREVIEW_ENABLED = "true";
      expect(isPreviewEnabled()).toBe(true);

      delete process.env.PREVIEW_ENABLED;
    });
  });
});
