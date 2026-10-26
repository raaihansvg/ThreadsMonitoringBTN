import { describe, it, expect, afterAll } from "vitest";
import {
  POST as postMention,
  GET as getMentions,
} from "@/app/api/mentions/route";
import { GET as getAlerts } from "@/app/api/alerts/route";
import { prisma } from "@/lib/prisma";
import { createSignedSessionToken } from "@/lib/auth/session";
import { NextRequest } from "next/server";
import {
  InputSourceType,
  AlertType,
  Priority,
  MentionStatus,
} from "@prisma/client";
import { getDuplicateNavigationInfo } from "@/lib/modal/modalInputLifecycle";

describe("Alert Nyata & Pencarian Entri Lama (Tahap 3D)", () => {
  const testMentionIds: string[] = [];
  const testAlertIds: string[] = [];
  const sessionToken = createSignedSessionToken();

  afterAll(async () => {
    if (testAlertIds.length > 0) {
      await prisma.alert.deleteMany({ where: { id: { in: testAlertIds } } });
    }
    if (testMentionIds.length > 0) {
      await prisma.mention.deleteMany({
        where: { id: { in: testMentionIds } },
      });
    }
  });

  it("menciptakan alert nyata saat mention PERLU_PERHATIAN disimpan dan tidak tersaring saat includeSample=false", async () => {
    const uniqueId = `tahap3d_${Date.now()}`;
    const testUrl = `https://www.threads.com/@nasabah_btn/post/${uniqueId}`;

    // 1. Simpan mention nyata dengan prioritas PERLU_PERHATIAN
    const postReq = new NextRequest("http://localhost:3000/api/mentions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Host: "localhost:3000",
        Origin: "http://localhost:3000",
        Cookie: `petugas_session=${sessionToken}`,
      },
      body: JSON.stringify({
        linkAsli: testUrl,
        teksPostingan:
          "Kendala serius: dana transfer tertahan dan saldo berkurang di BTN Mobile.",
        topik: "BTN Mobile",
        sentimen: "NEGATIF",
        prioritas: Priority.PERLU_PERHATIAN,
        sumberInput: InputSourceType.FORM,
        headline: "Keluhan Saldo Tertahan di BTN Mobile",
        ringkasan:
          "Nasabah mengalami kendala saldo berkurang saat transaksi transfer.",
      }),
    });

    const postRes = await postMention(postReq);
    expect(postRes.status).toBe(200);
    const postData = await postRes.json();
    expect(postData.ok).toBe(true);
    testMentionIds.push(postData.mention.id);

    // 2. Verifikasi alert dibuat di DB dengan sumberInput = FORM (bukan CONTOH)
    const alert = await prisma.alert.findFirst({
      where: {
        jenis: AlertType.PERLU_PERHATIAN,
        topik: "BTN Mobile",
        sumberInput: InputSourceType.FORM,
      },
      orderBy: { dibuatPada: "desc" },
    });

    expect(alert).not.toBeNull();
    expect(alert?.sumberInput).toBe(InputSourceType.FORM);
    if (alert) testAlertIds.push(alert.id);

    // 3. Verifikasi GET /api/alerts?includeSample=false tetap mengembalikan alert nyata ini
    const alertsReq = new NextRequest(
      "http://localhost:3000/api/alerts?includeSample=false",
      {
        method: "GET",
        headers: {
          Host: "localhost:3000",
          Cookie: `petugas_session=${sessionToken}`,
        },
      }
    );

    const alertsRes = await getAlerts(alertsReq);
    expect(alertsRes.status).toBe(200);
    const alertsData = await alertsRes.json();
    expect(alertsData.ok).toBe(true);

    const foundInNonSample = alertsData.alerts.some(
      (a: { id: string; sumberInput: string }) =>
        a.id === alert?.id && a.sumberInput === "FORM"
    );
    expect(foundInNonSample).toBe(true);
  });

  it("mendukung pencarian entri lama via link dan via id khusus pada GET /api/mentions", async () => {
    const uniqueId = `tahap3d_search_${Date.now()}`;
    const testUrl = `https://www.threads.com/@user_btn/post/${uniqueId}`;

    const postReq = new NextRequest("http://localhost:3000/api/mentions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Host: "localhost:3000",
        Origin: "http://localhost:3000",
        Cookie: `petugas_session=${sessionToken}`,
      },
      body: JSON.stringify({
        linkAsli: testUrl,
        teksPostingan: "Uji pencarian entri lama berbasis URL kanonik dan ID.",
        topik: "KPR BTN",
        sentimen: "POSITIF",
        prioritas: Priority.RUTIN,
        headline: "Uji Pencarian Entri Lama",
      }),
    });

    const postRes = await postMention(postReq);
    const postData = await postRes.json();
    const createdId = postData.mention.id;
    testMentionIds.push(createdId);

    // 1. Uji checkUrl endpoint
    const checkReq = new NextRequest(
      `http://localhost:3000/api/mentions?checkUrl=${encodeURIComponent(testUrl)}`
    );
    const checkRes = await getMentions(checkReq);
    const checkData = await checkRes.json();
    expect(checkData.exists).toBe(true);
    expect(checkData.mention.id).toBe(createdId);

    // 2. Uji pencarian via parameter search yang mencocokkan URL
    const searchUrlReq = new NextRequest(
      `http://localhost:3000/api/mentions?search=${encodeURIComponent(uniqueId)}`
    );
    const searchUrlRes = await getMentions(searchUrlReq);
    const searchUrlData = await searchUrlRes.json();
    expect(
      searchUrlData.mentions.some((m: { id: string }) => m.id === createdId)
    ).toBe(true);

    // 3. Uji pencarian entri lama via parameter id spesifik
    const searchIdReq = new NextRequest(
      `http://localhost:3000/api/mentions?id=${encodeURIComponent(createdId)}`
    );
    const searchIdRes = await getMentions(searchIdReq);
    const searchIdData = await searchIdRes.json();
    expect(searchIdData.mentions.length).toBe(1);
    expect(searchIdData.mentions[0].id).toBe(createdId);
  });

  it("mengarahkan duplikat Draf ke /draf dan memastikan draf tidak muncul di daftar mention", async () => {
    const uniqueId = `draft_dup_${Date.now()}`;
    const testUrl = `https://www.threads.com/@user_btn/post/${uniqueId}`;

    const draft = await prisma.mention.create({
      data: {
        linkAsli: testUrl,
        linkTernormalisasi: `threads.com/@user_btn/post/${uniqueId}`,
        teksPostingan: "Draf dari ekstensi yang belum disetujui",
        topik: "BTN Mobile",
        sentimen: "NEGATIF",
        prioritas: Priority.PANTAU,
        status: MentionStatus.DRAF,
        sumberInput: InputSourceType.EKSTENSI,
        headline: "Draf Ekstensi Belum Disetujui",
      },
    });
    testMentionIds.push(draft.id);

    // 1. checkUrl mengembalikan exists: true, id, status DRAF, dan sumberInput
    const checkReq = new NextRequest(
      `http://localhost:3000/api/mentions?checkUrl=${encodeURIComponent(testUrl)}`
    );
    const checkRes = await getMentions(checkReq);
    const checkData = await checkRes.json();
    expect(checkData.exists).toBe(true);
    expect(checkData.id).toBe(draft.id);
    expect(checkData.status).toBe("DRAF");
    expect(checkData.sumberInput).toBe("EKSTENSI");

    // 2. Evaluasi navigasi untuk duplikat DRAF
    const nav = getDuplicateNavigationInfo(
      checkData.status,
      checkData.id,
      testUrl
    );
    expect(nav.destination).toBe("/draf");
    expect(nav.path).toBe("/draf");
    expect(nav.message).toBe(
      "Tautan ini sudah ada di antrean Draf. Tinjau dari halaman Draf."
    );

    // 3. Verifikasi Draf TIDAK muncul di daftar Mention reguler (GET /api/mentions)
    const listReq = new NextRequest(
      `http://localhost:3000/api/mentions?includeSample=true`
    );
    const listRes = await getMentions(listReq);
    const listData = await listRes.json();
    const foundInList = listData.mentions.some(
      (m: { id: string }) => m.id === draft.id
    );
    expect(foundInList).toBe(false);
  });

  it("mengarahkan duplikat Mention aktif ke halaman /mention", async () => {
    const uniqueId = `active_dup_${Date.now()}`;
    const testUrl = `https://www.threads.com/@user_btn/post/${uniqueId}`;

    const active = await prisma.mention.create({
      data: {
        linkAsli: testUrl,
        linkTernormalisasi: `threads.com/@user_btn/post/${uniqueId}`,
        teksPostingan: "Mention aktif yang sudah dipublikasikan",
        topik: "KPR BTN",
        sentimen: "POSITIF",
        prioritas: Priority.RUTIN,
        status: MentionStatus.BARU,
        sumberInput: InputSourceType.FORM,
        headline: "Mention Aktif",
      },
    });
    testMentionIds.push(active.id);

    const checkReq = new NextRequest(
      `http://localhost:3000/api/mentions?checkUrl=${encodeURIComponent(testUrl)}`
    );
    const checkRes = await getMentions(checkReq);
    const checkData = await checkRes.json();
    expect(checkData.exists).toBe(true);
    expect(checkData.id).toBe(active.id);
    expect(checkData.status).toBe("BARU");

    const nav = getDuplicateNavigationInfo(
      checkData.status,
      checkData.id,
      testUrl
    );
    expect(nav.destination).toBe("/mention");
    expect(nav.path).toContain(`/mention?id=${active.id}`);
  });

  it("memastikan data CONTOH tidak memicu duplikat saat includeSample=false", async () => {
    const uniqueId = `sample_dup_${Date.now()}`;
    const testUrl = `https://www.threads.com/@sample_btn/post/${uniqueId}`;

    const sampleMention = await prisma.mention.create({
      data: {
        linkAsli: testUrl,
        linkTernormalisasi: `threads.com/@sample_btn/post/${uniqueId}`,
        teksPostingan: "Data contoh sistem monitoring",
        topik: "Tabungan BTN",
        sentimen: "NETRAL",
        prioritas: Priority.RUTIN,
        status: MentionStatus.BARU,
        sumberInput: InputSourceType.CONTOH,
        headline: "Sample Data",
      },
    });
    testMentionIds.push(sampleMention.id);

    // Saat includeSample=false, checkUrl TIDAK boleh menganggap tautan ini duplikat data nyata
    const checkNonSampleReq = new NextRequest(
      `http://localhost:3000/api/mentions?checkUrl=${encodeURIComponent(testUrl)}&includeSample=false`
    );
    const checkNonSampleRes = await getMentions(checkNonSampleReq);
    const nonSampleData = await checkNonSampleRes.json();
    expect(nonSampleData.exists).toBe(false);

    // Saat includeSample=true, checkUrl tetap mendeteksi adanya data contoh
    const checkSampleReq = new NextRequest(
      `http://localhost:3000/api/mentions?checkUrl=${encodeURIComponent(testUrl)}&includeSample=true`
    );
    const checkSampleRes = await getMentions(checkSampleReq);
    const sampleData = await checkSampleRes.json();
    expect(sampleData.exists).toBe(true);
    expect(sampleData.sumberInput).toBe("CONTOH");
  });
});
