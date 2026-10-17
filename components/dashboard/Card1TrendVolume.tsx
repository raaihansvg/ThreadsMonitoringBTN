"use client";

import React, { useState } from "react";
import { useApp } from "@/context/AppContext";
import { Table, BarChart2 } from "lucide-react";

interface TrendBar {
  label: string;
  count: number;
  isSpike: boolean;
  isPeak: boolean;
}

interface Card1Props {
  totalMentions: number;
  growthText: string;
  isGrowthPositive: boolean;
  negativeCount: number;
  negativePercentage: string;
  dailyThreshold: number;
  isWeeklyAggregation: boolean;
  trendBars: TrendBar[];
  topicsList: string[];
}

export function Card1TrendVolume({
  totalMentions,
  growthText,
  negativeCount,
  negativePercentage,
  dailyThreshold,
  isWeeklyAggregation,
  trendBars,
  topicsList,
}: Card1Props) {
  const { selectedTopic, setSelectedTopic } = useApp();
  const [showTable, setShowTable] = useState(false);

  const maxCount = Math.max(1, ...trendBars.map((b) => b.count));
  const hasData = totalMentions > 0 && trendBars.some((b) => b.count > 0);

  return (
    <div className="flex flex-col justify-between rounded-[28px] border border-slate-100 bg-white p-6 shadow-sm lg:col-span-7">
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3.5 w-3.5 rounded bg-[#0055FF]" />
            <span className="text-xs font-bold text-slate-800">
              Analytics • Tren Mention & Deteksi Lonjakan
            </span>
          </div>
          <div className="flex items-center gap-3">
            {isWeeklyAggregation && (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-[#5A6A7E]">
                Ditampilkan mingguan
              </span>
            )}
            <span className="text-xs font-bold text-[#5A6A7E]">
              Ambang: {dailyThreshold}/hari
            </span>
            <button
              onClick={() => setShowTable(!showTable)}
              className="text-[#5A6A7E] transition hover:text-[#0055FF]"
              title={showTable ? "Lihat Grafik" : "Lihat Tabel"}
              aria-label={showTable ? "Lihat Grafik" : "Lihat Tabel"}
            >
              {showTable ? (
                <BarChart2 className="h-4 w-4" />
              ) : (
                <Table className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-baseline gap-8">
          <div className="flex items-baseline gap-2.5">
            <span className="text-xs font-medium text-[#5A6A7E]">Total</span>
            <span className="text-4xl font-normal tracking-tight text-[#0A192F]">
              {totalMentions}
            </span>
            <span className="text-xs font-bold uppercase text-[#5A6A7E]">
              Mention
            </span>
            <span className="rounded-full bg-[#EBF3FF] px-2.5 py-0.5 text-xs font-bold text-[#0055FF]">
              {growthText}
            </span>
          </div>
          <div className="flex items-baseline gap-2.5">
            <span className="text-xs font-medium text-[#5A6A7E]">Negatif</span>
            <span className="text-4xl font-normal tracking-tight text-[#0A192F]">
              {negativeCount}
            </span>
            <span className="text-xs font-bold uppercase text-[#5A6A7E]">
              Isu
            </span>
            <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-bold text-[#C10010]">
              {negativePercentage}% dari total
            </span>
          </div>
        </div>
      </div>

      {/* Bar Chart Kapsul / Tabel Alternatif */}
      {showTable ? (
        <div className="my-6 max-h-36 overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 border-b border-slate-100 bg-slate-50 font-bold text-[#5A6A7E]">
              <tr>
                <th className="p-2">Tanggal</th>
                <th className="p-2">Jumlah</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {trendBars.map((b) => (
                <tr key={b.label}>
                  <td className="p-2 font-medium text-slate-700">{b.label}</td>
                  <td className="p-2 font-bold text-[#0A192F]">{b.count}</td>
                  <td className="p-2">
                    {b.isSpike ? (
                      <span className="font-bold text-[#C10010]">Lonjakan</span>
                    ) : b.isPeak && b.count > 0 ? (
                      <span className="font-bold text-[#0055FF]">
                        Tertinggi
                      </span>
                    ) : (
                      <span className="text-[#5A6A7E]">Normal</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !hasData ? (
        /* Keadaan Kosong (Empty State) bila tidak ada data */
        <div className="my-6 flex h-36 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-center">
          <p className="text-xs font-bold text-[#5A6A7E]">
            Belum ada data mention pada rentang waktu ini
          </p>
          <p className="mt-1 text-xs text-[#5A6A7E]">
            Pilih rentang tanggal lain atau gunakan tombol Tambah Mention.
          </p>
        </div>
      ) : (
        <div
          role="img"
          aria-label={`Grafik tren volume mention dengan total ${totalMentions} mention dan ${negativeCount} isu negatif.`}
          className="my-6 flex h-36 items-end justify-between gap-2 px-2"
        >
          {trendBars.map((b) => {
            // Tinggi batang minimum 4px untuk nilai > 0
            const heightPercent =
              b.count > 0 ? Math.max(5, (b.count / maxCount) * 100) : 0;

            return (
              <div
                key={b.label}
                tabIndex={0}
                aria-label={`${b.label}: ${b.count} mention${b.isSpike ? ", lonjakan" : ""}`}
                className="flex flex-1 flex-col items-center rounded-lg p-0.5 focus:outline-none focus:ring-1 focus:ring-[#0055FF]"
              >
                {b.isSpike && b.count > 0 && (
                  <span className="mb-1 text-xs font-bold text-[#C10010]">
                    Lonjakan
                  </span>
                )}
                {/* Label Tertinggi hanya tampil bila ada batang (> 0) */}
                {b.isPeak && b.count > 0 && !b.isSpike && (
                  <span className="mb-1 text-xs font-bold text-[#0055FF]">
                    Tertinggi
                  </span>
                )}
                <div
                  style={{
                    height: `${heightPercent}%`,
                    minHeight: b.count > 0 ? "4px" : "0px",
                  }}
                  className={`w-4 rounded-full transition-all ${
                    b.count === 0
                      ? "bg-transparent"
                      : b.isSpike
                        ? "bg-[#E60012] shadow-sm"
                        : b.isPeak
                          ? "bg-[#0055FF]"
                          : "bg-slate-200"
                  }`}
                />
                <span
                  className={`mt-2 max-w-full truncate text-center text-xs ${
                    b.isSpike || b.isPeak
                      ? "font-bold text-[#0A192F]"
                      : "text-[#5A6A7E]"
                  }`}
                >
                  {b.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Filter Topik Kapsul */}
      <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2">
        <button
          onClick={() => setSelectedTopic("Semua Topik")}
          className={`rounded-full px-3.5 py-1.5 text-xs transition ${
            selectedTopic === "Semua Topik" || selectedTopic === "Semua"
              ? "bg-[#0055FF] font-bold text-white"
              : "bg-slate-100 font-semibold text-slate-700 hover:bg-slate-200"
          }`}
        >
          Semua Topik
        </button>
        {topicsList.map((t) => (
          <button
            key={t}
            onClick={() => setSelectedTopic(t)}
            className={`rounded-full px-3.5 py-1.5 text-xs transition ${
              selectedTopic === t
                ? "bg-[#0055FF] font-bold text-white"
                : "bg-slate-100 font-semibold text-slate-700 hover:bg-slate-200"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}
