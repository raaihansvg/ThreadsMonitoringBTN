"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import {
  Settings,
  Plus,
  Trash2,
  ShieldCheck,
  Database,
  Check,
} from "lucide-react";

interface Topic {
  id: string;
  nama: string;
  kataKunci: string[];
  aktif: boolean;
}

export default function TopicsConfigPage() {
  const { role, refreshTrigger, triggerRefresh } = useApp();

  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);

  // Form Tambah Topik
  const [newTopicName, setNewTopicName] = useState("");
  const [newKeywords, setNewKeywords] = useState("");

  // Ambang Alert (State Lokal)
  const [mentionThreshold, setMentionThreshold] = useState(10);
  const [negativeThreshold, setNegativeThreshold] = useState(3);
  const [thresholdSaved, setThresholdSaved] = useState(false);

  // Kata Kunci Risiko
  const [riskKeywords, setRiskKeywords] = useState([
    "penipuan",
    "gagal transfer",
    "saldo hilang",
    "kebocoran data",
    "hoaks",
    "undian palsu",
    "phishing",
  ]);
  const [newRiskKeyword, setNewRiskKeyword] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch("/api/topics")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && Array.isArray(data.topics)) {
          setTopics(data.topics);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [refreshTrigger]);

  const handleAddTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicName.trim()) return;

    const kataKunci = newKeywords
      .split(",")
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);

    try {
      const res = await fetch("/api/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama: newTopicName, kataKunci, aktif: true }),
      });
      if (res.ok) {
        setNewTopicName("");
        setNewKeywords("");
        triggerRefresh();
      } else {
        alert("Gagal menambahkan topik.");
      }
    } catch {
      alert("Terjadi kendala jaringan.");
    }
  };

  const handleDeleteTopic = async (id: string, nama: string) => {
    if (!confirm(`Hapus topik "${nama}" dari sistem?`)) return;
    try {
      const res = await fetch(`/api/topics?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        triggerRefresh();
      } else {
        alert("Gagal menghapus topik.");
      }
    } catch {
      alert("Terjadi kendala jaringan.");
    }
  };

  const handleToggleActive = async (topic: Topic) => {
    if (role !== "petugas") return;
    try {
      const res = await fetch("/api/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: topic.id,
          nama: topic.nama,
          aktif: !topic.aktif,
        }),
      });
      if (res.ok) {
        triggerRefresh();
      }
    } catch {
      alert("Terjadi kendala jaringan.");
    }
  };

  const handleAddRiskKeyword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRiskKeyword.trim()) return;
    if (!riskKeywords.includes(newRiskKeyword.toLowerCase())) {
      setRiskKeywords([...riskKeywords, newRiskKeyword.toLowerCase()]);
    }
    setNewRiskKeyword("");
  };

  const handleRemoveRiskKeyword = (kw: string) => {
    setRiskKeywords(riskKeywords.filter((k) => k !== kw));
  };

  const handleSeedSampleData = async () => {
    if (
      !confirm(
        "Konfirmasi Langkah 1: Apakah Anda ingin mengisi data contoh sintetis ke sistem?"
      )
    ) {
      return;
    }
    if (
      !confirm(
        "Konfirmasi Langkah 2: Data contoh akan ditambahkan untuk demonstrasi. Lanjutkan?"
      )
    ) {
      return;
    }

    try {
      const res = await fetch("/api/sample-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed" }),
      });
      if (res.ok) {
        alert("Data contoh berhasil diisi ke database.");
        triggerRefresh();
      } else {
        alert("Gagal mengisi data contoh.");
      }
    } catch {
      alert("Terjadi kendala jaringan.");
    }
  };

  const handleClearSampleData = async () => {
    if (
      !confirm(
        "Konfirmasi Langkah 1: Apakah Anda yakin ingin menghapus semua data contoh sintetis?"
      )
    ) {
      return;
    }
    if (
      !confirm(
        "Konfirmasi Langkah 2: Data contoh akan dibersihkan dari database. Lanjutkan?"
      )
    ) {
      return;
    }

    try {
      const res = await fetch("/api/sample-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear" }),
      });
      if (res.ok) {
        alert("Semua data contoh berhasil dihapus.");
        triggerRefresh();
      }
    } catch {
      alert("Terjadi kendala jaringan.");
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Card */}
      <div className="flex items-center gap-3 rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EBF3FF] text-[#0055FF]">
          <Settings className="h-5 w-5" strokeWidth={2} />
        </div>
        <div>
          <h2 className="text-base font-bold text-[#0A192F]">
            Konfigurasi Topik dan Ambang Sistem
          </h2>
          <p className="text-xs font-medium text-slate-500">
            Kelola kata kunci pantauan, ambang peringatan alert, dan manajemen
            data contoh.
          </p>
        </div>
      </div>

      {/* Grid Konfigurasi */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Kolom Kiri: Manajemen Topik (8 Kolom) */}
        <div className="space-y-6 lg:col-span-7">
          <div className="space-y-5 rounded-[28px] border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Daftar Topik Pantauan
              </h3>
              <span className="text-xs font-bold text-slate-400">
                {topics.length} Topik Terdaftar
              </span>
            </div>

            {/* Form Tambah Topik (Khusus Petugas) */}
            {role === "petugas" && (
              <form
                onSubmit={handleAddTopic}
                className="space-y-3 rounded-2xl border border-slate-200/80 bg-[#F4F7FB] p-4"
              >
                <div className="text-xs font-bold text-slate-700">
                  Tambah Topik Baru
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input
                    type="text"
                    value={newTopicName}
                    onChange={(e) => setNewTopicName(e.target.value)}
                    placeholder="Nama topik (mis: BTN Syariah)..."
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={newKeywords}
                    onChange={(e) => setNewKeywords(e.target.value)}
                    placeholder="Kata kunci (koma: syariah, akad)..."
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="shadow-2xs flex items-center gap-1.5 rounded-full bg-[#0055FF] px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Tambah Topik</span>
                  </button>
                </div>
              </form>
            )}

            {/* Daftar Tabel Topik */}
            {loading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-16 rounded-xl bg-slate-100" />
                <div className="h-16 rounded-xl bg-slate-100" />
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {topics.map((t) => (
                  <div
                    key={t.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3.5"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[#0A192F]">
                          {t.nama}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            t.aktif
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {t.aktif ? "Aktif" : "Nonaktif"}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        {t.kataKunci.map((kw) => (
                          <span
                            key={kw}
                            className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>

                    {role === "petugas" && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleActive(t)}
                          className={`rounded-full border px-3 py-1 text-xs font-bold transition-colors ${
                            t.aktif
                              ? "border-slate-200 bg-slate-100 text-slate-600"
                              : "border-transparent bg-[#0055FF] text-white"
                          }`}
                        >
                          {t.aktif ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                        <button
                          onClick={() => handleDeleteTopic(t.id, t.nama)}
                          className="p-1 text-slate-400 transition-colors hover:text-[#C10010]"
                          title="Hapus Topik"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Kolom Kanan: Ambang Alert, Kata Kunci Risiko & Data Contoh (5 Kolom) */}
        <div className="space-y-6 lg:col-span-5">
          {/* Ambang Alert */}
          <div className="space-y-4 rounded-[28px] border border-slate-100 bg-white p-6 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Ambang Deteksi Alert
            </h3>
            <p className="text-xs text-slate-500">
              Sistem akan memicu peringatan otomatis saat volume melebihi angka
              berikut:
            </p>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Ambang Lonjakan Mention (per hari)
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={mentionThreshold}
                  onChange={(e) =>
                    setMentionThreshold(parseInt(e.target.value) || 10)
                  }
                  disabled={role !== "petugas"}
                  className="w-full rounded-xl border border-slate-200 bg-[#F4F7FB] px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none disabled:opacity-60"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Ambang Mention Negatif (per hari)
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={negativeThreshold}
                  onChange={(e) =>
                    setNegativeThreshold(parseInt(e.target.value) || 3)
                  }
                  disabled={role !== "petugas"}
                  className="w-full rounded-xl border border-slate-200 bg-[#F4F7FB] px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none disabled:opacity-60"
                />
              </div>
            </div>

            {role === "petugas" && (
              <button
                onClick={() => {
                  setThresholdSaved(true);
                  setTimeout(() => setThresholdSaved(false), 2000);
                }}
                className="shadow-2xs flex w-full items-center justify-center gap-1.5 rounded-full bg-[#0A192F] py-2.5 text-xs font-bold text-white transition-colors hover:bg-slate-800"
              >
                {thresholdSaved ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Ambang Tersimpan</span>
                  </>
                ) : (
                  <span>Simpan Perubahan Ambang</span>
                )}
              </button>
            )}
          </div>

          {/* Kata Kunci Risiko */}
          <div className="space-y-4 rounded-[28px] border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#0055FF]" strokeWidth={2} />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Kata Kunci Risiko
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              Kata kunci yang menaikkan usulan prioritas menjadi{" "}
              <span className="font-bold text-[#E60012]">Perlu Perhatian</span>{" "}
              bila sentimen negatif:
            </p>

            <div className="flex flex-wrap gap-1.5">
              {riskKeywords.map((kw) => (
                <span
                  key={kw}
                  className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-bold text-[#C10010]"
                >
                  <span>#{kw}</span>
                  {role === "petugas" && (
                    <button
                      onClick={() => handleRemoveRiskKeyword(kw)}
                      className="hover:text-red-800"
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
            </div>

            {role === "petugas" && (
              <form onSubmit={handleAddRiskKeyword} className="flex gap-2 pt-2">
                <input
                  type="text"
                  value={newRiskKeyword}
                  onChange={(e) => setNewRiskKeyword(e.target.value)}
                  placeholder="Tambah kata kunci risiko..."
                  className="w-full rounded-xl border border-slate-200 bg-[#F4F7FB] px-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none"
                />
                <button
                  type="submit"
                  className="shadow-2xs shrink-0 rounded-xl bg-[#0055FF] px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
                >
                  Tambah
                </button>
              </form>
            )}
          </div>

          {/* Manajemen Data Contoh */}
          <div className="space-y-4 rounded-[28px] border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-slate-500" strokeWidth={2} />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Kelola Data Contoh
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              Data contoh bertanda khusus dan tidak pernah tercampur dengan data
              nyata dalam laporan ekspor.
            </p>

            {role === "petugas" ? (
              <div className="space-y-2">
                <button
                  onClick={handleSeedSampleData}
                  className="w-full rounded-full border border-[#0055FF]/30 bg-[#EBF3FF] py-2.5 text-xs font-bold text-[#0055FF] transition-colors hover:bg-blue-100"
                >
                  Isi Data Contoh
                </button>
                <button
                  onClick={handleClearSampleData}
                  className="w-full rounded-full border border-rose-200 bg-rose-50 py-2.5 text-xs font-bold text-[#C10010] transition-colors hover:bg-rose-100"
                >
                  Hapus Semua Data Contoh
                </button>
              </div>
            ) : (
              <div className="rounded-2xl bg-[#F4F7FB] p-3 text-xs font-medium text-slate-400">
                Tindakan pengelolaan data contoh hanya dapat dilakukan oleh
                Petugas Input.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
