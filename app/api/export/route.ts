import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { MentionStatus, InputSourceType } from "@prisma/client";
import { sanitizeFormulaInjection } from "@/lib/export/sanitize";
import { escapeHtml, safeHttpsUrl } from "@/lib/security/escapeHtml";
import ExcelJS from "exceljs";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const format = (searchParams.get("format") || "csv").toLowerCase();
    const topik = searchParams.get("topik");
    const sentimenParam = searchParams.get("sentimen");
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const includeSample = searchParams.get("includeSample") !== "false";

    // DRAF selalu dikecualikan dari ekspor laporan
    const where: Record<string, unknown> = {
      status: { not: MentionStatus.DRAF },
      ...(includeSample
        ? {}
        : { sumberInput: { not: InputSourceType.CONTOH } }),
    };

    if (topik && topik !== "Semua" && topik !== "Semua Topik") {
      where.topik = topik;
    }

    if (sentimenParam && sentimenParam !== "Semua") {
      where.sentimen = sentimenParam;
    }

    if (startDateParam || endDateParam) {
      const dateFilter: Record<string, Date> = {};
      if (startDateParam) dateFilter.gte = new Date(startDateParam);
      if (endDateParam) {
        const end = new Date(endDateParam);
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }
      where.tanggalDitemukan = dateFilter;
    }

    const mentions = await prisma.mention.findMany({
      where,
      orderBy: { tanggalDitemukan: "desc" },
    });

    const headers = [
      "ID",
      "Tanggal Ditemukan",
      "Topik",
      "Sentimen",
      "Prioritas",
      "Status",
      "Sumber Data",
      "Headline",
      "Ringkasan",
      "Teks Postingan (Disamarkan)",
      "Tautan Sumber Threads",
    ];

    // Persiapkan baris data dengan sanitasi Formula Injection pada setiap sel
    const sanitizedRows = mentions.map((m) => {
      const isContoh = m.sumberInput === InputSourceType.CONTOH;
      const sumberTag = isContoh ? "CONTOH (SIMULASI)" : m.sumberInput;

      return [
        sanitizeFormulaInjection(m.id),
        sanitizeFormulaInjection(new Date(m.tanggalDitemukan).toISOString()),
        sanitizeFormulaInjection(m.topik || "Lainnya"),
        sanitizeFormulaInjection(m.sentimen),
        sanitizeFormulaInjection(m.prioritas),
        sanitizeFormulaInjection(m.status),
        sanitizeFormulaInjection(sumberTag),
        sanitizeFormulaInjection(m.headline || ""),
        sanitizeFormulaInjection(m.ringkasan || ""),
        sanitizeFormulaInjection(m.teksPostingan),
        sanitizeFormulaInjection(m.linkAsli),
      ];
    });

    const timestamp = Date.now();

    // 1. FORMAT CSV
    if (format === "csv") {
      const csvLines = [
        headers.map((h) => `"${h}"`).join(","),
        ...sanitizedRows.map((row) =>
          row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")
        ),
      ];

      // UTF-8 BOM (\uFEFF) untuk kompatibilitas Excel Indonesia
      const csvContent = "\uFEFF" + csvLines.join("\r\n");
      const filename = `Laporan_ThreadsMonitoring_BTN_${timestamp}.csv`;

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // 2. FORMAT EXCEL (.xlsx sungguhan menggunakan ExcelJS yang aman)
    if (format === "xlsx" || format === "excel") {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "BTN Threads Monitoring";
      workbook.created = new Date();
      const worksheet = workbook.addWorksheet("Mentions BTN");

      worksheet.columns = [
        { header: "ID", width: 15 },
        { header: "Tanggal Ditemukan", width: 22 },
        { header: "Topik", width: 18 },
        { header: "Sentimen", width: 12 },
        { header: "Prioritas", width: 16 },
        { header: "Status", width: 14 },
        { header: "Sumber Data", width: 20 },
        { header: "Headline", width: 35 },
        { header: "Ringkasan", width: 45 },
        { header: "Teks Postingan (Disamarkan)", width: 50 },
        { header: "Tautan Sumber Threads", width: 40 },
      ];

      // Format header baris pertama
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0A192F" },
      };

      sanitizedRows.forEach((row) => {
        worksheet.addRow(row);
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const filename = `Laporan_ThreadsMonitoring_BTN_${timestamp}.xlsx`;

      return new NextResponse(Buffer.from(buffer), {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // 3. FORMAT PDF / PRINTABLE HTML (AC-13: judul, rentang tanggal, filter aktif, ringkasan angka, tabel)
    if (format === "pdf" || format === "html") {
      const totalCount = mentions.length;
      const positifCount = mentions.filter(
        (m) => m.sentimen === "POSITIF"
      ).length;
      const netralCount = mentions.filter(
        (m) => m.sentimen === "NETRAL"
      ).length;
      const negatifCount = mentions.filter(
        (m) => m.sentimen === "NEGATIF"
      ).length;
      const urgentCount = mentions.filter(
        (m) => m.prioritas === "PERLU_PERHATIAN"
      ).length;
      const contohCount = mentions.filter(
        (m) => m.sumberInput === InputSourceType.CONTOH
      ).length;

      const dateStr =
        startDateParam || endDateParam
          ? `${startDateParam || "Awal"} s/d ${endDateParam || "Sekarang"}`
          : "Semua Rentang Waktu";

      const nonce = crypto.randomBytes(16).toString("base64");

      const htmlContent = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Laporan Threads Monitoring - Bank BTN</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0A192F; margin: 0; padding: 20px; font-size: 11px; }
    .header { border-bottom: 2px solid #0055FF; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start; }
    .title { font-size: 20px; font-weight: bold; color: #0055FF; margin: 0; }
    .subtitle { font-size: 13px; color: #475569; margin-top: 4px; }
    .filter-box { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; display: flex; gap: 24px; flex-wrap: wrap; }
    .metric-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 20px; }
    .metric-card { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px 14px; text-align: center; }
    .metric-val { font-size: 22px; font-weight: bold; color: #0A192F; }
    .metric-lbl { font-size: 10px; color: #5A6A7E; text-transform: uppercase; font-weight: 600; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #0A192F; color: white; text-align: left; padding: 8px; font-size: 10px; font-weight: 600; text-transform: uppercase; }
    td { padding: 8px; border-bottom: 1px solid #E2E8F0; vertical-align: top; }
    tr:nth-child(even) { background-color: #F8FAFC; }
    .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; }
    .badge-positif { background: #EBF3FF; color: #0055FF; }
    .badge-netral { background: #F1F5F9; color: #475569; }
    .badge-negatif { background: #FEF2F2; color: #C10010; }
    .badge-urgent { background: #E60012; color: #FFFFFF; }
    .badge-contoh { background: #FEF3C7; color: #92400E; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="title">PT Bank Tabungan Negara (Persero) Tbk</h1>
      <div class="subtitle">Laporan Monitoring Media Sosial Threads (Social Listening & Analytics)</div>
    </div>
    <div style="text-align: right;">
      <div style="font-weight: bold;">Dicetak: ${escapeHtml(new Date().toLocaleString("id-ID"))}</div>
      <div class="no-print" style="margin-top: 8px;">
        <button id="btnPrint" style="background: #0055FF; color: white; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-weight: bold;">Cetak / Simpan PDF</button>
      </div>
    </div>
  </div>

  <div class="filter-box">
    <div><strong>Rentang Tanggal:</strong> ${escapeHtml(dateStr)}</div>
    <div><strong>Filter Topik:</strong> ${escapeHtml(topik || "Semua Topik")}</div>
    <div><strong>Filter Sentimen:</strong> ${escapeHtml(sentimenParam || "Semua")}</div>
    <div><strong>Termasuk Data Contoh:</strong> ${includeSample ? "Ya (" + contohCount + " item)" : "Tidak (Hanya Riil)"}</div>
  </div>

  <div class="metric-grid">
    <div class="metric-card">
      <div class="metric-val">${totalCount}</div>
      <div class="metric-lbl">Total Mention</div>
    </div>
    <div class="metric-card">
      <div class="metric-val" style="color: #0055FF;">${positifCount}</div>
      <div class="metric-lbl">Sentimen Positif</div>
    </div>
    <div class="metric-card">
      <div class="metric-val" style="color: #475569;">${netralCount}</div>
      <div class="metric-lbl">Sentimen Netral</div>
    </div>
    <div class="metric-card">
      <div class="metric-val" style="color: #C10010;">${negatifCount}</div>
      <div class="metric-lbl">Sentimen Negatif</div>
    </div>
    <div class="metric-card">
      <div class="metric-val" style="color: #E60012;">${urgentCount}</div>
      <div class="metric-lbl">Perlu Perhatian</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 75px;">Tanggal</th>
        <th style="width: 100px;">Topik</th>
        <th style="width: 75px;">Sentimen</th>
        <th style="width: 90px;">Prioritas</th>
        <th style="width: 80px;">Sumber</th>
        <th>Headline & Ringkasan</th>
        <th style="width: 140px;">Tautan</th>
      </tr>
    </thead>
    <tbody>
      ${mentions
        .map((m) => {
          const safeUrl = safeHttpsUrl(m.linkAsli);
          const displayLink = escapeHtml(m.linkTernormalisasi || m.linkAsli);
          const linkHtml = safeUrl
            ? `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer" style="color: #0055FF;">${displayLink}</a>`
            : `<span>${displayLink}</span>`;

          const sumberHtml =
            m.sumberInput === "CONTOH"
              ? '<span class="badge badge-contoh">CONTOH</span>'
              : escapeHtml(m.sumberInput);

          const badgeUrgent =
            m.prioritas === "PERLU_PERHATIAN" ? "badge-urgent" : "";

          return `
        <tr>
          <td>${escapeHtml(new Date(m.tanggalDitemukan).toLocaleDateString("id-ID"))}</td>
          <td><strong>${escapeHtml(m.topik || "Lainnya")}</strong></td>
          <td><span class="badge badge-${escapeHtml(m.sentimen.toLowerCase())}">${escapeHtml(m.sentimen)}</span></td>
          <td><span class="badge ${badgeUrgent}">${escapeHtml(m.prioritas)}</span></td>
          <td>${sumberHtml}</td>
          <td>
            <strong>${escapeHtml(m.headline || "Mention Baru")}</strong>
            <div style="color: #475569; margin-top: 3px;">${escapeHtml(m.ringkasan || m.teksPostingan.slice(0, 150))}</div>
          </td>
          <td style="word-break: break-all; font-size: 9px;">${linkHtml}</td>
        </tr>`;
        })
        .join("")}
    </tbody>
  </table>
  <script nonce="${nonce}">
    document.getElementById("btnPrint")?.addEventListener("click", function() { window.print(); });
  </script>
</body>
</html>`;

      return new NextResponse(htmlContent, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src data:;`,
        },
      });
    }

    // Default: Format JSON
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
