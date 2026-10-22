export interface ReanalyzeDraftClientOptions {
  draftId: string;
  confirmOverwrite?: boolean;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  onStart?: () => void;
  onFinish?: () => void;
  onToast?: (message: string, type: "success" | "error" | "info") => void;
  onSuccess?: (data: { fallback?: boolean; message?: string }) => void;
}

export async function reanalyzeDraftClient({
  draftId,
  confirmOverwrite = false,
  timeoutMs = 17000,
  fetchFn = fetch,
  onStart,
  onFinish,
  onToast,
  onSuccess,
}: ReanalyzeDraftClientOptions) {
  onStart?.();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchFn(`/api/drafts/${draftId}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmOverwrite }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      if (data.fallback) {
        onToast?.("Analisis AI gagal, hasil lama dipertahankan.", "info");
      } else {
        onToast?.(data.message || "Analisis ulang selesai.", "success");
      }
      onSuccess?.(data);
      return { ok: true, data };
    } else {
      const errorMsg = data.error || "Gagal melakukan analisis ulang.";
      onToast?.(errorMsg, "error");
      return { ok: false, error: errorMsg };
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      const timeoutMsg = "Analisis ulang melebihi batas waktu (timeout).";
      onToast?.(timeoutMsg, "error");
      return { ok: false, error: timeoutMsg, isTimeout: true };
    }
    const networkMsg = "Terjadi kendala jaringan saat analisis ulang.";
    onToast?.(networkMsg, "error");
    return { ok: false, error: networkMsg };
  } finally {
    clearTimeout(timeoutId);
    onFinish?.();
  }
}
