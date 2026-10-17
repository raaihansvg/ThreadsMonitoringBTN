import { describe, it, expect } from "vitest";
import { detectSpike } from "@/lib/alert/spike";

describe("Deteksi Lonjakan / Anomali (AC-11)", () => {
  it("memicu alert LONJAKAN_VOLUME jika volume harian melonjak di atas baseline", () => {
    // Baseline 5 postingan/hari, hari ini ada 15 postingan (3x lonjakan)
    const alert = detectSpike({
      currentVolume: 15,
      baselineAverage: 5,
      volumeThresholdMultiplier: 2.0,
    });

    expect(alert.triggered).toBe(true);
    expect(alert.type).toBe("LONJAKAN_VOLUME");
    expect(alert.reason).toContain("melonjak");
    expect(alert.reason).toContain("baseline");
  });

  it("tidak memicu alert lonjakan volume saat aktivitas masih dalam rentang wajar", () => {
    const alert = detectSpike({
      currentVolume: 6,
      baselineAverage: 5,
      volumeThresholdMultiplier: 2.0,
    });

    expect(alert.triggered).toBe(false);
  });

  it("memicu alert SENTIMEN_NEGATIF jika jumlah dan proporsi sentimen negatif melampaui ambang", () => {
    const alert = detectSpike({
      currentVolume: 10,
      baselineAverage: 10,
      negativeCount: 6,
      negativeThreshold: 5,
      negativePercentageThreshold: 40,
    });

    expect(alert.triggered).toBe(true);
    expect(alert.type).toBe("SENTIMEN_NEGATIF");
    expect(alert.reason).toContain("sentimen negatif");
  });

  it("dapat menyesuaikan ambang batas (threshold) secara dinamis tanpa mengubah kode", () => {
    // Bila ambang batas dinaikkan menjadi 4.0x
    const alertTinggi = detectSpike({
      currentVolume: 15,
      baselineAverage: 5,
      volumeThresholdMultiplier: 4.0, // Perlu >= 20
    });
    expect(alertTinggi.triggered).toBe(false);

    // Bila ambang batas diturunkan menjadi 1.5x
    const alertRendah = detectSpike({
      currentVolume: 8,
      baselineAverage: 5,
      volumeThresholdMultiplier: 1.5, // Perlu >= 7.5
    });
    expect(alertRendah.triggered).toBe(true);
  });
});
