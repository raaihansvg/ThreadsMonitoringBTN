/**
 * Deteksi Lonjakan Mention dan Sentimen Negatif (AC-11 & FR-15)
 *
 * AC-11: Pada data uji dengan lonjakan buatan, alert muncul beserta penyebabnya;
 * tanpa lonjakan, alert tidak muncul; perubahan ambang berlaku tanpa mengubah kode.
 */

export interface SpikeDetectionOptions {
  /** Jumlah postingan pada periode evaluasi saat ini (mis. 24 jam terakhir) */
  currentVolume: number;
  /** Rata-rata volume dasar (baseline) dari beberapa hari sebelumnya */
  baselineAverage: number;
  /** Pengali lonjakan volume (default 2.0x = 200% dari baseline) */
  volumeThresholdMultiplier?: number;
  /** Jumlah sentimen negatif saat ini */
  negativeCount?: number;
  /** Ambang batas absolut sentimen negatif yang memicu alert (default 5) */
  negativeThreshold?: number;
  /** Persentase sentimen negatif terhadap total (0-100) */
  negativePercentageThreshold?: number;
}

export interface SpikeAlert {
  triggered: boolean;
  type?: "LONJAKAN_VOLUME" | "SENTIMEN_NEGATIF";
  title?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export function detectSpike(options: SpikeDetectionOptions): SpikeAlert {
  const {
    currentVolume,
    baselineAverage,
    volumeThresholdMultiplier = 2.0,
    negativeCount = 0,
    negativeThreshold = 5,
    negativePercentageThreshold = 40,
  } = options;

  // 1. Evaluasi Lonjakan Volume
  // Terpicu jika volume saat ini melampaui baseline * multiplier, dengan batas minimal volume tertentu
  const effectiveBaseline = Math.max(1, baselineAverage);
  const volumeLimit = effectiveBaseline * volumeThresholdMultiplier;

  if (currentVolume >= 3 && currentVolume >= volumeLimit) {
    const increasePercent = Math.round(
      ((currentVolume - effectiveBaseline) / effectiveBaseline) * 100
    );
    return {
      triggered: true,
      type: "LONJAKAN_VOLUME",
      title: "Peringatan: Lonjakan Volume Mention Terdeteksi",
      reason: `Volume mention saat ini (${currentVolume}) melonjak +${increasePercent}% melampaui baseline rata-rata (${baselineAverage.toFixed(1)}). Ambang pemicu: ${volumeThresholdMultiplier}x.`,
      metadata: {
        currentVolume,
        baselineAverage,
        volumeThresholdMultiplier,
        increasePercent,
      },
    };
  }

  // 2. Evaluasi Lonjakan Sentimen Negatif
  const negativePercentage =
    currentVolume > 0 ? (negativeCount / currentVolume) * 100 : 0;

  if (
    negativeCount >= negativeThreshold &&
    negativePercentage >= negativePercentageThreshold
  ) {
    return {
      triggered: true,
      type: "SENTIMEN_NEGATIF",
      title: "Peringatan: Peningkatan Sentimen Negatif Signifikan",
      reason: `Ditemukan ${negativeCount} mention bersentimen negatif (${negativePercentage.toFixed(1)}% dari total ${currentVolume}). Ambang pemicu: ${negativeThreshold} mention / ${negativePercentageThreshold}%.`,
      metadata: {
        negativeCount,
        negativeThreshold,
        negativePercentage,
        currentVolume,
      },
    };
  }

  return { triggered: false };
}
