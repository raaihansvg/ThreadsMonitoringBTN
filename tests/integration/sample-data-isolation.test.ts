import { describe, it, expect } from "vitest";
import { POST as postSampleData } from "@/app/api/sample-data/route";
import { GET as getDrafts } from "@/app/api/drafts/route";
import { GET as getAlerts } from "@/app/api/alerts/route";
import { GET as getDashboard } from "@/app/api/dashboard/route";
import { prisma } from "@/lib/prisma";
import { createSignedSessionToken } from "@/lib/auth/session";
import { NextRequest } from "next/server";
import { InputSourceType, MentionStatus, AlertType } from "@prisma/client";

describe("Isolasi Data Contoh & Pembersihan Penuh (Tahap 3E - Item 2)", () => {
  const sessionToken = createSignedSessionToken();

  it("seluruh data yang dibuat /api/sample-data (mention, draf, alert) bersumberInput CONTOH dan draf berstatus DRAF", async () => {
    // 1. Seed data contoh via endpoint
    const seedReq = new NextRequest("http://localhost:3000/api/sample-data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Host: "localhost:3000",
        Cookie: `petugas_session=${sessionToken}`,
      },
      body: JSON.stringify({ action: "seed" }),
    });

    const seedRes = await postSampleData(seedReq);
    expect(seedRes.status).toBe(200);

    // 2. Verifikasi seluruh mention contoh ber-sumberInput CONTOH
    const sampleMentions = await prisma.mention.findMany({
      where: { sumberInput: InputSourceType.CONTOH },
    });
    expect(sampleMentions.length).toBeGreaterThan(0);

    // Harus ada draf contoh dan statusnya tetap DRAF dengan sumberInput CONTOH
    const sampleDrafts = sampleMentions.filter(
      (m) => m.status === MentionStatus.DRAF
    );
    expect(sampleDrafts.length).toBeGreaterThanOrEqual(2);
    for (const d of sampleDrafts) {
      expect(d.status).toBe(MentionStatus.DRAF);
      expect(d.sumberInput).toBe(InputSourceType.CONTOH);
    }

    // 3. Verifikasi seluruh alert contoh ber-sumberInput CONTOH
    const sampleAlerts = await prisma.alert.findMany({
      where: { sumberInput: InputSourceType.CONTOH },
    });
    expect(sampleAlerts.length).toBeGreaterThan(0);

    // Pastikan alert Perlu Perhatian contoh memiliki ambangDipakai = null dan jumlah = 1
    const perluPerhatianAlert = sampleAlerts.find(
      (a) => a.jenis === AlertType.PERLU_PERHATIAN
    );
    expect(perluPerhatianAlert).toBeDefined();
    expect(perluPerhatianAlert?.ambangDipakai).toBeNull();
    expect(perluPerhatianAlert?.jumlah).toBe(1);

    // 4. Buat satu mention dan alert nyata untuk membuktikan pemisahan
    await prisma.mention.create({
      data: {
        linkAsli: "https://www.threads.com/@user/post/real_post_1",
        linkTernormalisasi: "https://threads.com/@user/post/real_post_1",
        teksPostingan: "Postingan nyata dari operasional.",
        sumberInput: InputSourceType.FORM,
        status: MentionStatus.BARU,
      },
    });

    await prisma.alert.create({
      data: {
        jenis: AlertType.PERLU_PERHATIAN,
        topik: "Layanan Nyata",
        periode: "19 Okt 2026",
        jumlah: 1,
        ambangDipakai: null,
        sumberInput: InputSourceType.FORM,
      },
    });

    // 5. Verifikasi saat includeSample=false, draf dan alert contoh TIDAK dihitung/disertakan
    const draftsReq = new NextRequest(
      "http://localhost:3000/api/drafts?includeSample=false",
      {
        headers: { Cookie: `petugas_session=${sessionToken}` },
      }
    );
    const draftsRes = await getDrafts(draftsReq);
    const draftsData = await draftsRes.json();
    expect(draftsData.drafts.length).toBe(0);

    const alertsReq = new NextRequest(
      "http://localhost:3000/api/alerts?includeSample=false",
      {
        headers: { Cookie: `petugas_session=${sessionToken}` },
      }
    );
    const alertsRes = await getAlerts(alertsReq);
    const alertsData = await alertsRes.json();
    expect(alertsData.alerts.length).toBe(1);
    expect(alertsData.alerts[0].sumberInput).toBe("FORM");

    const dashReq = new NextRequest(
      "http://localhost:3000/api/dashboard?includeSample=false",
      {
        headers: { Cookie: `petugas_session=${sessionToken}` },
      }
    );
    const dashRes = await getDashboard(dashReq);
    const dashData = await dashRes.json();
    expect(dashData.draftsCount).toBe(0);
    expect(dashData.unreadAlertsCount).toBe(1);

    // 6. Action "clear" menghapus SEMUA data contoh tanpa menghapus data nyata
    const clearReq = new NextRequest("http://localhost:3000/api/sample-data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Host: "localhost:3000",
        Cookie: `petugas_session=${sessionToken}`,
      },
      body: JSON.stringify({ action: "clear" }),
    });
    const clearRes = await postSampleData(clearReq);
    expect(clearRes.status).toBe(200);

    const remainingSampleMentions = await prisma.mention.count({
      where: { sumberInput: InputSourceType.CONTOH },
    });
    const remainingSampleAlerts = await prisma.alert.count({
      where: { sumberInput: InputSourceType.CONTOH },
    });
    expect(remainingSampleMentions).toBe(0);
    expect(remainingSampleAlerts).toBe(0);

    // Data nyata tetap ada utuh
    const remainingRealMentions = await prisma.mention.count({
      where: { sumberInput: InputSourceType.FORM },
    });
    const remainingRealAlerts = await prisma.alert.count({
      where: { sumberInput: InputSourceType.FORM },
    });
    expect(remainingRealMentions).toBe(1);
    expect(remainingRealAlerts).toBe(1);
  });
});
