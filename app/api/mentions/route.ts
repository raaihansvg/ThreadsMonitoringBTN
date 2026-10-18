import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  Sentiment,
  Priority,
  MentionStatus,
  InputSourceType,
} from "@prisma/client";
import { requireOfficer, isBearerAuth } from "@/lib/auth/session";
import { validateThreadsUrl } from "@/lib/url";
import { maskPii } from "@/lib/pii";
import { createMentionSchema } from "@/lib/validation/schemas";
import { selectTopic } from "@/lib/analysis/topicSelector";

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

    if (topik && topik !== "Semua" && topik !== "Semua Topik") {
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
    const authError = await requireOfficer(req, { allowBearer: true });
    if (authError) return authError;

    const isBearer = isBearerAuth(req);

    const rawBody = await req.json().catch(() => null);
    if (!rawBody) {
      return NextResponse.json(
        { ok: false, error: "Bad Request: Body JSON tidak boleh kosong." },
        { status: 400 }
      );
    }

    // 1. Validasi Payload dengan Zod Schema
    const parsed = createMentionSchema.safeParse(rawBody);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        {
          ok: false,
          error: `Validasi gagal: ${firstIssue?.message || "Format data tidak sesuai."}`,
        },
        { status: 400 }
      );
    }

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
      status: requestStatus,
    } = parsed.data;

    // AC-01: Validasi URL Threads resmi (HTTPS & domain threads.net / threads.com)
    const urlCheck = validateThreadsUrl(linkAsli);
    if (!urlCheck.valid || !urlCheck.normalizedUrl) {
      return NextResponse.json(
        {
          ok: false,
          error:
            urlCheck.error ||
            "Tautan harus HTTPS dengan host threads.net atau threads.com.",
        },
        { status: 400 }
      );
    }

    // Pakai alamat kanonik /@akun/post/<id> (tanpa query) jika ada dari hasil pratinjau redirect
    let cleanUrl = urlCheck.normalizedUrl;
    if (parsed.data.linkTernormalisasi) {
      const canonCheck = validateThreadsUrl(parsed.data.linkTernormalisasi);
      if (canonCheck.valid && canonCheck.normalizedUrl) {
        cleanUrl = canonCheck.normalizedUrl;
      }
    }

    // AC-03: Cek duplikasi dengan tautan ternormalisasi
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

    // AC-05: Penyamaran PII DI SERVER (Server-Side Sanitization)
    const { maskedText: safeText } = maskPii(teksPostingan);
    const { maskedText: safeHeadline } = maskPii(
      headline || safeText.slice(0, 80)
    );
    const { maskedText: safeRingkasan } = maskPii(
      ringkasan || safeText.slice(0, 300)
    );

    // Aturan Penentuan Topik Otomatis jika topik belum dipilih atau "Lainnya"
    const finalTopik =
      topik &&
      topik !== "Lainnya" &&
      topik !== "Semua" &&
      topik !== "Semua Topik"
        ? topik
        : selectTopic(safeText);

    // Aturan Otentikasi & Status (Tahap 1.7):
    // Permintaan yang diautentikasi lewat Bearer token (ekstensi) HARUS dipaksa
    // status=DRAF dan sumberInput=EKSTENSI di server, mengabaikan nilai payload (FR-09 & AC-06)
    let targetStatus: MentionStatus;
    let targetSumber: InputSourceType;

    if (isBearer) {
      targetStatus = MentionStatus.DRAF;
      targetSumber = InputSourceType.EKSTENSI;
    } else {
      const isDraftSource =
        sumberInput === InputSourceType.IMPOR ||
        sumberInput === InputSourceType.EKSTENSI ||
        requestStatus === MentionStatus.DRAF;
      targetStatus = isDraftSource ? MentionStatus.DRAF : MentionStatus.BARU;
      targetSumber = sumberInput || InputSourceType.FORM;
    }

    const newMention = await prisma.mention.create({
      data: {
        linkAsli,
        linkTernormalisasi: cleanUrl,
        teksPostingan: safeText,
        sumberInput: targetSumber,
        topik: finalTopik,
        sentimen: sentimen || Sentiment.NETRAL,
        prioritas: prioritas || Priority.RUTIN,
        status: targetStatus,
        headline: safeHeadline.slice(0, 100),
        ringkasan: safeRingkasan.slice(0, 400),
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
