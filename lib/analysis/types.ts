import { Sentiment, Priority } from "@prisma/client";
import { TopicDefinition } from "./topicSelector";

export interface AnalysisInput {
  text: string;
  topics?: TopicDefinition[];
  allowLlm?: boolean;
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
  name: string;
  analyze(input: AnalysisInput): Promise<AnalysisResult>;
}

export interface AnalyzeOptions {
  allowLlm?: boolean;
  officerOverride?: Partial<AnalysisResult>;
}
