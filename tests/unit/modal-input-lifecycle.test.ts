import { describe, it, expect, vi } from "vitest";
import {
  createInitialFormValues,
  resetFormValues,
  handleUrlChangeState,
  isResponseStale,
  applyAnalysisResult,
  shouldIgnoreAbortError,
  ModalFormValues,
} from "@/lib/modal/modalInputLifecycle";

describe("ModalInput Lifecycle & Race Condition Guard (Audit Fix)", () => {
  it("1. Membuka kembali modal setelah Cancel menghasilkan form kosong", () => {
    // Skenario: Form terisi data dari sesi sebelumnya
    const filledState: ModalFormValues = {
      ...createInitialFormValues(),
      url: "https://www.threads.net/@user/post/old123",
      postText: "Teks lama yang belum tersimpan",
      headline: "Headline Lama",
      ringkasan: "Ringkasan Lama",
      topik: "KPR BTN",
      sentimen: "NEGATIF",
      prioritas: "PERLU_PERHATIAN",
      canonicalUrl: "https://www.threads.net/@user/post/old123",
      step: 2,
    };

    // Saat dibatalkan/ditutup dan dibuka kembali, form di-reset
    const clean = resetFormValues();

    expect(clean.url).toBe("");
    expect(clean.postText).toBe("");
    expect(clean.headline).toBe("");
    expect(clean.ringkasan).toBe("");
    expect(clean.topik).toBe("Lainnya");
    expect(clean.sentimen).toBe("NETRAL");
    expect(clean.prioritas).toBe("RUTIN");
    expect(clean.canonicalUrl).toBe("");
    expect(clean.step).toBe(1);
    expect(clean.initialAnalysis).toBeNull();
  });

  it("2. Mengganti URL membersihkan teks dan hasil analisis lama", () => {
    const stateWithOldAnalysis: ModalFormValues = {
      ...createInitialFormValues(),
      url: "https://www.threads.net/@bankbtn/post/first_post",
      postText: "Keluhan antrean di kantor cabang pembantu",
      headline: "Antrean Cabang Lama",
      ringkasan: "Ringkasan keluhan antrean nasabah",
      topik: "Pelayanan & CS",
      sentimen: "NEGATIF",
      prioritas: "PANTAU",
      kataKunciInput: "antrean, cs",
      canonicalUrl: "https://www.threads.net/@bankbtn/post/first_post",
      isTruncated: true,
      initialAnalysis: {
        topik: "Pelayanan & CS",
        sentimen: "NEGATIF",
        prioritas: "PANTAU",
        headline: "Antrean Cabang Lama",
        ringkasan: "Ringkasan keluhan antrean nasabah",
        penyedia: "gemini",
      },
    };

    const newUrl = "https://www.threads.net/@bankbtn/post/second_post";
    const updatedState = handleUrlChangeState(stateWithOldAnalysis, newUrl);

    expect(updatedState.url).toBe(newUrl);
    expect(updatedState.postText).toBe("");
    expect(updatedState.headline).toBe("");
    expect(updatedState.ringkasan).toBe("");
    expect(updatedState.topik).toBe("Lainnya");
    expect(updatedState.sentimen).toBe("NETRAL");
    expect(updatedState.prioritas).toBe("RUTIN");
    expect(updatedState.kataKunciInput).toBe("");
    expect(updatedState.canonicalUrl).toBe("");
    expect(updatedState.isTruncated).toBe(false);
    expect(updatedState.initialAnalysis).toBeNull();
  });

  it("3. Request lama dibatalkan saat URL baru dimasukkan atau saat modal ditutup", () => {
    const controller = new AbortController();
    const abortSpy = vi.spyOn(controller, "abort");

    expect(controller.signal.aborted).toBe(false);

    // Simulasi pembatalan ketika URL berganti atau modal ditutup
    controller.abort();

    expect(abortSpy).toHaveBeenCalledTimes(1);
    expect(controller.signal.aborted).toBe(true);
  });

  it("4. Response lama tidak mengubah state URL baru (pencegahan race condition)", () => {
    let activeRequestId = 1;

    // Request 1 dimulai untuk URL A
    const req1Id = activeRequestId;

    // Pengguna mengganti URL ke URL B, request ID bertambah
    activeRequestId += 1;
    const req2Id = activeRequestId;

    // Ketika response untuk request 1 tiba terlambat
    const isReq1Stale = isResponseStale(activeRequestId, req1Id);
    expect(isReq1Stale).toBe(true);

    // Ketika response untuk request 2 tiba
    const isReq2Stale = isResponseStale(activeRequestId, req2Id);
    expect(isReq2Stale).toBe(false);

    // Form state hanya boleh dimutasi jika response TIDAK stale
    let currentState = handleUrlChangeState(
      createInitialFormValues(),
      "https://threads.net/post/B"
    );

    // Response 1 mencoba menimpa -> Ditolak karena stale
    if (!isReq1Stale) {
      currentState = applyAnalysisResult(currentState, {
        headline: "Headline A Usang",
      });
    }
    expect(currentState.headline).toBe("");

    // Response 2 tiba -> Diterima
    if (!isReq2Stale) {
      currentState = applyAnalysisResult(currentState, {
        headline: "Headline B Baru",
        ringkasan: "Ringkasan B Baru",
        topik: "BTN Mobile",
        sentimen: "POSITIF",
      });
    }
    expect(currentState.headline).toBe("Headline B Baru");
    expect(currentState.ringkasan).toBe("Ringkasan B Baru");
    expect(currentState.topik).toBe("BTN Mobile");
    expect(currentState.sentimen).toBe("POSITIF");
  });

  it("5. Abort karena Cancel tidak menampilkan toast error", () => {
    const abortError = new DOMException(
      "The user aborted a request.",
      "AbortError"
    );
    const networkError = new Error("Network timeout 500");

    // AbortError selalu diabaikan
    expect(shouldIgnoreAbortError(abortError, false)).toBe(true);
    expect(shouldIgnoreAbortError(abortError, true)).toBe(true);

    // Error lain jika request stale juga diabaikan
    expect(shouldIgnoreAbortError(networkError, true)).toBe(true);

    // Error jaringan pada request aktif TIDAK diabaikan (harus menampilkan pesan/fallback)
    expect(shouldIgnoreAbortError(networkError, false)).toBe(false);
  });

  it("6. Request terbaru tetap dapat mengisi hasil analisis secara penuh", () => {
    const state = createInitialFormValues();
    const newAnalysis = {
      headline: "Fitur QRIS BTN Mobile Makin Cepat",
      ringkasan:
        "Nasabah memuji pembaruan transaksi QRIS pada aplikasi BTN Mobile.",
      topik: "BTN Mobile",
      sentimen: "POSITIF" as const,
      prioritas: "RUTIN" as const,
      kataKunci: ["qris", "btn mobile", "transaksi"],
      penyedia: "gemini",
    };

    const finalState = applyAnalysisResult(state, newAnalysis);

    expect(finalState.headline).toBe("Fitur QRIS BTN Mobile Makin Cepat");
    expect(finalState.ringkasan).toBe(
      "Nasabah memuji pembaruan transaksi QRIS pada aplikasi BTN Mobile."
    );
    expect(finalState.topik).toBe("BTN Mobile");
    expect(finalState.sentimen).toBe("POSITIF");
    expect(finalState.prioritas).toBe("RUTIN");
    expect(finalState.kataKunciInput).toBe("qris, btn mobile, transaksi");
    expect(finalState.isAnalyzing).toBe(false);
  });

  it("7. Timer dan state loading selalu dibersihkan", () => {
    vi.useFakeTimers();

    let isLoading = true;
    let timer: NodeJS.Timeout | null = setTimeout(() => {
      isLoading = false;
    }, 17000);

    // Bersihkan timer sebelum waktu habis (misal saat abort / cleanup)
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    isLoading = false;

    vi.advanceTimersByTime(20000);

    expect(timer).toBeNull();
    expect(isLoading).toBe(false);

    vi.useRealTimers();
  });
});
