import { describe, it, expect } from "vitest";
import { sanitizeFormulaInjection } from "@/lib/export/sanitize";

describe("Sanitasi Formula Injection (CSV / Excel Injection)", () => {
  it("menambahkan tanda petik tunggal jika sel diawali karakter '='", () => {
    expect(sanitizeFormulaInjection("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
    expect(sanitizeFormulaInjection("=cmd|'/C calc'!A0")).toBe(
      "'=cmd|'/C calc'!A0"
    );
  });

  it("menambahkan tanda petik tunggal jika sel diawali '+', '-', '@'", () => {
    expect(sanitizeFormulaInjection("+123456")).toBe("'+123456");
    expect(sanitizeFormulaInjection("-5000")).toBe("'-5000");
    expect(sanitizeFormulaInjection("@SUM(1,2)")).toBe("'@SUM(1,2)");
  });

  it("menambahkan tanda petik tunggal jika sel diawali karakter tab \\t atau return \\r", () => {
    expect(sanitizeFormulaInjection("\t=1+1")).toBe("'\t=1+1");
    expect(sanitizeFormulaInjection("\r+2*2")).toBe("'\r+2*2");
  });

  it("menangani sel yang diawali spasi lalu karakter formula", () => {
    expect(sanitizeFormulaInjection("  =1+1")).toBe("'  =1+1");
  });

  it("tidak mengubah teks aman biasa", () => {
    expect(sanitizeFormulaInjection("Pelayanan Bank BTN sangat baik")).toBe(
      "Pelayanan Bank BTN sangat baik"
    );
    expect(sanitizeFormulaInjection("KPR BTN 2026")).toBe("KPR BTN 2026");
  });

  it("menangani nilai kosong, null, dan undefined", () => {
    expect(sanitizeFormulaInjection(null)).toBe("");
    expect(sanitizeFormulaInjection(undefined)).toBe("");
    expect(sanitizeFormulaInjection("")).toBe("");
  });
});
