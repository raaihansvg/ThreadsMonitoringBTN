"use client";

import React, { useState } from "react";
import { useApp } from "@/context/AppContext";
import { Copy, Check, Link as LinkIcon, ArrowRight, Lock } from "lucide-react";

interface Card7Props {
  weeklySummary: {
    headline: string;
    summary: string;
    hasData?: boolean;
  };
}

export function Card7WeeklySummaryQuickInput({ weeklySummary }: Card7Props) {
  const { role, openInputModal, setTokenModalOpen, showToast } = useApp();
  const [copied, setCopied] = useState(false);
  const [quickUrl, setQuickUrl] = useState("");

  const hasData = Boolean(
    weeklySummary?.hasData &&
      (weeklySummary.headline?.trim() || weeklySummary.summary?.trim())
  );

  const handleCopy = async () => {
    if (!hasData) return;
    const textToCopy = `Headline Post:\n${weeklySummary.headline}\n\nSummary Post:\n${weeklySummary.summary}`;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast(
        "Tersalin ke clipboard dalam format kolom Headline Post & Summary Post.",
        "info"
      );
    }
  };

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (role === "petugas") {
      openInputModal(quickUrl.trim());
      setQuickUrl("");
    } else {
      setTokenModalOpen(true);
    }
  };

  return (
    <div className="flex flex-col justify-between rounded-[28px] border border-slate-100 bg-white p-6 shadow-sm lg:col-span-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-medium uppercase tracking-tight text-[#0A192F]">
            RINGKASAN MINGGUAN
          </h2>
          <p className="text-xs text-[#5A6A7E]">
            Format kolom{" "}
            <strong className="text-slate-700">Headline Post</strong> &{" "}
            <strong className="text-slate-700">Summary Post</strong>
          </p>
        </div>
        <button
          onClick={handleCopy}
          disabled={!hasData}
          className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition ${
            hasData
              ? "bg-[#0A192F] text-white hover:bg-[#0055FF]"
              : "cursor-not-allowed bg-slate-200 text-slate-400"
          }`}
          aria-label="Salin Ringkasan Mingguan"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" strokeWidth={2} />
              <span>Tersalin</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" strokeWidth={2} />
              <span>Salin Ringkasan</span>
            </>
          )}
        </button>
      </div>

      {hasData ? (
        <div className="my-3 space-y-1.5 rounded-2xl border border-slate-200/60 bg-[#F4F7FB] p-3 text-xs">
          <p className="truncate">
            <strong>Headline:</strong> {weeklySummary.headline}
          </p>
          <p className="truncate text-[#5A6A7E]">
            <strong>Summary:</strong> {weeklySummary.summary}
          </p>
        </div>
      ) : (
        <div className="my-3 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-[#F4F7FB] p-4 text-center text-xs text-slate-500">
          <p className="font-semibold text-slate-600">
            Belum ada data minggu ini
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Ringkasan akan otomatis terisi saat ada mention yang dicatat pada
            pekan ini.
          </p>
        </div>
      )}

      {/* Bar Input Cepat (Role-Aware) */}
      {role === "petugas" ? (
        <form
          onSubmit={handleQuickSubmit}
          className="flex items-center justify-between gap-2 rounded-full border border-slate-200 bg-[#F4F7FB] p-1.5 pl-4"
        >
          <div className="flex flex-1 items-center gap-2">
            <LinkIcon
              className="h-4 w-4 shrink-0 text-[#0055FF]"
              strokeWidth={2}
            />
            <input
              id="quickUrl"
              type="url"
              value={quickUrl}
              onChange={(e) => setQuickUrl(e.target.value)}
              placeholder="Tempel tautan https://www.threads.com/@.../post/..."
              className="w-full bg-transparent text-xs text-slate-800 placeholder-[#5A6A7E] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="shadow-xs flex h-8 w-8 items-center justify-center rounded-full bg-[#0055FF] text-white transition hover:bg-[#0A192F]"
            aria-label="Analisis tautan"
          >
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        </form>
      ) : (
        <div className="flex items-center justify-between rounded-full border border-slate-200 bg-[#F4F7FB] px-4 py-2.5 text-xs text-[#5A6A7E]">
          <div className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-slate-400" />
            <span>Masuk sebagai Petugas untuk menambah mention.</span>
          </div>
          <button
            type="button"
            onClick={() => setTokenModalOpen(true)}
            className="font-bold text-[#0055FF] hover:underline"
          >
            Masuk
          </button>
        </div>
      )}
    </div>
  );
}
