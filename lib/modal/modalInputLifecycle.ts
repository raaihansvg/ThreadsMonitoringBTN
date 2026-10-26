/**
 * Helper murni untuk pengelolaan lifecycle state form ModalInput,
 * pencegahan stale response (race condition), dan pembatalan AbortController.
 */

export interface ModalFormValues {
  url: string;
  postText: string;
  topik: string;
  sentimen: "POSITIF" | "NETRAL" | "NEGATIF";
  prioritas: "RUTIN" | "PANTAU" | "PERLU_PERHATIAN";
  headline: string;
  ringkasan: string;
  kataKunciInput: string;
  canonicalUrl: string;
  isTruncated: boolean;
  isLoadingPreview: boolean;
  previewError: string;
  previewCooldown: number;
  urlError: string;
  duplicateEntry: {
    id: string;
    headline: string;
    status?: string;
    sumberInput?: string;
  } | null;
  detectedPii: string[];
  isAnalyzing: boolean;
  analysisFailed: boolean;
  isSubmitting: boolean;
  submitDuplicate: {
    existingId?: string;
    status?: string;
    sumberInput?: string;
    url?: string;
  } | null;
  submitError: string;
  step: 1 | 2;
  initialAnalysis: {
    topik: string;
    sentimen: string;
    prioritas: string;
    headline: string;
    ringkasan: string;
    penyedia: string;
  } | null;
}

export function createInitialFormValues(
  defaultTopic = "Lainnya"
): ModalFormValues {
  return {
    url: "",
    postText: "",
    topik: defaultTopic,
    sentimen: "NETRAL",
    prioritas: "RUTIN",
    headline: "",
    ringkasan: "",
    kataKunciInput: "",
    canonicalUrl: "",
    isTruncated: false,
    isLoadingPreview: false,
    previewError: "",
    previewCooldown: 0,
    urlError: "",
    duplicateEntry: null,
    detectedPii: [],
    isAnalyzing: false,
    analysisFailed: false,
    isSubmitting: false,
    submitDuplicate: null,
    submitError: "",
    step: 1,
    initialAnalysis: null,
  };
}

export function resetFormValues(defaultTopic = "Lainnya"): ModalFormValues {
  return createInitialFormValues(defaultTopic);
}

export function handleUrlChangeState(
  prevState: ModalFormValues,
  newUrl: string
): ModalFormValues {
  return {
    ...prevState,
    url: newUrl,
    postText: "",
    canonicalUrl: "",
    isTruncated: false,
    isLoadingPreview: false,
    previewError: "",
    topik: "Lainnya",
    sentimen: "NETRAL",
    prioritas: "RUTIN",
    headline: "",
    ringkasan: "",
    kataKunciInput: "",
    initialAnalysis: null,
    isAnalyzing: false,
    analysisFailed: false,
    duplicateEntry: null,
    submitDuplicate: null,
    submitError: "",
  };
}

export function isResponseStale(
  activeRequestId: number,
  incomingRequestId: number
): boolean {
  return activeRequestId !== incomingRequestId;
}

export function applyAnalysisResult(
  prevState: ModalFormValues,
  analysis: {
    topik?: string;
    sentimen?: "POSITIF" | "NETRAL" | "NEGATIF";
    prioritas?: "RUTIN" | "PANTAU" | "PERLU_PERHATIAN";
    headline?: string;
    ringkasan?: string;
    kataKunci?: string[];
    penyedia?: string;
  }
): ModalFormValues {
  const resolvedTopic = analysis.topik || "Lainnya";
  const resolvedSentiment = analysis.sentimen || "NETRAL";
  const resolvedPriority = analysis.prioritas || "RUTIN";
  const resolvedHeadline = analysis.headline || "";
  const resolvedRingkasan = analysis.ringkasan || "";
  const resolvedKeywords = Array.isArray(analysis.kataKunci)
    ? analysis.kataKunci.join(", ")
    : "";

  return {
    ...prevState,
    topik: resolvedTopic,
    sentimen: resolvedSentiment,
    prioritas: resolvedPriority,
    headline: resolvedHeadline,
    ringkasan: resolvedRingkasan,
    kataKunciInput: resolvedKeywords,
    initialAnalysis: {
      topik: resolvedTopic,
      sentimen: resolvedSentiment,
      prioritas: resolvedPriority,
      headline: resolvedHeadline,
      ringkasan: resolvedRingkasan,
      penyedia: analysis.penyedia || "keyword",
    },
    isAnalyzing: false,
    analysisFailed: false,
  };
}

export function shouldIgnoreAbortError(
  err: unknown,
  isStale: boolean
): boolean {
  if (isStale) return true;
  if (err instanceof Error && err.name === "AbortError") return true;
  return false;
}

export interface DuplicateNavigationTarget {
  destination: "/draf" | "/mention";
  path: string;
  message: string;
  buttonLabel: string;
}

export function getDuplicateNavigationInfo(
  status?: string,
  id?: string,
  url?: string
): DuplicateNavigationTarget {
  if (status === "DRAF") {
    return {
      destination: "/draf",
      path: "/draf",
      message:
        "Tautan ini sudah ada di antrean Draf. Tinjau dari halaman Draf.",
      buttonLabel: "Buka antrean Draf",
    };
  }

  const cleanUrl = url ? url.split("?")[0] : "";
  const query = id
    ? `?id=${encodeURIComponent(id)}&search=${encodeURIComponent(cleanUrl)}`
    : cleanUrl
      ? `?search=${encodeURIComponent(cleanUrl)}`
      : "";

  return {
    destination: "/mention",
    path: `/mention${query}`,
    message: "Tautan ini sudah tercatat di sistem",
    buttonLabel: "Buka entri lama",
  };
}
