/**
 * Utilitas Penguraian Tempel Banyak (Bulk Paste) & Impor (FR-10, Tahap 3B)
 *
 * Aturan:
 * 1. Pecah HANYA pada tanda "|" pertama; karakter "|" berikutnya tetap bagian dari teks.
 * 2. Batas seragam: maksimal 50 item per proses di semua tempat (UI, validasi, server).
 */

export const MAX_IMPORT_ITEMS = 50;

export interface ParsedImportItem {
  url: string;
  text?: string;
}

/**
 * Mengurai satu baris masukan tempel banyak:
 * Format: "tautan" ATAU "tautan | teks postingan dengan | kemungkinan | karakter pipe"
 */
export function parsePasteLine(line: string): ParsedImportItem {
  const trimmed = line.trim();
  const pipeIndex = trimmed.indexOf("|");

  if (pipeIndex === -1) {
    return {
      url: trimmed,
      text: undefined,
    };
  }

  const url = trimmed.slice(0, pipeIndex).trim();
  const text = trimmed.slice(pipeIndex + 1).trim();

  return {
    url,
    text: text || undefined,
  };
}

/**
 * Mengurai seluruh teks area tempel banyak dan membatasi hingga MAX_IMPORT_ITEMS (50)
 */
export function parseBulkPaste(
  rawContent: string,
  limit = MAX_IMPORT_ITEMS
): {
  items: ParsedImportItem[];
  totalLines: number;
  isTruncated: boolean;
} {
  if (!rawContent || typeof rawContent !== "string") {
    return { items: [], totalLines: 0, isTruncated: false };
  }

  const lines = rawContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const totalLines = lines.length;
  const parsed = lines.map(parsePasteLine);
  const items = parsed.slice(0, limit);

  return {
    items,
    totalLines,
    isTruncated: totalLines > limit,
  };
}
