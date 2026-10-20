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

export interface ProblemRow {
  line: number;
  url: string;
  reason: string;
}

export interface ImportResultSummary {
  berhasil: number;
  duplikat: number;
  gagal: number;
  belumDiproses: number;
  problems: ProblemRow[];
  rateLimited: boolean;
  rateLimitMessage?: string;
  retryAfterSeconds?: number;
}

export interface ImportResponseLike {
  ok: boolean;
  status: number;
  headers?: {
    get(name: string): string | null;
  };
  json(): Promise<unknown>;
}

export type SendImportItemFn = (payload: {
  linkAsli: string;
  teksPostingan: string;
  status: "DRAF";
  sumberInput: "IMPOR";
  headline: string;
  ringkasan: string;
  kataKunci: string[];
}) => Promise<ImportResponseLike>;

export interface ProcessImportQueueOptions {
  onProgress?: (current: number, total: number) => void;
  limit?: number;
}

/**
 * Memproses antrean impor item satu per satu.
 * Bila server merespons HTTP 429 (Rate Limit):
 * 1. Hentikan loop seketika (jangan kirim item berikutnya).
 * 2. Hitung item saat ini dan seluruh sisa item sebagai 'belumDiproses'.
 * 3. Simpan durasi Retry-After dan pesan kesalahan.
 */
export async function processImportQueue(
  items: Array<{ url: string; text?: string }>,
  sendItem: SendImportItemFn,
  options?: ProcessImportQueueOptions
): Promise<ImportResultSummary> {
  const limit = options?.limit ?? MAX_IMPORT_ITEMS;
  const limited = items.slice(0, limit);
  const total = limited.length;

  let berhasil = 0;
  let duplikat = 0;
  let gagal = 0;
  let belumDiproses = 0;
  const problems: ProblemRow[] = [];
  let rateLimited = false;
  let rateLimitMessage: string | undefined;
  let retryAfterSeconds: number | undefined;

  for (let i = 0; i < total; i++) {
    options?.onProgress?.(i + 1, total);
    const item = limited[i];

    const cleanUrl = item.url.trim().split("?")[0].replace("www.", "");
    if (
      !cleanUrl.startsWith("https://threads.net") &&
      !cleanUrl.startsWith("https://threads.com")
    ) {
      gagal++;
      problems.push({
        line: i + 1,
        url: item.url,
        reason: "Format tautan bukan HTTPS threads.net atau threads.com",
      });
      continue;
    }

    try {
      const text = item.text?.trim() || "";
      const payload = {
        linkAsli: item.url.trim(),
        teksPostingan: text,
        status: "DRAF" as const,
        sumberInput: "IMPOR" as const,
        headline: text ? text.slice(0, 80) : "",
        ringkasan: text ? text.slice(0, 300) : "",
        kataKunci: text ? ["impor", "massal"] : [],
      };

      const res = await sendItem(payload);

      if (res.status === 429) {
        rateLimited = true;
        const retryHeader = res.headers?.get
          ? res.headers.get("retry-after")
          : null;
        const parsedRetry = retryHeader ? parseInt(retryHeader, 10) : NaN;
        retryAfterSeconds =
          !isNaN(parsedRetry) && parsedRetry > 0 ? parsedRetry : 60;

        let errMsg = "Terlalu banyak permintaan. Pembatasan laju aktif.";
        try {
          const errData = (await res.json()) as { error?: string } | null;
          if (errData && errData.error) {
            errMsg = errData.error;
          }
        } catch {
          // ignore json parsing errors
        }
        rateLimitMessage = errMsg;

        // Item ke-i dan sisa item di antrean belum terproses
        belumDiproses = total - i;

        problems.push({
          line: i + 1,
          url: item.url,
          reason: `${errMsg} (Tunggu ${retryAfterSeconds} detik)`,
        });

        // Hentikan antrean seketika
        break;
      }

      if (res.ok) {
        berhasil++;
      } else if (res.status === 409) {
        duplikat++;
        problems.push({
          line: i + 1,
          url: item.url,
          reason: "Tautan sudah tercatat di sistem (duplikat)",
        });
      } else {
        gagal++;
        let errMsg = "Gagal menyimpan entri";
        try {
          const errData = (await res.json()) as { error?: string } | null;
          if (errData && errData.error) {
            errMsg = errData.error;
          }
        } catch {
          // ignore
        }
        problems.push({
          line: i + 1,
          url: item.url,
          reason: errMsg,
        });
      }
    } catch {
      gagal++;
      problems.push({
        line: i + 1,
        url: item.url,
        reason: "Kendala jaringan saat menghubungi server",
      });
    }
  }

  return {
    berhasil,
    duplikat,
    gagal,
    belumDiproses,
    problems,
    rateLimited,
    rateLimitMessage,
    retryAfterSeconds,
  };
}
