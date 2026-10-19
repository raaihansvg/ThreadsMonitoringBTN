"use client";

import React, { useEffect, useRef } from "react";
import { useApp } from "@/context/AppContext";
import { AlertTriangle, HelpCircle } from "lucide-react";

export function ModalConfirm() {
  const { confirmDialogState, closeConfirmDialog } = useApp();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  const isOpen = !!confirmDialogState?.isOpen;
  const options = confirmDialogState?.options;
  const variant = options?.variant || "primary";

  // Fokus awal saat dialog terbuka
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        if (variant === "danger") {
          cancelBtnRef.current?.focus();
        } else {
          confirmBtnRef.current?.focus();
        }
      }, 40);
      return () => clearTimeout(timer);
    }
  }, [isOpen, variant]);

  // Trap focus dan tangani Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeConfirmDialog(false);
        return;
      }

      if (e.key === "Tab" && dialogRef.current) {
        const focusableElements =
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeConfirmDialog]);

  if (!isOpen || !options) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A192F]/40 p-4 backdrop-blur-xs transition-opacity"
      onClick={() => closeConfirmDialog(false)}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-[28px] border border-slate-100 bg-white p-6 shadow-2xl transition-all"
      >
        <div className="flex items-start gap-3.5">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
              variant === "danger"
                ? "bg-[#FEF2F2] text-[#E60012]"
                : "bg-[#EBF3FF] text-[#0055FF]"
            }`}
          >
            {variant === "danger" ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <HelpCircle className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3
              id="confirm-dialog-title"
              className="text-base font-bold leading-snug text-[#0A192F]"
            >
              {options.title}
            </h3>
            <p
              id="confirm-dialog-desc"
              className="mt-2 text-xs leading-relaxed text-slate-600"
            >
              {options.message}
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={() => closeConfirmDialog(false)}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0055FF] focus:ring-offset-2"
          >
            {options.cancelLabel || "Batal"}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={() => closeConfirmDialog(true)}
            className={`rounded-full px-5 py-2 text-xs font-bold text-white shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              variant === "danger"
                ? "bg-[#E60012] hover:bg-red-700 focus:ring-[#E60012]"
                : "bg-[#0055FF] hover:bg-blue-700 focus:ring-[#0055FF]"
            }`}
          >
            {options.confirmLabel || "Lanjutkan"}
          </button>
        </div>
      </div>
    </div>
  );
}
