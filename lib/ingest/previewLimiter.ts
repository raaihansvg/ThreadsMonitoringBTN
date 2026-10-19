/**
 * Modul Pengaman Frekuensi, Circuit Breaker, dan Kill Switch Pratinjau (FR-02, Tahap 3A & 3B)
 *
 * Kebijakan:
 * 1. Kill Switch: PREVIEW_ENABLED (default true di dev/test, false di produksi).
 * 2. Batas Sesi: Maksimal 10 permintaan per menit per sesi petugas.
 * 3. Batas Global: Maksimal 60 permintaan per jam seluruh sistem.
 * 4. Circuit Breaker: Jeda otomatis 15 menit jika menerima kode status HTTP 403 atau 429 dari Threads.
 * 5. State disimpan persisten di tabel basis data PreviewLimitState agar konsisten di lingkungan serverless.
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

async function getPrismaClient() {
  try {
    const { prisma } = await import("@/lib/prisma");
    return prisma;
  } catch {
    return null;
  }
}

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
 * Memeriksa apakah circuit breaker sedang aktif (mendukung DB PreviewLimitState & fallback in-memory)
 */
export async function isCircuitBreakerActive(): Promise<{
  active: boolean;
  remainingSeconds?: number;
  reason?: string;
}> {
  const now = Date.now();
  const prisma = await getPrismaClient();

  if (prisma) {
    try {
      const record = await prisma.previewLimitState.findUnique({
        where: { key: "circuit_breaker" },
      });
      if (
        record &&
        record.circuitUntil &&
        record.circuitUntil.getTime() > now
      ) {
        const remainingSeconds = Math.ceil(
          (record.circuitUntil.getTime() - now) / 1000
        );
        return {
          active: true,
          remainingSeconds,
          reason: record.reason || "Circuit breaker aktif.",
        };
      }
    } catch {
      // Fallback in-memory
    }
  }

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
 * Memicu circuit breaker selama 15 menit (persisten di DB PreviewLimitState & in-memory)
 */
export async function triggerCircuitBreaker(statusCode: number): Promise<void> {
  const now = Date.now();
  const until = new Date(now + CIRCUIT_BREAKER_DURATION_MS);
  const reason = `Menerima status HTTP ${statusCode} dari Threads. Pengambilan dijeda 15 menit untuk mematuhi pembatasan akses.`;

  circuitBreakerUntil = now + CIRCUIT_BREAKER_DURATION_MS;
  circuitBreakerReason = reason;

  const prisma = await getPrismaClient();
  if (prisma) {
    try {
      await prisma.previewLimitState.upsert({
        where: { key: "circuit_breaker" },
        create: {
          key: "circuit_breaker",
          tipe: "CIRCUIT_BREAKER",
          circuitUntil: until,
          reason,
          attempts: [],
        },
        update: {
          circuitUntil: until,
          reason,
        },
      });
    } catch {
      // In-memory sudah terpasang
    }
  }
}

/**
 * Mereset circuit breaker (untuk keperluan pengujian)
 */
export async function resetCircuitBreaker(): Promise<void> {
  circuitBreakerUntil = null;
  circuitBreakerReason = null;

  const prisma = await getPrismaClient();
  if (prisma) {
    try {
      await prisma.previewLimitState.deleteMany({
        where: { key: "circuit_breaker" },
      });
    } catch {
      // Ignore
    }
  }
}

/**
 * Memeriksa batas frekuensi per sesi dan global (persisten di DB & in-memory)
 */
export async function checkPreviewRateLimit(sessionId: string): Promise<{
  allowed: boolean;
  error?: string;
}> {
  const now = Date.now();
  const prisma = await getPrismaClient();

  if (prisma) {
    try {
      // 1. Cek batas sesi di database
      const sessionRow = await prisma.previewLimitState.findUnique({
        where: { key: `session:${sessionId}` },
      });
      if (sessionRow) {
        const recentSession = sessionRow.attempts.filter(
          (d) => now - d.getTime() < SESSION_WINDOW_MS
        );
        if (recentSession.length >= MAX_SESSION_PER_MINUTE) {
          const oldest = recentSession[0].getTime();
          const waitSec = Math.ceil((oldest + SESSION_WINDOW_MS - now) / 1000);
          return {
            allowed: false,
            error: `Batas frekuensi pratinjau sesi tercapai (maksimal 10/menit). Tunggu ${waitSec} detik lagi.`,
          };
        }
      }

      // 2. Cek batas global di database
      const globalRow = await prisma.previewLimitState.findUnique({
        where: { key: "global" },
      });
      if (globalRow) {
        const recentGlobal = globalRow.attempts.filter(
          (d) => now - d.getTime() < GLOBAL_WINDOW_MS
        );
        if (recentGlobal.length >= MAX_GLOBAL_PER_HOUR) {
          const oldest = recentGlobal[0].getTime();
          const waitMin = Math.ceil((oldest + GLOBAL_WINDOW_MS - now) / 60000);
          return {
            allowed: false,
            error: `Batas frekuensi pratinjau global tercapai (maksimal 60/jam). Tunggu sekitar ${waitMin} menit lagi.`,
          };
        }
      }
    } catch {
      // Fallback ke in-memory jika DB gagal
    }
  }

  // Fallback in-memory
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
 * Mencatat percobaan pratinjau yang dieksekusi (persisten di DB & in-memory)
 */
export async function recordPreviewAttempt(sessionId: string): Promise<void> {
  const now = Date.now();
  const nowDate = new Date(now);

  const sessionRecord = sessionAttempts.get(sessionId) || { timestamps: [] };
  sessionRecord.timestamps = sessionRecord.timestamps.filter(
    (ts) => now - ts < SESSION_WINDOW_MS
  );
  sessionRecord.timestamps.push(now);
  sessionAttempts.set(sessionId, sessionRecord);

  globalAttempts = globalAttempts.filter((ts) => now - ts < GLOBAL_WINDOW_MS);
  globalAttempts.push(now);

  const prisma = await getPrismaClient();
  if (prisma) {
    try {
      const sessionRow = await prisma.previewLimitState.findUnique({
        where: { key: `session:${sessionId}` },
      });
      const validSessionDates = (sessionRow?.attempts || []).filter(
        (d) => now - d.getTime() < SESSION_WINDOW_MS
      );
      validSessionDates.push(nowDate);

      await prisma.previewLimitState.upsert({
        where: { key: `session:${sessionId}` },
        create: {
          key: `session:${sessionId}`,
          tipe: "RATE_LIMIT",
          attempts: [nowDate],
        },
        update: {
          attempts: validSessionDates,
        },
      });

      const globalRow = await prisma.previewLimitState.findUnique({
        where: { key: "global" },
      });
      const validGlobalDates = (globalRow?.attempts || []).filter(
        (d) => now - d.getTime() < GLOBAL_WINDOW_MS
      );
      validGlobalDates.push(nowDate);

      await prisma.previewLimitState.upsert({
        where: { key: "global" },
        create: {
          key: "global",
          tipe: "RATE_LIMIT",
          attempts: [nowDate],
        },
        update: {
          attempts: validGlobalDates,
        },
      });
    } catch {
      // In-memory sudah terisi
    }
  }
}

/**
 * Mereset riwayat rate limit (untuk pengujian)
 */
export async function resetPreviewRateLimits(): Promise<void> {
  sessionAttempts.clear();
  globalAttempts = [];

  const prisma = await getPrismaClient();
  if (prisma) {
    try {
      await prisma.previewLimitState.deleteMany({
        where: {
          OR: [{ key: "global" }, { key: { startsWith: "session:" } }],
        },
      });
    } catch {
      // Ignore
    }
  }
}

/**
 * Mereset semua limit dan circuit breaker (untuk pengujian)
 */
export async function resetPreviewLimits(): Promise<void> {
  await resetCircuitBreaker();
  await resetPreviewRateLimits();
}
