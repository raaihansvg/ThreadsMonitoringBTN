import { prisma } from "@/lib/prisma";
import { Sentiment, Priority } from "@prisma/client";
import { maskPii } from "@/lib/pii";
import { TopicDefinition } from "./topicSelector";
import { AnalysisProvider, AnalysisResult, AnalyzeOptions } from "./types";
import { KeywordAnalysisProvider } from "./stub";
import { z } from "zod";

export function createAnalysisResultSchema(allowedTopics: string[]) {
  return z.object({
    sentimen: z.nativeEnum(Sentiment),
    topik: z.string().refine((val) => allowedTopics.includes(val), {
      message: "Topik tidak terdaftar di daftar topik aktif atau 'Lainnya'.",
    }),
    kataKunci: z.array(z.string().max(50)).max(30),
    prioritas: z.nativeEnum(Priority),
    headline: z.string().max(100),
    ringkasan: z.string().max(400),
    penyedia: z.string(),
  });
}

export type AnalysisWithFallback = AnalysisResult & {
  fallbackDipakai: boolean;
};

const providerRegistry = new Map<
  string,
  (topics: TopicDefinition[]) => AnalysisProvider
>();

export function registerAnalysisProvider(
  name: string,
  factory: (topics: TopicDefinition[]) => AnalysisProvider
) {
  providerRegistry.set(name.toLowerCase().trim(), factory);
}

/**
 * Registry / Factory untuk mendapatkan instance AnalysisProvider
 */
export function getAnalysisProvider(
  providerName: string,
  topics: TopicDefinition[] = []
): AnalysisProvider {
  const normalized = providerName.toLowerCase().trim();
  const customFactory = providerRegistry.get(normalized);
  if (customFactory) {
    return customFactory(topics);
  }
  switch (normalized) {
    case "keyword":
    default:
      return new KeywordAnalysisProvider(topics);
  }
}

/**
 * Service Analisis Terpadu di Sisi Server (FR-04, FR-19, AC-05, AC-15, NFR-04)
 */
export async function analyzeText(
  text: string,
  options: AnalyzeOptions = {}
): Promise<AnalysisWithFallback> {
  // 1. Sanitasi PII di server sebelum dianalisis atau dikirim ke penyedia
  const { maskedText: safeText } = maskPii(text || "");

  // 2. Ambil topik aktif dari database (sumber tunggal)
  let topics: TopicDefinition[] = [];
  try {
    const dbTopics = await prisma.topic.findMany({
      where: { aktif: true },
      orderBy: { dibuatPada: "asc" },
    });
    topics = dbTopics.map((t) => ({
      nama: t.nama,
      kataKunci: t.kataKunci,
    }));
  } catch {
    // Graceful: bila koneksi database bermasalah atau tabel kosong, gunakan array kosong
    topics = [];
  }

  const allowedTopics = [...topics.map((t) => t.nama), "Lainnya"];
  const validator = createAnalysisResultSchema(allowedTopics);

  // 3. Tentukan penyedia analisis berdasarkan env dan options
  const configuredProvider = process.env.ANALYSIS_PROVIDER?.trim() || "keyword";
  const targetProviderName =
    options.allowLlm === false ? "keyword" : configuredProvider;

  let result: AnalysisResult;
  let fallbackDipakai = false;

  const keywordProvider = new KeywordAnalysisProvider(topics);

  try {
    const primaryProvider = getAnalysisProvider(targetProviderName, topics);
    const rawResult = await primaryProvider.analyze({
      text: safeText,
      topics,
      allowLlm: options.allowLlm,
    });

    const parsed = validator.safeParse(rawResult);
    if (!parsed.success) {
      throw new Error(`Validasi schema gagal: ${parsed.error.message}`);
    }

    result = parsed.data;
    if (targetProviderName !== "keyword" && result.penyedia === "keyword") {
      fallbackDipakai = true;
    }
  } catch {
    // Fallback ke analisis kata kunci bila penyedia gagal atau schema tidak valid
    result = await keywordProvider.analyze({
      text: safeText,
      topics,
      allowLlm: false,
    });
    fallbackDipakai = targetProviderName !== "keyword";
  }

  // 4. Override oleh petugas jika disediakan
  if (options.officerOverride) {
    if (options.officerOverride.topik) {
      result.topik = options.officerOverride.topik;
    }
    if (options.officerOverride.sentimen) {
      result.sentimen = options.officerOverride.sentimen;
    }
    if (options.officerOverride.prioritas) {
      result.prioritas = options.officerOverride.prioritas;
    }
    if (options.officerOverride.headline) {
      result.headline = options.officerOverride.headline.slice(0, 100);
    }
    if (options.officerOverride.ringkasan) {
      result.ringkasan = options.officerOverride.ringkasan.slice(0, 400);
    }
    if (options.officerOverride.kataKunci) {
      result.kataKunci = options.officerOverride.kataKunci;
    }
  }

  return {
    ...result,
    fallbackDipakai,
  };
}
