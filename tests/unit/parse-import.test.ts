import { describe, it, expect, vi } from "vitest";
import { processImportQueue, SendImportItemFn } from "@/lib/ingest/parseImport";

describe("processImportQueue (FR-10, Tahap 3G Keamanan)", () => {
  it("memproses antrean normal dengan keberhasilan, duplikat, dan URL tidak valid tanpa 429", async () => {
    const items = [
      { url: "https://www.threads.net/@user/post/1", text: "Post satu" },
      { url: "https://threads.com/@user/post/2", text: "Post dua" },
      { url: "https://google.com/bukan-threads", text: "Link luar" },
      { url: "https://threads.net/@user/post/3", text: "Post tiga" },
    ];

    const mockSendItem: SendImportItemFn = vi.fn(async (payload) => {
      if (payload.linkAsli.includes("post/2")) {
        return {
          ok: false,
          status: 409,
          json: async () => ({ error: "Tautan sudah ada" }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: "m1", status: "DRAF" }),
      };
    });

    const progressCalls: Array<{ current: number; total: number }> = [];
    const summary = await processImportQueue(items, mockSendItem, {
      onProgress: (c, t) => progressCalls.push({ current: c, total: t }),
    });

    expect(summary.berhasil).toBe(2);
    expect(summary.duplikat).toBe(1);
    expect(summary.gagal).toBe(1); // URL bukan threads
    expect(summary.belumDiproses).toBe(0);
    expect(summary.rateLimited).toBe(false);
    expect(summary.problems).toHaveLength(2); // 1 duplikat + 1 invalid url
    expect(mockSendItem).toHaveBeenCalledTimes(3); // Link non-threads tidak dikirim
    expect(progressCalls).toEqual([
      { current: 1, total: 4 },
      { current: 2, total: 4 },
      { current: 3, total: 4 },
      { current: 4, total: 4 },
    ]);
  });

  it("seketika menghentikan loop saat menerima HTTP 429 di tengah jalan dan menghitung belumDiproses dengan tepat", async () => {
    // 5 item total
    const items = [
      { url: "https://threads.net/@user/post/101", text: "Item 1" },
      { url: "https://threads.net/@user/post/102", text: "Item 2" },
      { url: "https://threads.net/@user/post/103", text: "Item 3" },
      { url: "https://threads.net/@user/post/104", text: "Item 4" },
      { url: "https://threads.net/@user/post/105", text: "Item 5" },
    ];

    let callCount = 0;
    const mockSendItem: SendImportItemFn = vi.fn(async (payload) => {
      callCount++;
      if (payload.linkAsli.includes("post/101")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: "m101" }),
        };
      }
      if (payload.linkAsli.includes("post/102")) {
        // Item ke-2 terkena 429
        return {
          ok: false,
          status: 429,
          headers: {
            get: (name: string) =>
              name.toLowerCase() === "retry-after" ? "45" : null,
          },
          json: async () => ({
            error: "Terlalu banyak permintaan impor. Coba lagi nanti.",
            retryAfter: 45,
          }),
        };
      }
      // Item 3, 4, 5 TIDAK BOLEH dipanggil
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: "other" }),
      };
    });

    const summary = await processImportQueue(items, mockSendItem);

    // Buktikan pengiriman berhenti seketika
    expect(callCount).toBe(2);
    expect(mockSendItem).toHaveBeenCalledTimes(2);

    // Buktikan perhitungan status
    expect(summary.berhasil).toBe(1); // Item 1 berhasil
    expect(summary.duplikat).toBe(0);
    expect(summary.gagal).toBe(0); // 429 BUKAN gagal biasa
    expect(summary.belumDiproses).toBe(4); // Item 2 (yang terkena 429) + Item 3, 4, 5
    expect(
      summary.berhasil +
        summary.duplikat +
        summary.gagal +
        summary.belumDiproses
    ).toBe(5);

    // Buktikan flag rate limited dan retry after
    expect(summary.rateLimited).toBe(true);
    expect(summary.retryAfterSeconds).toBe(45);
    expect(summary.rateLimitMessage).toContain(
      "Terlalu banyak permintaan impor"
    );

    // Buktikan problems mencatat informasi ramah pengguna
    expect(summary.problems).toHaveLength(1);
    expect(summary.problems[0].line).toBe(2);
    expect(summary.problems[0].url).toBe("https://threads.net/@user/post/102");
    expect(summary.problems[0].reason).toContain("45 detik");
  });

  it("menangani HTTP 429 pada item pertama dari 10 item dan menetapkan default 60 detik bila header absen", async () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      url: `https://threads.net/@user/post/${i + 1}`,
      text: `Post ${i + 1}`,
    }));

    const mockSendItem: SendImportItemFn = vi.fn(async () => {
      return {
        ok: false,
        status: 429,
        headers: {
          get: () => null,
        },
        json: async () => ({
          error: "Batas laju tercapai",
        }),
      };
    });

    const summary = await processImportQueue(items, mockSendItem);

    expect(mockSendItem).toHaveBeenCalledTimes(1);
    expect(summary.rateLimited).toBe(true);
    expect(summary.retryAfterSeconds).toBe(60);
    expect(summary.berhasil).toBe(0);
    expect(summary.duplikat).toBe(0);
    expect(summary.gagal).toBe(0);
    expect(summary.belumDiproses).toBe(10);
    expect(summary.problems[0].line).toBe(1);
  });

  it("mencatat kegagalan jaringan tanpa menghentikan loop untuk item lainnya", async () => {
    const items = [
      { url: "https://threads.net/@user/post/1" },
      { url: "https://threads.net/@user/post/2" },
    ];

    let call = 0;
    const mockSendItem: SendImportItemFn = vi.fn(async () => {
      call++;
      if (call === 1) {
        throw new Error("Network timeout");
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: "m2" }),
      };
    });

    const summary = await processImportQueue(items, mockSendItem);

    expect(summary.gagal).toBe(1);
    expect(summary.berhasil).toBe(1);
    expect(summary.belumDiproses).toBe(0);
    expect(summary.rateLimited).toBe(false);
    expect(summary.problems[0].reason).toContain("Kendala jaringan");
  });
});
