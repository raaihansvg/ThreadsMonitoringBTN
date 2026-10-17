import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MentionStatus, InputSourceType } from "@prisma/client";
import { requireOfficer } from "@/lib/auth/session";
import { draftActionSchema } from "@/lib/validation/schemas";
import { maskPii } from "@/lib/pii";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const includeSample = searchParams.get("includeSample") !== "false";

    const drafts = await prisma.mention.findMany({
      where: {
        status: MentionStatus.DRAF,
        ...(includeSample
          ? {}
          : { sumberInput: { not: InputSourceType.CONTOH } }),
      },
      orderBy: { tanggalDitemukan: "desc" },
    });

    return NextResponse.json({ ok: true, drafts });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Gagal memuat draf",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authError = await requireOfficer(req);
    if (authError) return authError;

    const rawBody = await req.json().catch(() => null);
    if (!rawBody) {
      return NextResponse.json(
        { ok: false, error: "Body JSON tidak boleh kosong." },
        { status: 400 }
      );
    }

    const parsed = draftActionSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error:
            parsed.error.issues[0]?.message || "Payload aksi draf tidak valid.",
        },
        { status: 400 }
      );
    }

    const { id, action, edits } = parsed.data;

    if (action === "approve") {
      const sanitizedEdits: Record<string, unknown> = {};
      if (edits) {
        if (edits.topik) sanitizedEdits.topik = edits.topik;
        if (edits.sentimen) sanitizedEdits.sentimen = edits.sentimen;
        if (edits.prioritas) sanitizedEdits.prioritas = edits.prioritas;
        if (edits.headline) {
          sanitizedEdits.headline = maskPii(edits.headline).maskedText.slice(
            0,
            100
          );
        }
        if (edits.ringkasan) {
          sanitizedEdits.ringkasan = maskPii(edits.ringkasan).maskedText.slice(
            0,
            400
          );
        }
        if (edits.teksPostingan) {
          sanitizedEdits.teksPostingan = maskPii(
            edits.teksPostingan
          ).maskedText.slice(0, 5000);
        }
      }

      const updated = await prisma.mention.update({
        where: { id },
        data: {
          status: MentionStatus.BARU,
          ...sanitizedEdits,
          dikoreksiManual: true,
        },
      });
      return NextResponse.json({
        ok: true,
        message: "Draf disetujui ke Dashboard.",
        mention: updated,
      });
    }

    if (action === "reject") {
      await prisma.mention.delete({
        where: { id },
      });
      return NextResponse.json({
        ok: true,
        message: "Draf berhasil ditolak dan dihapus.",
      });
    }

    return NextResponse.json(
      { ok: false, error: "Aksi tidak dikenali." },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Gagal memproses draf",
      },
      { status: 500 }
    );
  }
}
