import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MentionStatus, InputSourceType } from "@prisma/client";
import { requireOfficer } from "@/lib/auth/session";
import { draftActionSchema } from "@/lib/validation/schemas";
import { maskPii } from "@/lib/pii";
import { triggerAlertsForMention } from "@/lib/alert/service";
import { analyzeText } from "@/lib/analysis/service";

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
      const draft = await prisma.mention.findUnique({
        where: { id },
      });

      if (!draft) {
        return NextResponse.json(
          { ok: false, error: "Draf tidak ditemukan." },
          { status: 404 }
        );
      }

      // Pastikan teks postingan terisi (baik dari draf asli maupun dari suntingan petugas)
      const rawEffectiveText = (
        edits?.teksPostingan !== undefined
          ? edits.teksPostingan
          : draft.teksPostingan
      )?.trim();

      if (!rawEffectiveText) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Draf tanpa teks tidak dapat disetujui sebelum teks postingan diisi oleh petugas.",
          },
          { status: 400 }
        );
      }

      const { maskedText: safeText } = maskPii(rawEffectiveText);

      const sanitizedEdits: Record<string, unknown> = {
        teksPostingan: safeText.slice(0, 5000),
      };

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
      }

      const analysisResult = await analyzeText(safeText, { allowLlm: true });

      // Bila headline/ringkasan masih kosong setelah teks diisi, turunkan secara otomatis
      if (!sanitizedEdits.headline && !draft.headline) {
        sanitizedEdits.headline = analysisResult.headline;
      }
      if (!sanitizedEdits.ringkasan && !draft.ringkasan) {
        sanitizedEdits.ringkasan = analysisResult.ringkasan;
      }
      if (
        !sanitizedEdits.topik &&
        (!draft.topik || draft.topik === "Lainnya")
      ) {
        sanitizedEdits.topik = analysisResult.topik;
      }
      if (!sanitizedEdits.sentimen && !draft.sentimen) {
        sanitizedEdits.sentimen = analysisResult.sentimen;
      }
      if (!sanitizedEdits.prioritas && !draft.prioritas) {
        sanitizedEdits.prioritas = analysisResult.prioritas;
      }
      if (!draft.penyediaAnalisis) {
        sanitizedEdits.penyediaAnalisis = analysisResult.penyedia;
      }

      const updated = await prisma.mention.update({
        where: { id },
        data: {
          status: MentionStatus.BARU,
          ...sanitizedEdits,
          dikoreksiManual: true,
        },
      });

      // Pemicu Alert Nyata untuk draf yang disetujui (Tahap 3D)
      await triggerAlertsForMention({
        id: updated.id,
        topik: updated.topik,
        prioritas: updated.prioritas,
        sentimen: updated.sentimen,
        sumberInput: updated.sumberInput,
        tanggalDitemukan: updated.tanggalDitemukan,
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
