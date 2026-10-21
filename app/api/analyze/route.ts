import { NextRequest, NextResponse } from "next/server";
import {
  requireOfficer,
  checkAnalyzeRateLimit,
  recordAnalyzeAttempt,
} from "@/lib/auth/session";
import { analyzeInputSchema } from "@/lib/validation/schemas";
import { analyzeText } from "@/lib/analysis/service";

function getAnalyzeRateLimitKey(req: NextRequest): string {
  const sessionCookie = req.cookies.get("petugas_session")?.value;
  if (sessionCookie) {
    return `session:${sessionCookie.slice(-24)}`;
  }
  const forwardedFor = req.headers.get("x-forwarded-for");
  const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : "127.0.0.1";
  return `ip:${ip}`;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Verifikasi Sesi Petugas & CSRF
    const authError = await requireOfficer(req);
    if (authError) return authError;

    // 2. Pembatasan Laju (Rate Limit): 20 req/menit
    const key = getAnalyzeRateLimitKey(req);
    const rateLimit = checkAnalyzeRateLimit(key);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: "Terlalu banyak permintaan analisis. Silakan tunggu sebentar.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds || 60),
          },
        }
      );
    }
    recordAnalyzeAttempt(key);

    // 3. Validasi Body JSON
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { ok: false, error: "Bad Request: Body JSON tidak boleh kosong." },
        { status: 400 }
      );
    }

    const parsed = analyzeInputSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        {
          ok: false,
          error: `Validasi gagal: ${firstIssue?.message || "Format data tidak sesuai."}`,
        },
        { status: 400 }
      );
    }

    // 4. Jalankan Analisis di Server
    const result = await analyzeText(parsed.data.text, { allowLlm: true });

    return NextResponse.json({
      ok: true,
      data: result,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Gagal menganalisis teks",
      },
      { status: 500 }
    );
  }
}
