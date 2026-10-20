"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import {
  X,
  Upload,
  FileText,
  RefreshCw,
  Download,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import {
  parseBulkPaste,
  MAX_IMPORT_ITEMS,
  processImportQueue,
  ImportResultSummary,
} from "@/lib/ingest/parseImport";

export function ModalImpor() {
  const router = useRouter();
  const { isImportModalOpen, setImportModalOpen, triggerRefresh, showToast } =
    useApp();
  const [activeTab, setActiveTab] = useState<"paste" | "csv">("paste");
  const [pasteContent, setPasteContent] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);
  const [resultSummary, setResultSummary] =
    useState<ImportResultSummary | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isImportModalOpen) return null;

  const downloadCsvTemplate = () => {
    const templateContent =
      "tautan,teks\nhttps://www.threads.net/@nasabah_btn/post/DA12345,Pelayanan teller di Kantor Cabang BTN sangat ramah dan cepat.\nhttps://www.threads.com/@user_properti/post/DB67890,Simulasi KPR BTN sangat membantu dalam merencanakan cicilan rumah pertama.\n";
    const blob = new Blob([templateContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "contoh_impor_threads.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const processItems = async (items: Array<{ url: string; text?: string }>) => {
    setIsProcessing(true);
    setResultSummary(null);

    const summary = await processImportQueue(
      items,
      async (payload) => {
        return await fetch("/api/mentions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      },
      {
        onProgress: (current, total) => {
          setProgressText(`${current} dari ${total} diproses`);
          setProgressPercent(Math.round((current / total) * 100));
        },
      }
    );

    setIsProcessing(false);
    setResultSummary(summary);
    triggerRefresh();
  };

  const handleProcessPaste = () => {
    if (!pasteContent.trim()) {
      showToast("Masukkan tautan terlebih dahulu.", "error");
      return;
    }

    // Tahap 3B: Pecah HANYA pada tanda '|' pertama, sisanya tetap bagian teks. Batas seragam 50 item.
    const { items, totalLines, isTruncated } = parseBulkPaste(
      pasteContent,
      MAX_IMPORT_ITEMS
    );

    if (isTruncated) {
      showToast(
        `Hanya ${MAX_IMPORT_ITEMS} item pertama dari total ${totalLines} baris yang akan diproses.`,
        "info"
      );
    }

    processItems(items);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      const lines = content.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length <= 1) {
        showToast("Berkas CSV kosong atau hanya berisi baris judul.", "error");
        return;
      }

      // Deteksi kolom header
      const headerLine = lines[0].toLowerCase();
      const headers = headerLine
        .split(",")
        .map((h) => h.trim().replace(/"/g, ""));
      const urlIdx =
        headers.indexOf("tautan") !== -1 ? headers.indexOf("tautan") : 0;
      const textIdx =
        headers.indexOf("teks") !== -1 ? headers.indexOf("teks") : 1;

      const parsedItems: Array<{ url: string; text?: string }> = [];
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i];
        if (!row.trim()) continue;
        const cols = row.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        const rawUrl = cols[urlIdx] || "";
        const rawText = cols[textIdx] || "";
        if (rawUrl) {
          parsedItems.push({ url: rawUrl, text: rawText });
        }
      }

      if (parsedItems.length === 0) {
        showToast(
          "Tidak ada baris data yang valid ditemukan dalam berkas CSV.",
          "error"
        );
        return;
      }

      if (parsedItems.length > MAX_IMPORT_ITEMS) {
        showToast(
          `Hanya ${MAX_IMPORT_ITEMS} item pertama dari total ${parsedItems.length} baris CSV yang akan diproses.`,
          "info"
        );
      }

      processItems(parsedItems);
    };

    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-import-title"
    >
      <div className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-[32px] border border-slate-100 bg-white p-6 shadow-2xl sm:p-7">
        <button
          onClick={() => {
            setImportModalOpen(false);
            setResultSummary(null);
          }}
          className="absolute right-5 top-5 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          aria-label="Tutup Modal"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header Modal */}
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EBF3FF] text-[#0055FF]">
            <Upload className="h-5 w-5" strokeWidth={2} />
          </div>
          <div>
            <h2
              id="modal-import-title"
              className="text-lg font-bold tracking-tight text-[#0A192F]"
            >
              Impor Postingan Massal
            </h2>
            <p className="text-xs font-medium text-slate-500">
              Batas 50 item per proses. Semua item berhasil akan masuk ke
              antrean Draf.
            </p>
          </div>
        </div>

        {/* Tab Navigasi */}
        <div className="mb-4 flex border-b border-slate-200">
          <button
            onClick={() => {
              setActiveTab("paste");
              setResultSummary(null);
            }}
            className={`border-b-2 px-4 pb-2.5 text-xs font-bold transition-all ${
              activeTab === "paste"
                ? "border-[#0055FF] text-[#0055FF]"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Tempel Banyak
          </button>
          <button
            onClick={() => {
              setActiveTab("csv");
              setResultSummary(null);
            }}
            className={`border-b-2 px-4 pb-2.5 text-xs font-bold transition-all ${
              activeTab === "csv"
                ? "border-[#0055FF] text-[#0055FF]"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Unggah Berkas CSV
          </button>
        </div>

        {/* Konten Tab */}
        {activeTab === "paste" ? (
          <div className="space-y-4">
            <div>
              <label
                htmlFor="import-paste-input"
                className="mb-1 block text-xs font-bold text-slate-700"
              >
                Daftar Tautan (Format: `tautan` atau `tautan | teks`, maks 50
                item)
              </label>
              <textarea
                id="import-paste-input"
                rows={5}
                value={pasteContent}
                onChange={(e) => setPasteContent(e.target.value)}
                placeholder="https://www.threads.net/@user/post/1&#10;https://www.threads.net/@user/post/2 | Teks postingan contoh"
                className="w-full rounded-2xl border border-slate-200 bg-[#F4F7FB] p-3.5 font-mono text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0055FF]/20"
              />
            </div>

            {/* Progress Bar */}
            {isProcessing && (
              <div className="space-y-1.5 rounded-2xl bg-[#EBF3FF] p-3 text-xs text-[#0055FF]">
                <div className="flex justify-between font-bold">
                  <span>Memproses impor massal...</span>
                  <span>{progressText}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-blue-100">
                  <div
                    style={{ width: `${progressPercent}%` }}
                    className="h-full bg-[#0055FF] transition-all duration-150"
                  />
                </div>
              </div>
            )}

            {/* Hasil Ringkasan Impor */}
            {resultSummary && (
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span>Laporan Hasil Impor</span>
                  <button
                    onClick={() => {
                      setImportModalOpen(false);
                      router.push("/draf");
                    }}
                    className="flex items-center gap-1 text-[#0055FF] hover:underline"
                  >
                    <span>Lihat di Draf</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>

                {resultSummary.rateLimited && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                      <span>Proses Impor Terhenti (Batas Laju Tercapai)</span>
                    </div>
                    <p className="mt-1">
                      Sebanyak{" "}
                      <strong>
                        {resultSummary.belumDiproses} item belum diproses
                      </strong>{" "}
                      karena server membatasi laju permintaan (HTTP 429).
                      Silakan tunggu sekitar{" "}
                      <strong>
                        {resultSummary.retryAfterSeconds ?? 60} detik
                      </strong>{" "}
                      sebelum mencoba lagi.
                    </p>
                    <p className="mt-1 text-amber-800">
                      💡 <strong>Mengimpor ulang aman:</strong> Item yang sudah
                      berhasil disimpan sebelumnya akan otomatis terdeteksi
                      sebagai duplikat dan tidak akan digandakan.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2 font-bold text-emerald-800">
                    <div>{resultSummary.berhasil}</div>
                    <div className="text-xs font-semibold">Berhasil (Draf)</div>
                  </div>
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-2 font-bold text-blue-800">
                    <div>{resultSummary.duplikat}</div>
                    <div className="text-xs font-semibold">Duplikat</div>
                  </div>
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-2 font-bold text-rose-800">
                    <div>{resultSummary.gagal}</div>
                    <div className="text-xs font-semibold">Gagal / Format</div>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-2 font-bold text-amber-800">
                    <div>{resultSummary.belumDiproses}</div>
                    <div className="text-xs font-semibold">Belum Diproses</div>
                  </div>
                </div>

                {resultSummary.problems.length > 0 && (
                  <div className="max-h-28 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2.5 text-xs">
                    {resultSummary.problems.map((p, idx) => (
                      <div key={idx} className="py-1">
                        <span className="font-bold text-slate-700">
                          Baris {p.line}:
                        </span>{" "}
                        <span className="text-[#C10010]">{p.reason}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="rounded-full px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handleProcessPaste}
                disabled={isProcessing || !pasteContent.trim()}
                className="shadow-xs flex items-center gap-1.5 rounded-full bg-[#0055FF] px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    <span>Mulai Impor</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-[#F4F7FB] p-6 text-center">
              <FileText
                className="mx-auto mb-2 h-10 w-10 text-slate-400"
                strokeWidth={1.5}
              />
              <p className="text-xs font-bold text-slate-700">
                Pilih berkas CSV untuk diunggah
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Kolom wajib: <code className="font-bold">tautan</code>, kolom
                opsional: <code className="font-bold">teks</code>
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                id="csv-file-input"
              />

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  className="shadow-2xs rounded-full bg-[#0055FF] px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Pilih Berkas (.csv)
                </button>

                <button
                  type="button"
                  onClick={downloadCsvTemplate}
                  className="shadow-2xs flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Unduh Contoh CSV</span>
                </button>
              </div>
            </div>

            {/* Progress Bar CSV */}
            {isProcessing && (
              <div className="space-y-1.5 rounded-2xl bg-[#EBF3FF] p-3 text-xs text-[#0055FF]">
                <div className="flex justify-between font-bold">
                  <span>Memproses berkas CSV...</span>
                  <span>{progressText}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-blue-100">
                  <div
                    style={{ width: `${progressPercent}%` }}
                    className="h-full bg-[#0055FF] transition-all duration-150"
                  />
                </div>
              </div>
            )}

            {/* Hasil Ringkasan CSV */}
            {resultSummary && (
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span>Laporan Hasil Impor CSV</span>
                  <button
                    onClick={() => {
                      setImportModalOpen(false);
                      router.push("/draf");
                    }}
                    className="flex items-center gap-1 text-[#0055FF] hover:underline"
                  >
                    <span>Lihat di Draf</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>

                {resultSummary.rateLimited && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                      <span>Proses Impor Terhenti (Batas Laju Tercapai)</span>
                    </div>
                    <p className="mt-1">
                      Sebanyak{" "}
                      <strong>
                        {resultSummary.belumDiproses} item belum diproses
                      </strong>{" "}
                      karena server membatasi laju permintaan (HTTP 429).
                      Silakan tunggu sekitar{" "}
                      <strong>
                        {resultSummary.retryAfterSeconds ?? 60} detik
                      </strong>{" "}
                      sebelum mencoba lagi.
                    </p>
                    <p className="mt-1 text-amber-800">
                      💡 <strong>Mengimpor ulang aman:</strong> Item yang sudah
                      berhasil disimpan sebelumnya akan otomatis terdeteksi
                      sebagai duplikat dan tidak akan digandakan.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2 font-bold text-emerald-800">
                    <div>{resultSummary.berhasil}</div>
                    <div className="text-xs font-semibold">Berhasil (Draf)</div>
                  </div>
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-2 font-bold text-blue-800">
                    <div>{resultSummary.duplikat}</div>
                    <div className="text-xs font-semibold">Duplikat</div>
                  </div>
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-2 font-bold text-rose-800">
                    <div>{resultSummary.gagal}</div>
                    <div className="text-xs font-semibold">Gagal / Format</div>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-2 font-bold text-amber-800">
                    <div>{resultSummary.belumDiproses}</div>
                    <div className="text-xs font-semibold">Belum Diproses</div>
                  </div>
                </div>

                {resultSummary.problems.length > 0 && (
                  <div className="max-h-28 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2.5 text-xs">
                    {resultSummary.problems.map((p, idx) => (
                      <div key={idx} className="py-1">
                        <span className="font-bold text-slate-700">
                          Baris {p.line}:
                        </span>{" "}
                        <span className="text-[#C10010]">{p.reason}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
