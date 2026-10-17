import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MentionStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookie = req.cookies.get("petugas_session");
    if (cookie?.value !== "authenticated") {
      return NextResponse.json(
        {
          ok: false,
          error: "Aksi ditolak. Masuk sebagai Petugas Input terlebih dahulu.",
        },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const { status, topik, sentimen, prioritas } = body;

    const updated = await prisma.mention.update({
      where: { id },
      data: {
        ...(status ? { status: status as MentionStatus } : {}),
        ...(topik ? { topik } : {}),
        ...(sentimen ? { sentimen } : {}),
        ...(prioritas ? { prioritas } : {}),
        dikoreksiManual: true,
      },
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
    const cookie = req.cookies.get("petugas_session");
    if (cookie?.value !== "authenticated") {
      return NextResponse.json(
        {
          ok: false,
          error: "Aksi ditolak. Masuk sebagai Petugas Input terlebih dahulu.",
        },
        { status: 403 }
      );
    }

    const { id } = await params;
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
