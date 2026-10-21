/**
 * Aturan Pemilihan Topik Otomatis (Tahap 1.6 - FR-04 & FR-19)
 *
 * Aturan:
 * 1. Kecocokan kata kunci terbanyak dalam teks.
 * 2. Bila jumlah kata kunci yang cocok sama (tie), gunakan urutan topik pertama di konfigurasi.
 * 3. Bila tidak ada kata kunci yang cocok (skor 0), kembalikan 'Lainnya'.
 */

export interface TopicDefinition {
  nama: string;
  kataKunci: string[];
}

export function selectTopic(
  text: string,
  topics: TopicDefinition[] = []
): string {
  if (!text || typeof text !== "string") {
    return "Lainnya";
  }

  const lowerText = text.toLowerCase();
  let maxMatchCount = 0;
  let selectedTopic = "Lainnya";

  for (const topic of topics) {
    let matchCount = 0;

    for (const kw of topic.kataKunci) {
      const lowerKw = kw.toLowerCase().trim();
      if (!lowerKw) continue;

      // Pencocokan kata kunci: regex boundary untuk kata atau includes untuk frase majemuk
      const isMultiWord = lowerKw.includes(" ") || lowerKw.includes("-");
      if (isMultiWord) {
        if (lowerText.includes(lowerKw)) {
          matchCount++;
        }
      } else {
        const escaped = lowerKw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`\\b${escaped}\\b`, "i");
        if (regex.test(lowerText)) {
          matchCount++;
        }
      }
    }

    // Aturan 1: Kecocokan kata kunci terbanyak
    // Aturan 2: Bila sama, strict > memastikan topik dengan urutan lebih awal di konfigurasi menang
    if (matchCount > maxMatchCount) {
      maxMatchCount = matchCount;
      selectedTopic = topic.nama;
    }
  }

  // Aturan 3: Bila tidak ada kecocokan (skor 0), 'Lainnya'
  return maxMatchCount > 0 ? selectedTopic : "Lainnya";
}
