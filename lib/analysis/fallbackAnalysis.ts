import { selectTopic, CONFIGURED_TOPICS, TopicDefinition } from "./topicSelector";

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
  "memilih",
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
  "woii",
  "woiii",
  "woiiii",
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
  "17m",
  "milyar",
  "miliar",
];

/**
 * Menghitung kecocokan kata/frasa dalam teks dengan boundary regex
 */
function findMatches(textLower: string, wordList: string[]): string[] {
  const matched: string[] = [];
  for (const word of wordList) {
    const w = word.toLowerCase().trim();
    if (!w) continue;
    if (w.includes(" ") || w.includes("-") || w.includes("/")) {
      if (textLower.includes(w)) {
        matched.push(w);
      }
    } else {
      const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b${escaped}\\b`, "i");
      if (regex.test(textLower) || textLower.includes(w)) {
        matched.push(w);
      }
    }
  }
  return matched;
}

/**
 * SATU fungsi analisis cadangan berbasis kata kunci yang dipakai bersama
 * oleh klien (ModalInput) dan server (API mentions / fallback provider).
 */
export function analyzeFallback(
  text: string,
  topics: TopicDefinition[] = CONFIGURED_TOPICS
): FallbackAnalysisResult {
  const cleanText = (text || "").trim();
  const textLower = cleanText.toLowerCase();

  // 1. Deteksi Topik via topicSelector (kecocokan terbanyak, urutan config, fallback 'Lainnya')
  const selectedTopic = selectTopic(cleanText, topics);

  // 2. Deteksi Sentimen dari Leksikon Kata Positif & Negatif
  const matchedPositive = findMatches(textLower, POSITIVE_WORDS);
  const matchedNegative = findMatches(textLower, NEGATIVE_WORDS);

  let sentimen: "POSITIF" | "NETRAL" | "NEGATIF" = "NETRAL";
  if (matchedNegative.length > matchedPositive.length) {
    sentimen = "NEGATIF";
  } else if (matchedPositive.length > matchedNegative.length) {
    sentimen = "POSITIF";
  } else if (matchedNegative.length > 0 && matchedPositive.length > 0) {
    // Bila seimbang tetapi ada kata negatif kuat, tetap netral atau condong ke negatif
    sentimen = "NETRAL";
  }

  // 3. Deteksi Kata Kunci Risiko & Prioritas
  const matchedRisks = findMatches(textLower, RISK_KEYWORDS);

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
  const matchedKeywordsSet = new Set<string>();

  // Ekstraksi kata kunci topik yang cocok
  for (const topic of topics) {
    for (const kw of topic.kataKunci) {
      const lowerKw = kw.toLowerCase().trim();
      if (!lowerKw) continue;
      if (lowerKw.includes(" ") || lowerKw.includes("-")) {
        if (textLower.includes(lowerKw)) {
          matchedKeywordsSet.add(lowerKw);
        }
      } else {
        const escaped = lowerKw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (new RegExp(`\\b${escaped}\\b`, "i").test(textLower)) {
          matchedKeywordsSet.add(lowerKw);
        }
      }
    }
  }

  // Tambahkan kata risiko yang cocok
  for (const rk of matchedRisks) {
    matchedKeywordsSet.add(rk);
  }

  // Tambahkan kata sentimen yang cocok
  for (const sw of [...matchedPositive, ...matchedNegative]) {
    matchedKeywordsSet.add(sw);
  }

  // Deteksi entitas khusus seperti "bank btn", "btn", atau token nominal seperti "17m"
  if (textLower.includes("bank btn")) matchedKeywordsSet.add("bank btn");
  else if (textLower.includes("btn")) matchedKeywordsSet.add("btn");

  const nominalMatches = textLower.match(/\b\d+[mjrbk]\b/g);
  if (nominalMatches) {
    for (const nom of nominalMatches) {
      matchedKeywordsSet.add(nom);
    }
  }

  let extractedKeywords = Array.from(matchedKeywordsSet);
  if (extractedKeywords.length === 0) {
    extractedKeywords = [selectedTopic.toLowerCase()];
  }

  // 5. Headline & Ringkasan Proporsional
  const firstLine = cleanText.split("\n")[0] || cleanText;
  const headline = firstLine.slice(0, 80).trim() || `Perbincangan Nasabah Terkait ${selectedTopic}`;
  const ringkasan = cleanText.slice(0, 300).trim();

  return {
    topik: selectedTopic,
    sentimen,
    prioritas,
    kataKunci: extractedKeywords,
    headline,
    ringkasan,
    penyedia: "keyword_fallback",
  };
}
