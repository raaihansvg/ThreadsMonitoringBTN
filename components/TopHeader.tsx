"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { BtnLogo } from "./BtnLogo";
import { useApp } from "@/context/AppContext";
import { formatWIBHeaderDate } from "@/lib/time";
import {
  Plus,
  Upload,
  Database,
  Bell,
  Lock,
  Unlock,
  FlaskConical,
} from "lucide-react";

export function TopHeader() {
  const {
    role,
    showSampleData,
    setShowSampleData,
    openInputModal,
    setImportModalOpen,
    setTokenModalOpen,
    logout,
    refreshTrigger,
    confirmDialog,
  } = useApp();

  const [unreadAlerts, setUnreadAlerts] = useState<number>(0);
  const [headerDate, setHeaderDate] = useState<string>("...");

  useEffect(() => {
    setHeaderDate(formatWIBHeaderDate());
  }, []);

  useEffect(() => {
    fetch(`/api/alerts?filter=unread&includeSample=${showSampleData}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && Array.isArray(data.alerts)) {
          setUnreadAlerts(data.alerts.length);
        }
      })
      .catch(() => setUnreadAlerts(0));
  }, [refreshTrigger, showSampleData]);

  const handleRoleButtonClick = async () => {
    if (role === "petugas") {
      const ok = await confirmDialog({
        title: "Keluar dari sesi Petugas?",
        message:
          "Sesi input Anda akan berakhir dan Anda akan kembali ke mode penonton.",
        confirmLabel: "Keluar",
        cancelLabel: "Batal",
        variant: "primary",
      });
      if (ok) {
        logout();
      }
    } else {
      setTokenModalOpen(true);
    }
  };

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 pb-6">
      <div className="flex items-center gap-3">
        {/* Brand Pill dengan Logo Baru BTN (SVG Presisi) */}
        <div className="flex items-center gap-3.5 rounded-full border border-slate-200/80 bg-white px-4 py-2 shadow-sm">
          <BtnLogo />
          <div className="border-l border-slate-200 pl-3 pr-2">
            <p className="text-xs font-extrabold leading-none tracking-tight text-[#0A192F]">
              Threads Monitoring
            </p>
            <p className="mt-0.5 text-xs text-slate-600">Social Listening</p>
          </div>
        </div>

        {/* Quick Action Bar */}
        <div className="flex items-center gap-1.5 rounded-full border border-slate-200/70 bg-white px-2 py-1.5 shadow-sm">
          {role === "petugas" && (
            <>
              <button
                onClick={() => openInputModal()}
                title="Input Link Baru"
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-700 transition hover:bg-[#0055FF] hover:text-white"
                aria-label="Input Link Baru"
              >
                <Plus className="h-4 w-4" strokeWidth={2.2} />
              </button>
              <button
                onClick={() => setImportModalOpen(true)}
                title="Impor CSV / Antrean Draf"
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-700 transition hover:bg-[#0055FF] hover:text-white"
                aria-label="Impor CSV / Antrean Draf"
              >
                <Upload className="h-4 w-4" strokeWidth={2} />
              </button>
            </>
          )}

          {/* Toggle Data Contoh (Tersedia untuk Penonton & Petugas) */}
          <button
            onClick={() => setShowSampleData(!showSampleData)}
            title={
              showSampleData
                ? "Sembunyikan Data Contoh"
                : "Tampilkan Data Contoh"
            }
            className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
              showSampleData
                ? "bg-[#EBF3FF] text-[#0055FF]"
                : "bg-slate-100 text-slate-400"
            }`}
            aria-label="Toggle Data Contoh"
          >
            <Database className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Kanan Header: Indikator Demo, Alert, & Token Petugas */}
      <div className="flex items-center gap-2.5">
        {showSampleData && (
          <span className="shadow-2xs hidden items-center gap-1.5 rounded-full border border-[#0055FF]/20 bg-white px-3.5 py-2 text-xs font-bold text-[#0055FF] lg:inline-flex">
            <FlaskConical className="h-3.5 w-3.5 text-[#0055FF]" />
            <span>Data Contoh</span>
          </span>
        )}

        <Link
          href="/alert"
          className="flex items-center gap-2.5 rounded-full border border-slate-200/80 bg-white px-4 py-2 text-xs font-bold text-[#0A192F] shadow-sm transition hover:border-[#0055FF]"
          aria-label={`Alert Notifikasi: ${unreadAlerts} belum dibaca`}
        >
          <Bell className="h-4 w-4 text-slate-600" strokeWidth={2} />
          <span>{headerDate}</span>
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#E60012] text-xs font-bold text-white">
            {unreadAlerts}
          </span>
        </Link>

        <button
          id="authBtn"
          onClick={handleRoleButtonClick}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-white shadow-sm transition ${
            role === "petugas"
              ? "bg-[#0055FF] hover:bg-blue-700"
              : "bg-[#0A192F] hover:bg-slate-800"
          }`}
          aria-label={
            role === "petugas"
              ? "Mode Petugas Aktif · Keluar"
              : "Masuk sebagai Petugas"
          }
        >
          {role === "petugas" ? (
            <>
              <Unlock className="h-3.5 w-3.5" strokeWidth={2} />
              <span>Mode Petugas Aktif · Keluar</span>
            </>
          ) : (
            <>
              <Lock className="h-3.5 w-3.5" strokeWidth={2} />
              <span>Masuk sebagai Petugas</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
}
