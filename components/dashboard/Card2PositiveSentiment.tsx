import React from "react";

interface Card2Props {
  positivePercentage: string;
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
}

export function Card2PositiveSentiment({
  positivePercentage,
  positiveCount,
  neutralCount,
  negativeCount,
}: Card2Props) {
  return (
    <div className="flex flex-1 flex-col justify-between rounded-[28px] border border-slate-100 bg-white p-5 shadow-sm">
      <span className="text-xs font-semibold text-slate-400">
        Sentimen Positif
      </span>
      <div className="my-2">
        <span className="text-5xl font-normal tracking-tight text-[#0A192F]">
          {positivePercentage}
        </span>
        <span className="text-2xl font-semibold text-[#0055FF]">%</span>
      </div>
      <span className="text-[11px] text-slate-500">
        {positiveCount} positif · {neutralCount} netral · {negativeCount}{" "}
        negatif
      </span>
    </div>
  );
}
