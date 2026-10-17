/**
 * Konfigurasi Terpusat Ambang Deteksi Alert (Tahap 1.6 - FR-14 & FR-19)
 * Menghilangkan angka tetap (hardcoded magic numbers) di seluruh kode.
 */

export interface SystemThresholds {
  /** Ambang batas lonjakan mention volume harian (default 10 mention/hari) */
  volumeThreshold: number;
  /** Pengali lonjakan volume terhadap rata-rata baseline (default 2.0x = 200%) */
  volumeMultiplier: number;
  /** Ambang batas mention bersentimen negatif harian (default 3 mention/hari) */
  negativeThreshold: number;
  /** Ambang persentase sentimen negatif terhadap total (default 40%) */
  negativePercentage: number;
}

export const DEFAULT_THRESHOLDS: SystemThresholds = {
  volumeThreshold: 10,
  volumeMultiplier: 2.0,
  negativeThreshold: 3, // Nilai baku terverifikasi: 3 mention negatif per hari
  negativePercentage: 40,
};

/**
 * Mengambil ambang batas aktif dari database.
 * Bila belum ada di DB, menggunakan DEFAULT_THRESHOLDS sebagai nilai awal.
 */
export async function getThresholds(): Promise<SystemThresholds> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const config = await prisma.alertConfig.findUnique({
      where: { id: "default" },
    });
    if (config) {
      return {
        volumeThreshold: config.volumeThreshold,
        volumeMultiplier: config.volumeMultiplier,
        negativeThreshold: config.negativeThreshold,
        negativePercentage: config.negativePercentage,
      };
    }
  } catch {
    // Fallback jika database belum siap atau saat environment tanpa DB
  }
  return { ...DEFAULT_THRESHOLDS };
}

/**
 * Menyimpan pembaruan ambang batas ke database.
 */
export async function saveThresholds(
  data: Partial<SystemThresholds>
): Promise<SystemThresholds> {
  const current = await getThresholds();
  const updated: SystemThresholds = {
    volumeThreshold: data.volumeThreshold ?? current.volumeThreshold,
    volumeMultiplier: data.volumeMultiplier ?? current.volumeMultiplier,
    negativeThreshold: data.negativeThreshold ?? current.negativeThreshold,
    negativePercentage: data.negativePercentage ?? current.negativePercentage,
  };

  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.alertConfig.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        volumeThreshold: updated.volumeThreshold,
        volumeMultiplier: updated.volumeMultiplier,
        negativeThreshold: updated.negativeThreshold,
        negativePercentage: updated.negativePercentage,
      },
      update: {
        volumeThreshold: updated.volumeThreshold,
        volumeMultiplier: updated.volumeMultiplier,
        negativeThreshold: updated.negativeThreshold,
        negativePercentage: updated.negativePercentage,
      },
    });
  } catch (err) {
    console.error("Gagal menyimpan ambang alert ke database:", err);
  }

  return updated;
}
