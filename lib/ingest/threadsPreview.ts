/**
 * Modul Pengambilan Pratinjau Tautan Threads (FR-02, Tahap 3A)
 *
 * Pengaman & Batasan Teknis:
 * 1. User-Agent jujur: "ThreadsMonitoring/0.1" (tanpa header penyamaran browser/crawler lain).
 * 2. Tanpa cookie, tanpa sesi login.
 * 3. Timeout 8 detik per permintaan.
 * 4. Batas pembacaan badan respon maksimal 1 MB.
 * 5. Maksimal 3 redirect (HTTPS saja, validasi host di setiap lompatan).
 * 6. Mengambil HANYA og:description (tidak menyimpan og:title atau nama akun).
 * 7. Decode entitas HTML (heksadesimal, desimal, dan entitas bernama).
 * 8. Menolak teks yang menyerupai halaman login ("Log in with your Instagram", "Join Threads to share ideas").
 * 9. Menandai isTruncated jika panjang >= 480 atau diakhiri elipsis.
 */

import { canonicalizeThreadsUrl } from "../url";

export type PreviewErrorCode =
  | "INVALID_URL"
  | "DISABLED"
  | "RATE_LIMITED"
  | "CIRCUIT_BREAKER"
  | "TIMEOUT"
  | "NOT_FOUND"
  | "LOGIN_WALL"
  | "REDIRECT_REJECTED"
  | "REDIRECT_LOOP"
  | "EMPTY_PREVIEW"
  | "NETWORK_ERROR"
  | "UPSTREAM_ERROR"
  | "INTERNAL_ERROR";

export interface ThreadsPreviewResult {
  ok: boolean;
  text: string;
  canonicalUrl: string;
  isTruncated: boolean;
  statusCode?: number;
  error?: string;
  errorCode?: PreviewErrorCode;
}

const ALLOWED_HOSTS = [
  "threads.net",
  "www.threads.net",
  "threads.com",
  "www.threads.com",
];

const TIMEOUT_MS = 8000; // 8 detik
const MAX_BYTES = 1024 * 1024; // 1 MB
const MAX_REDIRECTS = 3;

/**
 * Decode entitas HTML umum, heksadesimal, dan desimal numerik.
 */
export function decodeHtmlEntities(text: string): string {
  if (!text) return "";
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      try {
        const codePoint = parseInt(hex, 16);
        return String.fromCodePoint(codePoint);
      } catch {
        return "";
      }
    })
    .replace(/&#([0-9]+);/g, (_, dec) => {
      try {
        const codePoint = parseInt(dec, 10);
        return String.fromCodePoint(codePoint);
      } catch {
        return "";
      }
    })
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—");
}

function isValidThreadsHost(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== "https:") return false;
    return ALLOWED_HOSTS.includes(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function isLoginWallText(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("log in with your instagram") ||
    lower.includes("join threads to share ideas") ||
    lower.includes("log in to see photos and videos")
  );
}

function extractOgDescription(html: string): string | null {
  const ogDescMatch =
    html.match(
      /<meta\s+property=["']og:description["']\s+content=["']([^"']*)["']/i
    ) ||
    html.match(
      /<meta\s+content=["']([^"']*)["']\s+property=["']og:description["']/i
    );

  if (ogDescMatch && ogDescMatch[1] !== undefined) {
    return ogDescMatch[1];
  }
  return null;
}

/**
 * Fungsi utama untuk mengambil halaman Threads dan mengekstrak og:description
 */
export async function fetchThreadsPreview(
  initialUrl: string
): Promise<ThreadsPreviewResult> {
  let currentUrl = initialUrl.trim();
  let redirectsCount = 0;

  while (redirectsCount <= MAX_REDIRECTS) {
    if (!isValidThreadsHost(currentUrl)) {
      return {
        ok: false,
        text: "",
        canonicalUrl: currentUrl,
        isTruncated: false,
        error: `Host URL tidak diizinkan: ${currentUrl}`,
        errorCode: "REDIRECT_REJECTED",
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(currentUrl, {
        method: "GET",
        headers: {
          "User-Agent": "ThreadsMonitoring/0.1",
        },
        redirect: "manual",
        signal: controller.signal,
      });

      clearTimeout(timer);

      // Cek pengalihan HTTP (301, 302, 303, 307, 308)
      if ([301, 302, 303, 307, 308].includes(res.status)) {
        if (redirectsCount >= MAX_REDIRECTS) {
          return {
            ok: false,
            text: "",
            canonicalUrl: currentUrl,
            isTruncated: false,
            statusCode: res.status,
            error: "Melebihi batas maksimal redirect (3).",
            errorCode: "REDIRECT_LOOP",
          };
        }

        const location = res.headers.get("location");
        if (!location) {
          return {
            ok: false,
            text: "",
            canonicalUrl: currentUrl,
            isTruncated: false,
            statusCode: res.status,
            error: "Redirect status tanpa header Location.",
            errorCode: "REDIRECT_LOOP",
          };
        }

        const resolvedUrl = new URL(location, currentUrl).toString();

        // Validasi ketat target redirect: WAJIB HTTPS dan host Threads
        if (!isValidThreadsHost(resolvedUrl)) {
          return {
            ok: false,
            text: "",
            canonicalUrl: resolvedUrl,
            isTruncated: false,
            error: `Target redirect ditolak (bukan host Threads resmi): ${resolvedUrl}`,
            errorCode: "REDIRECT_REJECTED",
          };
        }

        currentUrl = resolvedUrl;
        redirectsCount++;
        continue;
      }

      // Kode status pembatasan akses: 403 (Forbidden) atau 429 (Too Many Requests)
      if (res.status === 403 || res.status === 429) {
        return {
          ok: false,
          text: "",
          canonicalUrl: canonicalizeThreadsUrl(currentUrl),
          isTruncated: false,
          statusCode: res.status,
          error: `Menerima status HTTP ${res.status} dari Threads.`,
          errorCode: "CIRCUIT_BREAKER",
        };
      }

      // Kode status tidak ditemukan / tidak dapat diakses: 404 (Not Found)
      if (res.status === 404) {
        return {
          ok: false,
          text: "",
          canonicalUrl: canonicalizeThreadsUrl(currentUrl),
          isTruncated: false,
          statusCode: 404,
          error:
            "Postingan tidak ditemukan atau tidak dapat diakses (HTTP 404).",
          errorCode: "NOT_FOUND",
        };
      }

      if (!res.ok) {
        return {
          ok: false,
          text: "",
          canonicalUrl: canonicalizeThreadsUrl(currentUrl),
          isTruncated: false,
          statusCode: res.status,
          error: `Permintaan gagal dengan status HTTP ${res.status}.`,
          errorCode: "UPSTREAM_ERROR",
        };
      }

      // Pembacaan badan dokumen HTML dengan pembatasan maksimal 1 MB
      let html = "";
      const reader = res.body?.getReader();
      if (!reader) {
        const fullText = await res.text();
        html = fullText.slice(0, MAX_BYTES);
      } else {
        const chunks: Uint8Array[] = [];
        let totalBytes = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            totalBytes += value.length;
            chunks.push(value);
            if (totalBytes >= MAX_BYTES) {
              reader.cancel();
              break;
            }
          }
        }
        html = Buffer.concat(chunks).toString("utf-8");
      }

      // Ekstraksi HANYA tag og:description
      const rawOgDesc = extractOgDescription(html);
      if (rawOgDesc === null) {
        return {
          ok: false,
          text: "",
          canonicalUrl: canonicalizeThreadsUrl(currentUrl),
          isTruncated: false,
          statusCode: res.status,
          error: "Tag og:description tidak ditemukan pada halaman.",
          errorCode: "EMPTY_PREVIEW",
        };
      }

      // Decode seluruh entitas HTML
      const decodedText = decodeHtmlEntities(rawOgDesc).trim();
      if (!decodedText) {
        return {
          ok: false,
          text: "",
          canonicalUrl: canonicalizeThreadsUrl(currentUrl),
          isTruncated: false,
          statusCode: res.status,
          error: "Teks og:description kosong pada halaman.",
          errorCode: "EMPTY_PREVIEW",
        };
      }

      // Tolak jika menyerupai teks pembatas login generic
      if (isLoginWallText(decodedText)) {
        return {
          ok: false,
          text: "",
          canonicalUrl: canonicalizeThreadsUrl(currentUrl),
          isTruncated: false,
          statusCode: res.status,
          error:
            "Teks terdeteksi sebagai halaman login Threads (bukan postingan).",
          errorCode: "LOGIN_WALL",
        };
      }

      // Cek apakah teks berpotensi terpotong (panjang >= 480 karakter atau diakhiri elipsis)
      const isTruncated =
        decodedText.endsWith("...") ||
        decodedText.endsWith("…") ||
        decodedText.length >= 480;

      const canonicalUrl = canonicalizeThreadsUrl(currentUrl);

      return {
        ok: true,
        text: decodedText,
        canonicalUrl,
        isTruncated,
        statusCode: res.status,
      };
    } catch (err: unknown) {
      clearTimeout(timer);
      const isAbort = err instanceof Error && err.name === "AbortError";
      const message =
        err instanceof Error ? err.message : "Gagal menghubungi Threads.";
      return {
        ok: false,
        text: "",
        canonicalUrl: currentUrl,
        isTruncated: false,
        error: isAbort ? "Timeout melebihi 8 detik." : message,
        errorCode: isAbort ? "TIMEOUT" : "NETWORK_ERROR",
      };
    }
  }

  return {
    ok: false,
    text: "",
    canonicalUrl: currentUrl,
    isTruncated: false,
    error: "Melebihi batas maksimal redirect.",
    errorCode: "REDIRECT_LOOP",
  };
}
