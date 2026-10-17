import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma client
vi.mock("@/lib/prisma", () => {
  let mockConfig: any = {
    id: "default",
    volumeThreshold: 10,
    volumeMultiplier: 2.0,
    negativeThreshold: 3,
    negativePercentage: 40.0,
  };

  return {
    prisma: {
      alertConfig: {
        findUnique: vi
          .fn()
          .mockImplementation(() =>
            Promise.resolve(mockConfig ? { ...mockConfig } : null)
          ),
        upsert: vi.fn().mockImplementation((args: any) => {
          mockConfig = { ...args.update };
          return Promise.resolve(mockConfig);
        }),
      },
      topic: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    },
  };
});

import { getThresholds, saveThresholds } from "@/lib/config/thresholds";
import { detectSpike, detectSpikeAsync } from "@/lib/alert/spike";

describe("Ambang Alert Dinamis dari Database (FR-14, FR-19, Tahap 1.7)", () => {
  beforeEach(async () => {
    // Reset ambang ke nilai baku awal
    await saveThresholds({
      volumeThreshold: 10,
      volumeMultiplier: 2.0,
      negativeThreshold: 3,
      negativePercentage: 40.0,
    });
  });

  it("hasil deteksi berubah saat ambang negatif di database diubah (tanpa ubah kode)", async () => {
    // Kondisi uji: 3 mention negatif dari total 5 mention (60%)
    const evaluationData = {
      currentVolume: 5,
      baselineAverage: 5,
      negativeCount: 3,
    };

    // 1. Dengan ambang bawaan di DB (negativeThreshold: 3)
    const alertAwal = await detectSpikeAsync(evaluationData);
    expect(alertAwal.triggered).toBe(true);
    expect(alertAwal.type).toBe("SENTIMEN_NEGATIF");

    // 2. Petugas menaikkan ambang negatif di DB menjadi 5 mention/hari
    await saveThresholds({ negativeThreshold: 5 });

    // 3. Evaluasi ulang data yang SAMA PERSIS tanpa mengubah kode detectSpike
    const alertSetelahUbah = await detectSpikeAsync(evaluationData);
    // Tidak terpicu karena 3 mention belum mencapai ambang baru (5)
    expect(alertSetelahUbah.triggered).toBe(false);
  });

  it("hasil deteksi lonjakan volume berubah saat pengali volume di DB diubah", async () => {
    // Kondisi uji: volume 12 mention, baseline rata-rata 5 (melonjak 2.4x)
    const evaluationData = {
      currentVolume: 12,
      baselineAverage: 5,
      negativeCount: 0,
    };

    // 1. Dengan pengali volume bawaan di DB (2.0x): 12 >= 5 * 2.0 (10) -> terpicu
    const alertAwal = await detectSpikeAsync(evaluationData);
    expect(alertAwal.triggered).toBe(true);
    expect(alertAwal.type).toBe("LONJAKAN_VOLUME");

    // 2. Petugas menaikkan pengali volume di DB menjadi 3.0x
    await saveThresholds({ volumeMultiplier: 3.0 });

    // 3. Evaluasi ulang data yang SAMA PERSIS: 12 < 5 * 3.0 (15) -> tidak terpicu
    const alertSetelahUbah = await detectSpikeAsync(evaluationData);
    expect(alertSetelahUbah.triggered).toBe(false);
  });
});
