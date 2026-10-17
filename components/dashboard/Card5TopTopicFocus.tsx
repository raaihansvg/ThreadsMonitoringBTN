import React from "react";

interface Card5Props {
  topTopic: {
    nama: string;
    count: number;
    percentage: number;
  };
}

export function Card5TopTopicFocus({ topTopic }: Card5Props) {
  return (
    <div className="relative flex flex-col justify-between overflow-hidden rounded-[28px] bg-[#0055FF] p-6 text-white shadow-sm lg:col-span-4">
      {/* Aksen Garis Merah terinspirasi dari logo BTN */}
      <div
        aria-hidden="true"
        className="absolute right-8 top-0 h-1.5 w-20 rounded-b-full bg-[#E60012]"
      />

      <div className="flex items-center justify-between">
        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#0055FF]">
          {Math.round(topTopic.percentage)}% Porsi Topik
        </span>
        <span className="text-xs font-bold uppercase text-white/80">
          Topik Teratas
        </span>
      </div>

      <div aria-hidden="true" className="my-5 flex items-center gap-2.5">
        <span className="h-3.5 w-3.5 rounded-full bg-white/30" />
        <span className="h-3.5 w-3.5 rounded-full bg-white/30" />
        <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-[#0055FF]">
          <span className="h-2.5 w-2.5 rounded-full bg-white" />
        </span>
        <span className="h-3.5 w-3.5 rounded-full bg-white/30" />
      </div>

      <div>
        <p className="text-xs font-bold uppercase text-white/75">
          Fokus Pembicaraan Utama
        </p>
        <p className="mt-0.5 text-4xl font-normal tracking-tight text-white">
          {topTopic.nama}
        </p>
      </div>
    </div>
  );
}
