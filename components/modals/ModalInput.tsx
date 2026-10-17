"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useApp } from "@/context/AppContext";
import {
  X,
  ShieldCheck,
  Loader2,
  AlertCircle,
  ExternalLink,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";

export function ModalInput() {
  const {
    isInputModalOpen,
    setInputModalOpen,
    prefilledUrl,
    setTokenModalOpen,
    triggerRefresh,
  } = useApp();

  // Wizard Step: 1 = Tempel Tautan & Teks, 2 = Tinjau & Simpan
  const [step, setStep] = useState<1 | 2>(1);

  // Form Fields
  const [url, setUrl] = useState("");
  const [postText, setPostText] = useState("");
  const [topik, setTopik] = useState("BTN Mobile");
  const [sentimen, setSentimen] = useState<"POSITIF" | "NETRAL" | "NEGATIF">(
    "NETRAL"
  );
  const [prioritas, setPrioritas] = useState<
    "RUTIN" | "PANTAU" | "PERLU_PERHATIAN"
  >("RUTIN");
  const [headline, setHeadline] = useState("");
  const [ringkasan, setRingkasan] = useState("");
  const [kataKunciInput, setKataKunciInput] = useState("btn mobile, layanan");

  // State Checks
  const [isCheckingUrl, setIsCheckingUrl] = useState(false);
  const [urlError, setUrlError] = useState("");
  const [duplicateEntry, setDuplicateEntry] = useState<{
    id: string;
    headline: string;
  } | null>(null);
  const [detectedPii, setDetectedPii] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisFailed, setAnalysisFailed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableTopics, setAvailableTopics] = useState<string[]>([
    "BTN Mobile",
    "KPR BTN",
    "Tapera",
    "Tabungan BTN",
    "Pelayanan & CS",
    "Kompetitor",
    "Lainnya",
  ]);

  // Load active topics from API
  useEffect(() => {
    fetch("/api/topics")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && Array.isArray(data.topics) && data.topics.length > 0) {
          const names = data.topics.map((t: { nama: string }) => t.nama);
          if (!names.includes("Lainnya")) names.push("Lainnya");
          setAvailableTopics(names);
        }
      })
      .catch(() => {});
  }, []);

  // Set prefilled URL when opened
  useEffect(() => {
    if (isInputModalOpen) {
      if (prefilledUrl) {
        setUrl(prefilledUrl);
      }
      setStep(1);
      setDuplicateEntry(null);
      setUrlError("");
    }
  }, [isInputModalOpen, prefilledUrl]);

  // Validate and detect duplicate URL
  const checkUrlDuplicate = useCallback(async (testUrl: string) => {
    const trimmed = testUrl.trim();
    if (!trimmed) {
      setUrlError("");
      setDuplicateEntry(null);
      return;
    }

    if (
      !trimmed.startsWith("https://threads.net") &&
      !trimmed.startsWith("https://threads.com") &&
      !trimmed.startsWith("https://www.threads.net") &&
      !trimmed.startsWith("https://www.threads.com")
    ) {
      setUrlError("Gunakan tautan HTTPS dari threads.net atau threads.com.");
      setDuplicateEntry(null);
      return;
    }

    setUrlError("");
    setIsCheckingUrl(true);
    try {
      const res = await fetch(
        `/api/mentions?checkUrl=${encodeURIComponent(trimmed)}`
      );
      const data = await res.json();
      if (data.exists && data.mention) {
        setDuplicateEntry(data.mention);
      } else {
        setDuplicateEntry(null);
      }
    } catch {
      // Silently ignore network check fail
    } finally {
      setIsCheckingUrl(false);
    }
  }, []);

  useEffect(() => {
    if (url) {
      const timer = setTimeout(() => {
        checkUrlDuplicate(url);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setUrlError("");
      setDuplicateEntry(null);
    }
  }, [url, checkUrlDuplicate]);

  // Real-time PII detection on postText
  useEffect(() => {
    const found: string[] = [];
    if (/(?:\+?62|08)[0-9]{8,12}/.test(postText)) {
      found.push("nomor telepon");
    }
    if (/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/.test(postText)) {
      found.push("email");
    }
    if (/\b\d{16}\b/.test(postText)) {
      found.push("NIK");
    }
    if (/\b\d{10,15}\b/.test(postText)) {
      found.push("nomor rekening");
    }
    setDetectedPii(found);
  }, [postText]);

  // Keyboard Escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isInputModalOpen) {
        if (url || postText) {
          if (
            confirm("Tutup formulir? Isian yang belum disimpan akan hilang.")
          ) {
            setInputModalOpen(false);
          }
        } else {
          setInputModalOpen(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isInputModalOpen, url, postText, setInputModalOpen]);

  if (!isInputModalOpen) return null;

  // Mask PII before moving to step 2 or submitting
  const getMaskedText = (raw: string) => {
    return raw
      .replace(
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
        "[EMAIL DISAMARKAN]"
      )
      .replace(/(?:\+?62|08)[0-9]{8,12}/g, "[NO TELP DISAMARKAN]")
      .replace(/\b\d{16}\b/g, "[NIK DISAMARKAN]")
      .replace(/\b\d{10,15}\b/g, "[NO REKENING DISAMARKAN]");
  };

  const handleProceedToStep2 = () => {
    if (!url.trim()) {
      setUrlError("Tautan Threads wajib diisi.");
      return;
    }
    if (duplicateEntry) {
      return;
    }

    const masked = getMaskedText(postText);
    setPostText(masked);

    // Run auto-analysis simulation with fallback
    setIsAnalyzing(true);
    setAnalysisFailed(false);
    setStep(2);

    setTimeout(() => {
      setIsAnalyzing(false);
      // Auto-extract keywords and headline if empty
      if (!headline) {
        const textSample =
          masked || "Mention nasabah terkait produk perbankan Bank BTN.";
        const snippet = textSample.slice(0, 80);
        setHeadline(
          snippet.length > 20
            ? snippet
            : `Perbincangan Nasabah Terkait ${topik}`
        );
      }
      if (!ringkasan) {
        setRingkasan(
          masked
            ? masked.slice(0, 350)
            : `Postingan Threads terkait layanan ${topik} yang dicatat untuk pemantauan social listening.`
        );
      }
    }, 600);
  };

  const handleSaveMention = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const keywords = kataKunciInput
      .split(",")
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);

    try {
      const res = await fetch("/api/mentions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          linkAsli: url.trim(),
          teksPostingan: postText,
          topik,
          sentimen,
          prioritas,
          headline: headline.slice(0, 100),
          ringkasan: ringkasan.slice(0, 400),
          kataKunci: keywords,
          penyediaAnalisis: "manual",
        }),
      });

      const data = await res.json();
      if (res.status === 403) {
        // Token session expired: prompt Token modal without losing filled fields
        alert(
          "Sesi login Petugas telah berakhir. Silakan masukkan token kembali."
        );
        setTokenModalOpen(true);
        return;
      }

      if (!res.ok) {
        alert(data.error || "Gagal menyimpan mention.");
      } else {
        alert("Mention berhasil dicatat dan dipublikasikan ke Dashboard.");
        setInputModalOpen(false);
        triggerRefresh();
      }
    } catch {
      alert("Terjadi kendala jaringan saat menyimpan mention.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-input-title"
    >
      <div className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-[32px] border border-white bg-white p-6 shadow-2xl sm:p-7">
        {/* Tombol Tutup */}
        <button
          onClick={() => {
            if (url || postText) {
              if (
                confirm(
                  "Tutup formulir? Isian yang belum disimpan akan hilang."
                )
              ) {
                setInputModalOpen(false);
              }
            } else {
              setInputModalOpen(false);
            }
          }}
          className="absolute right-5 top-5 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          aria-label="Tutup"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header Modal */}
        <div className="mb-5 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#EBF3FF] px-2.5 py-0.5 text-[10px] font-bold text-[#0055FF]">
              Langkah {step} dari 2
            </span>
            <span className="text-xs font-semibold text-slate-400">
              {step === 1 ? "Tempel Tautan & Teks" : "Tinjau dan Simpan"}
            </span>
          </div>
          <h2
            id="modal-input-title"
            className="mt-1 text-lg font-bold text-[#0A192F]"
          >
            {step === 1
              ? "Catat Postingan Baru dari Threads"
              : "Tinjau Hasil Analisis Mention"}
          </h2>
        </div>

        {/* ===================== LANGKAH 1 ===================== */}
        {step === 1 && (
          <div className="space-y-4 text-xs">
            {/* Banner PII */}
            {detectedPii.length > 0 && (
              <div className="flex items-start gap-2.5 rounded-2xl border border-[#0055FF]/20 bg-[#EBF3FF] p-3 text-[#0A192F]">
                <ShieldCheck className="h-5 w-5 shrink-0 text-[#0055FF]" />
                <div>
                  <strong className="block font-bold">
                    Data sensitif telah disamarkan otomatis
                  </strong>
                  <span className="text-[11px] text-slate-600">
                    Terdeteksi: {detectedPii.join(", ")}. Nomor rekening, NIK,
                    nomor telepon, atau email disembunyikan demi privasi
                    nasabah.
                  </span>
                </div>
              </div>
            )}

            {/* Kolom Tautan Threads */}
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="input-url" className="font-bold text-slate-700">
                  Tautan Postingan Threads (Wajib)
                </label>
                {isCheckingUrl && (
                  <span className="flex items-center gap-1 text-[11px] text-[#0055FF]">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Memeriksa tautan...</span>
                  </span>
                )}
              </div>
              <input
                id="input-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.threads.net/@user/post/..."
                required
                className={`mt-1.5 w-full rounded-2xl border bg-[#F4F7FB] p-3 font-mono text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 ${
                  urlError
                    ? "border-rose-400 focus:ring-rose-200"
                    : duplicateEntry
                      ? "border-[#0055FF]/40 focus:ring-[#0055FF]/20"
                      : "border-slate-200 focus:ring-[#0055FF]/20"
                }`}
              />

              {/* Status Validasi URL */}
              {urlError && (
                <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-[#C10010]">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>{urlError}</span>
                </p>
              )}

              {/* Banner Duplikat */}
              {duplicateEntry && (
                <div className="mt-2 flex items-center justify-between rounded-2xl border border-[#0055FF]/25 bg-[#EBF3FF] p-3 text-[#0A192F]">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-[#0055FF]" />
                    <span className="text-xs font-semibold">
                      Tautan ini sudah tercatat di sistem
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setInputModalOpen(false);
                      window.location.href = `/mention?search=${encodeURIComponent(url.split("?")[0])}`;
                    }}
                    className="flex items-center gap-1 rounded-full bg-[#0055FF] px-3 py-1 text-[11px] font-bold text-white hover:bg-blue-700"
                  >
                    <span>Buka entri lama</span>
                    <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Kolom Teks Postingan */}
            <div>
              <label
                htmlFor="input-post-text"
                className="font-bold text-slate-700"
              >
                Teks Postingan Threads (Opsional jika pratinjau berhasil)
              </label>
              <textarea
                id="input-post-text"
                rows={4}
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                placeholder="Tempel atau ketik teks kutipan postingan Threads di sini..."
                className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-[#F4F7FB] p-3 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0055FF]/20"
              />
            </div>

            {/* Aksi Langkah 1 */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setInputModalOpen(false)}
                className="rounded-full px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!url.trim() || !!urlError || !!duplicateEntry}
                onClick={handleProceedToStep2}
                className="flex items-center gap-1.5 rounded-full bg-[#0055FF] px-5 py-2 text-xs font-bold text-white transition hover:bg-blue-700 disabled:opacity-40"
              >
                <span>Lanjut ke Tinjau</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ===================== LANGKAH 2 ===================== */}
        {step === 2 && (
          <form onSubmit={handleSaveMention} className="space-y-4 text-xs">
            {/* Banner Analisis Gagal (Bila Terjadi) */}
            {analysisFailed && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
                <strong>Analisis otomatis gagal:</strong> Nilai bawaan dipakai
                (Netral, Rutin); mohon periksa sebelum menyimpan.
              </div>
            )}

            {/* Loading Skeleton jika sedang analisis */}
            {isAnalyzing ? (
              <div className="animate-pulse space-y-3 py-4">
                <div className="h-10 rounded-xl bg-slate-100" />
                <div className="h-20 rounded-xl bg-slate-100" />
                <div className="h-10 rounded-xl bg-slate-100" />
              </div>
            ) : (
              <>
                {/* Baris Pilihan Klasifikasi */}
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  <div>
                    <label className="font-bold text-slate-700">Topik</label>
                    <select
                      value={topik}
                      onChange={(e) => setTopik(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F4F7FB] p-2.5 font-bold text-slate-800 focus:outline-none"
                    >
                      {availableTopics.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700">Sentimen</label>
                    <select
                      value={sentimen}
                      onChange={(e) =>
                        setSentimen(
                          e.target.value as "POSITIF" | "NETRAL" | "NEGATIF"
                        )
                      }
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F4F7FB] p-2.5 font-bold text-slate-800 focus:outline-none"
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
                      value={prioritas}
                      onChange={(e) =>
                        setPrioritas(
                          e.target.value as
                            | "RUTIN"
                            | "PANTAU"
                            | "PERLU_PERHATIAN"
                        )
                      }
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F4F7FB] p-2.5 font-bold text-slate-800 focus:outline-none"
                    >
                      <option value="RUTIN">Rutin</option>
                      <option value="PANTAU">Pantau</option>
                      <option value="PERLU_PERHATIAN">Perlu Perhatian</option>
                    </select>
                  </div>
                </div>

                {/* Usulan Headline (Maks 100 Karakter) */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-700">
                      Usulan Headline Postingan
                    </label>
                    <span
                      className={`text-[10px] font-bold ${
                        headline.length > 90
                          ? "text-[#E60012]"
                          : "text-slate-400"
                      }`}
                    >
                      {headline.length}/100
                    </span>
                  </div>
                  <input
                    type="text"
                    maxLength={100}
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    required
                    placeholder="Headline singkat ringkas..."
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F4F7FB] p-2.5 font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0055FF]/20"
                  />
                </div>

                {/* Usulan Ringkasan (Maks 400 Karakter) */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-700">
                      Ringkasan Analisis Sosial Listening
                    </label>
                    <span
                      className={`text-[10px] font-bold ${
                        ringkasan.length > 370
                          ? "text-[#E60012]"
                          : "text-slate-400"
                      }`}
                    >
                      {ringkasan.length}/400
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    maxLength={400}
                    value={ringkasan}
                    onChange={(e) => setRingkasan(e.target.value)}
                    required
                    placeholder="Ringkasan konteks keluhan, saran, atau apresiasi..."
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F4F7FB] p-2.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0055FF]/20"
                  />
                </div>

                {/* Kata Kunci */}
                <div>
                  <label className="font-bold text-slate-700">
                    Kata Kunci (Pisahkan dengan koma)
                  </label>
                  <input
                    type="text"
                    value={kataKunciInput}
                    onChange={(e) => setKataKunciInput(e.target.value)}
                    placeholder="btn mobile, login, error transaksi"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F4F7FB] p-2.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0055FF]/20"
                  />
                </div>

                {/* Keterangan Status Awal */}
                <div className="rounded-xl bg-[#F4F7FB] p-2.5 text-[11px] text-slate-500">
                  Status awal mention yang disimpan langsung adalah{" "}
                  <strong>Baru</strong> dan akan terhitung pada statistik
                  Dashboard.
                </div>
              </>
            )}

            {/* Aksi Langkah 2 */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center gap-1 rounded-full px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Kembali</span>
              </button>

              <button
                type="submit"
                disabled={isSubmitting || isAnalyzing}
                className="shadow-2xs flex items-center gap-1.5 rounded-full bg-[#0055FF] px-5 py-2.5 text-xs font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Simpan Mention</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
