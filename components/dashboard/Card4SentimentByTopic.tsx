import React from "react";
import Link from "next/link";

export interface TopicStat {
  nama: string;
  count: number;
  percentage: number;
  positif: number;
  netral: number;
  negatif: number;
}

interface Card4Props {
  totalMentions: number;
  topicsBreakdown: TopicStat[];
  draftsCount: number;
  unreadAlertsCount: number;
}

/**
 * Mengagregasi data topik untuk Kartu 4:
 * 1. Menggabungkan topik dengan nama yang sama (duplikat nama dijumlahkan).
 * 2. Memisahkan "Lainnya" dari topik bernama spesifik.
 * 3. Menampilkan maksimal 3 topik spesifik teratas.
 * 4. Menggabungkan sisa topik (ke-4 dst) bersama seluruh entri "Lainnya" menjadi TEPAT SATU "Lainnya".
 * 5. Menjamin key unik dan total hitungan sama persis dengan totalMentions.
 */
export function aggregateTopicsForCard4(
  topicsBreakdown: TopicStat[] = [],
  totalMentions: number
): TopicStat[] {
  // 1. Gabungkan item dengan nama sama bila ada
  const mergedMap = new Map<string, TopicStat>();
  for (const topic of topicsBreakdown) {
    const existing = mergedMap.get(topic.nama);
    if (existing) {
      existing.count += topic.count;
      existing.positif += topic.positif;
      existing.netral += topic.netral;
      existing.negatif += topic.negatif;
    } else {
      mergedMap.set(topic.nama, { ...topic });
    }
  }

  // 2. Pisahkan "Lainnya" dari topik spesifik
  let othersAccumulator: TopicStat | null = null;
  const namedTopics: TopicStat[] = [];

  for (const [name, stat] of mergedMap.entries()) {
    if (name.trim().toLowerCase() === "lainnya") {
      othersAccumulator = { ...stat, nama: "Lainnya" };
    } else {
      namedTopics.push(stat);
    }
  }

  // 3. Urutkan topik spesifik berdasarkan hitungan terbanyak
  namedTopics.sort((a, b) => b.count - a.count);

  // 4. Ambil 3 teratas
  const top3Named = namedTopics.slice(0, 3);
  const remainingNamed = namedTopics.slice(3);

  // 5. Gabungkan sisa topik bersama "Lainnya"
  if (remainingNamed.length > 0) {
    if (!othersAccumulator) {
      othersAccumulator = {
        nama: "Lainnya",
        count: 0,
        percentage: 0,
        positif: 0,
        netral: 0,
        negatif: 0,
      };
    }
    for (const rem of remainingNamed) {
      othersAccumulator.count += rem.count;
      othersAccumulator.positif += rem.positif;
      othersAccumulator.netral += rem.netral;
      othersAccumulator.negatif += rem.negatif;
    }
  }

  const result: TopicStat[] = [...top3Named];
  if (othersAccumulator && othersAccumulator.count > 0) {
    result.push(othersAccumulator);
  }

  // 6. Pastikan bila ada selisih mention yang belum tercatat topik, digabung ke "Lainnya"
  const accountedCount = result.reduce((acc, curr) => acc + curr.count, 0);
  if (totalMentions > accountedCount) {
    const diff = totalMentions - accountedCount;
    const existingOther = result.find((t) => t.nama === "Lainnya");
    if (existingOther) {
      existingOther.count += diff;
      existingOther.netral += diff;
    } else {
      result.push({
        nama: "Lainnya",
        count: diff,
        percentage: 0,
        positif: 0,
        netral: diff,
        negatif: 0,
      });
    }
  }

  // Hitung ulang persentase agar proporsional terhadap totalMentions
  return result.map((item) => ({
    ...item,
    percentage: totalMentions > 0 ? (item.count / totalMentions) * 100 : 0,
  }));
}

export function Card4SentimentByTopic({
  totalMentions,
  topicsBreakdown,
  draftsCount,
  unreadAlertsCount,
}: Card4Props) {
  const displayList = aggregateTopicsForCard4(topicsBreakdown, totalMentions);

  return (
    <div className="flex flex-col justify-between rounded-[28px] border border-slate-100 bg-white p-6 shadow-sm lg:col-span-3">
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#0055FF]" />
            <span className="text-xs font-semibold text-slate-700">
              Positif/Netral
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#E60012]" />
            <span className="text-xs font-semibold text-[#C10010]">
              Negatif
            </span>
          </div>
        </div>

        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-3xl font-normal tracking-tight text-[#0A192F]">
              {totalMentions}{" "}
              <span className="text-xs text-[#5A6A7E]">mention</span>
            </p>
            <p className="mt-0.5 text-xs font-bold uppercase text-[#5A6A7E]">
              DISTRIBUSI PER TOPIK
            </p>
          </div>
          <span className="rounded-full bg-[#EBF3FF] px-2.5 py-0.5 text-xs font-bold text-[#0055FF]">
            Aktif
          </span>
        </div>

        <div className="mt-4 space-y-2.5 text-xs">
          {displayList.map((t) => (
            <div key={t.nama}>
              <div className="mb-1 flex justify-between font-medium text-slate-700">
                <span>{t.nama}</span>
                <span>{t.count} mention</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-100">
                <div
                  style={{ width: `${Math.max(8, t.percentage)}%` }}
                  className="h-full rounded-full bg-[#0055FF]"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
        <Link href="/draf" className="cursor-pointer">
          <p className="text-2xl font-normal text-[#0A192F]">{draftsCount}</p>
          <p className="text-xs font-bold uppercase text-[#5A6A7E]">DRAF</p>
          <p className="mt-0.5 text-xs text-[#5A6A7E]">Menunggu tinjauan</p>
        </Link>
        <Link
          href="/alert"
          className="cursor-pointer border-l border-slate-100 pl-3"
        >
          <div className="flex items-center justify-between">
            <p className="text-2xl font-normal text-[#0A192F]">
              {unreadAlertsCount}
            </p>
            {unreadAlertsCount > 0 && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-[#C10010]">
                Baru
              </span>
            )}
          </div>
          <p className="text-xs font-bold uppercase text-[#5A6A7E]">
            Alert belum dibaca
          </p>
          <p className="mt-0.5 text-xs text-[#5A6A7E]">Lonjakan terdeteksi</p>
        </Link>
      </div>
    </div>
  );
}
