import React from "react";
import Link from "next/link";

interface TopicStat {
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

export function Card4SentimentByTopic({
  totalMentions,
  topicsBreakdown,
  draftsCount,
  unreadAlertsCount,
}: Card4Props) {
  // Tampilkan topik teratas dan gabungkan sisanya ke "Lainnya" agar jumlah sama dengan total mention
  const mainTopics = topicsBreakdown.slice(0, 3);
  const otherTopics = topicsBreakdown.slice(3);
  const othersCount = otherTopics.reduce((acc, curr) => acc + curr.count, 0);

  const displayList = [...mainTopics];
  if (othersCount > 0) {
    displayList.push({
      nama: "Lainnya",
      count: othersCount,
      percentage: totalMentions > 0 ? (othersCount / totalMentions) * 100 : 0,
      positif: otherTopics.reduce((a, c) => a + c.positif, 0),
      netral: otherTopics.reduce((a, c) => a + c.netral, 0),
      negatif: otherTopics.reduce((a, c) => a + c.negatif, 0),
    });
  }

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
