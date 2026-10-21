import { selectTopic, TopicDefinition } from "./topicSelector";

export interface FallbackAnalysisResult {
  topik: string;
  sentimen: "POSITIF" | "NETRAL" | "NEGATIF";
  prioritas: "RUTIN" | "PANTAU" | "PERLU_PERHATIAN";
  kataKunci: string[];
  headline: string;
  ringkasan: string;
  penyedia: string;
}

/**
 * Normalisasi teks: lowercase dan squashing huruf berulang >= 3 kali menjadi 1 huruf.
 * Contoh: "woiiii" -> "woi", "mantaaap" -> "mantap", "russsaaak" -> "rusak".
 */
export function normalizeText(text: string): string {
  return (text || "").toLowerCase().replace(/(.)\1{2,}/g, "$1");
}

/**
 * Leksikon Kata Sentimen Bahasa Indonesia Sederhana
 */
export const POSITIVE_WORDS = [
  "bagus",
  "puas",
  "ramah",
  "cepat",
  "mudah",
  "lancar",
  "membantu",
  "terima kasih",
  "terimakasih",
  "makasih",
  "modern",
  "responsif",
  "keren",
  "mantap",
  "top",
  "hebat",
  "suka",
  "senang",
  "rekomendasi",
  "terbaik",
  "aman",
  "rapi",
  "memuaskan",
  "solutif",
  "bersyukur",
  "alhamdulillah",
  "kece",
  "ciamik",
  "apresiasi",
  "jempol",
  "inovatif",
  "praktis",
  "unggul",
];

export const NEGATIVE_WORDS = [
  "kecewa",
  "buruk",
  "lambat",
  "rusak",
  "gagal",
  "rugi",
  "hilang",
  "lenyap",
  "raib",
  "penipuan",
  "tertahan",
  "jelek",
  "parah",
  "lelet",
  "apes",
  "marah",
  "keluhan",
  "skandal",
  "woi",
  "bobol",
  "kebobolan",
  "sulit",
  "payah",
  "eror",
  "error",
  "down",
  "kecele",
  "bohong",
  "tipu",
  "bocor",
  "korupsi",
  "ngelag",
  "hang",
  "nyangkut",
  "hancur",
  "kapok",
  "mengecewakan",
  "bermasalah",
  "ribet",
  "amburadul",
  "antre",
  "antri",
];

/**
 * Kata Kunci Risiko (Configurable Risk Keywords)
 * Menentukan eskalasi prioritas ke PERLU_PERHATIAN jika bersentimen negatif.
 */
export const RISK_KEYWORDS = [
  "lenyap",
  "hilang",
  "raib",
  "penipuan",
  "bobol",
  "kebobolan",
  "kebocoran data",
  "bocor",
  "skandal",
  "korupsi",
  "gagal transfer",
  "uang hilang",
  "uang lenyap",
  "phishing",
  "hoaks",
  "lapor polisi",
  "somasi",
  "kejahatan",
  "sita",
  "ilegal",
  "tuntutan",
  "milyar",
  "miliar",
];

/**
 * Kata/frasa penanda pertanyaan murni
 */
export const QUESTION_INDICATORS = [
  "apa",
  "apakah",
  "bagaimana",
  "gimana",
  "kapan",
  "siapa",
  "kenapa",
  "mengapa",
  "mana",
  "tau",
  "tahu",
  "infonya",
  "info nya",
  "boleh bagi info",
];

/**
 * Ungkapan sopan dalam bahasa Indonesia.
 * Pada kalimat tanya, kata-kata ini merupakan tata krama dan BUKAN pujian,
 * sehingga tidak dihitung sebagai sentimen positif.
 */
export const POLITE_WORDS = [
  "terima kasih",
  "terimakasih",
  "makasih",
  "mohon",
  "tolong",
];

/**
 * Mencocokkan kata atau frasa dengan batasan kata yang ketat.
 * Mencegah substring di dalam kata lain salah cocok (misal 'kas' tidak cocok dengan 'bekas').
 */
export function matchesWordOrPhrase(text: string, term: string): boolean {
  const t = term.trim().toLowerCase();
  if (!t) return false;
  const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(^|[^a-zA-Z0-9])${escaped}([^a-zA-Z0-9]|$)`, "i");
  return regex.test(text);
}

/**
 * Menghitung kecocokan kata/frasa dalam teks dengan boundary regex
 */
export function findMatches(textLower: string, wordList: string[]): string[] {
  const matched: string[] = [];
  for (const word of wordList) {
    const w = word.toLowerCase().trim();
    if (!w) continue;
    if (matchesWordOrPhrase(textLower, w)) {
      matched.push(w);
    }
  }
  return matched;
}

/**
 * Deduplikasi kata kunci: jika frasa panjang sudah ada (misal "btn mobile"),
 * hapus kata pembentuk yang lebih pendek (seperti "btn" atau "mobile").
 */
export function deduplicateKeywords(keywords: string[]): string[] {
  const unique = Array.from(
    new Set(keywords.map((k) => k.trim().toLowerCase()).filter(Boolean))
  );
  // Urutkan dari yang terpanjang ke terpendek
  const sorted = [...unique].sort((a, b) => b.length - a.length);
  const result: string[] = [];

  for (const kw of sorted) {
    const isSub = result.some((longer) => {
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(
        `(^|[^a-zA-Z0-9])${escaped}([^a-zA-Z0-9]|$)`,
        "i"
      );
      return regex.test(longer);
    });
    if (!isSub) {
      result.push(kw);
    }
  }

  return result;
}

/**
 * SATU fungsi analisis cadangan berbasis kata kunci yang dipakai bersama
 * oleh klien (ModalInput) dan server (API mentions / fallback provider).
 */
export function analyzeFallback(
  text: string,
  topics: TopicDefinition[] = []
): FallbackAnalysisResult {
  const cleanText = (text || "").trim();
  const normalizedText = normalizeText(cleanText);

  // 1. Deteksi Topik via topicSelector (kecocokan terbanyak, urutan config, fallback 'Lainnya')
  const selectedTopic = selectTopic(normalizedText, topics);

  // 2. Deteksi Sentimen dari Leksikon Kata Positif & Negatif
  const matchedPositive = findMatches(normalizedText, POSITIVE_WORDS);
  const matchedNegative = findMatches(normalizedText, NEGATIVE_WORDS);

  const hasQuestionMark = cleanText.includes("?");
  const matchedQuestions = findMatches(normalizedText, QUESTION_INDICATORS);
  const isQuestion = hasQuestionMark || matchedQuestions.length > 0;

  // Pada kalimat tanya, ungkapan sopan tidak dihitung sebagai sentimen positif
  const effectivePositive = isQuestion
    ? matchedPositive.filter((w) => !POLITE_WORDS.includes(w))
    : matchedPositive;

  let sentimen: "POSITIF" | "NETRAL" | "NEGATIF" = "NETRAL";
  if (matchedNegative.length > effectivePositive.length) {
    sentimen = "NEGATIF";
  } else if (effectivePositive.length > matchedNegative.length) {
    sentimen = "POSITIF";
  } else {
    sentimen = "NETRAL";
  }

  // 3. Deteksi Kata Kunci Risiko & Prioritas
  const matchedRisks = findMatches(normalizedText, RISK_KEYWORDS);

  let prioritas: "RUTIN" | "PANTAU" | "PERLU_PERHATIAN" = "RUTIN";
  if (sentimen === "NEGATIF") {
    if (matchedRisks.length > 0) {
      prioritas = "PERLU_PERHATIAN";
    } else {
      prioritas = "PANTAU";
    }
  } else if (matchedRisks.length > 0) {
    // Jika ada kata risiko walau sentimen belum tentu negatif, pantau
    prioritas = "PANTAU";
  } else {
    prioritas = "RUTIN";
  }

  // 4. Ekstraksi Kata Kunci yang Cocok dari Teks
  const matchedKeywordsList: string[] = [];

  // Ekstraksi kata kunci topik yang cocok
  for (const topic of topics) {
    for (const kw of topic.kataKunci) {
      const lowerKw = kw.toLowerCase().trim();
      if (!lowerKw) continue;
      if (matchesWordOrPhrase(normalizedText, lowerKw)) {
        matchedKeywordsList.push(lowerKw);
      }
    }
  }

  // Tambahkan kata risiko yang cocok
  for (const rk of matchedRisks) {
    matchedKeywordsList.push(rk);
  }

  // Tambahkan kata sentimen yang cocok
  for (const sw of [...matchedPositive, ...matchedNegative]) {
    matchedKeywordsList.push(sw);
  }

  // Deteksi entitas khusus seperti "bank btn" atau "btn"
  if (matchesWordOrPhrase(normalizedText, "bank btn")) {
    matchedKeywordsList.push("bank btn");
  } else if (matchesWordOrPhrase(normalizedText, "btn")) {
    matchedKeywordsList.push("btn");
  }

  // Deduplikasi: kata/frasa yang tercakup dalam frasa yang lebih panjang dihilangkan
  let extractedKeywords = deduplicateKeywords(matchedKeywordsList);
  if (extractedKeywords.length === 0) {
    extractedKeywords = [selectedTopic.toLowerCase()];
  }

  // 5. Headline & Ringkasan Proporsional
  const firstLine = cleanText.split("\n")[0] || cleanText;
  const headline =
    firstLine.slice(0, 80).trim() ||
    `Perbincangan Nasabah Terkait ${selectedTopic}`;
  const ringkasan = cleanText.slice(0, 300).trim();

  return {
    topik: selectedTopic,
    sentimen,
    prioritas,
    kataKunci: extractedKeywords,
    headline,
    ringkasan,
    penyedia: "keyword",
  };
}
