import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  isCircuitBreakerActive,
  triggerCircuitBreaker,
  resetCircuitBreaker,
  checkPreviewRateLimit,
  recordPreviewAttempt,
  resetPreviewLimits,
} from "@/lib/ingest/previewLimiter";

describe("State Pembatas & Circuit Breaker Persisten di Basis Data (PreviewLimitState - Tahap 3B)", () => {
  beforeEach(async () => {
    await resetPreviewLimits();
  });

  afterEach(async () => {
    await resetPreviewLimits();
  });

  it("menyimpan state circuit breaker ke tabel PreviewLimitState dan membacanya kembali", async () => {
    // 1. Awalnya belum aktif
    const initialStatus = await isCircuitBreakerActive();
    expect(initialStatus.active).toBe(false);

    // 2. Picu circuit breaker dengan kode 429
    await triggerCircuitBreaker(429);

    // 3. Pastikan record tersimpan langsung di tabel PreviewLimitState PostgreSQL
    const dbRecord = await prisma.previewLimitState.findUnique({
      where: { key: "circuit_breaker" },
    });
    expect(dbRecord).not.toBeNull();
    expect(dbRecord?.tipe).toBe("CIRCUIT_BREAKER");
    expect(dbRecord?.reason).toContain("429");
    expect(dbRecord?.circuitUntil).not.toBeNull();
    expect(dbRecord!.circuitUntil!.getTime()).toBeGreaterThan(Date.now());

    // 4. isCircuitBreakerActive membaca status aktif dari database
    const activeStatus = await isCircuitBreakerActive();
    expect(activeStatus.active).toBe(true);
    expect(activeStatus.remainingSeconds).toBeGreaterThan(0);
    expect(activeStatus.reason).toContain("429");

    // 5. Reset menghapus dari database
    await resetCircuitBreaker();
    const afterResetDb = await prisma.previewLimitState.findUnique({
      where: { key: "circuit_breaker" },
    });
    expect(afterResetDb).toBeNull();
    expect((await isCircuitBreakerActive()).active).toBe(false);
  });

  it("menyimpan riwayat percobaan rate limit ke database dan menolak saat melebihi batas sesi", async () => {
    const testSession = `test-officer-${Date.now()}`;

    // 1. Eksekusi 10 percobaan
    for (let i = 0; i < 10; i++) {
      const check = await checkPreviewRateLimit(testSession);
      expect(check.allowed).toBe(true);
      await recordPreviewAttempt(testSession);
    }

    // 2. Pastikan record sesi dan global tersimpan di database
    const sessionDb = await prisma.previewLimitState.findUnique({
      where: { key: `session:${testSession}` },
    });
    expect(sessionDb).not.toBeNull();
    expect(sessionDb?.attempts.length).toBe(10);

    const globalDb = await prisma.previewLimitState.findUnique({
      where: { key: "global" },
    });
    expect(globalDb).not.toBeNull();
    expect(globalDb!.attempts.length).toBeGreaterThanOrEqual(10);

    // 3. Percobaan ke-11 harus ditolak oleh rate limiter berbasis database
    const eleventh = await checkPreviewRateLimit(testSession);
    expect(eleventh.allowed).toBe(false);
    expect(eleventh.error).toContain("10/menit");
  });
});
