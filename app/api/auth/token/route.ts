import { NextRequest, NextResponse } from "next/server";
import {
  verifySessionToken,
  createSignedSessionToken,
  verifyInputToken,
  checkLoginRateLimit,
  recordLoginAttempt,
  resetLoginRateLimit,
} from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get("petugas_session");
  const payload = verifySessionToken(cookie?.value);
  const isAuthenticated = !!payload && payload.role === "petugas";

  return NextResponse.json({
    authenticated: isAuthenticated,
    role: isAuthenticated ? "petugas" : "penonton",
  });
}

export async function POST(req: NextRequest) {
  try {
    // 1. Ekstrak IP klien untuk Rate Limiting
    const forwardedFor = req.headers.get("x-forwarded-for");
    const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : "127.0.0.1";

    // 2. Cek Rate Limit (5x percobaan per menit)
    const rateLimit = checkLoginRateLimit(ip);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: `Terlalu banyak percobaan masuk. Silakan tunggu ${rateLimit.retryAfterSeconds} detik.`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds || 60),
          },
        }
      );
    }

    const body = await req.json();
    const token = body?.token?.trim();
    const serverToken = process.env.INPUT_TOKEN?.trim();

    if (!serverToken) {
      return NextResponse.json(
        { ok: false, error: "INPUT_TOKEN belum dikonfigurasi di server." },
        { status: 500 }
      );
    }

    // 3. Catat percobaan masuk untuk rate limiter
    recordLoginAttempt(ip);

    // 4. Bandingkan token dengan constant-time timingSafeEqual
    if (!verifyInputToken(token, serverToken)) {
      return NextResponse.json(
        { ok: false, error: "Token tidak valid." },
        { status: 401 }
      );
    }

    // Sukses: reset percobaan rate limit untuk IP ini
    resetLoginRateLimit(ip);

    // 5. Terbitkan token bertanda tangan HMAC-SHA256 dengan waktu terbit + masa berlaku 8 jam + nonce acak
    const signedToken = createSignedSessionToken();

    const response = NextResponse.json({
      ok: true,
      role: "petugas",
      message: "Berhasil masuk sebagai Petugas Input.",
    });

    // Pasang cookie httpOnly bertanda tangan berumur 8 jam (28800 detik)
    response.cookies.set("petugas_session", signedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 28800,
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Permintaan tidak valid." },
      { status: 400 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({
    ok: true,
    role: "penonton",
    message: "Sesi petugas diakhiri.",
  });
  response.cookies.delete("petugas_session");
  return response;
}
