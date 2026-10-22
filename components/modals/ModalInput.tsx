"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import {
  X,
  ShieldCheck,
  Loader2,
  AlertCircle,
  AlertTriangle,
  ExternalLink,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { maskPii } from "@/lib/pii";

export function ModalInput() {
  const router = useRouter();
  const {
    isInputModalOpen,
    setInputModalOpen,
    prefilledUrl,
    setTokenModalOpen,
    triggerRefresh,
    showToast,
    confirmDialog,
  } = useApp();

  // Wizard Step: 1 = Tempel Tautan & Teks, 2 = Tinjau & Simpan
  const [step, setStep] = useState<1 | 2>(1);
  const [submitDuplicate, setSubmitDuplicate] = useState<{
    existingId?: string;
    url?: string;
  } | null>(null);
  const [submitError, setSubmitError] = useState<string>("");

  // Form Fields
  const [url, setUrl] = useState("");
  const [postText, setPostText] = useState("");
  const [topik, setTopik] = useState("Lainnya");
  const [sentimen, setSentimen] = useState<"POSITIF" | "NETRAL" | "NEGATIF">(
    "NETRAL"
  );
  const [prioritas, setPrioritas] = useState<
    "RUTIN" | "PANTAU" | "PERLU_PERHATIAN"
  >("RUTIN");
  const [headline, setHeadline] = useState("");
  const [ringkasan, setRingkasan] = useState("");
  const [kataKunciInput, setKataKunciInput] = useState("");
  const [initialAnalysis, setInitialAnalysis] = useState<{
    topik: string;
    sentimen: string;
    prioritas: string;
    headline: string;
    ringkasan: string;
    penyedia: string;
  } | null>(null);

  // State Pratinjau FR-02 (Tahap 3A)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [isTruncated, setIsTruncated] = useState(false);
  const [canonicalUrl, setCanonicalUrl] = useState("");

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
      setSubmitDuplicate(null);
      setSubmitError("");
      setUrlError("");
      setInitialAnalysis(null);
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
    if (!postText) {
      setDetectedPii([]);
      return;
    }
    const { detectedTypes } = maskPii(postText);
    const labelMap: Record<string, string> = {
      EMAIL: "email",
      NOMOR_TELEPON: "nomor telepon",
      NOMOR_KARTU: "nomor kartu",
      NOMOR_IDENTITAS: "NIK",
      NOMOR_REKENING: "nomor rekening",
    };
    setDetectedPii(detectedTypes.map((t) => labelMap[t] || t));
  }, [postText]);

  const handleRequestClose = useCallback(async () => {
    if (url || postText) {
      const ok = await confirmDialog({
        title: "Tutup formulir?",
        message: "Isian formulir yang belum disimpan akan hilang.",
        confirmLabel: "Tutup Formulir",
        cancelLabel: "Batal",
        variant: "danger",
      });
      if (ok) {
        setInputModalOpen(false);
      }
    } else {
      setInputModalOpen(false);
    }
  }, [url, postText, confirmDialog, setInputModalOpen]);

  // Keyboard Escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isInputModalOpen) {
        handleRequestClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isInputModalOpen, handleRequestClose]);

  if (!isInputModalOpen) return null;

  const handleFetchPreview = async () => {
    const trimmed = url.trim();
    if (!trimmed || urlError) return;

    setIsLoadingPreview(true);
    setPreviewError("");
    setIsTruncated(false);

    try {
      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json();
      if (res.ok && data.ok && data.text) {
        setPostText(data.text);
        if (data.canonicalUrl) {
          setCanonicalUrl(data.canonicalUrl);
          if (data.canonicalUrl !== trimmed) {
            checkUrlDuplicate(data.canonicalUrl);
          }
        }
        setIsTruncated(!!data.isTruncated);
        setPreviewError("");
      } else {
        setPostText("");
        setPreviewError(
          data.error ||
            "Teks tidak dapat diambil otomatis. Tempel teks postingan."
        );
      }
    } catch {
      setPostText("");
      setPreviewError(
        "Kendala jaringan saat menghubungi server. Tempel teks postingan."
      );
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleProceedToStep2 = async () => {
    if (!url.trim()) {
      setUrlError("Tautan Threads wajib diisi.");
      return;
    }
    if (duplicateEntry) {
      return;
    }
    if (!postText.trim()) {
      showToast(
        "Teks tidak dapat diambil otomatis. Silakan tempel teks postingan.",
        "info"
      );
      return;
    }

    const { maskedText: masked } = maskPii(postText);
    setPostText(masked);

    // Jalankan analisis via POST /api/analyze (NFR-04, AC-18)
    setIsAnalyzing(true);
    setAnalysisFailed(false);
    setStep(2);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: masked }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (res.ok && data.ok) {
        const analysis = data.data || data;
        const resolvedTopic = analysis.topik || "Lainnya";
        const resolvedSentiment = analysis.sentimen || "NETRAL";
        const resolvedPriority = analysis.prioritas || "RUTIN";
        const resolvedHeadline = analysis.headline || "";
        const resolvedRingkasan = analysis.ringkasan || "";
        const resolvedKeywords = Array.isArray(analysis.kataKunci)
          ? analysis.kataKunci.join(", ")
          : "";

        setTopik(resolvedTopic);
        setSentimen(resolvedSentiment);
        setPrioritas(resolvedPriority);
        setKataKunciInput(resolvedKeywords);
        if (!headline) {
          setHeadline(resolvedHeadline);
        }
        if (!ringkasan) {
          setRingkasan(resolvedRingkasan);
        }
        setInitialAnalysis({
          topik: resolvedTopic,
          sentimen: resolvedSentiment,
          prioritas: resolvedPriority,
          headline: resolvedHeadline,
          ringkasan: resolvedRingkasan,
          penyedia: analysis.penyedia || "keyword",
        });
      } else {
        throw new Error(data?.error || "Gagal menganalisis postingan.");
      }
    } catch {
      clearTimeout(timeoutId);
      // Fallback aman di klien bila server/timeout/rate-limit gagal
      setAnalysisFailed(true);
      const firstLine = masked.split("\n")[0] || masked;
      const fallbackHeadline =
        firstLine.slice(0, 80).trim() || "Perbincangan Nasabah Terkait BTN";
      const fallbackSummary = masked.slice(0, 300).trim();

      setTopik("Lainnya");
      setSentimen("NETRAL");
      setPrioritas("RUTIN");
      setKataKunciInput("");
      if (!headline) setHeadline(fallbackHeadline);
      if (!ringkasan) setRingkasan(fallbackSummary);
      setInitialAnalysis({
        topik: "Lainnya",
        sentimen: "NETRAL",
        prioritas: "RUTIN",
        headline: fallbackHeadline,
        ringkasan: fallbackSummary,
        penyedia: "klien_fallback",
      });
      showToast(
        "Analisis otomatis gagal. Silakan sesuaikan secara manual.",
        "error"
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveMention = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitDuplicate(null);
    setSubmitError("");
    setIsSubmitting(true);

    const keywords = kataKunciInput
      .split(",")
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);

    const isModified = initialAnalysis
      ? topik !== initialAnalysis.topik ||
        sentimen !== initialAnalysis.sentimen ||
        prioritas !== initialAnalysis.prioritas ||
        headline.trim() !== initialAnalysis.headline.trim() ||
        ringkasan.trim() !== initialAnalysis.ringkasan.trim()
      : false;

    try {
      const res = await fetch("/api/mentions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          linkAsli: url.trim(),
          linkTernormalisasi: canonicalUrl || undefined,
          teksPostingan: postText,
          topik,
          sentimen,
          prioritas,
          headline: headline.slice(0, 100),
          ringkasan: ringkasan.slice(0, 400),
          kataKunci: keywords,
          penyediaAnalisis: initialAnalysis?.penyedia || "keyword",
          dikoreksiManual: isModified,
        }),
      });

      const data = await res.json();
      if (res.status === 403) {
        setSubmitError(
          "Sesi login Petugas telah berakhir. Silakan masukkan token kembali."
        );
        setTokenModalOpen(true);
        return;
      }

      if (res.status === 409) {
        setSubmitDuplicate({
          existingId: data.existingId,
          url: url.trim(),
        });
        return;
      }

      if (!res.ok) {
        setSubmitError(data.error || "Gagal menyimpan mention.");
      } else {
        setInputModalOpen(false);
        showToast("Mention berhasil dicatat.");
        triggerRefresh();
        // Reset formulir
        setUrl("");
        setPostText("");
        setHeadline("");
        setRingkasan("");
        setCanonicalUrl("");
        setStep(1);
      }
    } catch {
      setSubmitError("Terjadi kendala jaringan saat menyimpan mention.");
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
          onClick={handleRequestClose}
          className="absolute right-5 top-5 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          aria-label="Tutup"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header Modal */}
        <div className="mb-5 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#EBF3FF] px-2.5 py-0.5 text-xs font-bold text-[#0055FF]">
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

        {/* Banner Duplikat 409 pada submit */}
        {submitDuplicate && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 shadow-sm">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="font-bold text-amber-950">
                  Tautan ini sudah tercatat
                </p>
                <p className="mt-0.5 text-amber-800">
                  Tautan postingan Threads ini sudah pernah disimpan sebelumnya
                  ke sistem.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setInputModalOpen(false);
                const targetSearch = submitDuplicate.url || url.trim();
                router.push(
                  `/mention?search=${encodeURIComponent(targetSearch)}`
                );
              }}
              className="shrink-0 rounded-full bg-amber-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-amber-700"
            >
              Buka entri lama
            </button>
          </div>
        )}

        {/* Banner Error Submit */}
        {submitError && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{submitError}</span>
          </div>
        )}

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
                  <span className="text-xs text-slate-600">
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
                  <span className="flex items-center gap-1 text-xs text-[#0055FF]">
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
                <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-[#C10010]">
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
                      const targetUrl = url.split("?")[0];
                      const existingId = duplicateEntry.id;
                      window.location.href = `/mention?id=${encodeURIComponent(existingId)}&search=${encodeURIComponent(targetUrl)}`;
                    }}
                    className="flex items-center gap-1 rounded-full bg-[#0055FF] px-3 py-1 text-xs font-bold text-white hover:bg-blue-700"
                  >
                    <span>Buka entri lama</span>
                    <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Kolom Teks Postingan */}
            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="input-post-text"
                  className="font-bold text-slate-700"
                >
                  Teks Postingan Threads (Wajib)
                </label>
                <button
                  type="button"
                  disabled={!url.trim() || !!urlError || isLoadingPreview}
                  onClick={handleFetchPreview}
                  className="flex items-center gap-1 rounded-full bg-[#EBF3FF] px-3 py-1 text-xs font-bold text-[#0055FF] transition hover:bg-blue-100 disabled:opacity-40"
                  title="Ambil teks postingan dari tautan secara otomatis (FR-02)"
                >
                  {isLoadingPreview ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Mengambil...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3 w-3" />
                      <span>Ambil Pratinjau Teks</span>
                    </>
                  )}
                </button>
              </div>

              {/* Skeleton Loader saat memuat pratinjau */}
              {isLoadingPreview && (
                <div
                  data-testid="preview-skeleton"
                  className="mt-1.5 flex h-24 w-full animate-pulse flex-col justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-100 p-3.5"
                >
                  <div className="h-3 w-3/4 rounded bg-slate-300"></div>
                  <div className="h-3 w-5/6 rounded bg-slate-200"></div>
                  <div className="h-3 w-1/2 rounded bg-slate-200"></div>
                </div>
              )}

              {/* Pesan Fallback bila pratinjau gagal */}
              {!isLoadingPreview && previewError && (
                <div
                  id="preview-fallback-notice"
                  className="mt-1.5 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                  <span>{previewError}</span>
                </div>
              )}

              {/* Catatan Terpotong */}
              {!isLoadingPreview && isTruncated && (
                <div
                  id="preview-truncated-notice"
                  className="mt-1.5 flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 p-2.5 text-xs text-blue-800"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 text-[#0055FF]" />
                  <span>
                    <strong>Catatan:</strong> Teks postingan mungkin terpotong
                    dari sumber aslinya (&gt;= 480 karakter atau diakhiri
                    elipsis). Periksa kembali sebelum menyimpan.
                  </span>
                </div>
              )}

              {!isLoadingPreview && (
                <textarea
                  id="input-post-text"
                  rows={4}
                  value={postText}
                  onChange={(e) => {
                    setPostText(e.target.value);
                    if (previewError && e.target.value.trim()) {
                      setPreviewError("");
                    }
                  }}
                  placeholder="Tempel teks postingan Threads di sini atau klik 'Ambil Pratinjau Teks'..."
                  className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-[#F4F7FB] p-3 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0055FF]/20"
                />
              )}
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
                disabled={
                  !url.trim() ||
                  !!urlError ||
                  !!duplicateEntry ||
                  !postText.trim()
                }
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
            {analysisFailed && !isAnalyzing && (
              <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                <span>
                  Analisis otomatis gagal. Silakan sesuaikan secara manual.
                </span>
              </div>
            )}

            {/* Loading Skeleton Bento jika sedang analisis */}
            {isAnalyzing ? (
              <div
                data-testid="bento-analysis-skeleton"
                className="animate-pulse space-y-4 rounded-2xl border border-slate-100 bg-[#F4F7FB]/50 p-5"
              >
                <div className="flex items-center gap-2 font-medium text-slate-600">
                  <Loader2 className="h-4 w-4 animate-spin text-[#0055FF]" />
                  <span>Menganalisis postingan...</span>
                </div>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  <div className="h-10 rounded-xl bg-slate-200/70" />
                  <div className="h-10 rounded-xl bg-slate-200/70" />
                  <div className="h-10 rounded-xl bg-slate-200/70" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-3 w-20 rounded bg-slate-200/70" />
                  <div className="h-10 rounded-xl bg-slate-200/70" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-3 w-24 rounded bg-slate-200/70" />
                  <div className="h-20 rounded-xl bg-slate-200/70" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-3 w-20 rounded bg-slate-200/70" />
                  <div className="h-10 rounded-xl bg-slate-200/70" />
                </div>
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
                      className={`text-xs font-bold ${
                        headline.length > 90
                          ? "text-[#C10010]"
                          : "text-[#5A6A7E]"
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
                      className={`text-xs font-bold ${
                        ringkasan.length > 370
                          ? "text-[#C10010]"
                          : "text-[#5A6A7E]"
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
                <div className="rounded-xl bg-[#F4F7FB] p-2.5 text-xs text-[#5A6A7E]">
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
