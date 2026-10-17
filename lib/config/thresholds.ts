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
