import { normalizeThreadsUrl } from "./url";

/**
 * Deteksi Duplikasi Mention (AC-03 & FR-07)
 * Membandingkan link setelah dinormalisasi (menghilangkan tracking param, www, dsb).
 */
export function isDuplicateLink(
  candidateUrl: string,
  existingUrls: string[]
): { isDuplicate: boolean; matchedUrl?: string } {
  if (!candidateUrl) return { isDuplicate: false };

  const normalizedCandidate = normalizeThreadsUrl(candidateUrl);

  for (const existing of existingUrls) {
    if (normalizeThreadsUrl(existing) === normalizedCandidate) {
      return { isDuplicate: true, matchedUrl: existing };
    }
  }

  return { isDuplicate: false };
}
