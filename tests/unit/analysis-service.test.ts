import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma client
vi.mock("@/lib/prisma", () => {
  return {
    prisma: {
      topic: {
        findMany: vi.fn(),
      },
    },
  };
});

import { prisma } from "@/lib/prisma";
import { analyzeText } from "@/lib/analysis/service";
import { TEST_TOPICS } from "@/tests/fixtures/topics";
import { Sentiment, Priority } from "@prisma/client";

describe("Service Analisis Server (lib/analysis/service.ts)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.topic.findMany as any).mockResolvedValue(
      TEST_TOPICS.map((t, idx) => ({
        id: `topic-${idx}`,
        nama: t.nama,
        kataKunci: t.kataKunci,
        aktif: true,
        dibuatPada: new Date("2026-01-01T00:00:00Z"),
        diubahPada: new Date("2026-01-01T00:00:00Z"),
      }))
    );
  });

  it("menyamarkan PII sebelum teks diproses oleh analisis", async () => {
    const rawText =
      "Tolong bantu nomor rekening 12345678901 dan NIK 3201234567890123 uang raib dari tabungan btn";
    const result = await analyzeText(rawText);

    expect(result.ringkasan).not.toContain("12345678901");
    expect(result.ringkasan).not.toContain("3201234567890123");
    expect(result.ringkasan).toContain("[NOMOR_REKENING_TERSEMBUNYI]");
    expect(result.ringkasan).toContain("[NIK_TERSEMBUNYI]");
    expect(result.topik).toBe("Tabungan BTN");
  });

  it("mengambil topik aktif dari database dengan urutan dibuatPada asc", async () => {
    const rawText = "Saya mau tanya syarat pengajuan KPR BTN subsidi rumah";
    const result = await analyzeText(rawText);

    expect(prisma.topic.findMany).toHaveBeenCalledWith({
      where: { aktif: true },
      orderBy: { dibuatPada: "asc" },
    });
    expect(result.topik).toBe("KPR BTN");
  });

  it("memaksa penggunaan provider keyword saat allowLlm: false (misal impor massal)", async () => {
    const rawText = "Aplikasi BTN Mobile lancar jaya dan responsif";
    const result = await analyzeText(rawText, { allowLlm: false });

    expect(result.penyedia).toBe("keyword");
    expect(result.fallbackDipakai).toBe(false);
    expect(result.topik).toBe("BTN Mobile");
    expect(result.sentimen).toBe(Sentiment.POSITIF);
  });

  it("menerapkan officerOverride bila disediakan oleh petugas", async () => {
    const rawText = "Pengalaman buka rekening tabungan btn di cabang";
    const result = await analyzeText(rawText, {
      officerOverride: {
        sentimen: Sentiment.POSITIF,
        prioritas: Priority.PERLU_PERHATIAN,
        headline: "Headline Disesuaikan Petugas",
      },
    });

    expect(result.sentimen).toBe(Sentiment.POSITIF);
    expect(result.prioritas).toBe(Priority.PERLU_PERHATIAN);
    expect(result.headline).toBe("Headline Disesuaikan Petugas");
  });

  it("tidak melempar error (graceful) bila tabel topik kosong dan mengembalikan 'Lainnya'", async () => {
    (prisma.topic.findMany as any).mockResolvedValue([]);

    const rawText = "Teks apapun tentang kpr btn mobile cabang";
    const result = await analyzeText(rawText);

    expect(result.topik).toBe("Lainnya");
    expect(result.sentimen).toBeDefined();
    expect(result.prioritas).toBeDefined();
  });

  it("topik baru/kata kunci baru di database memengaruhi hasil analyzeText tanpa ubah kode (AC-15)", async () => {
    // Simulasi penambahan topik baru di DB oleh admin
    const dynamicTopics = [
      ...TEST_TOPICS,
      {
        nama: "Asuransi BTN",
        kataKunci: ["asuransi", "premi", "klaim asuransi"],
      },
    ];
    (prisma.topic.findMany as any).mockResolvedValue(
      dynamicTopics.map((t, idx) => ({
        id: `topic-${idx}`,
        nama: t.nama,
        kataKunci: t.kataKunci,
        aktif: true,
        dibuatPada: new Date(`2026-01-0${idx + 1}T00:00:00Z`),
        diubahPada: new Date("2026-01-01T00:00:00Z"),
      }))
    );

    const rawText = "Bagaimana prosedur pencairan klaim asuransi btn?";
    const result = await analyzeText(rawText);

    expect(result.topik).toBe("Asuransi BTN");
  });

  it("fallback ke kamus dan menandai fallbackDipakai true bila penyedia utama melempar error atau tidak valid", async () => {
    const originalProvider = process.env.ANALYSIS_PROVIDER;
    const { registerAnalysisProvider } = await import("@/lib/analysis/service");

    // Daftarkan penyedia uji yang mengembalikan schema invalid
    registerAnalysisProvider("broken-llm", () => ({
      name: "broken-llm",
      analyze: async () => {
        // Melempar error atau mengembalikan payload di luar enum
        throw new Error("Koneksi LLM timeout 15s");
      },
    }));

    try {
      process.env.ANALYSIS_PROVIDER = "broken-llm";
      const rawText = "Mau tanya pengajuan kpr btn subsidi";
      const result = await analyzeText(rawText, { allowLlm: true });

      expect(result.fallbackDipakai).toBe(true);
      expect(result.penyedia).toBe("keyword");
      expect(result.topik).toBe("KPR BTN");
    } finally {
      process.env.ANALYSIS_PROVIDER = originalProvider;
    }
  });

  it("teks berisi nomor HP dan nomor kartu: yang diteruskan ke penyedia sudah tersamar", async () => {
    const originalProvider = process.env.ANALYSIS_PROVIDER;
    const { registerAnalysisProvider } = await import("@/lib/analysis/service");

    let capturedText = "";
    registerAnalysisProvider("recording-provider", () => ({
      name: "recording-provider",
      analyze: async (input) => {
        capturedText = input.text;
        return {
          sentimen: Sentiment.NETRAL,
          topik: "Lainnya",
          kataKunci: ["btn"],
          prioritas: Priority.RUTIN,
          headline: "Uji Rekam",
          ringkasan: input.text.slice(0, 100),
          penyedia: "recording-provider",
        };
      },
    }));

    try {
      process.env.ANALYSIS_PROVIDER = "recording-provider";
      const rawText =
        "Hubungi saya di 0812-3456-7890 atau debet kartu 4111 2222 3333 4444 segera";
      await analyzeText(rawText, { allowLlm: true });

      // Verifikasi bahwa penyedia TIDAK PERNAH menerima teks asli nomor HP dan nomor kartu
      expect(capturedText).not.toContain("0812-3456-7890");
      expect(capturedText).not.toContain("4111 2222 3333 4444");
      expect(capturedText).toContain("[NOMOR_TELEPON_TERSEMBUNYI]");
      expect(capturedText).toContain("[NOMOR_KARTU_TERSEMBUNYI]");
    } finally {
      process.env.ANALYSIS_PROVIDER = originalProvider;
    }
  });
});
