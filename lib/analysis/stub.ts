import { Sentiment, Priority } from "@prisma/client";
import { AnalysisInput, AnalysisProvider, AnalysisResult } from "./types";

export class StubAnalysisProvider implements AnalysisProvider {
  async analyze(_input: AnalysisInput): Promise<AnalysisResult> {
    void _input;
    return {
      sentimen: Sentiment.NETRAL,
      topik: "",
      kataKunci: [],
      prioritas: Priority.RUTIN,
      headline: "",
      ringkasan: "",
      penyedia: "stub",
    };
  }
}
