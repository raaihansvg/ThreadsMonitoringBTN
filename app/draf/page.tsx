"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import {
  Check,
  Trash2,
  ExternalLink,
  Inbox,
  Edit3,
  ChevronUp,
  RefreshCw,
  Loader2,
} from "lucide-react";

interface DraftMention {
  id: string;
  linkAsli: string;
  teksPostingan: string;
  sumberInput: string;
  tanggalDitemukan: string;
  topik: string | null;
  sentimen: "POSITIF" | "NETRAL" | "NEGATIF";
  prioritas: "RUTIN" | "PANTAU" | "PERLU_PERHATIAN";
  headline: string | null;
  ringkasan: string | null;
  kataKunci: string[];
  statusKanonik?: string;
  dikoreksiManual?: boolean;
}

export default function DraftPage() {
  const {
    role,
    refreshTrigger,
    triggerRefresh,
    showSampleData,
    confirmDialog,
    showToast,
  } = useApp();
  const [drafts, setDrafts] = useState<DraftMention[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [analyzingDraftId, setAnalyzingDraftId] = useState<string | null>(null);

  // Edit draft form state
  const [editTeksPostingan, setEditTeksPostingan] = useState("");
  const [editHeadline, setEditHeadline] = useState("");
  const [editRingkasan, setEditRingkasan] = useState("");
  const [editTopik, setEditTopik] = useState("");
  const [editSentimen, setEditSentimen] = useState<
    "POSITIF" | "NETRAL" | "NEGATIF"
  >("NETRAL");
  const [editPrioritas, setEditPrioritas] = useState<
    "RUTIN" | "PANTAU" | "PERLU_PERHATIAN"
  >("RUTIN");

  const [availableTopics, setAvailableTopics] = useState<string[]>([
    "BTN Mobile",
    "KPR BTN",
    "Tapera",
    "Tabungan BTN",
    "Pelayanan & CS",
    "Lainnya",
  ]);

  useEffect(() => {
    fetch("/api/topics")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && Array.isArray(data.topics)) {
          const names = data.topics.map((t: { nama: string }) => t.nama);
          if (!names.includes("Lainnya")) names.push("Lainnya");
          setAvailableTopics(names);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/drafts?includeSample=${showSampleData}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && Array.isArray(data.drafts)) {
          setDrafts(data.drafts);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [refreshTrigger, showSampleData]);

  const startEdit = (d: DraftMention) => {
    if (editingId === d.id) {
      setEditingId(null);
    } else {
      setEditingId(d.id);
      setEditTeksPostingan(d.teksPostingan || "");
      setEditHeadline(d.headline || "");
      setEditRingkasan(d.ringkasan || "");
      setEditTopik(d.topik || "Lainnya");
      setEditSentimen(d.sentimen);
      setEditPrioritas(d.prioritas);
    }
  };

  const handleAction = async (
    id: string,
    action: "approve" | "reject",
    withEdits = false
  ) => {
    if (action === "reject") {
      const ok = await confirmDialog({
        title: "Tolak dan hapus draf?",
        message:
          "Draf postingan ini akan ditolak dan dihapus secara permanen dari sistem. Tindakan ini tidak bisa dibatalkan.",
        confirmLabel: "Tolak Draf",
        cancelLabel: "Batal",
        variant: "danger",
      });
      if (!ok) {
        return;
      }
    }

    if (action === "approve") {
      const targetDraft = drafts.find((d) => d.id === id);
      const effectiveText = withEdits
        ? editTeksPostingan
        : targetDraft?.teksPostingan;
      if (!effectiveText || effectiveText.trim() === "") {
        showToast(
          "Draf tanpa teks tidak dapat disetujui. Silakan klik 'Edit Analisis' dan isi teks postingan terlebih dahulu.",
          "error"
        );
        return;
      }
    }

    const payload: {
      id: string;
      action: "approve" | "reject";
      edits?: Record<string, unknown>;
    } = { id, action };

    if (withEdits) {
      payload.edits = {
        teksPostingan: editTeksPostingan.slice(0, 5000),
        headline: editHeadline.slice(0, 100),
        ringkasan: editRingkasan.slice(0, 400),
        topik: editTopik,
        sentimen: editSentimen,
        prioritas: editPrioritas,
      };
    }

    try {
      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setEditingId(null);
        triggerRefresh();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "Gagal memproses draf.", "error");
      }
    } catch {
      showToast("Terjadi kendala jaringan saat memproses draf.", "error");
    }
  };

  const handleReanalyze = async (d: DraftMention) => {
    if (!d.teksPostingan || d.teksPostingan.trim() === "") {
      showToast("Draf tidak memiliki teks untuk dianalisis.", "error");
      return;
    }

    let confirmOverwrite = false;
    if (d.dikoreksiManual) {
      const ok = await confirmDialog({
        title: "Ganti koreksi manual?",
        message: "Koreksi manual kamu akan diganti hasil AI. Lanjut?",
        confirmLabel: "Lanjut",
        cancelLabel: "Batal",
      });
      if (!ok) return;
      confirmOverwrite = true;
    }

    setAnalyzingDraftId(d.id);
    try {
      const res = await fetch(`/api/drafts/${d.id}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmOverwrite }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        if (data.fallback) {
          showToast("Analisis AI gagal, hasil lama dipertahankan.", "info");
        } else {
          showToast(data.message || "Analisis ulang selesai.", "success");
        }
        setEditingId(null);
        triggerRefresh();
      } else {
        showToast(data.error || "Gagal melakukan analisis ulang.", "error");
      }
    } catch {
      showToast("Terjadi kendala jaringan saat analisis ulang.", "error");
    } finally {
      setAnalyzingDraftId(null);
    }
  };

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="animate-pulse space-y-3">
          <div className="h-32 rounded-[24px] border border-dashed border-slate-300 bg-white" />
          <div className="h-32 rounded-[24px] border border-dashed border-slate-300 bg-white" />
        </div>
      ) : drafts.length === 0 ? (
        <div className="space-y-3 rounded-[24px] border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Inbox className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">
            Tidak ada Draf menunggu tinjauan
          </h3>
          <p className="mx-auto max-w-sm text-xs text-slate-500">
            Semua postingan yang masuk telah ditinjau atau disetujui ke
            dashboard utama.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {drafts.map((d) => {
            const isEditing = editingId === d.id;

            return (
              <div
                key={d.id}
                className="space-y-3 rounded-[24px] border border-dashed border-slate-300 bg-white p-5 shadow-sm transition hover:border-slate-400"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[#EBF3FF] px-3 py-0.5 text-xs font-bold text-[#0055FF]">
                      Sumber:{" "}
                      {d.sumberInput === "EKSTENSI"
                        ? "Ekstensi Chrome"
                        : d.sumberInput === "IMPOR"
                          ? "Impor"
                          : "Form Input"}{" "}
                      • Status: Draf
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      {d.topik || "Lainnya"}
                    </span>
                    {d.statusKanonik === "BELUM_DIKETAHUI" && (
                      <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                        Kanonik belum diketahui
                      </span>
                    )}
                    {(!d.teksPostingan || d.teksPostingan.trim() === "") && (
                      <span className="rounded-full border border-rose-300 bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-[#C10010]">
                        Teks belum diisi (Wajib diisi sebelum disetujui)
                      </span>
                    )}
                  </div>

                  <a
                    href={d.linkAsli}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs font-bold text-[#0055FF] hover:underline"
                  >
                    <span>Buka Tautan Sumber</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                {!isEditing ? (
                  <>
                    <h3 className="text-base font-bold text-[#0A192F]">
                      {d.headline || "Draf Postingan Threads"}
                    </h3>
                    <p className="text-xs text-slate-600">
                      {d.ringkasan ||
                        "Entri ini belum dihitung di Dashboard sampai disetujui oleh Petugas Input."}
                    </p>
                  </>
                ) : (
                  <div className="space-y-3 rounded-2xl border border-[#0055FF]/20 bg-[#F4F7FB] p-4 text-xs">
                    <div className="font-bold text-[#0A192F]">
                      Ubah Hasil Analisis Sebelum Disetujui:
                    </div>

                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                      <div>
                        <label className="font-bold text-slate-700">
                          Topik
                        </label>
                        <select
                          value={editTopik}
                          onChange={(e) => setEditTopik(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2 font-bold text-slate-800 focus:outline-none"
                        >
                          {availableTopics.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="font-bold text-slate-700">
                          Sentimen
                        </label>
                        <select
                          value={editSentimen}
                          onChange={(e) =>
                            setEditSentimen(
                              e.target.value as "POSITIF" | "NETRAL" | "NEGATIF"
                            )
                          }
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2 font-bold text-slate-800 focus:outline-none"
                        >
                          <option value="POSITIF">Positif</option>
                          <option value="NETRAL">Netral</option>
                          <option value="NEGATIF">Negatif</option>
                        </select>
                      </div>

                      <div>
                        <label className="font-bold text-slate-700">
                          Prioritas
                        </label>
                        <select
                          value={editPrioritas}
                          onChange={(e) =>
                            setEditPrioritas(
                              e.target.value as
                                | "RUTIN"
                                | "PANTAU"
                                | "PERLU_PERHATIAN"
                            )
                          }
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2 font-bold text-slate-800 focus:outline-none"
                        >
                          <option value="RUTIN">Rutin</option>
                          <option value="PANTAU">Pantau</option>
                          <option value="PERLU_PERHATIAN">
                            Perlu Perhatian
                          </option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between">
                        <label className="font-bold text-slate-700">
                          Headline
                        </label>
                        <span className="text-xs text-[#5A6A7E]">
                          {editHeadline.length}/100
                        </span>
                      </div>
                      <input
                        type="text"
                        maxLength={100}
                        value={editHeadline}
                        onChange={(e) => setEditHeadline(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2 font-bold text-slate-800 focus:outline-none"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between">
                        <label className="font-bold text-slate-700">
                          Ringkasan
                        </label>
                        <span className="text-xs text-[#5A6A7E]">
                          {editRingkasan.length}/400
                        </span>
                      </div>
                      <textarea
                        rows={3}
                        maxLength={400}
                        value={editRingkasan}
                        onChange={(e) => setEditRingkasan(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2 text-xs text-slate-800 focus:outline-none"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between">
                        <label className="font-bold text-slate-700">
                          Teks Postingan{" "}
                          <span className="text-[#C10010]">*</span>
                        </label>
                        <span className="text-xs text-[#5A6A7E]">
                          {editTeksPostingan.length}/5000
                        </span>
                      </div>
                      <textarea
                        rows={3}
                        maxLength={5000}
                        value={editTeksPostingan}
                        onChange={(e) => setEditTeksPostingan(e.target.value)}
                        placeholder="Wajib isi teks postingan Threads sebelum menyetujui draf..."
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2 text-xs text-slate-800 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-slate-100 bg-[#F4F7FB] p-3 text-xs italic text-slate-600">
                  {d.teksPostingan && d.teksPostingan.trim() ? (
                    <>&ldquo;{d.teksPostingan}&rdquo;</>
                  ) : (
                    <span className="font-medium not-italic text-rose-500">
                      (Teks postingan belum diisi. Petugas wajib mengisi teks
                      sebelum menyetujui draf.)
                    </span>
                  )}
                </div>

                {role === "petugas" && (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(d)}
                        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0055FF]/40"
                      >
                        {isEditing ? (
                          <>
                            <ChevronUp className="h-3.5 w-3.5" />
                            <span>Tutup Edit</span>
                          </>
                        ) : (
                          <>
                            <Edit3 className="h-3.5 w-3.5" />
                            <span>Edit Analisis</span>
                          </>
                        )}
                      </button>

                      {Boolean(d.teksPostingan && d.teksPostingan.trim()) && (
                        <button
                          type="button"
                          onClick={() => handleReanalyze(d)}
                          disabled={analyzingDraftId === d.id}
                          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-[#0055FF] transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-[#0055FF]/40 disabled:opacity-50"
                          title="Analisis ulang dengan AI"
                        >
                          <RefreshCw
                            className={`h-3.5 w-3.5 ${
                              analyzingDraftId === d.id ? "animate-spin" : ""
                            }`}
                          />
                          <span>Analisis Ulang</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAction(d.id, "reject")}
                        className="flex items-center gap-1 rounded-full bg-rose-50 px-3.5 py-1.5 text-xs font-bold text-[#C10010] transition hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Tolak dan Hapus</span>
                      </button>

                      <button
                        onClick={() => handleAction(d.id, "approve", isEditing)}
                        className="shadow-2xs flex items-center gap-1.5 rounded-full bg-[#0055FF] px-4 py-1.5 text-xs font-bold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-[#0055FF]/50"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>
                          {isEditing
                            ? "Simpan & Setujui ke Dashboard"
                            : "Setujui ke Dashboard"}
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Kecil Loading Analisis Ulang AI (Bento Style) */}
      {analyzingDraftId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reanalyze-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-sm rounded-[24px] border border-slate-100 bg-white p-6 shadow-xl">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0055FF]/10 text-[#0055FF]">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
              <div>
                <h3
                  id="reanalyze-modal-title"
                  className="text-sm font-bold text-[#0A192F]"
                >
                  Menganalisis ulang dengan AI...
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Sedang memproses teks postingan untuk memperbarui topik,
                  sentimen, dan ringkasan.
                </p>
              </div>
              <div
                data-testid="bento-reanalyze-skeleton"
                className="w-full animate-pulse space-y-3 rounded-2xl border border-slate-100 bg-[#F4F7FB]/70 p-4 text-left"
              >
                <div className="grid grid-cols-3 gap-2">
                  <div className="h-7 rounded-xl bg-slate-200/70" />
                  <div className="h-7 rounded-xl bg-slate-200/70" />
                  <div className="h-7 rounded-xl bg-slate-200/70" />
                </div>
                <div className="space-y-1">
                  <div className="h-2.5 w-16 rounded bg-slate-200/70" />
                  <div className="h-7 rounded-xl bg-slate-200/70" />
                </div>
                <div className="space-y-1">
                  <div className="h-2.5 w-20 rounded bg-slate-200/70" />
                  <div className="h-12 rounded-xl bg-slate-200/70" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
