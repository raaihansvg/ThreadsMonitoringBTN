import { prisma } from "@/lib/prisma";
import { AlertType, InputSourceType, Priority } from "@prisma/client";
import {
  formatWIBFullDate,
  getStartOfWIBDay,
  getEndOfWIBDay,
  getWIBDateString,
} from "@/lib/time";
import { getThresholds } from "@/lib/config/thresholds";

export interface MentionAlertInput {
  id: string;
  topik: string | null;
  prioritas: Priority;
  sentimen: string;
  sumberInput: InputSourceType;
  tanggalDitemukan: Date;
}

/**
 * Aturan Penentuan sumberInput pada Alert (Tahap 3D):
 * 1. Alert berjenis PERLU_PERHATIAN (FR-15):
 *    - sumberInput diambil langsung dari data mention pemicunya (mis. FORM, EKSTENSI, IMPOR, atau CONTOH).
 * 2. Alert berjenis LONJAKAN (FR-14):
 *    - Jika seluruh mention pemicu lonjakan murni berasal dari data contoh sintetis,
 *      maka sumberInput = CONTOH.
 *    - Jika lonjakan melibatkan atau dipicu oleh mention nyata (campuran data nyata dan contoh,
 *      atau murni data nyata), maka alert diklasifikasikan sebagai data nyata (sumberInput non-CONTOH,
 *      mengikuti sumber pemicu atau FORM).
 *    Hal ini menjamin bahwa setiap lonjakan yang mengandung data operasional nyata TIDAK akan pernah
 *    tersaring saat pengguna mematikan toggle data contoh (includeSample=false).
 */
export async function triggerAlertsForMention(mention: MentionAlertInput) {
  const alertsCreated = [];
  const thresholds = await getThresholds();

  // 1. Alert Mention Berprioritas PERLU_PERHATIAN (FR-15)
  if (mention.prioritas === Priority.PERLU_PERHATIAN) {
    const alert = await prisma.alert.create({
      data: {
        jenis: AlertType.PERLU_PERHATIAN,
        topik: mention.topik || "Umum",
        periode: formatWIBFullDate(mention.tanggalDitemukan),
        jumlah: 1,
        ambangDipakai: thresholds.negativeThreshold,
        dibaca: false,
        sumberInput: mention.sumberInput, // Sesuai data pemicu (bukan bawaan CONTOH)
      },
    });
    alertsCreated.push(alert);
  }

  // 2. Evaluasi Lonjakan Mention Harian pada Topik (FR-14)
  if (mention.topik) {
    const todayStr = getWIBDateString(mention.tanggalDitemukan);
    const startOfDay = getStartOfWIBDay(todayStr);
    const endOfDay = getEndOfWIBDay(todayStr);

    const todayMentions = await prisma.mention.findMany({
      where: {
        topik: mention.topik,
        tanggalDitemukan: { gte: startOfDay, lte: endOfDay },
      },
      select: { id: true, sumberInput: true },
    });

    const currentVolume = todayMentions.length;
    const dailyVolumeThreshold = thresholds.volumeThreshold || 10;

    if (currentVolume >= dailyVolumeThreshold) {
      const existingAlert = await prisma.alert.findFirst({
        where: {
          jenis: AlertType.LONJAKAN,
          topik: mention.topik,
          periode: formatWIBFullDate(mention.tanggalDitemukan),
        },
      });

      if (!existingAlert) {
        // Aturan Campuran: jika ada minimal satu mention nyata, alert dianggap nyata
        const hasRealMention = todayMentions.some(
          (m) => m.sumberInput !== InputSourceType.CONTOH
        );
        const resolvedSumberInput: InputSourceType = hasRealMention
          ? mention.sumberInput !== InputSourceType.CONTOH
            ? mention.sumberInput
            : InputSourceType.FORM
          : InputSourceType.CONTOH;

        const alert = await prisma.alert.create({
          data: {
            jenis: AlertType.LONJAKAN,
            topik: mention.topik,
            periode: formatWIBFullDate(mention.tanggalDitemukan),
            jumlah: currentVolume,
            ambangDipakai: dailyVolumeThreshold,
            dibaca: false,
            sumberInput: resolvedSumberInput,
          },
        });
        alertsCreated.push(alert);
      }
    }
  }

  return alertsCreated;
}
