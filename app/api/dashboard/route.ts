import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  Sentiment,
  Priority,
  MentionStatus,
  InputSourceType,
} from "@prisma/client";

import {
  getWIBDateString,
  getStartOfWIBDay,
  getEndOfWIBDay,
  subDaysWIB,
  getStartOfWIBWeek,
  formatWIBShortDate,
} from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const topicFilter = searchParams.get("topic") || "";
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const includeSample = searchParams.get("includeSample") !== "false";

    // Standar rentang tanggal: default 30 hari terakhir berbasis zona waktu Asia/Jakarta (WIB)
    const todayStr = getWIBDateString();
    const endOfToday = getEndOfWIBDay(todayStr);
    const endDate = endDateParam ? new Date(endDateParam) : endOfToday;
    const startDate = startDateParam
      ? new Date(startDateParam)
      : getStartOfWIBDay(subDaysWIB(todayStr, 29));

    // Hitung durasi untuk periode sebelumnya (panjang yang sama)
    const durationMs = endDate.getTime() - startDate.getTime();
    const prevEndDate = new Date(startDate.getTime() - 1);
    const prevStartDate = new Date(prevEndDate.getTime() - durationMs);

    // Kondisi filter dasar (DRAF tidak dihitung sesuai BR-03)
    const baseWhere: Record<string, unknown> = {
      status: { not: MentionStatus.DRAF },
      ...(includeSample
        ? {}
        : { sumberInput: { not: InputSourceType.CONTOH } }),
    };

    if (
      topicFilter &&
      topicFilter !== "Semua" &&
      topicFilter !== "Semua Topik"
    ) {
      baseWhere.topik = topicFilter;
    }

    // Ambil data periode aktif
    const activeMentions = await prisma.mention.findMany({
      where: {
        ...baseWhere,
        tanggalDitemukan: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
        tanggalDitemukan: true,
        sentimen: true,
        prioritas: true,
        topik: true,
        headline: true,
        ringkasan: true,
      },
      orderBy: { tanggalDitemukan: "asc" },
    });

    // Ambil data periode sebelumnya untuk perbandingan pertumbuhan
    const prevCount = await prisma.mention.count({
      where: {
        ...baseWhere,
        tanggalDitemukan: {
          gte: prevStartDate,
          lte: prevEndDate,
        },
      },
    });

    const totalMentions = activeMentions.length;

    // Perhitungan Pertumbuhan
    let growthText = "0%";
    let isGrowthPositive = true;
    if (prevCount === 0) {
      growthText = totalMentions > 0 ? "Baru" : "0%";
    } else {
      const growth = ((totalMentions - prevCount) / prevCount) * 100;
      isGrowthPositive = growth >= 0;
      growthText = `${growth >= 0 ? "+" : ""}${growth.toFixed(1).replace(".", ",")}%`;
    }

    // Perhitungan Sentimen
    let positiveCount = 0;
    let neutralCount = 0;
    let negativeCount = 0;
    let needsAttentionCount = 0;

    for (const m of activeMentions) {
      if (m.sentimen === Sentiment.POSITIF) positiveCount++;
      else if (m.sentimen === Sentiment.NETRAL) neutralCount++;
      else if (m.sentimen === Sentiment.NEGATIF) negativeCount++;

      if (m.prioritas === Priority.PERLU_PERHATIAN) needsAttentionCount++;
    }

    const positivePercentage =
      totalMentions > 0
        ? ((positiveCount / totalMentions) * 100).toFixed(1).replace(".", ",")
        : "0,0";
    const negativePercentage =
      totalMentions > 0
        ? ((negativeCount / totalMentions) * 100).toFixed(1).replace(".", ",")
        : "0,0";

    // Ambang batas harian default
    const dailyThreshold = 10;

    // Agregasi Batang Tren Waktu (Maksimal 31 batang)
    const granularityParam = searchParams.get("granularity");
    const dayDiff = Math.max(1, Math.ceil(durationMs / (24 * 60 * 60 * 1000)));
    const isWeeklyAggregation = granularityParam === "Mingguan" || dayDiff > 31;
    const effectiveThreshold = isWeeklyAggregation
      ? dailyThreshold * 7
      : dailyThreshold;

    const barsMap = new Map<string, number>();
    for (const m of activeMentions) {
      const d = new Date(m.tanggalDitemukan);
      const key = isWeeklyAggregation
        ? `M${Math.ceil(d.getDate() / 7)} ${d.toLocaleDateString("id-ID", { month: "short" })}`
        : d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
      barsMap.set(key, (barsMap.get(key) || 0) + 1);
    }

    let peakValue = 0;
    for (const val of barsMap.values()) {
      if (val > peakValue) peakValue = val;
    }

    const trendBars = Array.from(barsMap.entries()).map(([label, count]) => ({
      label,
      count,
      isSpike: count >= effectiveThreshold,
      isPeak: count === peakValue && peakValue > 0,
    }));

    // Agregasi per Topik (termasuk "Lainnya" agar total match)
    const knownTopics = await prisma.topic.findMany({
      where: { aktif: true },
      select: { nama: true },
    });
    const knownTopicSet = new Set(knownTopics.map((t) => t.nama));

    const topicStatsMap = new Map<
      string,
      { count: number; positif: number; netral: number; negatif: number }
    >();

    for (const m of activeMentions) {
      const topicName =
        m.topik && knownTopicSet.has(m.topik) ? m.topik : "Lainnya";
      const current = topicStatsMap.get(topicName) || {
        count: 0,
        positif: 0,
        netral: 0,
        negatif: 0,
      };
      current.count++;
      if (m.sentimen === Sentiment.POSITIF) current.positif++;
      else if (m.sentimen === Sentiment.NETRAL) current.netral++;
      else if (m.sentimen === Sentiment.NEGATIF) current.negatif++;
      topicStatsMap.set(topicName, current);
    }

    const topicsBreakdown = Array.from(topicStatsMap.entries())
      .map(([nama, stat]) => ({
        nama,
        count: stat.count,
        percentage: totalMentions > 0 ? (stat.count / totalMentions) * 100 : 0,
        positif: stat.positif,
        netral: stat.netral,
        negatif: stat.negatif,
      }))
      .sort((a, b) => b.count - a.count);

    const topTopic =
      topicsBreakdown.length > 0
        ? topicsBreakdown[0]
        : { nama: "Belum Ada Topik", count: 0, percentage: 0 };

    // Indeks Harian 7 Hari Terakhir (Lollipop Chart berakhir hari ini dalam waktu WIB)
    const daily7Days = [];
    const dayNames = ["M", "S", "S", "R", "K", "J", "S"]; // Minggu s/d Sabtu
    for (let i = 6; i >= 0; i--) {
      const targetDateStr = subDaysWIB(todayStr, i);
      const startOfDay = getStartOfWIBDay(targetDateStr);
      const endOfDay = getEndOfWIBDay(targetDateStr);
      const midDay = new Date(`${targetDateStr}T12:00:00.000+07:00`);

      const dayCount = await prisma.mention.count({
        where: {
          ...baseWhere,
          tanggalDitemukan: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      });

      daily7Days.push({
        dayLabel: dayNames[midDay.getDay()],
        dateLabel: formatWIBShortDate(startOfDay),
        count: dayCount,
        isSpike: dayCount >= dailyThreshold,
      });
    }

    // Jumlah antrean Draf & Alert aktif (konsisten dengan toggle Data Contoh)
    const draftsCount = await prisma.mention.count({
      where: {
        status: MentionStatus.DRAF,
        ...(includeSample
          ? {}
          : { sumberInput: { not: InputSourceType.CONTOH } }),
      },
    });

    const unreadAlertsCount = await prisma.alert.count({
      where: {
        dibaca: false,
        ...(includeSample
          ? {}
          : { sumberInput: { not: InputSourceType.CONTOH } }),
      },
    });

    // Ringkasan Mingguan: hanya berbasis data nyata pada pekan berjalan (WIB)
    const startOfWeek = getStartOfWIBWeek();
    const thisWeekMentions = activeMentions.filter(
      (m) =>
        new Date(m.tanggalDitemukan) >= startOfWeek &&
        Boolean(m.headline?.trim() || m.ringkasan?.trim())
    );
    const latestWeeklyMention = thisWeekMentions[thisWeekMentions.length - 1];

    const weeklySummary = latestWeeklyMention
      ? {
          headline: latestWeeklyMention.headline || "",
          summary: latestWeeklyMention.ringkasan || "",
          hasData: true,
        }
      : {
          headline: "",
          summary: "",
          hasData: false,
        };

    return NextResponse.json({
      totalMentions,
      prevCount,
      growthText,
      isGrowthPositive,
      positiveCount,
      neutralCount,
      negativeCount,
      positivePercentage,
      negativePercentage,
      needsAttentionCount,
      dailyThreshold,
      isWeeklyAggregation,
      trendBars,
      topicsBreakdown,
      topTopic,
      daily7Days,
      draftsCount,
      unreadAlertsCount,
      weeklySummary,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Gagal memuat data dashboard",
      },
      { status: 500 }
    );
  }
}
