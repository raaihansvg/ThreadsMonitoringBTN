import {
  DEFAULT_THRESHOLDS,
  SystemThresholds,
  getThresholds,
} from "@/lib/config/thresholds";

/**
 * Deteksi Lonjakan Mention dan Sentimen Negatif (AC-11 & FR-14)
 *
 * Nilai ambang bersumber dari konfigurasi database (AlertConfig),
 * dengan fallback ke DEFAULT_THRESHOLDS (lib/config/thresholds.ts).
 */

export interface SpikeDetectionOptions {
  /** Jumlah postingan pada periode evaluasi saat ini (mis. 24 jam terakhir) */
  currentVolume: number;
  /** Rata-rata volume dasar (baseline) dari beberapa hari sebelumnya */
  baselineAverage: number;
  /** Pengali lonjakan volume (default dari config) */
  volumeThresholdMultiplier?: number;
  /** Jumlah sentimen negatif saat ini */
  negativeCount?: number;
  /** Ambang batas absolut sentimen negatif yang memicu alert (default dari config) */
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

export function detectSpike(
  options: SpikeDetectionOptions,
  customThresholds?: Partial<SystemThresholds>
): SpikeAlert {
  const {
    currentVolume,
    baselineAverage,
    volumeThresholdMultiplier = customThresholds?.volumeMultiplier ??
      DEFAULT_THRESHOLDS.volumeMultiplier,
    negativeCount = 0,
    negativeThreshold = customThresholds?.negativeThreshold ??
      DEFAULT_THRESHOLDS.negativeThreshold,
    negativePercentageThreshold = customThresholds?.negativePercentage ??
      DEFAULT_THRESHOLDS.negativePercentage,
  } = options;

  // 1. Evaluasi Lonjakan Volume
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

/**
 * Deteksi lonjakan secara asinkron dengan mengambil ambang batas langsung dari database.
 */
export async function detectSpikeAsync(
  options: SpikeDetectionOptions
): Promise<SpikeAlert> {
  const dbThresholds = await getThresholds();
  return detectSpike(options, dbThresholds);
}
