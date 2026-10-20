import { describe, it, expect } from "vitest";
import { maskPii } from "@/lib/pii";

describe("Penyamaran Data Pribadi / PII (AC-05)", () => {
  it("menyamarkan alamat email dengan [EMAIL_TERSEMBUNYI]", () => {
    const input =
      "Silakan hubungi customer service kami di nasabah.btn@gmail.com segera.";
    const result = maskPii(input);
    expect(result.hasPii).toBe(true);
    expect(result.detectedTypes).toContain("EMAIL");
    expect(result.maskedText).toBe(
      "Silakan hubungi customer service kami di [EMAIL_TERSEMBUNYI] segera."
    );
  });

  it("menyamarkan nomor telepon seluler Indonesia dengan [NOMOR_TELEPON_TERSEMBUNYI]", () => {
    const input =
      "Nomor WhatsApp saya di 081234567890 atau +6281987654321 mohon dihubungi.";
    const result = maskPii(input);
    expect(result.hasPii).toBe(true);
    expect(result.detectedTypes).toContain("NOMOR_TELEPON");
    expect(result.maskedText).toContain("[NOMOR_TELEPON_TERSEMBUNYI]");
    expect(result.maskedText).not.toContain("081234567890");
  });

  it("menyamarkan NIK KTP (16 digit) dengan [NIK_TERSEMBUNYI]", () => {
    const input =
      "Data KTP saya 3171012304950001 ditolak saat pengajuan KPR online.";
    const result = maskPii(input);
    expect(result.hasPii).toBe(true);
    expect(result.detectedTypes).toContain("NOMOR_IDENTITAS");
    expect(result.maskedText).toContain("[NIK_TERSEMBUNYI]");
    expect(result.maskedText).not.toContain("3171012304950001");
  });

  it("menyamarkan nomor rekening bank (10-15 digit) dengan [NOMOR_REKENING_TERSEMBUNYI]", () => {
    const input =
      "Transfer gagal ke nomor rekening BTN 001234567890 atas nama saya.";
    const result = maskPii(input);
    expect(result.hasPii).toBe(true);
    expect(result.detectedTypes).toContain("NOMOR_REKENING");
    expect(result.maskedText).toContain("[NOMOR_REKENING_TERSEMBUNYI]");
    expect(result.maskedText).not.toContain("001234567890");
  });

  it("menyamarkan nomor kartu dengan pemisah spasi dengan [NOMOR_KARTU_TERSEMBUNYI]", () => {
    const input = "Nomor kartu 4000 1234 5678 9010.";
    const result = maskPii(input);
    expect(result.hasPii).toBe(true);
    expect(result.detectedTypes).toContain("NOMOR_KARTU");
    expect(result.maskedText).toContain("[NOMOR_KARTU_TERSEMBUNYI]");
    expect(result.maskedText).not.toContain("4000 1234 5678 9010");
  });

  it("menyamarkan nomor kartu dengan pemisah dash dengan [NOMOR_KARTU_TERSEMBUNYI]", () => {
    const input = "Nomor kartu 4000-1234-5678-9010.";
    const result = maskPii(input);
    expect(result.hasPii).toBe(true);
    expect(result.detectedTypes).toContain("NOMOR_KARTU");
    expect(result.maskedText).toContain("[NOMOR_KARTU_TERSEMBUNYI]");
    expect(result.maskedText).not.toContain("4000-1234-5678-9010");
  });

  it("menyamarkan nomor kartu 16 digit tanpa pemisah", () => {
    const input = "Nomor kartu 4000123456789010.";
    const result = maskPii(input);
    expect(result.hasPii).toBe(true);
    expect(result.maskedText).not.toContain("4000123456789010");
  });

  it("menyamarkan nomor kartu dengan tetap menjaga keutuhan teks di sekitarnya", () => {
    const input = "Nomor kartu saya 4000 1234 5678 9010 mohon diblokir";
    const result = maskPii(input);
    expect(result.hasPii).toBe(true);
    expect(result.maskedText).toBe(
      "Nomor kartu saya [NOMOR_KARTU_TERSEMBUNYI] mohon diblokir"
    );
  });

  it("tidak mengubah teks wajar yang tidak mengandung PII", () => {
    const input =
      "Pelayanan kantor cabang BTN hari ini sangat cepat dan ramah.";
    const result = maskPii(input);
    expect(result.hasPii).toBe(false);
    expect(result.detectedTypes).toHaveLength(0);
    expect(result.maskedText).toBe(input);
  });
});
