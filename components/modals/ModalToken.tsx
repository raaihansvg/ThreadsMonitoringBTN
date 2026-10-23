"use client";

import React, { useState } from "react";
import { useApp } from "@/context/AppContext";
import { X, Lock, Eye, EyeOff } from "lucide-react";

export function ModalToken() {
  const { isTokenModalOpen, setTokenModalOpen, login, showToast } = useApp();
  const [tokenInput, setTokenInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isTokenModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    const result = await login(tokenInput);
    setLoading(false);

    if (!result.ok) {
      if (result.error === "Gagal terhubung ke server.") {
        setErrorMsg("Aplikasi tidak dapat dihubungi. Silakan coba lagi nanti.");
      } else {
        setErrorMsg("Kode akses tidak valid. Silakan coba lagi.");
      }
    } else {
      setTokenInput("");
      showToast("Mode Petugas Aktif", "success");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-token-title"
    >
      <div className="animate-in fade-in zoom-in-95 relative w-full max-w-md rounded-[32px] border border-slate-100 bg-white p-6 shadow-2xl duration-150">
        <button
          onClick={() => {
            setTokenModalOpen(false);
            setErrorMsg("");
          }}
          className="absolute right-5 top-5 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          aria-label="Tutup Modal"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EBF3FF] text-[#0055FF]">
            <Lock className="h-5 w-5" strokeWidth={2} />
          </div>
          <div>
            <h3
              id="modal-token-title"
              className="text-lg font-bold tracking-tight text-[#0A192F]"
            >
              Masuk sebagai Petugas
            </h3>
            <p className="text-xs font-medium text-slate-500">
              Masukkan kode akses untuk mengaktifkan kontrol tulis.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="token-input"
              className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700"
            >
              Kode akses petugas
            </label>
            <div className="relative">
              <input
                id="token-input"
                type={showPassword ? "text" : "password"}
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Masukkan kode akses..."
                autoComplete="current-password"
                required
                className="w-full rounded-2xl border border-slate-200 bg-[#F4F7FB] px-4 py-3 pr-10 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-[#0055FF] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0055FF]/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label={
                  showPassword
                    ? "Sembunyikan kode akses"
                    : "Tampilkan kode akses"
                }
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              Kode akses diberikan oleh administrator aplikasi.
            </p>
          </div>

          {errorMsg && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-bold text-[#C10010]">
              {errorMsg}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setTokenModalOpen(false);
                setErrorMsg("");
              }}
              className="rounded-full px-4 py-2.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="shadow-xs rounded-full bg-[#0055FF] px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Memeriksa..." : "Masuk"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
