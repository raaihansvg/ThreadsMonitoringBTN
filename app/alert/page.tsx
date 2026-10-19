"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useApp } from "@/context/AppContext";
import { Check, ArrowRight, BellOff } from "lucide-react";

interface AlertItem {
  id: string;
  jenis: "LONJAKAN" | "PERLU_PERHATIAN";
  topik: string | null;
  periode: string | null;
  jumlah: number;
  ambangDipakai: number | null;
  dibaca: boolean;
  dibuatPada: string;
}

export default function AlertPage() {
  const { role, refreshTrigger, triggerRefresh, showSampleData } = useApp();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/alerts?filter=${filter}&includeSample=${showSampleData}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && Array.isArray(data.alerts)) {
          setAlerts(data.alerts);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [filter, refreshTrigger, showSampleData]);

  const handleMarkAsRead = async (id: string) => {
    try {
      const res = await fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        triggerRefresh();
      } else {
        alert("Gagal menandai alert.");
      }
    } catch {
      alert("Terjadi kendala jaringan.");
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter Tab: Semua / Belum dibaca */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">
          Alert hanya mencerminkan mention yang sudah dicatat.
        </p>
        <div className="shadow-2xs flex items-center rounded-full border border-slate-200 bg-white p-1">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-full px-3.5 py-1 text-xs font-bold transition ${
              filter === "all"
                ? "shadow-xs bg-[#0A192F] text-white"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Semua Alert
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`rounded-full px-3.5 py-1 text-xs font-bold transition ${
              filter === "unread"
                ? "shadow-xs bg-[#0055FF] text-white"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Belum Dibaca
          </button>
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3">
          <div className="h-24 rounded-[24px] border-l-4 border-[#E60012] bg-white" />
          <div className="h-24 rounded-[24px] border-l-4 border-[#E60012] bg-white" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="space-y-3 rounded-[24px] border border-slate-100 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <BellOff className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">
            Belum ada alert aktif
          </h3>
          <p className="mx-auto max-w-sm text-xs text-slate-500">
            Tidak ada lonjakan volume atau isu berisiko tinggi yang terdeteksi
            saat ini.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((a) => (
            <div
              key={a.id}
              className={`flex flex-col justify-between gap-3 rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center ${
                a.jenis === "LONJAKAN"
                  ? "border-l-4 border-l-[#E60012]"
                  : "border-l-4 border-l-[#0055FF]"
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      a.jenis === "LONJAKAN"
                        ? "bg-red-50 text-[#C10010]"
                        : "bg-[#EBF3FF] text-[#0055FF]"
                    }`}
                  >
                    {a.jenis === "LONJAKAN"
                      ? "LONJAKAN HARIAN"
                      : "PERLU PERHATIAN"}
                  </span>
                  {!a.dibaca && (
                    <span className="shadow-xs rounded-full bg-[#E60012] px-2 py-0.5 text-xs font-bold text-white">
                      Baru
                    </span>
                  )}
                </div>

                <h3 className="mt-2 text-sm font-bold text-[#0A192F]">
                  {a.jenis === "LONJAKAN"
                    ? `Lonjakan mention topik ${a.topik || "Umum"} (+${a.jumlah} mention)`
                    : `Isu berisiko tinggi terdeteksi pada topik ${a.topik || "Umum"}`}
                </h3>

                <p className="mt-1 text-xs text-[#5A6A7E]">
                  Periode:{" "}
                  {a.periode ||
                    new Date(a.dibuatPada).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      timeZone: "Asia/Jakarta",
                    })}{" "}
                  • Ambang dipakai:{" "}
                  {a.ambangDipakai ?? (a.jenis === "LONJAKAN" ? 10 : 3)}{" "}
                  mention/hari
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                <Link
                  href={`/mention?topik=${encodeURIComponent(a.topik || "")}`}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#0055FF] hover:underline"
                >
                  <span>Lihat mention</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>

                {role === "petugas" && !a.dibaca && (
                  <button
                    onClick={() => handleMarkAsRead(a.id)}
                    className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 transition hover:bg-slate-200"
                  >
                    <Check className="h-3 w-3" />
                    <span>Tandai dibaca</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
