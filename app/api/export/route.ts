import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MentionStatus, InputSourceType } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "csv";
    const topik = searchParams.get("topik");
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const includeSample = searchParams.get("includeSample") !== "false";

    const where: Record<string, unknown> = {
      status: { not: MentionStatus.DRAF },
      ...(includeSample
        ? {}
        : { sumberInput: { not: InputSourceType.CONTOH } }),
    };

    if (topik && topik !== "Semua") {
      where.topik = topik;
    }

    if (startDateParam || endDateParam) {
      const dateFilter: Record<string, Date> = {};
      if (startDateParam) dateFilter.gte = new Date(startDateParam);
      if (endDateParam) dateFilter.lte = new Date(endDateParam);
      where.tanggalDitemukan = dateFilter;
    }

    const mentions = await prisma.mention.findMany({
      where,
      orderBy: { tanggalDitemukan: "desc" },
    });

    if (format === "csv" || format === "xlsx") {
      // Format CSV dengan UTF-8 BOM (\uFEFF)
      const headers = [
        "ID",
        "Tanggal Ditemukan",
        "Topik",
        "Sentimen",
        "Prioritas",
        "Status",
        "Headline",
        "Ringkasan",
        "Teks Postingan (Disamarkan)",
        "Tautan Sumber Threads",
      ];

      const rows = mentions.map((m) => [
        `"${m.id}"`,
        `"${new Date(m.tanggalDitemukan).toISOString()}"`,
        `"${m.topik || "Lainnya"}"`,
        `"${m.sentimen}"`,
        `"${m.prioritas}"`,
        `"${m.status}"`,
        `"${(m.headline || "").replace(/"/g, '""')}"`,
        `"${(m.ringkasan || "").replace(/"/g, '""')}"`,
        `"${m.teksPostingan.replace(/"/g, '""')}"`,
        `"${m.linkAsli}"`,
      ]);

      const csvContent =
        "\uFEFF" +
        [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

      const filename = `Laporan_ThreadsMonitoring_BTN_${Date.now()}.${format === "xlsx" ? "csv" : "csv"}`;

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // Format JSON / Metadata
    return NextResponse.json({ ok: true, count: mentions.length, mentions });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Gagal mengekspor laporan",
      },
      { status: 500 }
    );
  }
}
