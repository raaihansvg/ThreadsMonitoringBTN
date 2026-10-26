import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOfficer } from "@/lib/auth/session";
import { updateMentionSchema } from "@/lib/validation/schemas";
import { maskPii } from "@/lib/pii";
import { MentionStatus } from "@prisma/client";
import { syncAlertsAfterMentionDeletion } from "@/lib/alert/service";
import { getThresholds, DEFAULT_THRESHOLDS } from "@/lib/config/thresholds";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = await requireOfficer(req);
    if (authError) return authError;

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { ok: false, error: "ID mention wajib disertakan." },
        { status: 400 }
      );
    }

    const rawBody = await req.json().catch(() => null);
    if (!rawBody) {
      return NextResponse.json(
        { ok: false, error: "Body JSON tidak boleh kosong." },
        { status: 400 }
      );
    }

    const parsed = updateMentionSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error:
            parsed.error.issues[0]?.message || "Payload pembaruan tidak valid.",
        },
        { status: 400 }
      );
    }

    const {
      status,
      topik,
      sentimen,
      prioritas,
      headline,
      ringkasan,
      teksPostingan,
    } = parsed.data;

    // Server-side PII sanitization jika field teks diperbarui
    const updateData: Record<string, unknown> = {
      ...(status ? { status } : {}),
      ...(topik ? { topik } : {}),
      ...(sentimen ? { sentimen } : {}),
      ...(prioritas ? { prioritas } : {}),
      ...(headline
        ? { headline: maskPii(headline).maskedText.slice(0, 100) }
        : {}),
      ...(ringkasan
        ? { ringkasan: maskPii(ringkasan).maskedText.slice(0, 400) }
        : {}),
      ...(teksPostingan
        ? { teksPostingan: maskPii(teksPostingan).maskedText.slice(0, 5000) }
        : {}),
      dikoreksiManual: true,
    };

    const updated = await prisma.mention.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ ok: true, mention: updated });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Gagal memperbarui status mention",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = await requireOfficer(req);
    if (authError) return authError;

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { ok: false, error: "ID mention wajib disertakan." },
        { status: 400 }
      );
    }

    const mention = await prisma.mention.findUnique({
      where: { id },
    });

    if (!mention) {
      return NextResponse.json(
        { ok: false, error: "Mention tidak ditemukan." },
        { status: 404 }
      );
    }

    if (mention.status === MentionStatus.DRAF) {
      await prisma.mention.delete({
        where: { id },
      });
      return NextResponse.json({
        ok: true,
        message: "Mention berhasil dihapus.",
      });
    }

    // Ambil konfigurasi ambang batas sebelum transaksi dibuka untuk mengurangi
    // beban dan durasi koneksi di dalam Prisma interactive transaction.
    const thresholds = await getThresholds().catch(() => ({
      ...DEFAULT_THRESHOLDS,
    }));

    await prisma.$transaction(
      async (tx) => {
        await tx.mention.delete({
          where: { id },
        });
        await syncAlertsAfterMentionDeletion(mention, tx, thresholds);
      },
      { timeout: 15000 }
    );

    return NextResponse.json({
      ok: true,
      message: "Mention berhasil dihapus.",
    });
  } catch (error) {
    console.error(
      "[DELETE /api/mentions/[id]] Gagal menghapus mention:",
      error instanceof Error ? error.message : "Kesalahan server"
    );
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Gagal menghapus mention",
      },
      { status: 500 }
    );
  }
}
