import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  Sentiment,
  Priority,
  MentionStatus,
  InputSourceType,
} from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // Endpoint cepat untuk cek duplikat URL
    const checkUrl = searchParams.get("checkUrl");
    if (checkUrl) {
      const cleanUrl = checkUrl.trim().split("?")[0].replace("www.", "");
      const existing = await prisma.mention.findUnique({
        where: { linkTernormalisasi: cleanUrl },
        select: { id: true, headline: true, linkAsli: true },
      });
      return NextResponse.json({ exists: !!existing, mention: existing });
    }

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "20", 10));
    const search = searchParams.get("search")?.trim() || "";
    const topik = searchParams.get("topik")?.trim();
    const sentimen = searchParams.get("sentimen")?.trim() as
      | Sentiment
      | undefined;
    const prioritas = searchParams.get("prioritas")?.trim() as
      | Priority
      | undefined;
    const status = searchParams.get("status")?.trim() as
      | MentionStatus
      | undefined;
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const includeSample = searchParams.get("includeSample") !== "false";

    const where: Record<string, unknown> = {
      // By default list only non-draft in regular mention list (drafts are in /draf)
      status: status || { not: MentionStatus.DRAF },
      ...(includeSample
        ? {}
        : { sumberInput: { not: InputSourceType.CONTOH } }),
    };

    if (topik && topik !== "Semua") {
      where.topik = topik;
    }
    if (sentimen) {
      where.sentimen = sentimen;
    }
    if (prioritas) {
      where.prioritas = prioritas;
    }

    if (startDateParam || endDateParam) {
      const dateFilter: Record<string, Date> = {};
      if (startDateParam) dateFilter.gte = new Date(startDateParam);
      if (endDateParam) dateFilter.lte = new Date(endDateParam);
      where.tanggalDitemukan = dateFilter;
    }

    if (search) {
      where.OR = [
        { headline: { contains: search, mode: "insensitive" } },
        { ringkasan: { contains: search, mode: "insensitive" } },
        { teksPostingan: { contains: search, mode: "insensitive" } },
        { kataKunci: { has: search.toLowerCase() } },
      ];
    }

    const [total, mentions] = await Promise.all([
      prisma.mention.count({ where }),
      prisma.mention.findMany({
        where,
        orderBy: { tanggalDitemukan: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return NextResponse.json({
      mentions,
      total,
      page,
      totalPages,
      limit,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Gagal memuat mention",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const {
      linkAsli,
      teksPostingan,
      topik,
      sentimen,
      prioritas,
      headline,
      ringkasan,
      kataKunci,
      penyediaAnalisis,
      sumberInput,
    } = body;

    if (!linkAsli || typeof linkAsli !== "string") {
      return NextResponse.json(
        { ok: false, error: "Tautan Threads wajib diisi." },
        { status: 400 }
      );
    }

    // Normalisasi link
    const cleanUrl = linkAsli.trim().split("?")[0].replace("www.", "");
    if (
      !cleanUrl.startsWith("https://threads.net") &&
      !cleanUrl.startsWith("https://threads.com")
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Tautan harus HTTPS dengan host threads.net atau threads.com.",
        },
        { status: 400 }
      );
    }

    // Cek duplikasi
    const existing = await prisma.mention.findUnique({
      where: { linkTernormalisasi: cleanUrl },
    });
    if (existing) {
      return NextResponse.json(
        {
          ok: false,
          error: "Tautan ini sudah tercatat di sistem.",
          existingId: existing.id,
        },
        { status: 409 }
      );
    }

    // Samarkan PII sederhana pada teks
    let maskedText = teksPostingan || "";
    maskedText = maskedText
      .replace(
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
        "[EMAIL_TERSEMBUNYI]"
      )
      .replace(/(?:\+?62|08)[0-9]{8,12}/g, "[NOMOR_TELEPON_TERSEMBUNYI]")
      .replace(/\b\d{10,16}\b/g, "[NOMOR_REKENING_TERSEMBUNYI]");

    const newMention = await prisma.mention.create({
      data: {
        linkAsli,
        linkTernormalisasi: cleanUrl,
        teksPostingan: maskedText,
        sumberInput: sumberInput || InputSourceType.FORM,
        topik: topik || "Lainnya",
        sentimen: sentimen || Sentiment.NETRAL,
        prioritas: prioritas || Priority.RUTIN,
        status: MentionStatus.BARU,
        headline: headline?.slice(0, 100) || "Mention Threads Baru",
        ringkasan: ringkasan?.slice(0, 400) || maskedText.slice(0, 300),
        kataKunci: Array.isArray(kataKunci) ? kataKunci : [],
        penyediaAnalisis: penyediaAnalisis || "manual",
      },
    });

    return NextResponse.json({ ok: true, mention: newMention });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Gagal menyimpan mention",
      },
      { status: 500 }
    );
  }
}
