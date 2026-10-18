import { describe, it, expect } from "vitest";
import {
  StubInputSource,
  getPreviewFallback,
  PREVIEW_FALLBACK_MESSAGE,
} from "@/lib/ingest/stub";

describe("FR-02: Kebijakan Pratinjau Tautan Nyata (Tahap 1.8)", () => {
  const stubSource = new StubInputSource();

  it("JANGAN PERNAH menyimulasikan teks otomatis untuk tautan Threads nyata", async () => {
    const realUrls = [
      "https://www.threads.net/@bankbtn/post/DA123456789",
      "https://threads.net/@nasabah/post/DB987654321",
      "https://www.threads.com/@user/post/DC112233445",
    ];

    for (const url of realUrls) {
      const result = await stubSource.fetch({ url });

      // Verifikasi: teks harus kosong (tidak ada teks palsu/simulasi)
      expect(result.text).toBe("");
      expect(result.ok).toBe(false);

      // Verifikasi: pesan fallback wajib memuat instruksi tempel teks manual
      expect(result.error).toBe(
        "Teks tidak dapat diambil otomatis. Tempel teks postingan."
      );
    }
  });

  it("getPreviewFallback mengembalikan status gagal, teks kosong, dan pesan instruksi baku", () => {
    const fallback = getPreviewFallback("https://www.threads.net/@test/post/1");

    expect(fallback.success).toBe(false);
    expect(fallback.text).toBe("");
    expect(fallback.message).toBe(PREVIEW_FALLBACK_MESSAGE);
    expect(fallback.message).toBe(
      "Teks tidak dapat diambil otomatis. Tempel teks postingan."
    );
  });
});
