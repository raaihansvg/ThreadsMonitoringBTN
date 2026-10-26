import dns from "node:dns";
import { Sentiment, Priority } from "@prisma/client";
import { AnalysisInput, AnalysisProvider, AnalysisResult } from "./types";
import { TopicDefinition } from "./topicSelector";
import { maskPii } from "@/lib/pii";

// Prioritaskan IPv4 agar fetch Node.js di Linux tidak tertahan timeout IPv6
dns.setDefaultResultOrder("ipv4first");

interface GeminiPart {
  text?: string;
  thought?: boolean;
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

interface GeminiAnalysisJson {
  topik?: unknown;
  sentimen?: unknown;
  prioritas?: unknown;
  headline?: unknown;
  ringkasan?: unknown;
  kataKunci?: unknown;
}

export const DEFAULT_GEMINI_TIMEOUT_MS = 15000;

export function getGeminiTimeoutMs(): number {
  const envVal = process.env.GEMINI_TIMEOUT_MS;
  if (!envVal) return DEFAULT_GEMINI_TIMEOUT_MS;
  const parsed = parseInt(envVal, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_GEMINI_TIMEOUT_MS;
  }
  return parsed;
}

export class GeminiAnalysisProvider implements AnalysisProvider {
  name = "gemini";
  private defaultTopics: TopicDefinition[];

  constructor(defaultTopics: TopicDefinition[] = []) {
    this.defaultTopics = defaultTopics;
  }

  async analyze(input: AnalysisInput): Promise<AnalysisResult> {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY belum dikonfigurasi.");
    }

    const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite";

    // Pastikan teks melewati penyamaran PII sebelum dikirim ke API eksternal
    const { maskedText: safeText } = maskPii(input.text || "");

    const topics = input.topics || this.defaultTopics;
    const allowedTopics = [...topics.map((t) => t.nama), "Lainnya"];

    const promptText = `Anda adalah analis sentimen dan topik perbankan untuk PT Bank Tabungan Negara (Persero) Tbk (Bank BTN).
Tugas Anda adalah menganalisis teks postingan media sosial Threads terkait Bank BTN.

Daftar topik yang diizinkan:
${allowedTopics.map((t) => `- ${t}`).join("\n")}

Instruksi:
1. Pilih SATU topik yang paling relevan dari daftar di atas. Jika tidak ada yang cocok, gunakan "Lainnya".
2. Tentukan sentimen terhadap Bank BTN: "POSITIF", "NETRAL", atau "NEGATIF".
3. Tentukan tingkat prioritas penanganan: "RUTIN", "PANTAU", atau "PERLU_PERHATIAN".
4. Buat headline singkat dan padat (maksimal 100 karakter).
5. Buat ringkasan informasi pokok postingan (maksimal 400 karakter).
6. Ekstrak kata kunci penting (maksimal 30 kata kunci).

Keluarkan HANYA format JSON valid tanpa tanda markdown (tanpa \`\`\`json) dengan skema berikut:
{
  "topik": "string",
  "sentimen": "POSITIF" | "NETRAL" | "NEGATIF",
  "prioritas": "RUTIN" | "PANTAU" | "PERLU_PERHATIAN",
  "headline": "string",
  "ringkasan": "string",
  "kataKunci": ["string"]
}

Teks postingan untuk dianalisis:
"""
${safeText}
"""`;

    const requestBody: Record<string, unknown> = {
      contents: [
        {
          parts: [{ text: promptText }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
        maxOutputTokens: 350,
        ...(model.includes("3.5") || model.includes("3-")
          ? { thinkingConfig: { thinkingLevel: "MINIMAL" } }
          : {}),
      },
    };

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const timeoutMs = getGeminiTimeoutMs();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        const timeoutSeconds = Math.round(timeoutMs / 1000);
        const timeoutDisplay =
          timeoutSeconds > 0 ? `${timeoutSeconds} detik` : `${timeoutMs} ms`;
        throw new Error(`Gemini API timeout setelah ${timeoutDisplay}.`);
      }
      const fetchMessage =
        err instanceof Error ? err.message : "Kesalahan jaringan";
      throw new Error(`Gagal menghubungi Gemini API: ${fetchMessage}`);
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      let errorDetail = "";
      try {
        const errorJson =
          (await response.json()) as GeminiGenerateContentResponse;
        errorDetail = errorJson?.error?.message || response.statusText;
      } catch {
        errorDetail = response.statusText || `Status ${response.status}`;
      }
      throw new Error(
        `Gemini API mengembalikan status HTTP ${response.status}: ${errorDetail}`
      );
    }

    let rawResponseText = "";
    try {
      const data = (await response.json()) as GeminiGenerateContentResponse;
      const parts = data.candidates?.[0]?.content?.parts || [];
      const textPart =
        parts.find((p) => !p.thought && typeof p.text === "string") ||
        parts[parts.length - 1];
      rawResponseText = textPart?.text?.trim() || "";
    } catch {
      throw new Error("Respons Gemini API bukan JSON yang dapat dibaca.");
    }

    if (!rawResponseText) {
      throw new Error("Respons Gemini API tidak memuat kandidat teks.");
    }

    // Bersihkan code block markdown bila model tetap menyertakannya
    let cleanJson = rawResponseText;
    if (cleanJson.startsWith("```")) {
      cleanJson = cleanJson
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "");
    }

    let parsed: GeminiAnalysisJson;
    try {
      parsed = JSON.parse(cleanJson) as GeminiAnalysisJson;
    } catch {
      throw new Error(
        "Respons Gemini bukan format JSON yang valid atau gagal di-parse."
      );
    }

    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.topik !== "string" ||
      typeof parsed.sentimen !== "string"
    ) {
      throw new Error("Respons JSON Gemini tidak memiliki atribut wajib.");
    }

    let sentimen: Sentiment = Sentiment.NETRAL;
    if (
      parsed.sentimen === "POSITIF" ||
      parsed.sentimen === "NEGATIF" ||
      parsed.sentimen === "NETRAL"
    ) {
      sentimen = parsed.sentimen as Sentiment;
    }

    let prioritas: Priority = Priority.RUTIN;
    if (
      parsed.prioritas === "RUTIN" ||
      parsed.prioritas === "PANTAU" ||
      parsed.prioritas === "PERLU_PERHATIAN"
    ) {
      prioritas = parsed.prioritas as Priority;
    }

    const resolvedTopic = allowedTopics.includes(parsed.topik)
      ? parsed.topik
      : "Lainnya";

    const headline =
      typeof parsed.headline === "string"
        ? parsed.headline.slice(0, 100).trim()
        : safeText.slice(0, 80).trim() || "Perbincangan Nasabah Terkait BTN";

    const ringkasan =
      typeof parsed.ringkasan === "string"
        ? parsed.ringkasan.slice(0, 400).trim()
        : safeText.slice(0, 300).trim();

    const kataKunci = Array.isArray(parsed.kataKunci)
      ? parsed.kataKunci
          .filter((k): k is string => typeof k === "string")
          .map((k) => k.trim())
          .filter(Boolean)
          .slice(0, 30)
      : [];

    return {
      topik: resolvedTopic,
      sentimen,
      prioritas,
      headline,
      ringkasan,
      kataKunci,
      penyedia: "gemini",
    };
  }
}
