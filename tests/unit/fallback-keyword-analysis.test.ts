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

    // Prioritas: sentimen negatif DAN memuat kata kunci risiko ('lenyap') -> PERLU_PERHATIAN
    expect(resA.prioritas).toBe("PERLU_PERHATIAN");

    // Kata Kunci: memuat kata kunci risiko dan entitas (tanpa hardcoded nominal '17m')
    expect(resA.kataKunci).toEqual(
      expect.arrayContaining(["lenyap", "bank btn"])
    );
    expect(resA.kataKunci).not.toContain("17m");
  });

  it("Kasus B: boleh bagi info nya kak yg memilih kpp BTN daripada take over KPR bank lain?? terima kasih", () => {
    const textB =
      "boleh bagi info nya kak yg memilih kpp BTN daripada take over KPR bank lain?? terima kasih";
    const resB = analyzeFallback(textB);

    console.log("HASIL UJI KASUS B:", JSON.stringify(resB, null, 2));

    // Topik: cocok dengan kata kunci 'kpr' -> 'KPR BTN'
    expect(resB.topik).toBe("KPR BTN");

    // Sentimen: kalimat tanya dengan ungkapan sopan 'terima kasih' (bukan pujian) -> NETRAL
    expect(resB.sentimen).toBe("NETRAL");

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

    // Kata Kunci: memuat kata kunci topik dan sentimen yang diekstrak (deduplikasi menghilangkan 'btn' & 'mobile' terpisah)
    expect(resC.kataKunci).toEqual(
      expect.arrayContaining(["btn mobile", "modern", "responsif"])
    );
    expect(resC.kataKunci).not.toContain("mobile");
  });

  it("Generalisasi 1: Teks dengan huruf berulang ('aplikasi russsaaak bangett') terdeteksi negatif", () => {
    const res = analyzeFallback("aplikasi russsaaak bangett");
    expect(res.sentimen).toBe("NEGATIF");
    expect(res.kataKunci).toContain("rusak");
  });

  it("Generalisasi 2: Teks tanya murni ('apakah kantor cabang buka hari sabtu?') menjadi NETRAL", () => {
    const res = analyzeFallback("apakah kantor cabang buka hari sabtu?");
    expect(res.sentimen).toBe("NETRAL");
    expect(res.topik).toBe("Layanan Kantor Cabang");
  });

  it("Generalisasi 3: Substring tidak mencocokkan kata lain ('bekas kantor' tidak memicu kata 'kas')", () => {
    const res = analyzeFallback("bekas kantor cabang lama");
    expect(res.kataKunci).not.toContain("kas");
  });

  it("Generalisasi 4: Teks dengan nominal ('transfer 500rb berhasil lancar') tidak dianggap risiko", () => {
    const res = analyzeFallback("transfer 500rb berhasil lancar");
    expect(res.sentimen).toBe("POSITIF");
    expect(res.prioritas).toBe("RUTIN");
    expect(res.prioritas).not.toBe("PERLU_PERHATIAN");
  });

  // Uji Generalisasi Formal (d sampai i)
  it("Kasus d: 'saldo 50jt raib dari rekening btn, cs ga bisa dihubungi' -> NEGATIF, PERLU_PERHATIAN", () => {
    const res = analyzeFallback(
      "saldo 50jt raib dari rekening btn, cs ga bisa dihubungi"
    );
    expect(res.sentimen).toBe("NEGATIF");
    expect(res.prioritas).toBe("PERLU_PERHATIAN");
  });

  it("Kasus e: 'ada yg tau syarat kpr subsidi btn sekarang apa aja?' -> NETRAL, RUTIN", () => {
    const res = analyzeFallback(
      "ada yg tau syarat kpr subsidi btn sekarang apa aja?"
    );
    expect(res.sentimen).toBe("NETRAL");
    expect(res.prioritas).toBe("RUTIN");
  });

  it("Kasus f: 'pelayanan di cabang ramah bangeeet, mantaaap' -> POSITIF", () => {
    const res = analyzeFallback("pelayanan di cabang ramah bangeeet, mantaaap");
    expect(res.sentimen).toBe("POSITIF");
  });

  it("Kasus g: 'baru beli laptop pakai kpr btn' -> kata kunci tidak memuat 'top'", () => {
    const res = analyzeFallback("baru beli laptop pakai kpr btn");
    expect(res.kataKunci).not.toContain("top");
  });

  it("Kasus h: 'aplikasinya mantap banget ya? makasih' -> POSITIF", () => {
    const res = analyzeFallback("aplikasinya mantap banget ya? makasih");
    expect(res.sentimen).toBe("POSITIF");
  });

  it("Kasus i: 'kenapa saldo saya hilang? tolong dibantu makasih' -> NEGATIF, PERLU_PERHATIAN", () => {
    const res = analyzeFallback(
      "kenapa saldo saya hilang? tolong dibantu makasih"
    );
    expect(res.sentimen).toBe("NEGATIF");
    expect(res.prioritas).toBe("PERLU_PERHATIAN");
  });
});
