"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { Calendar, Clock, Download, Check } from "lucide-react";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/mention": "Daftar Mention",
  "/draf": "Antrean Draf",
  "/alert": "Alert & Lonjakan",
  "/topik": "Topik & Konfigurasi",
};

export function SubHeader() {
  const pathname = usePathname();
  const {
    dateRange,
    setDateRange,
    granularity,
    setGranularity,
    showSampleData,
  } = useApp();

  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isDateOpen, setIsDateOpen] = useState(false);

  const title = pageTitles[pathname] || "Dashboard";
  const isDashboard = pathname === "/";

  const dateOptions = [
    {
      label: "11 Okt - 17 Okt 2026",
      startDate: "2026-10-11T00:00:00.000Z",
      endDate: "2026-10-17T23:59:59.999Z",
    },
    {
      label: "04 Okt - 17 Okt 2026",
      startDate: "2026-10-04T00:00:00.000Z",
      endDate: "2026-10-17T23:59:59.999Z",
    },
    {
      label: "17 Sep - 17 Okt 2026",
      startDate: "2026-09-17T00:00:00.000Z",
      endDate: "2026-10-17T23:59:59.999Z",
    },
    {
      label: "Bulan Ini (Okt 2026)",
      startDate: "2026-10-01T00:00:00.000Z",
      endDate: "2026-10-17T23:59:59.999Z",
    },
  ];

  const handleExport = (format: "csv" | "xlsx" | "pdf") => {
    setIsExportOpen(false);
    if (format === "pdf") {
      window.print();
    } else {
      const params = new URLSearchParams({
        format: format === "xlsx" ? "xlsx" : "csv",
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        includeSample: String(showSampleData),
      });
      window.location.href = `/api/export?${params.toString()}`;
    }
  };

  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1
          id="pageTitle"
          className="text-3xl font-normal tracking-tight text-[#0A192F] md:text-4xl"
        >
          {title}
        </h1>
        <p className="mt-0.5 text-xs font-medium text-slate-500 md:text-sm">
          Data berasal dari tautan yang dicatat petugas, bukan pemantauan
          real-time.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Tombol Rentang Tanggal */}
        <div className="relative">
          <button
            onClick={() => setIsDateOpen(!isDateOpen)}
            className="flex items-center gap-2 rounded-full border border-slate-200/60 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300"
            aria-label="Pilih Rentang Tanggal"
          >
            <Calendar className="h-3.5 w-3.5 text-[#0055FF]" strokeWidth={2} />
            <span>{dateRange.label}</span>
          </button>

          {isDateOpen && (
            <div className="absolute right-0 z-30 mt-2 w-64 rounded-2xl border border-slate-100 bg-white py-2 shadow-xl">
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Pilih Periode
              </div>
              {dateOptions.map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => {
                    setDateRange(opt);
                    setIsDateOpen(false);
                  }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <span>{opt.label}</span>
                  {dateRange.label === opt.label && (
                    <Check className="h-4 w-4 text-[#0055FF]" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tombol Granularitas (Hanya di Dashboard) */}
        {isDashboard && (
          <button
            onClick={() =>
              setGranularity(granularity === "Harian" ? "Mingguan" : "Harian")
            }
            className="flex items-center gap-2 rounded-full border border-slate-200/60 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300"
            aria-label="Pilih Granularitas"
          >
            <Clock className="h-3.5 w-3.5 text-[#0055FF]" strokeWidth={2} />
            <span>{granularity}</span>
          </button>
        )}

        {/* Tombol Ekspor dengan Lingkaran Putih Berisi Download */}
        <div className="relative">
          <button
            onClick={() => setIsExportOpen(!isExportOpen)}
            className="flex items-center gap-2.5 rounded-full bg-[#0A192F] py-1.5 pl-4 pr-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#0055FF]"
            aria-label="Ekspor Laporan"
          >
            <span>Ekspor Laporan</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[#0A192F]">
              <Download className="h-3.5 w-3.5" strokeWidth={2.2} />
            </span>
          </button>

          {isExportOpen && (
            <div className="absolute right-0 z-30 mt-2 w-56 rounded-2xl border border-slate-100 bg-white py-2 shadow-xl">
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Format Laporan
              </div>
              <button
                onClick={() => handleExport("csv")}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                <span>Laporan CSV (UTF-8 BOM)</span>
              </button>
              <button
                onClick={() => handleExport("xlsx")}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                <span>Laporan Excel (.xlsx)</span>
              </button>
              <button
                onClick={() => handleExport("pdf")}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                <span>Laporan PDF Ringkasan</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
