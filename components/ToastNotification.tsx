"use client";

import React from "react";
import { useApp } from "@/context/AppContext";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";

export function ToastNotification() {
  const { toast } = useApp();

  if (!toast) return null;

  const isError = toast.type === "error";
  const isInfo = toast.type === "info";

  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-fade-in fixed bottom-6 right-6 z-50 flex max-w-sm items-center gap-3 rounded-2xl border border-white/20 bg-[#0A192F] px-5 py-3.5 text-xs font-semibold text-white shadow-2xl backdrop-blur-md"
    >
      {isError ? (
        <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
      ) : isInfo ? (
        <Info className="h-4 w-4 shrink-0 text-blue-400" />
      ) : (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
      )}
      <span className="flex-1 leading-snug">{toast.message}</span>
    </div>
  );
}
