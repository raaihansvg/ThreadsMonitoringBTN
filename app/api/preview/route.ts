import { NextRequest, NextResponse } from "next/server";
import { requireOfficer } from "@/lib/auth/session";
import { validateThreadsUrl } from "@/lib/url";
import {
  fetchThreadsPreview,
  PreviewErrorCode,
} from "@/lib/ingest/threadsPreview";
import {
  isPreviewEnabled,
  isCircuitBreakerActive,
  triggerCircuitBreaker,
  checkPreviewRateLimit,
  recordPreviewAttempt,
} from "@/lib/ingest/previewLimiter";

export const dynamic = "force-dynamic";

function logPreviewFailure(
  errorCode: PreviewErrorCode,
  statusCode: number | undefined,
  host: string,
  startTime: number,
  isCircuitBreaker: boolean
) {
  const durationMs = Date.now() - startTime;
  console.warn(
    `[PREVIEW_FAILURE] errorCode=${errorCode} status=${statusCode ?? "-"} host=${host} durationMs=${durationMs} circuitBreakerTriggered=${isCircuitBreaker}`
  );
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let parsedHost = "threads";

  try {
    // 1. Guard Petugas Input & Validasi CSRF
    const authError = await requireOfficer(req, { allowBearer: false });
    if (authError) return authError;

    // 2. Parse Body { url }
    const body = await req.json().catch(() => null);
    if (!body || typeof body.url !== "string" || !body.url.trim()) {
      logPreviewFailure("INVALID_URL", 400, "unknown", startTime, false);
      const msg = "URL Threads wajib diisi.";
      return NextResponse.json(
        {
          ok: false,
          errorCode: "INVALID_URL",
          message: msg,
          error: msg,
          canUseManualText: true,
        },
        { status: 400 }
      );
    }

    const rawUrl = body.url.trim();
    try {
      parsedHost = new URL(rawUrl).hostname.toLowerCase();
    } catch {
      parsedHost = "invalid_url";
    }

    // 3. Validasi Format URL Threads (mendukung /post/ dan /share/<id>)
    const urlValidation = validateThreadsUrl(rawUrl);
    if (!urlValidation.valid) {
      logPreviewFailure("INVALID_URL", 400, parsedHost, startTime, false);
      const msg =
        urlValidation.error ||
        "Format URL tidak valid. Gunakan tautan resmi threads.net atau threads.com.";
      return NextResponse.json(
        {
          ok: false,
          errorCode: "INVALID_URL",
          message: msg,
          error: msg,
          canUseManualText: true,
        },
        { status: 400 }
      );
    }

    // 4. Periksa Kill Switch PREVIEW_ENABLED
    if (!isPreviewEnabled()) {
      const msg =
        "Fitur pratinjau otomatis dinonaktifkan. Silakan tempel teks secara manual.";
      logPreviewFailure("DISABLED", 200, parsedHost, startTime, false);
      return NextResponse.json({
        ok: false,
        errorCode: "DISABLED",
        disabled: true,
        message: msg,
        error: msg,
        canUseManualText: true,
      });
    }

    // 5. Periksa Status Circuit Breaker (jeda 15 menit jika ada blokir 403/429 sebelumnya)
    const cbStatus = await isCircuitBreakerActive();
    if (cbStatus.active) {
      const remainingSeconds = cbStatus.remainingSeconds || 0;
      const msg = `Pengambilan pratinjau sementara dijeda (${remainingSeconds} detik tersisa) karena pembatasan akses Threads sebelumnya. Tempel teks secara manual.`;
      logPreviewFailure("CIRCUIT_BREAKER", 429, parsedHost, startTime, false);
      return NextResponse.json(
        {
          ok: false,
          errorCode: "CIRCUIT_BREAKER",
          message: msg,
          error: msg,
          circuitBreaker: true,
          remainingSeconds,
          retryAfterSeconds: remainingSeconds,
          canUseManualText: true,
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
      const msg = rateLimitCheck.error || "Batas frekuensi pratinjau tercapai.";
      logPreviewFailure("RATE_LIMITED", 429, parsedHost, startTime, false);
      return NextResponse.json(
        {
          ok: false,
          errorCode: "RATE_LIMITED",
          message: msg,
          error: msg,
          retryAfterSeconds: rateLimitCheck.retryAfterSeconds,
          canUseManualText: true,
        },
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
      const msg = `Menerima status HTTP ${result.statusCode} dari Threads. Pengambilan otomatis dijeda 15 menit. Tempel teks secara manual.`;
      logPreviewFailure(
        "CIRCUIT_BREAKER",
        result.statusCode,
        parsedHost,
        startTime,
        true
      );
      return NextResponse.json(
        {
          ok: false,
          errorCode: "CIRCUIT_BREAKER",
          message: msg,
          error: msg,
          circuitBreaker: true,
          remainingSeconds: 900,
          retryAfterSeconds: 900,
          canUseManualText: true,
        },
        { status: 429 }
      );
    }

    if (!result.ok || !result.text) {
      const errorCode: PreviewErrorCode = result.errorCode || "EMPTY_PREVIEW";
      let message = "Teks tidak dapat diambil otomatis. Tempel teks postingan.";

      switch (errorCode) {
        case "NOT_FOUND":
          message =
            "Postingan tidak ditemukan atau tidak dapat diakses (HTTP 404). Silakan tempel teks secara manual.";
          break;
        case "TIMEOUT":
          message =
            "Waktu pengambilan melebihi batas waktu 8 detik. Silakan tempel teks secara manual.";
          break;
        case "LOGIN_WALL":
          message =
            "Konten memerlukan autentikasi login Threads. Silakan tempel teks secara manual.";
          break;
        case "REDIRECT_REJECTED":
          message =
            "Pengalihan tautan ke domain luar ditolak demi keamanan. Silakan tempel teks secara manual.";
          break;
        case "REDIRECT_LOOP":
          message =
            "Terlalu banyak pengalihan tautan (redirect loop). Silakan tempel teks secara manual.";
          break;
        case "NETWORK_ERROR":
          message =
            "Kendala jaringan saat menghubungi Threads. Silakan tempel teks secara manual.";
          break;
        case "UPSTREAM_ERROR":
          message = `Server Threads mengalami kendala (HTTP ${result.statusCode || 500}). Silakan tempel teks secara manual.`;
          break;
        case "EMPTY_PREVIEW":
        default:
          message =
            "Teks pratinjau tidak ditemukan pada halaman Threads. Silakan tempel teks postingan secara manual.";
          break;
      }

      logPreviewFailure(
        errorCode,
        result.statusCode,
        parsedHost,
        startTime,
        false
      );

      return NextResponse.json({
        ok: false,
        errorCode,
        message,
        error: message,
        canonicalUrl: result.canonicalUrl,
        reason: result.error,
        canUseManualText: true,
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
    logPreviewFailure("INTERNAL_ERROR", 500, parsedHost, startTime, false);
    const message =
      "Terjadi kesalahan internal pada server saat memproses pratinjau. Silakan tempel teks secara manual.";
    return NextResponse.json(
      {
        ok: false,
        errorCode: "INTERNAL_ERROR",
        message,
        error: message,
        detail,
        canUseManualText: true,
      },
      { status: 500 }
    );
  }
}
