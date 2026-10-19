import { describe, it, expect } from "vitest";
import {
  parsePasteLine,
  parseBulkPaste,
  MAX_IMPORT_ITEMS,
} from "@/lib/ingest/parseImport";
import { importBatchSchema } from "@/lib/validation/schemas";

describe("Penguraian Tempel Banyak (Bulk Paste) & Batas Seragam 50 Item (FR-10, Tahap 3B)", () => {
  describe("parsePasteLine", () => {
    it("memecah HANYA pada tanda '|' pertama dan mempertahankan '|' berikutnya sebagai isi teks", () => {
      const line =
        "https://www.threads.net/@btn/post/1 | Promo KPR BTN | Bunga 3.5% | Bebas Biaya Admin";
      const result = parsePasteLine(line);

      expect(result.url).toBe("https://www.threads.net/@btn/post/1");
      expect(result.text).toBe(
        "Promo KPR BTN | Bunga 3.5% | Bebas Biaya Admin"
      );
    });

    it("menangani baris tanpa tanda '|' dengan text undefined", () => {
      const line = "https://www.threads.net/@btn/post/999";
      const result = parsePasteLine(line);

      expect(result.url).toBe("https://www.threads.net/@btn/post/999");
      expect(result.text).toBeUndefined();
    });

    it("memangkas spasi di sekitar url dan text", () => {
      const line =
        "   https://www.threads.com/share/ABC123   |   Layanan perbankan cepat dan ramah   ";
      const result = parsePasteLine(line);

      expect(result.url).toBe("https://www.threads.com/share/ABC123");
      expect(result.text).toBe("Layanan perbankan cepat dan ramah");
    });
  });

  describe("parseBulkPaste", () => {
    it("mengurai multi-line dan mengabaikan baris kosong", () => {
      const input = `
        https://threads.net/post/1 | Teks pertama
        
        https://threads.net/post/2 | Teks kedua dengan | pipe tambahan
        https://threads.net/post/3
      `;
      const result = parseBulkPaste(input, 50);

      expect(result.totalLines).toBe(3);
      expect(result.items).toHaveLength(3);
      expect(result.isTruncated).toBe(false);
      expect(result.items[1].text).toBe("Teks kedua dengan | pipe tambahan");
      expect(result.items[2].text).toBeUndefined();
    });

    it("membatasi masukan maksimal 50 item dan menandai isTruncated jika lebih dari 50 baris", () => {
      // 55 baris masukan
      const lines = Array.from(
        { length: 55 },
        (_, i) => `https://threads.net/post/${i + 1} | Post nomor ${i + 1}`
      );
      const rawContent = lines.join("\n");

      const result = parseBulkPaste(rawContent, MAX_IMPORT_ITEMS);

      expect(MAX_IMPORT_ITEMS).toBe(50);
      expect(result.totalLines).toBe(55);
      expect(result.items).toHaveLength(50);
      expect(result.isTruncated).toBe(true);
      expect(result.items[0].url).toBe("https://threads.net/post/1");
      expect(result.items[49].url).toBe("https://threads.net/post/50");
    });
  });

  describe("Validasi importBatchSchema", () => {
    it("menerima batch impor tepat 50 item", () => {
      const batch50 = Array.from({ length: 50 }, (_, i) => ({
        url: `https://threads.net/post/${i + 1}`,
        text: `Post ${i + 1}`,
      }));

      const parsed = importBatchSchema.safeParse(batch50);
      expect(parsed.success).toBe(true);
    });

    it("menolak batch impor 51 item dengan pesan batas 50 item", () => {
      const batch51 = Array.from({ length: 51 }, (_, i) => ({
        url: `https://threads.net/post/${i + 1}`,
        text: `Post ${i + 1}`,
      }));

      const parsed = importBatchSchema.safeParse(batch51);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0].message).toContain("maksimal 50 item");
      }
    });
  });
});
