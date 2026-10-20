import { Sentiment, Priority } from "@prisma/client";
import { AnalysisInput, AnalysisProvider, AnalysisResult } from "./types";
import { analyzeFallback } from "./fallbackAnalysis";

export class StubAnalysisProvider implements AnalysisProvider {
  async analyze(input: AnalysisInput): Promise<AnalysisResult> {
    const result = analyzeFallback(input.text);
    return {
      sentimen: result.sentimen as Sentiment,
      topik: result.topik,
      kataKunci: result.kataKunci,
      prioritas: result.prioritas as Priority,
      headline: result.headline,
      ringkasan: result.ringkasan,
      penyedia: "keyword_fallback",
    };
  }
}
