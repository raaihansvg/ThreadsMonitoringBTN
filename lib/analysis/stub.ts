import { Sentiment, Priority } from "@prisma/client";
import { AnalysisInput, AnalysisProvider, AnalysisResult } from "./types";
import { analyzeFallback } from "./fallbackAnalysis";
import { TopicDefinition } from "./topicSelector";

export class KeywordAnalysisProvider implements AnalysisProvider {
  name = "keyword";
  private defaultTopics: TopicDefinition[];

  constructor(defaultTopics: TopicDefinition[] = []) {
    this.defaultTopics = defaultTopics;
  }

  async analyze(input: AnalysisInput): Promise<AnalysisResult> {
    const topics = input.topics || this.defaultTopics;
    const result = analyzeFallback(input.text, topics);
    return {
      sentimen: result.sentimen as Sentiment,
      topik: result.topik,
      kataKunci: result.kataKunci,
      prioritas: result.prioritas as Priority,
      headline: result.headline,
      ringkasan: result.ringkasan,
      penyedia: "keyword",
    };
  }
}

export const StubAnalysisProvider = KeywordAnalysisProvider;
