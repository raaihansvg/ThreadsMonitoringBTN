import { NextRequest, NextResponse } from "next/server";
import { requireOfficer } from "@/lib/auth/session";
import { validateThreadsUrl } from "@/lib/url";
import { fetchThreadsPreview } from "@/lib/ingest/threadsPreview";
import {
  isPreviewEnabled,
  isCircuitBreakerActive,
  triggerCircuitBreaker,
  checkPreviewRateLimit,
  recordPreviewAttempt,
  PREVIEW_FALLBACK_TEXT,
} from "@/lib/ingest/previewLimiter";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // 1. Guard Petugas Input & Validasi CSRF
    const authError = await requireOfficer(req, { allowBearer: false });
    if (authError) return authError;

    // 2. Parse Body { url }
    const body = await req.json().catch(() => null);
    if (!body || typeof body.url !== "string" || !body.url.trim()) {
      return NextResponse.json(
        { ok: false, error: "URL Threads wajib diisi." },
        { status: 400 }
      );
    }

    const rawUrl = body.url.trim();

    // 3. Validasi Format URL Threads (mendukung /post/ dan /share/<id>)
    const urlValidation = validateThreadsUrl(rawUrl);
    if (!urlValidation.valid) {
      return NextResponse.json(
        {
          ok: false,
          error:
            urlValidation.error ||
            "Format URL tidak valid. Gunakan tautan resmi threads.net atau threads.com.",
        },
        { status: 400 }
      );
    }

    // 4. Periksa Kill Switch PREVIEW_ENABLED
    if (!isPreviewEnabled()) {
      return NextResponse.json({
        ok: false,
        error: PREVIEW_FALLBACK_TEXT,
        disabled: true,
      });
    }

    // 5. Periksa Status Circuit Breaker (jeda 15 menit jika ada blokir 403/429 sebelumnya)
    const cbStatus = await isCircuitBreakerActive();
    if (cbStatus.active) {
      return NextResponse.json(
        {
          ok: false,
          error: `Pengambilan pratinjau sementara dijeda (${cbStatus.remainingSeconds} detik tersisa) karena pembatasan akses Threads sebelumnya. Tempel teks secara manual.`,
          circuitBreaker: true,
          remainingSeconds: cbStatus.remainingSeconds,
        },
        { status: 429 }
      );
    }

    // 6. Periksa Pembatasan Frekuensi (Rate Limiting)
    const sessionToken =
      req.cookies.get("petugas_session")?.value ||
      req.headers.get("x-forwarded-for") ||
      "petugas_default";

    const rateLimitCheck = await checkPreviewRateLimit(sessionToken);
    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        { ok: false, error: rateLimitCheck.error },
        { status: 429 }
      );
    }

    // Catat percobaan pratinjau
    await recordPreviewAttempt(sessionToken);

    // 7. Eksekusi Pengambilan Pratinjau (SATU kali per permintaan eksplisit)
    const result = await fetchThreadsPreview(rawUrl);

    // Bila menerima status 403 atau 429 dari Threads, aktifkan circuit breaker 15 menit
    if (result.statusCode === 403 || result.statusCode === 429) {
      await triggerCircuitBreaker(result.statusCode);
      return NextResponse.json(
        {
          ok: false,
          error: `Menerima status HTTP ${result.statusCode} dari Threads. Pengambilan otomatis dijeda 15 menit. Tempel teks secara manual.`,
          circuitBreaker: true,
        },
        { status: 429 }
      );
    }

    if (!result.ok || !result.text) {
      return NextResponse.json({
        ok: false,
        error: PREVIEW_FALLBACK_TEXT,
        canonicalUrl: result.canonicalUrl,
        reason: result.error,
      });
    }

    // 8. Sukses Ekstraksi og:description
    return NextResponse.json({
      ok: true,
      text: result.text,
      canonicalUrl: result.canonicalUrl,
      isTruncated: result.isTruncated,
    });
  } catch (err: unknown) {
    const detail =
      err instanceof Error ? err.message : "Gagal memproses pratinjau.";
    return NextResponse.json(
      {
        ok: false,
        error: PREVIEW_FALLBACK_TEXT,
        detail,
      },
      { status: 500 }
    );
  }
}
