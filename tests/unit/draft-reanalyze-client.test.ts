import { describe, it, expect, vi } from "vitest";
import { reanalyzeDraftClient } from "@/lib/draft/reanalyze";

describe("reanalyzeDraftClient Unit Tests (Perbaikan Timeout)", () => {
  it("membatalkan request dengan pesan jelas saat timeout terjadi dan tidak meninggalkan state loading", async () => {
    let isLoading = false;
    let toastMessage = "";
    let toastType = "";

    // Mock fetch yang tertahan sampai sinyal abort ditembakkan
    const fetchFn = vi.fn().mockImplementation((_url, init) => {
      return new Promise((_, reject) => {
        const signal = init?.signal as AbortSignal | undefined;
        if (signal) {
          signal.addEventListener("abort", () => {
            const err = new Error("The operation was aborted");
            err.name = "AbortError";
            reject(err);
          });
        }
      });
    });

    const result = await reanalyzeDraftClient({
      draftId: "draft-timeout-test-1",
      timeoutMs: 50, // Timeout singkat untuk pengujian
      fetchFn: fetchFn as unknown as typeof fetch,
      onStart: () => {
        isLoading = true;
      },
      onFinish: () => {
        isLoading = false;
      },
      onToast: (msg, type) => {
        toastMessage = msg;
        toastType = type;
      },
    });

    // 1. Verifikasi fetch menerima abort signal
    expect(fetchFn).toHaveBeenCalledTimes(1);

    // 2. Verifikasi state loading telah dibersihkan kembali ke false (tidak gantung selamanya)
    expect(isLoading).toBe(false);

    // 3. Verifikasi pesan error timeout jelas
    expect(toastType).toBe("error");
    expect(toastMessage).toBe("Analisis ulang melebihi batas waktu (timeout).");

    // 4. Verifikasi return value mengindikasikan status timeout
    expect(result.ok).toBe(false);
    expect(result.isTimeout).toBe(true);
    expect(result.error).toBe("Analisis ulang melebihi batas waktu (timeout).");
  });

  it("berhasil memproses analisis ulang dan mematikan loading state secara aman", async () => {
    let isLoading = false;
    let toastMessage = "";
    let toastType = "";
    let successCalled = false;

    const mockResponseData = {
      ok: true,
      message: "Analisis ulang selesai",
      fallback: false,
      result: { sentimen: "POSITIF" },
    };

    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponseData,
    });

    const result = await reanalyzeDraftClient({
      draftId: "draft-success-test-1",
      timeoutMs: 17000,
      fetchFn: fetchFn as unknown as typeof fetch,
      onStart: () => {
        isLoading = true;
      },
      onFinish: () => {
        isLoading = false;
      },
      onToast: (msg, type) => {
        toastMessage = msg;
        toastType = type;
      },
      onSuccess: () => {
        successCalled = true;
      },
    });

    expect(isLoading).toBe(false);
    expect(successCalled).toBe(true);
    expect(toastType).toBe("success");
    expect(toastMessage).toBe("Analisis ulang selesai");
    expect(result.ok).toBe(true);
  });
});
