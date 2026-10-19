"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

import { getPresetDateRanges } from "@/lib/time";

export type Role = "penonton" | "petugas";
export type Granularity = "Harian" | "Mingguan";

export interface DateRange {
  startDate: string;
  endDate: string;
  label: string;
}

export interface ToastInfo {
  message: string;
  type?: "success" | "info" | "error";
}

interface AppContextType {
  role: Role;
  isAuthenticated: boolean;
  login: (token: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  // Modals
  isTokenModalOpen: boolean;
  setTokenModalOpen: (open: boolean) => void;
  isInputModalOpen: boolean;
  setInputModalOpen: (open: boolean) => void;
  prefilledUrl: string;
  openInputModal: (url?: string) => void;
  isImportModalOpen: boolean;
  setImportModalOpen: (open: boolean) => void;
  // Global Filters
  showSampleData: boolean;
  setShowSampleData: (show: boolean) => void;
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  granularity: Granularity;
  setGranularity: (g: Granularity) => void;
  selectedTopic: string;
  setSelectedTopic: (topic: string) => void;
  // Data refresh trigger
  refreshTrigger: number;
  triggerRefresh: () => void;
  // Toast notification
  toast: ToastInfo | null;
  showToast: (message: string, type?: "success" | "info" | "error") => void;
  // Dialog Konfirmasi Aksesibel (Tahap 3E)
  confirmDialogState: ConfirmState | null;
  confirmDialog: (options: ConfirmOptions) => Promise<boolean>;
  closeConfirmDialog: (result: boolean) => void;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "primary" | "danger";
}

export interface ConfirmState {
  isOpen: boolean;
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
  triggerElement: HTMLElement | null;
}

const defaultDateRange: DateRange = getPresetDateRanges()[2];

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>("penonton");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Modals
  const [isTokenModalOpen, setTokenModalOpen] = useState(false);
  const [isInputModalOpen, setInputModalOpen] = useState(false);
  const [prefilledUrl, setPrefilledUrl] = useState("");
  const [isImportModalOpen, setImportModalOpen] = useState(false);

  const openInputModal = (url?: string) => {
    if (url) {
      setPrefilledUrl(url);
    }
    setInputModalOpen(true);
  };

  // Filters
  const [showSampleData, setShowSampleData] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>(defaultDateRange);
  const [granularity, setGranularity] = useState<Granularity>("Harian");
  const [selectedTopic, setSelectedTopic] = useState<string>("Semua Topik");

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const triggerRefresh = () => setRefreshTrigger((prev) => prev + 1);

  // Toast notification
  const [toast, setToast] = useState<ToastInfo | null>(null);
  const showToast = (
    message: string,
    type: "success" | "info" | "error" = "success"
  ) => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  // Dialog Konfirmasi Aksesibel (Tahap 3E)
  const [confirmDialogState, setConfirmDialogState] =
    useState<ConfirmState | null>(null);

  const confirmDialog = (options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      const trigger = (
        typeof document !== "undefined" ? document.activeElement : null
      ) as HTMLElement | null;
      setConfirmDialogState({
        isOpen: true,
        options,
        resolve,
        triggerElement: trigger,
      });
    });
  };

  const closeConfirmDialog = (result: boolean) => {
    if (confirmDialogState) {
      confirmDialogState.resolve(result);
      const trigger = confirmDialogState.triggerElement;
      if (trigger && typeof trigger.focus === "function") {
        setTimeout(() => {
          trigger.focus();
        }, 10);
      }
      setConfirmDialogState(null);
    }
  };

  // Check initial session
  useEffect(() => {
    fetch("/api/auth/token")
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated) {
          setIsAuthenticated(true);
          setRole("petugas");
        } else {
          setIsAuthenticated(false);
          setRole("penonton");
        }
      })
      .catch(() => {
        setIsAuthenticated(false);
        setRole("penonton");
      });
  }, []);

  const login = async (token: string) => {
    try {
      const res = await fetch("/api/auth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setIsAuthenticated(true);
        setRole("petugas");
        setTokenModalOpen(false);
        triggerRefresh();
        return { ok: true };
      }
      return { ok: false, error: data.error || "Token tidak valid." };
    } catch {
      return { ok: false, error: "Gagal terhubung ke server." };
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/token", { method: "DELETE" });
      setIsAuthenticated(false);
      setRole("penonton");
      triggerRefresh();
    } catch (err) {
      console.error("Gagal logout:", err);
    }
  };

  return (
    <AppContext.Provider
      value={{
        role,
        isAuthenticated,
        login,
        logout,
        isTokenModalOpen,
        setTokenModalOpen,
        isInputModalOpen,
        setInputModalOpen,
        prefilledUrl,
        openInputModal,
        isImportModalOpen,
        setImportModalOpen,
        showSampleData,
        setShowSampleData,
        dateRange,
        setDateRange,
        granularity,
        setGranularity,
        selectedTopic,
        setSelectedTopic,
        refreshTrigger,
        triggerRefresh,
        toast,
        showToast,
        confirmDialogState,
        confirmDialog,
        closeConfirmDialog,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
