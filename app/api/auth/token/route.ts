import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get("petugas_session");
  const isAuthenticated = cookie?.value === "authenticated";
  return NextResponse.json({
    authenticated: isAuthenticated,
    role: isAuthenticated ? "petugas" : "penonton",
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = body?.token?.trim();
    const serverToken = process.env.INPUT_TOKEN?.trim();

    if (!serverToken) {
      return NextResponse.json(
        { ok: false, error: "INPUT_TOKEN belum dikonfigurasi di server." },
        { status: 500 }
      );
    }

    if (token !== serverToken) {
      return NextResponse.json(
        { ok: false, error: "Token tidak valid." },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      ok: true,
      role: "petugas",
      message: "Berhasil masuk sebagai Petugas Input.",
    });

    // Session cookie httpOnly berumur 8 jam (28800 detik)
    response.cookies.set("petugas_session", "authenticated", {
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
