import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MentionStatus, InputSourceType } from "@prisma/client";
import { requireOfficer } from "@/lib/auth/session";

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

    const body = await req.json();
    const { id, action, edits } = body;

    if (!id || !action) {
      return NextResponse.json(
        { ok: false, error: "ID dan aksi wajib diisi." },
        { status: 400 }
      );
    }

    if (action === "approve") {
      const updated = await prisma.mention.update({
        where: { id },
        data: {
          status: MentionStatus.BARU,
          ...(edits || {}),
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
