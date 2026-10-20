import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  Sentiment,
  Priority,
  MentionStatus,
  InputSourceType,
} from "@prisma/client";
import {
  requireOfficer,
  isBearerAuth,
  checkMentionRateLimit,
  recordMentionAttempt,
} from "@/lib/auth/session";
import { validateThreadsUrl } from "@/lib/url";
import { maskPii } from "@/lib/pii";
import { createMentionSchema } from "@/lib/validation/schemas";
import { analyzeFallback } from "@/lib/analysis/fallbackAnalysis";
import { triggerAlertsForMention } from "@/lib/alert/service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // Endpoint cepat untuk cek duplikat URL
    const checkUrl = searchParams.get("checkUrl");
    if (checkUrl) {
      const urlCheck = validateThreadsUrl(checkUrl);
      const cleanUrl =
        urlCheck.valid && urlCheck.normalizedUrl
          ? urlCheck.normalizedUrl
          : checkUrl.trim().split("?")[0].replace("www.", "");

      const existing = await prisma.mention.findFirst({
        where: {
          OR: [
            { linkTernormalisasi: cleanUrl },
            { linkAsli: checkUrl.trim() },
            { linkAsli: cleanUrl },
          ],
        },
        select: { id: true, headline: true, linkAsli: true },
      });
      return NextResponse.json({ exists: !!existing, mention: existing });
    }

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "20", 10));
    const search = searchParams.get("search")?.trim() || "";
    const idParam = searchParams.get("id")?.trim();
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

    if (idParam) {
      where.id = idParam;
      // Bila mencari entri spesifik via id, abaikan batasan tanggal dan status draf agar entri lama selalu ditemukan
      delete where.status;
      delete where.tanggalDitemukan;
    }

    if (search) {
      where.OR = [
        { id: search },
        { linkAsli: { contains: search, mode: "insensitive" } },
        { linkTernormalisasi: { contains: search, mode: "insensitive" } },
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

function getMentionRateLimitKey(req: NextRequest): string {
  const sessionCookie = req.cookies.get("petugas_session")?.value;
  if (sessionCookie) {
    return `session:${sessionCookie.slice(-24)}`;
  }
  const authHeader = req.headers.get("authorization");
  const extHeader = req.headers.get("x-extension-token");
  const token =
    extHeader ||
    (authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null);
  if (token) {
    return `token:${token.slice(-24)}`;
  }
  const forwardedFor = req.headers.get("x-forwarded-for");
  const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : "127.0.0.1";
  return `ip:${ip}`;
}

export async function POST(req: NextRequest) {
  try {
    const authError = await requireOfficer(req, { allowBearer: true });
    if (authError) return authError;

    // Rate Limiting: 60 pembuatan mention per menit per sesi/token (mendukung burst 50 item impor)
    const rateLimitKey = getMentionRateLimitKey(req);
    const rateLimit = checkMentionRateLimit(rateLimitKey);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: `Terlalu banyak permintaan pembuatan mention. Silakan tunggu ${rateLimit.retryAfterSeconds} detik.`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds || 60),
          },
        }
      );
    }
    recordMentionAttempt(rateLimitKey);

    const isBearer = isBearerAuth(req);

    const rawBody = await req.json().catch(() => null);
    if (!rawBody) {
      return NextResponse.json(
        { ok: false, error: "Bad Request: Body JSON tidak boleh kosong." },
        { status: 400 }
      );
    }

    if (Array.isArray(rawBody) && rawBody.length > 50) {
      return NextResponse.json(
        {
          ok: false,
          error: "Batas maksimal impor massal adalah 50 item sekaligus.",
        },
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

    // Status kanonik (Tahap 3B):
    // Bila tautan /share/ tanpa pratinjau, simpan tautan asli apa adanya,
    // tandai "BELUM_DIKETAHUI", dan JANGAN melakukan permintaan jaringan untuk mencarinya.
    const isShareLink =
      linkAsli.includes("/share/") ||
      (urlCheck.normalizedUrl && urlCheck.normalizedUrl.includes("/share/"));

    let cleanUrl = urlCheck.normalizedUrl;
    let statusKanonik = isShareLink ? "BELUM_DIKETAHUI" : "DIKETAHUI";

    if (parsed.data.linkTernormalisasi) {
      const canonCheck = validateThreadsUrl(parsed.data.linkTernormalisasi);
      if (canonCheck.valid && canonCheck.normalizedUrl) {
        cleanUrl = canonCheck.normalizedUrl;
        if (cleanUrl.includes("/post/")) {
          statusKanonik = "DIKETAHUI";
        }
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
    const rawText = (teksPostingan || "").trim();
    const { maskedText: safeText } = maskPii(rawText);
    const isEmptyText = safeText.trim().length === 0;

    let finalTopik: string | null = null;
    let safeHeadline = "";
    let safeRingkasan = "";
    let finalSentimen = sentimen || Sentiment.NETRAL;
    let finalPrioritas = prioritas || Priority.RUTIN;
    let finalKataKunci: string[] = [];
    let finalPenyedia: string | null = null;

    // Tahap 3B: Draf tanpa teks TIDAK dianalisis
    if (!isEmptyText) {
      const fallbackResult = analyzeFallback(safeText);

      safeHeadline = maskPii(
        headline || fallbackResult.headline
      ).maskedText.slice(0, 100);
      safeRingkasan = maskPii(
        ringkasan || fallbackResult.ringkasan
      ).maskedText.slice(0, 400);

      // Aturan Penentuan Topik Otomatis jika topik belum dipilih atau "Lainnya"
      finalTopik =
        topik &&
        topik !== "Lainnya" &&
        topik !== "Semua" &&
        topik !== "Semua Topik"
          ? topik
          : fallbackResult.topik;

      finalSentimen = sentimen || (fallbackResult.sentimen as Sentiment);
      finalPrioritas = prioritas || (fallbackResult.prioritas as Priority);
      finalKataKunci =
        Array.isArray(kataKunci) && kataKunci.length > 0
          ? kataKunci
          : fallbackResult.kataKunci;
      finalPenyedia = penyediaAnalisis || fallbackResult.penyedia;
    }

    // Aturan Otentikasi & Status (Tahap 1.7 & Tahap 3B):
    // 1. Permintaan via Bearer (ekstensi) HARUS dipaksa status=DRAF & sumber=EKSTENSI
    // 2. Draf tanpa teks (impor tunggal/massal) WAJIB status=DRAF
    let targetStatus: MentionStatus;
    let targetSumber: InputSourceType;

    if (isBearer) {
      targetStatus = MentionStatus.DRAF;
      targetSumber = InputSourceType.EKSTENSI;
    } else if (isEmptyText) {
      targetStatus = MentionStatus.DRAF;
      targetSumber = sumberInput || InputSourceType.FORM;
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
        statusKanonik,
        teksPostingan: safeText,
        sumberInput: targetSumber,
        topik: finalTopik,
        sentimen: finalSentimen,
        prioritas: finalPrioritas,
        status: targetStatus,
        headline: safeHeadline,
        ringkasan: safeRingkasan,
        kataKunci: finalKataKunci,
        penyediaAnalisis: finalPenyedia,
      },
    });

    // Pemicu Alert Nyata (Tahap 3D): Deteksi lonjakan / perlu perhatian
    if (newMention.status !== MentionStatus.DRAF) {
      await triggerAlertsForMention({
        id: newMention.id,
        topik: newMention.topik,
        prioritas: newMention.prioritas,
        sentimen: newMention.sentimen,
        sumberInput: newMention.sumberInput,
        tanggalDitemukan: newMention.tanggalDitemukan,
      });
    }

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
