/**
 * Mitigasi Formula Injection (CSV / Excel Formula Injection).
 * Prepend single quote (') ke sel CSV dan XLSX yang diawali karakter eksekusi formula:
 * '=', '+', '-', '@', '\t', '\r'
 */
export function sanitizeFormulaInjection(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const str = String(value);
  if (str.length === 0) return "";

  const dangerousPrefixes = ["=", "+", "-", "@", "\t", "\r"];

  // Cek apakah karakter pertama (atau setelah leading whitespace) berbahaya
  const firstChar = str.charAt(0);
  if (dangerousPrefixes.includes(firstChar)) {
    return `'${str}`;
  }

  // Jika ada whitespace di depan yang menyamarkan karakter bahaya
  const trimmed = str.trimStart();
  if (trimmed.length > 0 && dangerousPrefixes.includes(trimmed.charAt(0))) {
    return `'${str}`;
  }

  return str;
}
