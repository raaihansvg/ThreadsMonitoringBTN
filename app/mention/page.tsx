"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/context/AppContext";
import {
  Search,
  ExternalLink,
  Trash2,
  ChevronLeft,
  ChevronRight,
  FilterX,
  Tag,
} from "lucide-react";

interface Mention {
  id: string;
  linkAsli: string;
  teksPostingan: string;
  sumberInput: string;
  tanggalDitemukan: string;
  topik: string | null;
  sentimen: "POSITIF" | "NETRAL" | "NEGATIF";
  prioritas: "RUTIN" | "PANTAU" | "PERLU_PERHATIAN";
  status: "DRAF" | "BARU" | "DIPANTAU" | "SELESAI";
  headline: string | null;
  ringkasan: string | null;
  kataKunci: string[];
  statusKanonik?: string;
}

function MentionPageContent() {
  const searchParams = useSearchParams();
  const { role, showSampleData, dateRange, refreshTrigger, triggerRefresh } =
    useApp();

  const [mentions, setMentions] = useState<Mention[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [topik, setTopik] = useState("Semua");
  const [sentimen, setSentimen] = useState("");
  const [prioritas, setPrioritas] = useState("");
  const [status, setStatus] = useState("");
  const [topicsList, setTopicsList] = useState<string[]>([]);

  // Initialize from URL search parameters if available
  useEffect(() => {
    const qTopik = searchParams.get("topik");
    const qPrioritas = searchParams.get("prioritas");
    const qSearch = searchParams.get("search");
    if (qTopik) setTopik(qTopik);
    if (qPrioritas) setPrioritas(qPrioritas);
    if (qSearch) setSearch(qSearch);
  }, [searchParams]);

  useEffect(() => {
    fetch("/api/topics")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && Array.isArray(data.topics)) {
          setTopicsList(data.topics.map((t: { nama: string }) => t.nama));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: "20",
      search,
      topik,
      sentimen,
      prioritas,
      status,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      includeSample: String(showSampleData),
    });

    fetch(`/api/mentions?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.mentions) {
          setMentions(data.mentions);
          setTotal(data.total);
          setTotalPages(data.totalPages);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [
    page,
    search,
    topik,
    sentimen,
    prioritas,
    status,
    dateRange,
    showSampleData,
    refreshTrigger,
  ]);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/mentions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        triggerRefresh();
      } else {
        alert("Gagal memperbarui status mention.");
      }
    } catch {
      alert("Terjadi kendala jaringan.");
    }
  };

  const handleDeleteMention = async (id: string) => {
    if (
      !confirm("Apakah Anda yakin ingin menghapus mention ini secara permanen?")
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/mentions/${id}`, { method: "DELETE" });
      if (res.ok) {
        triggerRefresh();
      } else {
        alert("Gagal menghapus mention.");
      }
    } catch {
      alert("Terjadi kendala jaringan.");
    }
  };

  const resetFilter = () => {
    setSearch("");
    setTopik("Semua");
    setSentimen("");
    setPrioritas("");
    setStatus("");
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Filter dan Pencarian Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-slate-100 bg-white p-4 shadow-sm">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Cari kata kunci, topik, atau isi postingan..."
            className="w-full rounded-full border border-slate-200 bg-[#F4F7FB] py-2 pl-10 pr-4 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0055FF]/20"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={topik}
            onChange={(e) => {
              setTopik(e.target.value);
              setPage(1);
            }}
            className="rounded-full border border-slate-200 bg-[#F4F7FB] px-3.5 py-1.5 text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="Semua">Semua Topik</option>
            {topicsList.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <select
            value={sentimen}
            onChange={(e) => {
              setSentimen(e.target.value);
              setPage(1);
            }}
            className="rounded-full border border-slate-200 bg-[#F4F7FB] px-3.5 py-1.5 text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="">Semua Sentimen</option>
            <option value="POSITIF">Positif</option>
            <option value="NETRAL">Netral</option>
            <option value="NEGATIF">Negatif</option>
          </select>

          <select
            value={prioritas}
            onChange={(e) => {
              setPrioritas(e.target.value);
              setPage(1);
            }}
            className="rounded-full border border-slate-200 bg-[#F4F7FB] px-3.5 py-1.5 text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="">Semua Prioritas</option>
            <option value="RUTIN">Rutin</option>
            <option value="PANTAU">Pantau</option>
            <option value="PERLU_PERHATIAN">Perlu Perhatian</option>
          </select>

          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-full border border-slate-200 bg-[#F4F7FB] px-3.5 py-1.5 text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="">Semua Status</option>
            <option value="BARU">Baru</option>
            <option value="DIPANTAU">Dipantau</option>
            <option value="SELESAI">Selesai dicatat</option>
          </select>
        </div>
      </div>

      {/* Ringkasan Jumlah Hasil */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-bold text-slate-500">
          Menampilkan {mentions.length} dari total {total} mention
        </span>
      </div>

      {/* Daftar Kartu Mention Sesuai Prototipe */}
      {loading ? (
        <div className="animate-pulse space-y-3">
          <div className="h-36 rounded-[24px] border border-slate-100 bg-white" />
          <div className="h-36 rounded-[24px] border border-slate-100 bg-white" />
        </div>
      ) : mentions.length === 0 ? (
        <div className="space-y-3 rounded-[24px] border border-slate-100 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <FilterX className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">
            Tidak ada mention yang sesuai dengan filter aktif
          </h3>
          <p className="mx-auto max-w-sm text-xs text-slate-500">
            Coba ubah kata kunci pencarian atau reset filter untuk menampilkan
            kembali seluruh data.
          </p>
          <button
            onClick={resetFilter}
            className="shadow-2xs inline-flex items-center gap-1.5 rounded-full bg-[#0A192F] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-slate-800"
          >
            Reset Filter
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {mentions.map((m) => {
            const isNegative = m.sentimen === "NEGATIF";
            const isPositive = m.sentimen === "POSITIF";

            const formattedDate = new Date(
              m.tanggalDitemukan
            ).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "short",
              year: "numeric",
            });

            return (
              <div
                key={m.id}
                className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm transition hover:border-slate-200"
              >
                {/* Baris Atas Kartu Mention */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* Pill Topik */}
                    <span className="rounded-full bg-[#0A192F] px-3 py-0.5 text-xs font-bold text-white">
                      {m.topik || "Lainnya"}
                    </span>

                    {/* Pill Sentimen */}
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        isPositive
                          ? "bg-[#EBF3FF] text-[#0055FF]"
                          : isNegative
                            ? "bg-[#FEF2F2] text-[#C10010]"
                            : "bg-[#F1F5F9] text-[#475569]"
                      }`}
                    >
                      {m.sentimen === "POSITIF"
                        ? "Positif"
                        : m.sentimen === "NEGATIF"
                          ? "Negatif"
                          : "Netral"}
                    </span>

                    {/* Pill Prioritas */}
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        m.prioritas === "PERLU_PERHATIAN"
                          ? "bg-[#E60012] text-white"
                          : m.prioritas === "PANTAU"
                            ? "bg-[#EBF3FF] text-[#0055FF]"
                            : "bg-[#F1F5F9] text-[#475569]"
                      }`}
                    >
                      {m.prioritas === "PERLU_PERHATIAN"
                        ? "Perlu Perhatian"
                        : m.prioritas === "PANTAU"
                          ? "Pantau"
                          : "Rutin"}
                    </span>

                    {/* Pill Data Contoh */}
                    {m.sumberInput === "CONTOH" && (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                        Contoh
                      </span>
                    )}

                    {/* Pill Status Kanonik */}
                    {m.statusKanonik === "BELUM_DIKETAHUI" && (
                      <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                        Kanonik belum diketahui
                      </span>
                    )}

                    {/* Tanggal Ditemukan */}
                    <span className="text-xs font-medium text-slate-500">
                      • {formattedDate}
                    </span>
                  </div>

                  <a
                    href={m.linkAsli}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs font-bold text-[#0055FF] hover:underline"
                  >
                    <span>Sumber Threads</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                {/* Konten Mention */}
                <h3 className="mt-3 text-base font-bold text-[#0A192F]">
                  {m.headline || "Mention Threads BTN"}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  {m.ringkasan}
                </p>

                <p className="mt-2.5 rounded-2xl border border-slate-100 bg-[#F4F7FB] p-3 text-xs italic text-slate-600">
                  &ldquo;{m.teksPostingan}&rdquo;
                </p>

                {/* Footer Kartu Mention: Kata Kunci di Kiri, Aksi Petugas di Kanan */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {m.kataKunci && m.kataKunci.length > 0 ? (
                      m.kataKunci.map((kw, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
                        >
                          <Tag className="h-2.5 w-2.5 text-slate-400" />
                          <span>{kw}</span>
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-[#5A6A7E]">
                        Tanpa kata kunci
                      </span>
                    )}
                  </div>

                  {role === "petugas" && (
                    <div className="flex items-center gap-2">
                      <select
                        value={m.status}
                        onChange={(e) =>
                          handleUpdateStatus(m.id, e.target.value)
                        }
                        className="rounded-full border border-slate-200 bg-[#F4F7FB] px-3 py-1 text-xs font-bold text-slate-700 focus:outline-none"
                      >
                        <option value="BARU">Baru</option>
                        <option value="DIPANTAU">Dipantau</option>
                        <option value="SELESAI">Selesai dicatat</option>
                      </select>

                      <button
                        onClick={() => handleDeleteMention(m.id)}
                        className="rounded-full p-1 text-slate-400 transition hover:bg-rose-50 hover:text-[#C10010]"
                        title="Hapus Mention"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Paginasi Server */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="shadow-2xs flex items-center gap-1 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Sebelumnya</span>
          </button>
          <span className="text-xs font-bold text-slate-600">
            Halaman {page} dari {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="shadow-2xs flex items-center gap-1 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
          >
            <span>Selanjutnya</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function MentionPage() {
  return (
    <Suspense
      fallback={
        <div className="animate-pulse space-y-3">
          <div className="h-20 rounded-[24px] bg-white" />
          <div className="h-36 rounded-[24px] bg-white" />
        </div>
      }
    >
      <MentionPageContent />
    </Suspense>
  );
}
