import React from "react";

interface DailyPoint {
  dayLabel: string;
  dateLabel: string;
  count: number;
  isSpike: boolean;
}

interface Card6Props {
  daily7Days: DailyPoint[];
  dailyThreshold: number;
}

export function Card6DailyIndex7Days({ daily7Days }: Card6Props) {
  const maxCount = Math.max(1, ...daily7Days.map((d) => d.count));
  const sevenDayTotal = daily7Days.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <div className="flex flex-col justify-between rounded-[28px] border border-slate-100 bg-white p-6 shadow-sm lg:col-span-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[#5A6A7E]">
          Tren 7 Hari
        </span>
        <span className="rounded-full bg-[#EBF3FF] px-2.5 py-0.5 text-xs font-bold text-[#0055FF]">
          {sevenDayTotal} mention
        </span>
      </div>

      <div className="my-4 flex h-24 items-end justify-between px-3">
        {daily7Days.map((item, idx) => {
          const heightPx = Math.max(
            24,
            Math.round((item.count / maxCount) * 64)
          );

          return (
            <div key={idx} className="flex flex-col items-center">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  item.isSpike ? "bg-[#E60012]" : "bg-[#0055FF]"
                }`}
                title={`${item.dateLabel}: ${item.count} mention`}
              />
              <div
                style={{ height: `${heightPx}px` }}
                className="w-[2px] bg-slate-200"
              />
              <span
                className={`mt-1 text-xs font-bold ${
                  item.isSpike ? "text-[#0A192F]" : "text-slate-700"
                }`}
              >
                {item.dayLabel}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-[#5A6A7E]">
        Distribusi harian minggu berjalan
      </p>
    </div>
  );
}
