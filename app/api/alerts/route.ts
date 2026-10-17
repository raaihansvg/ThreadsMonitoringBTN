import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOfficer } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter") || "all";

    const where: Record<string, unknown> = {};
    if (filter === "unread") {
      where.dibaca = false;
    }

    const alerts = await prisma.alert.findMany({
      where,
      orderBy: { dibuatPada: "desc" },
    });

    return NextResponse.json({ ok: true, alerts });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Gagal memuat alert",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authError = await requireOfficer(req);
    if (authError) return authError;

    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "ID alert wajib diisi." },
        { status: 400 }
      );
    }

    const updated = await prisma.alert.update({
      where: { id },
      data: { dibaca: true },
    });

    return NextResponse.json({ ok: true, alert: updated });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Gagal menandai alert",
      },
      { status: 500 }
    );
  }
}
