import { describe, it, expect } from "vitest";
import { selectTopic, TopicDefinition } from "@/lib/analysis/topicSelector";
import { TEST_TOPICS } from "@/tests/fixtures/topics";

describe("Aturan Pemilihan Topik Otomatis (FR-04, FR-19)", () => {
  it("memilih topik dengan jumlah kecocokan kata kunci terbanyak", () => {
    // Teks memiliki 3 kata kunci KPR BTN (kpr, rumah, subsidi) dan 1 kata kunci BTN Mobile (aplikasi)
    const text =
      "Mau tanya pengajuan kpr btn untuk rumah subsidi apakah harus lewat aplikasi?";
    const result = selectTopic(text, TEST_TOPICS);
    expect(result).toBe("KPR BTN");
  });

  it("memilih BTN Mobile ketika kata kunci BTN Mobile mendominasi", () => {
    const text =
      "Aplikasi btn mobile error saat login dan transfer bifast, saldo terpotong.";
    const result = selectTopic(text, TEST_TOPICS);
    expect(result).toBe("BTN Mobile");
  });

  it("memilih topik urutan lebih awal dalam konfigurasi jika terjadi seri (tie breaker)", () => {
    const customTopics: TopicDefinition[] = [
      { nama: "Topik Pertama", kataKunci: ["rekening", "saldo"] },
      { nama: "Topik Kedua", kataKunci: ["transfer", "bifast"] },
      { nama: "Topik Ketiga", kataKunci: ["teller", "antrean"] },
    ];

    // 1 kata kunci cocok di Topik Pertama ("saldo") dan 1 di Topik Kedua ("transfer")
    const textTie = "Cek saldo lalu transfer uang.";
    const result = selectTopic(textTie, customTopics);
    expect(result).toBe("Topik Pertama");

    // Jika Topik Kedua dibalik posisinya ke urutan pertama, Topik Kedua yang menang
    const reversedTopics = [...customTopics].reverse();
    const resultReversed = selectTopic(textTie, reversedTopics);
    expect(resultReversed).toBe("Topik Kedua");
  });

  it("mengembalikan 'Lainnya' jika 0 kata kunci yang cocok", () => {
    const text =
      "Hari yang cerah untuk jogging pagi di sekitar stadion senayan bersama teman.";
    const result = selectTopic(text, TEST_TOPICS);
    expect(result).toBe("Lainnya");
  });

  it("mengembalikan 'Lainnya' untuk teks kosong, whitespace, atau invalid", () => {
    expect(selectTopic("", TEST_TOPICS)).toBe("Lainnya");
    expect(selectTopic("   ", TEST_TOPICS)).toBe("Lainnya");
    // @ts-expect-error test invalid input type
    expect(selectTopic(null, TEST_TOPICS)).toBe("Lainnya");
    // @ts-expect-error test undefined input type
    expect(selectTopic(undefined, TEST_TOPICS)).toBe("Lainnya");
  });

  it("mencocokkan kata kunci secara case-insensitive", () => {
    const text = "Pelayanan di KANTOR CABANG sangat memuaskan, TELLER ramah.";
    const result = selectTopic(text, TEST_TOPICS);
    expect(result).toBe("Pelayanan & CS");
  });
});
