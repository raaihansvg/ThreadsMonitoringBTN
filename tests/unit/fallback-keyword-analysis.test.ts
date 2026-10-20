import { describe, it, expect } from "vitest";
import { analyzeFallback } from "@/lib/analysis/fallbackAnalysis";

describe("Analisis Cadangan (Kata Kunci) - Tahap 3F", () => {
  it("Kasus A: KOK BISA UANG 17M LENYAP DI BANK BTN? SEKALI LAGI 17M WOIIII", () => {
    const textA =
      "KOK BISA UANG 17M LENYAP DI BANK BTN? SEKALI LAGI 17M WOIIII";
    const resA = analyzeFallback(textA);

    console.log("HASIL UJI KASUS A:", JSON.stringify(resA, null, 2));

    // Topik: tidak ada kata kunci topik spesifik -> fallback 'Lainnya'
    expect(resA.topik).toBe("Lainnya");

    // Sentimen: memuat kata negatif kuat ('lenyap', 'woiiii') tanpa kata positif -> NEGATIF
    expect(resA.sentimen).toBe("NEGATIF");

    // Prioritas: sentimen negatif DAN memuat kata kunci risiko ('lenyap', '17m') -> PERLU_PERHATIAN
    expect(resA.prioritas).toBe("PERLU_PERHATIAN");

    // Kata Kunci: memuat kata kunci risiko dan token nominal yang diekstrak dari teks
    expect(resA.kataKunci).toEqual(
      expect.arrayContaining(["lenyap", "17m", "bank btn"])
    );
  });

  it("Kasus B: boleh bagi info nya kak yg memilih kpp BTN daripada take over KPR bank lain?? terima kasih", () => {
    const textB =
      "boleh bagi info nya kak yg memilih kpp BTN daripada take over KPR bank lain?? terima kasih";
    const resB = analyzeFallback(textB);

    console.log("HASIL UJI KASUS B:", JSON.stringify(resB, null, 2));

    // Topik: cocok dengan kata kunci 'kpr' -> 'KPR BTN'
    expect(resB.topik).toBe("KPR BTN");

    // Sentimen: memuat kata positif ('terima kasih') -> POSITIF
    expect(resB.sentimen).toBe("POSITIF");

    // Prioritas: bukan kasus risiko darurat -> RUTIN
    expect(resB.prioritas).toBe("RUTIN");

    // Kata Kunci: memuat kata kunci topik yang cocok ('kpr') dan entitas ('btn')
    expect(resB.kataKunci).toEqual(
      expect.arrayContaining(["kpr", "terima kasih", "btn"])
    );
  });

  it("Kasus C: Update terbaru BTN Mobile tampilannya makin modern dan responsif", () => {
    const textC =
      "Update terbaru BTN Mobile tampilannya makin modern dan responsif";
    const resC = analyzeFallback(textC);

    console.log("HASIL UJI KASUS C:", JSON.stringify(resC, null, 2));

    // Topik: cocok dengan kata kunci 'btn mobile' & 'mobile' -> 'BTN Mobile'
    expect(resC.topik).toBe("BTN Mobile");

    // Sentimen: memuat kata positif ('modern', 'responsif') -> POSITIF
    expect(resC.sentimen).toBe("POSITIF");

    // Prioritas: RUTIN
    expect(resC.prioritas).toBe("RUTIN");

    // Kata Kunci: memuat kata kunci topik dan sentimen yang diekstrak
    expect(resC.kataKunci).toEqual(
      expect.arrayContaining(["btn mobile", "modern", "responsif"])
    );
  });
});
