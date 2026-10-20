import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock prisma client
vi.mock("@/lib/prisma", () => {
  return {
    prisma: {
      mention: {
        findMany: vi.fn(),
      },
    },
  };
});

import { prisma } from "@/lib/prisma";
import { GET as exportGet } from "@/app/api/export/route";

describe("Validasi Ekspor Laporan (FR-17, AC-08, Tahap 1.7)", () => {
  const host = "localhost:3000";
  const baseUrl = `http://${host}`;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ekspor CSV tidak memuat status DRAF, dan data CONTOH ditandai jelas", async () => {
    const mockMentions = [
      {
        id: "m-1",
        tanggalDitemukan: new Date("2026-10-15T10:00:00Z"),
        topik: "KPR BTN",
        sentimen: "POSITIF",
        prioritas: "RUTIN",
        status: "BARU",
        sumberInput: "FORM",
        headline: "Apresiasi Bunga KPR Rendah",
        ringkasan: "Nasabah puas dengan program promo KPR BTN.",
        teksPostingan: "Terima kasih BTN atas proses KPR cepat.",
        linkAsli: "https://www.threads.net/@user/post/111",
      },
      {
        id: "m-2",
        tanggalDitemukan: new Date("2026-10-16T11:00:00Z"),
        topik: "BTN Mobile",
        sentimen: "POSITIF",
        prioritas: "RUTIN",
        status: "SELESAI",
        sumberInput: "CONTOH", // Data sintetis demo
        headline: "Data Contoh Simulasi Mobile Banking",
        ringkasan: "Postingan simulasi untuk keperluan demonstrasi.",
        teksPostingan: "Login lancar jaya pakai aplikasi terbaru.",
        linkAsli: "https://www.threads.net/@user/post/222",
      },
    ];

    (prisma.mention.findMany as any).mockResolvedValue(mockMentions);

    const req = new NextRequest(
      `${baseUrl}/api/export?format=csv&includeSample=true`,
      {
        method: "GET",
        headers: { host },
      }
    );

    const res = await exportGet(req);
    expect(res.status).toBe(200);

    // 1. Verifikasi filter query ke database mengecualikan DRAF
    expect(prisma.mention.findMany).toHaveBeenCalledTimes(1);
    const queryArgs = (prisma.mention.findMany as any).mock.calls[0][0];
    expect(queryArgs.where.status).toEqual({ not: "DRAF" });

    // 2. Verifikasi konten teks CSV
    const csvText = await res.text();

    // Data DRAF tidak boleh ada di keluaran
    expect(csvText).not.toContain("DRAF");

    // Data CONTOH harus ditandai dengan CONTOH (SIMULASI)
    expect(csvText).toContain("CONTOH (SIMULASI)");
    expect(csvText).toContain("Apresiasi Bunga KPR Rendah");
    expect(csvText).toContain("Data Contoh Simulasi Mobile Banking");
  });

  it("ekspor XLSX tidak memuat status DRAF dan berhasil menghasilkan berkas spreadsheet", async () => {
    const mockMentions = [
      {
        id: "m-contoh-1",
        tanggalDitemukan: new Date("2026-10-17T12:00:00Z"),
        topik: "Layanan Kantor Cabang",
        sentimen: "NETRAL",
        prioritas: "PANTAU",
        status: "DIPANTAU",
        sumberInput: "CONTOH",
        headline: "Pelayanan Cabang Ramai",
        ringkasan: "Simulasi keramaian antrean kantor cabang.",
        teksPostingan: "Antrean cabang cukup padat siang ini.",
        linkAsli: "https://www.threads.net/@user/post/333",
      },
    ];

    (prisma.mention.findMany as any).mockResolvedValue(mockMentions);

    const req = new NextRequest(`${baseUrl}/api/export?format=xlsx`, {
      method: "GET",
      headers: { host },
    });

    const res = await exportGet(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("spreadsheetml.sheet");

    // Query ke database tetap mengecualikan DRAF
    const queryArgs = (prisma.mention.findMany as any).mock.calls[0][0];
    expect(queryArgs.where.status).toEqual({ not: "DRAF" });
  });

  it("ekspor PDF menghasilkan dokumen HTML siap cetak dengan kop surat BTN, gaya A4, ringkasan angka, dan tombol cetak", async () => {
    const mockMentions = [
      {
        id: "m-pdf-1",
        tanggalDitemukan: new Date("2026-10-18T09:00:00Z"),
        topik: "KPR BTN",
        sentimen: "POSITIF",
        prioritas: "RUTIN",
        status: "BARU",
        sumberInput: "FORM",
        headline: "Akad KPR BTN Lancar",
        ringkasan: "Proses akad berjalan lancar di KC Surabaya.",
        teksPostingan: "Alhamdulillah akad KPR BTN lancar jaya.",
        linkAsli: "https://www.threads.net/@user/post/pdf1",
        linkTernormalisasi: "https://threads.net/post/pdf1",
      },
      {
        id: "m-pdf-2",
        tanggalDitemukan: new Date("2026-10-18T10:00:00Z"),
        topik: "BTN Mobile",
        sentimen: "NEGATIF",
        prioritas: "PERLU_PERHATIAN",
        status: "DIPANTAU",
        sumberInput: "CONTOH",
        headline: "Kendala Transfer",
        ringkasan: "Simulasi kendala transfer pada aplikasi.",
        teksPostingan: "Transfer tertahan tapi saldo terpotong.",
        linkAsli: "https://www.threads.net/@user/post/pdf2",
        linkTernormalisasi: "https://threads.net/post/pdf2",
      },
    ];

    (prisma.mention.findMany as any).mockResolvedValue(mockMentions);

    const req = new NextRequest(
      `${baseUrl}/api/export?format=pdf&includeSample=true&topik=Semua`,
      {
        method: "GET",
        headers: { host },
      }
    );

    const res = await exportGet(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");

    const html = await res.text();

    // 1. Kop surat BTN
    expect(html).toContain("PT Bank Tabungan Negara (Persero) Tbk");
    expect(html).toContain("Laporan Monitoring Media Sosial Threads");

    // 2. Tombol Cetak / Simpan PDF
    expect(html).toContain("Cetak / Simpan PDF");
    expect(html).toContain('onclick="window.print()"');

    // 3. Gaya cetak A4
    expect(html).toContain("@page { size: A4 landscape; margin: 12mm; }");

    // 4. Ringkasan angka metrik
    expect(html).toContain("Total Mention");
    expect(html).toContain("Sentimen Positif");
    expect(html).toContain("Sentimen Negatif");
    expect(html).toContain("Perlu Perhatian");

    // 5. Data contoh bertanda badge CONTOH
    expect(html).toContain("badge badge-contoh");
    expect(html).toContain("CONTOH");

    // 6. DRAF tidak disertakan dalam pencarian DB
    const queryArgs = (prisma.mention.findMany as any).mock.calls[0][0];
    expect(queryArgs.where.status).toEqual({ not: "DRAF" });
  });
});
