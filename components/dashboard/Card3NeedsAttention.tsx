import React from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

interface Card3Props {
  needsAttentionCount: number;
}

export function Card3NeedsAttention({ needsAttentionCount }: Card3Props) {
  return (
    <Link
      href="/mention?prioritas=PERLU_PERHATIAN"
      className="flex flex-1 cursor-pointer flex-col justify-between rounded-[28px] border border-[#0055FF]/15 bg-[#EBF3FF] p-5 shadow-sm transition hover:brightness-95"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-[#0055FF]">
          Perlu Perhatian
        </span>
        <AlertTriangle className="h-4 w-4 text-[#E60012]" strokeWidth={2.2} />
      </div>
      <div className="my-2 flex items-baseline gap-1.5">
        <span className="text-5xl font-normal tracking-tight text-[#0A192F]">
          {needsAttentionCount}
        </span>
        <span className="text-xl font-medium text-[#0055FF]">isu</span>
      </div>
      <span className="text-xs font-semibold text-[#0055FF] underline">
        Tinjau prioritas tinggi
      </span>
    </Link>
  );
}
