/**
 * Helper Sanitasi HTML & URL untuk Mitigasi XSS (Cross-Site Scripting)
 */

const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Meng-escape karakter khusus HTML (&, <, >, ", ') agar aman dari XSS
 */
export function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return "";
  return String(str).replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char] || char);
}

/**
 * Validasi URL agar hanya mengizinkan protokol https:
 * Mengembalikan string URL yang telah divalidasi, atau null bila tidak valid / bukan https:.
 */
export function safeHttpsUrl(url: unknown): string | null {
  if (typeof url !== "string" || !url.trim()) return null;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    // URL tidak dapat di-parse
  }
  return null;
}
