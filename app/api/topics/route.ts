import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOfficer } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const topics = await prisma.topic.findMany({
      orderBy: { nama: "asc" },
    });
    return NextResponse.json({ ok: true, topics });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Gagal memuat topik",
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
    const { id, nama, kataKunci, aktif } = body;

    if (!nama || typeof nama !== "string") {
      return NextResponse.json(
        { ok: false, error: "Nama topik wajib diisi." },
        { status: 400 }
      );
    }

    if (id) {
      const updated = await prisma.topic.update({
        where: { id },
        data: {
          nama: nama.trim(),
          kataKunci: Array.isArray(kataKunci) ? kataKunci : [],
          aktif: aktif !== undefined ? Boolean(aktif) : true,
        },
      });
      return NextResponse.json({ ok: true, topic: updated });
    }

    const created = await prisma.topic.create({
      data: {
        nama: nama.trim(),
        kataKunci: Array.isArray(kataKunci) ? kataKunci : [],
        aktif: aktif !== undefined ? Boolean(aktif) : true,
      },
    });

    return NextResponse.json({ ok: true, topic: created });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Gagal menyimpan topik",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authError = await requireOfficer(req);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "ID topik wajib diisi." },
        { status: 400 }
      );
    }

    await prisma.topic.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true, message: "Topik berhasil dihapus." });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Gagal menghapus topik",
      },
      { status: 500 }
    );
  }
}
