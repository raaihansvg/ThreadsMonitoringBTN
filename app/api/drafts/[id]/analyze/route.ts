import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MentionStatus } from "@prisma/client";
import {
  requireOfficer,
  checkDraftAnalyzeRateLimit,
  recordDraftAnalyzeAttempt,
} from "@/lib/auth/session";
import * as analysisService from "@/lib/analysis/service";

export const dynamic = "force-dynamic";

function getDraftAnalyzeRateLimitKey(req: NextRequest): string {
  const sessionCookie = req.cookies.get("petugas_session")?.value;
  if (sessionCookie) {
    return `session:${sessionCookie.slice(-24)}`;
  }
  const forwardedFor = req.headers.get("x-forwarded-for");
  const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : "127.0.0.1";
  return `ip:${ip}`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Verifikasi Autentikasi Petugas & CSRF
    const authError = await requireOfficer(req);
    if (authError) return authError;

    // 2. Pembatasan Laju (Rate Limit): 10 req/menit per sesi
    const key = getDraftAnalyzeRateLimitKey(req);
    const rateLimit = checkDraftAnalyzeRateLimit(key);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Terlalu banyak permintaan analisis ulang draf. Silakan tunggu sebentar.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds || 60),
          },
        }
      );
    }
    recordDraftAnalyzeAttempt(key);

    // 3. Validasi Parameter ID
    const { id } = await params;
    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { ok: false, error: "ID draf wajib disertakan." },
        { status: 400 }
      );
    }

    // 4. Periksa Keberadaan Draf di Database
    const draft = await prisma.mention.findUnique({
      where: { id },
    });

    if (!draft || draft.status !== MentionStatus.DRAF) {
      return NextResponse.json(
        {
          ok: false,
          error: "Draf tidak ditemukan atau status bukan DRAF.",
        },
        { status: 400 }
      );
    }

    if (!draft.teksPostingan || draft.teksPostingan.trim() === "") {
      return NextResponse.json(
        {
          ok: false,
          error: "Teks postingan draf kosong atau tidak valid.",
        },
        { status: 400 }
      );
    }

    // 5. Validasi Konfirmasi Penimpaan Koreksi Manual
    let confirmOverwrite = false;
    try {
      const body = await req.json();
      if (body && typeof body === "object") {
        confirmOverwrite = Boolean(body.confirmOverwrite);
      }
    } catch {
      // Body bersifat opsional
    }

    if (draft.dikoreksiManual && !confirmOverwrite) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Draf telah dikoreksi manual. Konfirmasi penimpaan diperlukan.",
        },
        { status: 409 }
      );
    }

    // 6. Jalankan Analisis di Server
    try {
      const analysis = await analysisService.analyzeText(draft.teksPostingan, {
        allowLlm: true,
      });

      // Bila analisis gagal menggunakan model utama dan jatuh ke fallback kamus
      if (analysis.fallbackDipakai) {
        return NextResponse.json({
          ok: true,
          fallback: true,
          message: "Analisis AI gagal, hasil lama dipertahankan.",
          result: {
            topik: draft.topik,
            sentimen: draft.sentimen,
            prioritas: draft.prioritas,
            headline: draft.headline,
            ringkasan: draft.ringkasan,
            kataKunci: draft.kataKunci,
            penyedia: draft.penyediaAnalisis || "klien_fallback",
          },
        });
      }

      // Update row Mention di database bila analisis berhasil
      const updated = await prisma.mention.update({
        where: { id: draft.id },
        data: {
          topik: analysis.topik,
          sentimen: analysis.sentimen,
          prioritas: analysis.prioritas,
          headline: analysis.headline,
          ringkasan: analysis.ringkasan,
          kataKunci: analysis.kataKunci,
          penyediaAnalisis: analysis.penyedia,
          dikoreksiManual: false,
        },
      });

      return NextResponse.json({
        ok: true,
        fallback: false,
        message: "Analisis ulang selesai",
        result: {
          topik: updated.topik,
          sentimen: updated.sentimen,
          prioritas: updated.prioritas,
          headline: updated.headline,
          ringkasan: updated.ringkasan,
          kataKunci: updated.kataKunci,
          penyedia: updated.penyediaAnalisis,
        },
      });
    } catch {
      // JANGAN 500: Kembalikan 200 dengan data lama dan fallback: true
      return NextResponse.json({
        ok: true,
        fallback: true,
        message: "Analisis AI gagal, hasil lama dipertahankan.",
        result: {
          topik: draft.topik,
          sentimen: draft.sentimen,
          prioritas: draft.prioritas,
          headline: draft.headline,
          ringkasan: draft.ringkasan,
          kataKunci: draft.kataKunci,
          penyedia: draft.penyediaAnalisis || "klien_fallback",
        },
      });
    }
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan internal pada server.",
      },
      { status: 500 }
    );
  }
}
