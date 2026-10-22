import { prisma } from "@/lib/prisma";
import {
  AlertType,
  InputSourceType,
  Priority,
  MentionStatus,
} from "@prisma/client";
import {
  formatWIBFullDate,
  getStartOfWIBDay,
  getEndOfWIBDay,
  getWIBDateString,
} from "@/lib/time";
import { getThresholds } from "@/lib/config/thresholds";
import { detectSpike } from "@/lib/alert/spike";
import { sendAlertEmail } from "@/lib/email/service";

export interface MentionAlertInput {
  id: string;
  topik: string | null;
  prioritas: Priority;
  sentimen: string;
  sumberInput: InputSourceType;
  tanggalDitemukan: Date;
}

/**
 * Pemicu Alert (Tahap 3E):
 * 1. Alert Prioritas PERLU_PERHATIAN (FR-15):
 *    - Dipicu saat mention dengan prioritas PERLU_PERHATIAN disimpan atau disetujui dari draf.
 *    - Nilai: ambangDipakai = null (dipicu langsung per-insiden, bukan ambang volume agregat),
 *      jumlah = 1.
 *    - sumberInput mengikuti data pemicu.
 *    - Dilindungi batasan unik [jenis, topik, periode, sumberInput] agar tidak ganda.
 *
 * 2. Alert Lonjakan & Sentimen Negatif (FR-14):
 *    - Memakai SATU sumber logika resmi: detectSpike() dari @/lib/alert/spike.
 *    - Hanya menghitung entri non-DRAF (status !== DRAF).
 *    - Dihitung terpisah per kelas sumber:
 *      * Mention CONTOH hanya mengevaluasi mention CONTOH -> alert CONTOH.
 *      * Mention nyata hanya mengevaluasi mention nyata -> alert nyata.
 *      * Aturan "campuran" telah dihapus sepenuhnya.
 *    - Baseline dihitung dari rata-rata harian 7 hari sebelumnya untuk topik & kelas sumber yang sama.
 *    - Bila detectSpike() menghasilkan triggered: true (LONJAKAN_VOLUME atau SENTIMEN_NEGATIF),
 *      dibuat alert berjenis LONJAKAN dengan ambangDipakai dan jumlah sesuai hasil deteksi.
 */
export async function triggerAlertsForMention(mention: MentionAlertInput) {
  const alertsCreated = [];
  const thresholds = await getThresholds();
  const alertTopik = mention.topik || "Umum";
  const periode = formatWIBFullDate(mention.tanggalDitemukan);

  // 1. Alert Prioritas PERLU_PERHATIAN (FR-15)
  if (mention.prioritas === Priority.PERLU_PERHATIAN) {
    try {
      const alert = await prisma.alert.upsert({
        where: {
          jenis_topik_periode_sumberInput: {
            jenis: AlertType.PERLU_PERHATIAN,
            topik: alertTopik,
            periode,
            sumberInput: mention.sumberInput,
          },
        },
        create: {
          jenis: AlertType.PERLU_PERHATIAN,
          topik: alertTopik,
          periode,
          jumlah: 1, // 1 insiden spesifik per mention mendesak
          ambangDipakai: null, // Null: dipicu langsung per-insiden, bukan ambang volume
          dibaca: false,
          sumberInput: mention.sumberInput,
        },
        update: {},
      });
      alertsCreated.push(alert);
      if (alert.sumberInput !== InputSourceType.CONTOH) {
        void sendAlertEmail(
          alert,
          "Mention mendesak dengan prioritas PERLU_PERHATIAN terdeteksi"
        ).catch(() => {});
      }
    } catch {
      // Abaikan jika terjadi konflik konkuren
    }
  }

  // 2. Evaluasi Lonjakan & Sentimen Negatif via detectSpike (FR-14)
  if (mention.topik) {
    const isSample = mention.sumberInput === InputSourceType.CONTOH;
    const sourceFilter = isSample
      ? { sumberInput: InputSourceType.CONTOH }
      : { sumberInput: { not: InputSourceType.CONTOH } };
    const alertSumber = isSample ? InputSourceType.CONTOH : mention.sumberInput;

    const todayStr = getWIBDateString(mention.tanggalDitemukan);
    const startOfToday = getStartOfWIBDay(todayStr);
    const endOfToday = getEndOfWIBDay(todayStr);

    // Hitung hanya entri non-DRAF hari ini untuk topik dan kelas sumber yang sama
    const todayMentions = await prisma.mention.findMany({
      where: {
        topik: mention.topik,
        status: { not: MentionStatus.DRAF },
        tanggalDitemukan: { gte: startOfToday, lte: endOfToday },
        ...sourceFilter,
      },
      select: { id: true, sentimen: true },
    });

    const currentVolume = todayMentions.length;
    const negativeCount = todayMentions.filter(
      (m) => m.sentimen === "NEGATIF"
    ).length;

    // Baseline rata-rata harian 7 hari sebelumnya (non-DRAF, topik & sumber sama)
    const sevenDaysAgo = new Date(
      startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000
    );
    const pastMentionsCount = await prisma.mention.count({
      where: {
        topik: mention.topik,
        status: { not: MentionStatus.DRAF },
        tanggalDitemukan: { gte: sevenDaysAgo, lt: startOfToday },
        ...sourceFilter,
      },
    });
    const baselineAverage = pastMentionsCount / 7;

    // Panggil logika tunggal detectSpike
    const spike = detectSpike(
      {
        currentVolume,
        baselineAverage,
        volumeThresholdMultiplier: thresholds.volumeMultiplier,
        negativeCount,
        negativeThreshold: thresholds.negativeThreshold,
        negativePercentageThreshold: thresholds.negativePercentage,
      },
      thresholds
    );

    if (spike.triggered) {
      const ambangDipakai =
        spike.type === "SENTIMEN_NEGATIF"
          ? thresholds.negativeThreshold
          : Math.round(
              thresholds.volumeMultiplier * Math.max(1, baselineAverage)
            );
      const jumlah =
        spike.type === "SENTIMEN_NEGATIF" ? negativeCount : currentVolume;

      try {
        const alert = await prisma.alert.upsert({
          where: {
            jenis_topik_periode_sumberInput: {
              jenis: AlertType.LONJAKAN,
              topik: mention.topik,
              periode,
              sumberInput: alertSumber,
            },
          },
          create: {
            jenis: AlertType.LONJAKAN,
            topik: mention.topik,
            periode,
            jumlah,
            ambangDipakai,
            dibaca: false,
            sumberInput: alertSumber,
          },
          update: {
            jumlah,
            ambangDipakai,
          },
        });
        alertsCreated.push(alert);
        if (alert.sumberInput !== InputSourceType.CONTOH) {
          void sendAlertEmail(alert, spike.reason).catch(() => {});
        }
      } catch {
        // Abaikan jika terjadi konflik konkuren
      }
    }
  }

  return alertsCreated;
}
