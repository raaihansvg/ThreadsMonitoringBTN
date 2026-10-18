/**
 * Modul Pengaman Frekuensi, Circuit Breaker, dan Kill Switch Pratinjau (FR-02, Tahap 3A)
 *
 * Kebijakan:
 * 1. Kill Switch: PREVIEW_ENABLED (default true di dev/test, false di produksi).
 * 2. Batas Sesi: Maksimal 10 permintaan per menit per sesi petugas.
 * 3. Batas Global: Maksimal 60 permintaan per jam seluruh sistem.
 * 4. Circuit Breaker: Jeda otomatis 15 menit jika menerima kode status HTTP 403 atau 429 dari Threads.
 */

interface RateLimitBucket {
  timestamps: number[];
}

const sessionAttempts = new Map<string, RateLimitBucket>();
let globalAttempts: number[] = [];

let circuitBreakerUntil: number | null = null;
let circuitBreakerReason: string | null = null;

const CIRCUIT_BREAKER_DURATION_MS = 15 * 60 * 1000; // 15 menit
const SESSION_WINDOW_MS = 60 * 1000; // 1 menit
const MAX_SESSION_PER_MINUTE = 10;
const GLOBAL_WINDOW_MS = 60 * 60 * 1000; // 1 jam
const MAX_GLOBAL_PER_HOUR = 60;

export const PREVIEW_FALLBACK_TEXT =
  "Teks tidak dapat diambil otomatis. Tempel teks postingan.";

/**
 * Memeriksa apakah fitur pratinjau diaktifkan via environment variable
 */
export function isPreviewEnabled(): boolean {
  const envVal = process.env.PREVIEW_ENABLED;
  if (envVal !== undefined) {
    return envVal.toLowerCase() === "true" || envVal === "1";
  }
  // Default: aktif di dev dan test, nonaktif di lingkungan produksi
  return process.env.NODE_ENV !== "production";
}

/**
 * Memeriksa apakah circuit breaker sedang aktif
 */
export function isCircuitBreakerActive(): {
  active: boolean;
  remainingSeconds?: number;
  reason?: string;
} {
  const now = Date.now();
  if (circuitBreakerUntil && now < circuitBreakerUntil) {
    const remainingSeconds = Math.ceil((circuitBreakerUntil - now) / 1000);
    return {
      active: true,
      remainingSeconds,
      reason: circuitBreakerReason || "Circuit breaker aktif.",
    };
  }
  circuitBreakerUntil = null;
  circuitBreakerReason = null;
  return { active: false };
}

/**
 * Memicu circuit breaker selama 15 menit
 */
export function triggerCircuitBreaker(statusCode: number): void {
  const now = Date.now();
  circuitBreakerUntil = now + CIRCUIT_BREAKER_DURATION_MS;
  circuitBreakerReason = `Menerima status HTTP ${statusCode} dari Threads. Pengambilan dijeda 15 menit untuk mematuhi pembatasan akses.`;
}

/**
 * Mereset circuit breaker (untuk keperluan pengujian unit)
 */
export function resetCircuitBreaker(): void {
  circuitBreakerUntil = null;
  circuitBreakerReason = null;
}

/**
 * Memeriksa batas frekuensi per sesi dan global
 */
export function checkPreviewRateLimit(sessionId: string): {
  allowed: boolean;
  error?: string;
} {
  const now = Date.now();

  // 1. Cek batas per sesi (10/menit)
  const sessionRecord = sessionAttempts.get(sessionId) || { timestamps: [] };
  sessionRecord.timestamps = sessionRecord.timestamps.filter(
    (ts) => now - ts < SESSION_WINDOW_MS
  );
  if (sessionRecord.timestamps.length >= MAX_SESSION_PER_MINUTE) {
    const oldest = sessionRecord.timestamps[0];
    const waitSec = Math.ceil((oldest + SESSION_WINDOW_MS - now) / 1000);
    return {
      allowed: false,
      error: `Batas frekuensi pratinjau sesi tercapai (maksimal 10/menit). Tunggu ${waitSec} detik lagi.`,
    };
  }

  // 2. Cek batas global (60/jam)
  globalAttempts = globalAttempts.filter((ts) => now - ts < GLOBAL_WINDOW_MS);
  if (globalAttempts.length >= MAX_GLOBAL_PER_HOUR) {
    const oldest = globalAttempts[0];
    const waitMin = Math.ceil((oldest + GLOBAL_WINDOW_MS - now) / 60000);
    return {
      allowed: false,
      error: `Batas frekuensi pratinjau global tercapai (maksimal 60/jam). Tunggu sekitar ${waitMin} menit lagi.`,
    };
  }

  return { allowed: true };
}

/**
 * Mencatat percobaan pratinjau yang dieksekusi
 */
export function recordPreviewAttempt(sessionId: string): void {
  const now = Date.now();
  const sessionRecord = sessionAttempts.get(sessionId) || { timestamps: [] };
  sessionRecord.timestamps = sessionRecord.timestamps.filter(
    (ts) => now - ts < SESSION_WINDOW_MS
  );
  sessionRecord.timestamps.push(now);
  sessionAttempts.set(sessionId, sessionRecord);

  globalAttempts = globalAttempts.filter((ts) => now - ts < GLOBAL_WINDOW_MS);
  globalAttempts.push(now);
}

/**
 * Mereset riwayat rate limit (untuk pengujian)
 */
export function resetPreviewRateLimits(): void {
  sessionAttempts.clear();
  globalAttempts = [];
}

/**
 * Mereset semua limit dan circuit breaker (untuk pengujian)
 */
export function resetPreviewLimits(): void {
  resetCircuitBreaker();
  resetPreviewRateLimits();
}
