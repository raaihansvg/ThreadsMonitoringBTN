import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOfficer } from "@/lib/auth/session";
import { updateMentionSchema } from "@/lib/validation/schemas";
import { maskPii } from "@/lib/pii";

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

    await prisma.mention.delete({
      where: { id },
    });

    return NextResponse.json({
      ok: true,
      message: "Mention berhasil dihapus.",
    });
  } catch (error) {
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
