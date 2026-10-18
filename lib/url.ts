/**
 * Validasi dan Normalisasi Tautan Threads (AC-01 & AC-03)
 */

export interface UrlValidationResult {
  valid: boolean;
  error?: string;
  normalizedUrl?: string;
}

/**
 * AC-01: Link yang bukan HTTPS atau bukan dari threads.net atau threads.com ditolak dengan pesan yang jelas.
 */
export function validateThreadsUrl(rawUrl: string): UrlValidationResult {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { valid: false, error: "Tautan Threads wajib diisi." };
  }

  const trimmed = rawUrl.trim();

  // Validasi format dasar URL
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      valid: false,
      error: "Format URL tidak valid. Masukkan tautan lengkap dengan https://.",
    };
  }

  // Protokol WAJIB HTTPS
  if (parsed.protocol !== "https:") {
    return {
      valid: false,
      error: "Tautan harus menggunakan protokol aman HTTPS (bukan http://).",
    };
  }

  // Host WAJIB threads.net atau threads.com (dengan atau tanpa www.)
  const hostname = parsed.hostname.toLowerCase();
  const validHosts = [
    "threads.net",
    "www.threads.net",
    "threads.com",
    "www.threads.com",
  ];

  if (!validHosts.includes(hostname)) {
    return {
      valid: false,
      error:
        "Tautan harus berasal dari domain resmi threads.net atau threads.com.",
    };
  }

  // Jalur (pathname) wajib memuat postingan (/post/ atau /@user/post/) atau tautan berbagi (/share/<id>)
  const isPost = parsed.pathname.includes("/post/");
  const isShare =
    parsed.pathname.startsWith("/share/") &&
    parsed.pathname.replace(/^\/share\/?/, "").length > 0;

  if (!isPost && !isShare) {
    return {
      valid: false,
      error:
        "Tautan harus mengarah ke postingan Threads yang spesifik (/post/ atau /share/<id>).",
    };
  }

  return {
    valid: true,
    normalizedUrl: normalizeThreadsUrl(trimmed),
  };
}

/**
 * AC-03: Link yang sama, termasuk dengan parameter pelacakan berbeda,
 * terdeteksi sebagai duplikat dan tidak tersimpan dua kali.
 *
 * Normalisasi:
 * - Menyeragamkan domain ke 'threads.net' (mengganti threads.com dan membuang www.)
 * - Menghapus semua parameter query pelacak (?igshid=..., utm_*, xmt=...)
 * - Menghapus trailing slash
 */
export function normalizeThreadsUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== "string") return "";

  try {
    const parsed = new URL(rawUrl.trim());

    // Host seragam: threads.net
    let host = parsed.hostname.toLowerCase();
    if (host.startsWith("www.")) {
      host = host.slice(4);
    }
    if (host === "threads.com") {
      host = "threads.net";
    }

    // Pathname seragam: hilangkan trailing slash jika ada
    let pathname = parsed.pathname;
    if (pathname.length > 1 && pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1);
    }

    return `https://${host}${pathname}`;
  } catch {
    // Fallback jika parsing URL gagal
    return rawUrl.trim().split("?")[0].replace("www.", "");
  }
}

/**
 * Normalisasi alamat kanonikal post Threads: https://threads.net/@akun/post/<id> (tanpa query)
 */
export function canonicalizeThreadsUrl(resolvedUrl: string): string {
  return normalizeThreadsUrl(resolvedUrl);
}
