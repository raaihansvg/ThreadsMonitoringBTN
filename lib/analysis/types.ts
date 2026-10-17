import { Sentiment, Priority } from "@prisma/client";

export interface AnalysisInput {
  text: string;
}

export interface AnalysisResult {
  sentimen: Sentiment;
  topik: string;
  kataKunci: string[];
  prioritas: Priority;
  headline: string;
  ringkasan: string;
  penyedia: string;
}

export interface AnalysisProvider {
  analyze(input: AnalysisInput): Promise<AnalysisResult>;
}
