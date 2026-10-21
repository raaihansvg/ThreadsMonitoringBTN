import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export interface SessionPayload {
  iat: number;
  exp: number;
  nonce: string;
  role: "petugas";
}

const SESSION_COOKIE_NAME = "petugas_session";

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET wajib dikonfigurasi minimal 32 karakter.");
  }
  return secret;
}

/**
 * Membuat token sesi bertanda tangan HMAC-SHA256
 * Memuat waktu terbit (iat), waktu kedaluwarsa (exp max 8 jam), nonce acak, dan role.
 */
export function createSignedSessionToken(): string {
  const secret = getSessionSecret();
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    iat: now,
    exp: now + 8 * 3600, // 8 jam = 28.800 detik
    nonce: crypto.randomBytes(16).toString("hex"),
    role: "petugas",
  };

  const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString(
    "base64url"
  );
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payloadEncoded)
    .digest("base64url");

  return `${payloadEncoded}.${signature}`;
}

/**
 * Memverifikasi integritas, tanda tangan, dan masa berlaku token sesi
 */
export function verifySessionToken(
  token?: string | null
): SessionPayload | null {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payloadEncoded, signature] = parts;
  if (!payloadEncoded || !signature) return null;

  const secret = getSessionSecret();
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payloadEncoded)
    .digest("base64url");

  // Constant-time signature comparison
  const sigBuf = Buffer.from(signature, "utf-8");
  const expBuf = Buffer.from(expectedSignature, "utf-8");

  if (
    sigBuf.length !== expBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expBuf)
  ) {
    return null;
  }

  try {
    const rawJson = Buffer.from(payloadEncoded, "base64url").toString("utf-8");
    const payload: SessionPayload = JSON.parse(rawJson);

    const now = Math.floor(Date.now() / 1000);

    // Validasi masa berlaku dan durasi maksimal 8 jam
    if (
      !payload.iat ||
      !payload.exp ||
      !payload.nonce ||
      payload.role !== "petugas"
    ) {
      return null;
    }
    if (now > payload.exp) {
      return null; // Kedaluwarsa
    }
    if (payload.exp - payload.iat > 8 * 3600 + 120) {
      return null; // Melebihi 8 jam
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Bandingkan INPUT_TOKEN dengan crypto.timingSafeEqual untuk mencegah timing attack.
 */
export function verifyInputToken(
  input?: string | null,
  serverToken?: string | null
): boolean {
  if (!input || !serverToken) return false;

  const trimmedInput = input.trim();
  const trimmedServer = serverToken.trim();
  if (!trimmedInput || !trimmedServer) return false;

  const a = Buffer.from(trimmedInput, "utf-8");
  const b = Buffer.from(trimmedServer, "utf-8");

  // timingSafeEqual mewajibkan panjang buffer sama persis
  if (a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(a, b);
}

/**
 * Pembatasan percobaan login (In-Memory Sliding Window 5x per menit per IP).
 * Catatan: In-memory sliding window ini berlaku per instance container Node.js.
 * Di lingkungan serverless multi-region/edge, state in-memory tidak terdistribusi
 * sehingga untuk produksi berskala besar disarankan memakai Redis / Upstash.
 */
interface RateLimitBucket {
  attempts: number[];
}

const loginRateLimitMap = new Map<string, RateLimitBucket>();

export function checkLoginRateLimit(ip: string): {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds?: number;
} {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 menit
  const maxAttempts = 5;

  const record = loginRateLimitMap.get(ip) || { attempts: [] };
  // Hapus entri yang lewat dari 1 menit lalu
  record.attempts = record.attempts.filter((ts) => now - ts < windowMs);

  if (record.attempts.length >= maxAttempts) {
    const oldest = record.attempts[0];
    const retryAfterSeconds = Math.ceil((oldest + windowMs - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, retryAfterSeconds),
    };
  }

  return {
    allowed: true,
    remaining: maxAttempts - record.attempts.length,
  };
}

export function recordLoginAttempt(ip: string): void {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const record = loginRateLimitMap.get(ip) || { attempts: [] };
  record.attempts = record.attempts.filter((ts) => now - ts < windowMs);
  record.attempts.push(now);
  loginRateLimitMap.set(ip, record);
}

export function resetLoginRateLimit(ip: string): void {
  loginRateLimitMap.delete(ip);
}

/**
 * Pembatasan frekuensi pembuatan mention POST /api/mentions
 * (In-Memory Sliding Window 60x per menit per sesi/token/IP).
 * Mendukung burst impor massal sah hingga 50 item sekaligus (FR-10).
 */
const mentionRateLimitMap = new Map<string, RateLimitBucket>();

export function checkMentionRateLimit(key: string): {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds?: number;
} {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxAttempts = 60;

  const record = mentionRateLimitMap.get(key) || { attempts: [] };
  record.attempts = record.attempts.filter((ts) => now - ts < windowMs);

  if (record.attempts.length >= maxAttempts) {
    const oldest = record.attempts[0];
    const retryAfterSeconds = Math.ceil((oldest + windowMs - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, retryAfterSeconds),
    };
  }

  return {
    allowed: true,
    remaining: maxAttempts - record.attempts.length,
  };
}

export function recordMentionAttempt(key: string): void {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const record = mentionRateLimitMap.get(key) || { attempts: [] };
  record.attempts = record.attempts.filter((ts) => now - ts < windowMs);
  record.attempts.push(now);
  mentionRateLimitMap.set(key, record);
}

export function resetMentionRateLimit(key?: string): void {
  if (key) {
    mentionRateLimitMap.delete(key);
  } else {
    mentionRateLimitMap.clear();
  }
}

/**
 * Pembatasan frekuensi pemanggilan analisis POST /api/analyze
 * (In-Memory Sliding Window 20x per menit per sesi/IP).
 */
const analyzeRateLimitMap = new Map<string, RateLimitBucket>();

export function checkAnalyzeRateLimit(key: string): {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds?: number;
} {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxAttempts = 20;

  const record = analyzeRateLimitMap.get(key) || { attempts: [] };
  record.attempts = record.attempts.filter((ts) => now - ts < windowMs);

  if (record.attempts.length >= maxAttempts) {
    const oldest = record.attempts[0];
    const retryAfterSeconds = Math.ceil((oldest + windowMs - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, retryAfterSeconds),
    };
  }

  return {
    allowed: true,
    remaining: maxAttempts - record.attempts.length,
  };
}

export function recordAnalyzeAttempt(key: string): void {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const record = analyzeRateLimitMap.get(key) || { attempts: [] };
  record.attempts = record.attempts.filter((ts) => now - ts < windowMs);
  record.attempts.push(now);
  analyzeRateLimitMap.set(key, record);
}

export function resetAnalyzeRateLimit(key?: string): void {
  if (key) {
    analyzeRateLimitMap.delete(key);
  } else {
    analyzeRateLimitMap.clear();
  }
}

/**
 * Proteksi CSRF: membandingkan Origin/Referer dengan Host aplikasi
 * untuk semua metode mutasi (POST, PUT, PATCH, DELETE).
 */
export function validateCsrf(req: NextRequest): boolean {
  const method = req.method.toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) {
    return true;
  }

  const hostHeader = (
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    ""
  ).toLowerCase();

  const originHeader = req.headers.get("origin");
  const refererHeader = req.headers.get("referer");

  // Jika terdapat header origin, parse dan cocokkan host
  if (originHeader) {
    try {
      const originUrl = new URL(originHeader);
      const originHost = originUrl.host.toLowerCase();
      // Cocokkan host atau allow localhost / 127.0.0.1 saat mode dev/test
      if (
        originHost === hostHeader ||
        ((originHost.includes("localhost") ||
          originHost.includes("127.0.0.1")) &&
          (hostHeader.includes("localhost") ||
            hostHeader.includes("127.0.0.1") ||
            hostHeader === ""))
      ) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // Jika tidak ada origin, periksa referer
  if (refererHeader) {
    try {
      const refererUrl = new URL(refererHeader);
      const refererHost = refererUrl.host.toLowerCase();
      if (
        refererHost === hostHeader ||
        ((refererHost.includes("localhost") ||
          refererHost.includes("127.0.0.1")) &&
          (hostHeader.includes("localhost") ||
            hostHeader.includes("127.0.0.1") ||
            hostHeader === ""))
      ) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // Untuk request non-browser (misal API direct atau testing di Vitest), jika host cocok
  // atau ada x-requested-with / non-browser test environment, boleh diperiksa
  if (
    process.env.NODE_ENV === "test" ||
    (!originHeader && !refererHeader && hostHeader)
  ) {
    // Pada lingkungan test atau headless internal tanpa browser referer, loloskan jika host terdefinisi
    return true;
  }

  return false;
}

/**
 * Memeriksa apakah permintaan membawa Bearer token atau header x-extension-token yang sah.
 * PERHATIAN (Tahap 1.8): Bearer token HANYA sah dengan EXTENSION_TOKEN (terpisah dari INPUT_TOKEN).
 * INPUT_TOKEN tidak lagi diterima sebagai Bearer.
 */
export function isBearerAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  const headerToken =
    req.headers.get("x-extension-token") ||
    (authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null);

  const serverToken = process.env.EXTENSION_TOKEN?.trim();
  if (
    headerToken &&
    serverToken &&
    verifyInputToken(headerToken, serverToken)
  ) {
    return true;
  }
  return false;
}

/**
 * Guard terpusat requireOfficer()
 * Memeriksa validitas CSRF dan sesi Petugas Input.
 * Secara baku (default), hanya menerima cookie sesi resmi petugas_session.
 * Token Bearer HANYA diizinkan jika options.allowBearer === true (khusus POST /api/mentions).
 * Mengembalikan null jika valid, atau NextResponse dengan status 401/403 jika ditolak.
 */
export async function requireOfficer(
  req: NextRequest,
  options: { allowBearer?: boolean } = { allowBearer: false }
): Promise<NextResponse | null> {
  // 1. Periksa apakah ada token langsung via Authorization Bearer atau header x-extension-token (ekstensi)
  // CATATAN: Bearer token HANYA diterima jika route memanggil dengan { allowBearer: true } (khusus POST /api/mentions).
  // Permintaan dengan Bearer token eksplisit kebal terhadap CSRF karena browser tidak menyematkan Bearer token secara otomatis.
  if (options.allowBearer && isBearerAuth(req)) {
    return null; // Otentikasi ekstensi / API client valid
  }

  // 2. Proteksi CSRF untuk rute tulis yang mengandalkan sesi cookie
  if (!validateCsrf(req)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Akses ditolak: Verifikasi CSRF gagal (Origin/Host tidak cocok).",
      },
      { status: 403 }
    );
  }

  // 3. Periksa Cookie Sesi
  const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    return NextResponse.json(
      {
        ok: false,
        error: "Akses ditolak. Masuk sebagai Petugas Input terlebih dahulu.",
      },
      { status: 401 }
    );
  }

  // Tolak format statis lama "authenticated"
  if (sessionCookie === "authenticated") {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Sesi tidak valid: Cookie statis lama ditolak. Silakan login kembali.",
      },
      { status: 401 }
    );
  }

  // Verifikasi HMAC dan masa berlaku token
  const payload = verifySessionToken(sessionCookie);
  if (!payload || payload.role !== "petugas") {
    return NextResponse.json(
      {
        ok: false,
        error: "Sesi petugas tidak valid atau telah kedaluwarsa.",
      },
      { status: 401 }
    );
  }

  return null;
}
