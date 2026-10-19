import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { InputSourceType } from "@prisma/client";
import { requireOfficer } from "@/lib/auth/session";
import { updateAlertSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter") || "all";
    const includeSample = searchParams.get("includeSample") !== "false";

    const where: Record<string, unknown> = {
      ...(includeSample
        ? {}
        : { sumberInput: { not: InputSourceType.CONTOH } }),
    };
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

    const rawBody = await req.json().catch(() => null);
    if (!rawBody) {
      return NextResponse.json(
        { ok: false, error: "Body JSON tidak boleh kosong." },
        { status: 400 }
      );
    }

    const parsed = updateAlertSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: parsed.error.issues[0]?.message || "ID alert tidak valid.",
        },
        { status: 400 }
      );
    }

    const { id } = parsed.data;

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
