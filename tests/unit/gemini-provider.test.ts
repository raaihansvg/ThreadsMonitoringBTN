import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GeminiAnalysisProvider } from "@/lib/analysis/gemini";
import { TopicDefinition } from "@/lib/analysis/topicSelector";

describe("GeminiAnalysisProvider Unit Tests (Tahap 2C)", () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  const testTopics: TopicDefinition[] = [
    { nama: "BTN Mobile", kataKunci: ["btn mobile", "mobile banking"] },
    { nama: "KPR BTN", kataKunci: ["kpr", "kredit rumah", "subsidi"] },
    { nama: "Pelayanan & CS", kataKunci: ["cs", "teller", "kantor cabang"] },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
  });

  it("1. berhasil menganalisis postingan dan mengembalikan hasil terstruktur berlabel penyedia gemini", async () => {
    process.env.GEMINI_API_KEY = "rahasia-gemini-key";
    process.env.GEMINI_MODEL = "gemini-1.5-flash";

    const mockGeminiJson = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  topik: "KPR BTN",
                  sentimen: "POSITIF",
                  prioritas: "RUTIN",
                  headline: "Pengalaman KPR BTN Sangat Memuaskan",
                  ringkasan:
                    "Nasabah memuji proses pengajuan KPR BTN yang lancar dan cepat.",
                  kataKunci: ["kpr", "btn", "rumah subsidi"],
                }),
              },
            ],
          },
        },
      ],
    };

    let capturedUrl = "";
    let capturedBody = "";

    global.fetch = vi.fn().mockImplementation(async (url, init) => {
      capturedUrl = String(url);
      capturedBody = String(init?.body || "");
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => mockGeminiJson,
      } as unknown as Response;
    });

    const provider = new GeminiAnalysisProvider(testTopics);
    const rawPostWithPii =
      "Terima kasih Bank BTN pengajuan KPR saya disetujui! Hubungi saya di 081234567890.";

    const result = await provider.analyze({
      text: rawPostWithPii,
      topics: testTopics,
    });

    // Verifikasi pemanggilan fetch ke endpoint Gemini
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(capturedUrl).toContain(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"
    );

    // Verifikasi teks yang dikirim sudah melewati penyamaran PII (tidak ada nomor HP mentah)
    expect(capturedBody).not.toContain("081234567890");
    expect(capturedBody).toContain("[NOMOR_TELEPON_TERSEMBUNYI]");

    // Verifikasi hasil analisis terstruktur
    expect(result.penyedia).toBe("gemini");
    expect(result.topik).toBe("KPR BTN");
    expect(result.sentimen).toBe("POSITIF");
    expect(result.prioritas).toBe("RUTIN");
    expect(result.headline).toBe("Pengalaman KPR BTN Sangat Memuaskan");
    expect(result.ringkasan).toBe(
      "Nasabah memuji proses pengajuan KPR BTN yang lancar dan cepat."
    );
    expect(result.kataKunci).toEqual(["kpr", "btn", "rumah subsidi"]);
  });

  it("2. melempar error jika GEMINI_API_KEY kosong dan tidak memanggil fetch", async () => {
    delete process.env.GEMINI_API_KEY;

    global.fetch = vi.fn();

    const provider = new GeminiAnalysisProvider(testTopics);

    await expect(
      provider.analyze({ text: "Postingan Threads terkait BTN" })
    ).rejects.toThrow("GEMINI_API_KEY belum dikonfigurasi.");

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("3. melempar error dengan pesan jelas tanpa membocorkan API key saat API mengembalikan HTTP error", async () => {
    const secretKey = "super-secret-api-token-12345";
    process.env.GEMINI_API_KEY = secretKey;

    global.fetch = vi.fn().mockImplementation(async () => {
      return {
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        json: async () => ({
          error: {
            code: 429,
            message: "Resource exhausted: Quota exceeded",
            status: "RESOURCE_EXHAUSTED",
          },
        }),
      } as unknown as Response;
    });

    const provider = new GeminiAnalysisProvider(testTopics);

    let thrownError: Error | null = null;
    try {
      await provider.analyze({ text: "Aplikasi BTN lambat" });
    } catch (err: unknown) {
      if (err instanceof Error) {
        thrownError = err;
      }
    }

    expect(thrownError).not.toBeNull();
    expect(thrownError?.message).toContain("HTTP 429");
    expect(thrownError?.message).toContain("Quota exceeded");
    // Pastikan tidak ada kebocoran kunci rahasia pada pesan error
    expect(thrownError?.message).not.toContain(secretKey);
  });

  it("4. melempar error jika respons Gemini bukan format JSON yang valid", async () => {
    process.env.GEMINI_API_KEY = "rahasia-gemini-key";

    // Kembalikan respons di mana candidate text bukan format JSON
    const malformedGeminiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: "Maaf, saya tidak dapat merespons dalam format JSON sesuai permintaan.",
              },
            ],
          },
        },
      ],
    };

    global.fetch = vi.fn().mockImplementation(async () => {
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => malformedGeminiResponse,
      } as unknown as Response;
    });

    const provider = new GeminiAnalysisProvider(testTopics);

    await expect(
      provider.analyze({ text: "Postingan Threads" })
    ).rejects.toThrow(/format JSON yang valid/i);
  });

  it("5. menggunakan default model gemini-3.5-flash-lite dan menangani timeout 8 detik", async () => {
    process.env.GEMINI_API_KEY = "rahasia-gemini-key";
    delete process.env.GEMINI_MODEL; // Pastikan default model digunakan

    let capturedUrl = "";
    global.fetch = vi.fn().mockImplementation(async (url) => {
      capturedUrl = String(url);
      const abortError = new Error("This operation was aborted");
      abortError.name = "AbortError";
      throw abortError;
    });

    const provider = new GeminiAnalysisProvider(testTopics);

    await expect(
      provider.analyze({ text: "Postingan Threads BTN" })
    ).rejects.toThrow("Gemini API timeout setelah 8 detik.");

    expect(capturedUrl).toContain(
      "models/gemini-3.5-flash-lite:generateContent"
    );
  });
});
