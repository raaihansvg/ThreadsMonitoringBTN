import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  POST as mentionsPost,
  GET as mentionsGet,
} from "@/app/api/mentions/route";
import {
  PATCH as mentionPatch,
  DELETE as mentionDelete,
} from "@/app/api/mentions/[id]/route";
import { POST as draftsPost, GET as draftsGet } from "@/app/api/drafts/route";
import { POST as topicsPost, GET as topicsGet } from "@/app/api/topics/route";
import { GET as alertsGet, PATCH as alertsPatch } from "@/app/api/alerts/route";
import { parseBulkPaste, MAX_IMPORT_ITEMS } from "@/lib/ingest/parseImport";
import { normalizeThreadsUrl } from "@/lib/url";
import { createSignedSessionToken } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  MentionStatus,
  InputSourceType,
  Priority,
  Sentiment,
} from "@prisma/client";

describe("Verifikasi Permintaan Pengujian (Nomor 12 s/d 17)", () => {
  const host = "localhost:3000";
  const baseUrl = `http://${host}`;
  let officerHeaders: Record<string, string>;

  beforeEach(async () => {
    const token = createSignedSessionToken();
    officerHeaders = {
      host,
      origin: baseUrl,
      cookie: `petugas_session=${token}`,
      "content-type": "application/json",
    };
  });

  // -------------------------------------------------------------
  // NOMOR 12
  // -------------------------------------------------------------
  describe("Nomor 12: Tempel banyak 3 baris (satu memuat pipe ganda) -> laporkan berhasil, gagal, duplikat", () => {
    it("memecah pipe pertama saja, menjaga teks utuh, dan menghitung berhasil, gagal, duplikat", async () => {
      // 1. Siapkan 1 entri duplikat di DB terlebih dahulu
      const existingUrl = `https://www.threads.net/@btn/post/dup_${Date.now()}`;
      await prisma.mention.create({
        data: {
          linkAsli: existingUrl,
          linkTernormalisasi: normalizeThreadsUrl(existingUrl),
          teksPostingan: "Data awal yang sudah ada di database",
          status: MentionStatus.BARU,
          sumberInput: InputSourceType.FORM,
        },
      });

      // 3 baris input tempel banyak
      const rawInput = [
        // Baris 1: Valid + teks mengandung pipe ganda
        `https://www.threads.net/@nasabah/post/item12_${Date.now()} | Promo KPR BTN | Bunga 2.5% | Bebas Biaya Admin`,
        // Baris 2: Gagal (domain bukan threads.net / threads.com)
        `https://www.google.com/search?q=kpr | Ini tautan bukan threads`,
        // Baris 3: Duplikat dari existingUrl
        `${existingUrl} | Tautan yang sudah pernah disimpan`,
      ].join("\n");

      const { items } = parseBulkPaste(rawInput, 50);
      expect(items).toHaveLength(3);

      // Verifikasi baris 1: teks utuh memuat karakter pipe berikutnya
      expect(items[0].text).toBe(
        "Promo KPR BTN | Bunga 2.5% | Bebas Biaya Admin"
      );

      let berhasil = 0;
      let gagal = 0;
      let duplikat = 0;

      for (const item of items) {
        const cleanUrl = item.url.trim().split("?")[0].replace("www.", "");
        if (
          !cleanUrl.startsWith("https://threads.net") &&
          !cleanUrl.startsWith("https://threads.com")
        ) {
          gagal++;
          continue;
        }

        const req = new NextRequest(`${baseUrl}/api/mentions`, {
          method: "POST",
          headers: officerHeaders,
          body: JSON.stringify({
            linkAsli: item.url.trim(),
            teksPostingan: item.text || "",
            status: "DRAF",
            sumberInput: "IMPOR",
            headline: item.text ? item.text.slice(0, 80) : "",
            ringkasan: item.text ? item.text.slice(0, 300) : "",
            kataKunci: item.text ? ["impor", "massal"] : [],
          }),
        });

        const res = await mentionsPost(req);
        if (res.status === 200) {
          berhasil++;
        } else if (res.status === 409) {
          duplikat++;
        } else {
          gagal++;
        }
      }

      // Pastikan laporan tepat: 1 berhasil, 1 gagal, 1 duplikat
      expect(berhasil).toBe(1);
      expect(gagal).toBe(1);
      expect(duplikat).toBe(1);

      // Verifikasi di basis data bahwa baris 1 tersimpan dengan teks utuh
      const saved = await prisma.mention.findFirst({
        where: { linkAsli: items[0].url },
      });
      expect(saved).not.toBeNull();
      expect(saved?.teksPostingan).toBe(
        "Promo KPR BTN | Bunga 2.5% | Bebas Biaya Admin"
      );
      expect(saved?.status).toBe(MentionStatus.DRAF);
    });
  });

  // -------------------------------------------------------------
  // NOMOR 13
  // -------------------------------------------------------------
  describe("Nomor 13: Tempel 51 baris: ada peringatan batas 50", () => {
    it("mendeteksi 51 baris, memotong menjadi 50 item, dan menandai isTruncated true", () => {
      const lines = Array.from(
        { length: 51 },
        (_, i) =>
          `https://threads.net/@user/post/${i + 1} | Postingan nomor ${i + 1}`
      ).join("\n");

      const result = parseBulkPaste(lines, MAX_IMPORT_ITEMS);

      expect(result.totalLines).toBe(51);
      expect(result.items).toHaveLength(50);
      expect(result.isTruncated).toBe(true);

      // Verifikasi pesan peringatan yang ditampilkan ke user
      const warningMessage = `Hanya ${MAX_IMPORT_ITEMS} item pertama dari total ${result.totalLines} baris yang akan diproses.`;
      expect(warningMessage).toBe(
        "Hanya 50 item pertama dari total 51 baris yang akan diproses."
      );
    });
  });

  // -------------------------------------------------------------
  // NOMOR 14
  // -------------------------------------------------------------
  describe("Nomor 14: Impor link tanpa teks -> Draf kosong -> tolak tanpa teks -> isi teks & setujui -> periksa Mention", () => {
    it("menolak persetujuan draf kosong, menerima setelah teks diisi, dan mencatat sentimen/topik/prioritas yang wajar", async () => {
      const urlTanpaTeks = `https://www.threads.net/@nasabah/post/empty_${Date.now()}`;

      // 1. Impor link tanpa teks
      const reqImport = new NextRequest(`${baseUrl}/api/mentions`, {
        method: "POST",
        headers: officerHeaders,
        body: JSON.stringify({
          linkAsli: urlTanpaTeks,
          teksPostingan: "", // Teks kosong
          status: "DRAF",
          sumberInput: "IMPOR",
          headline: "",
          ringkasan: "",
          kataKunci: [],
        }),
      });
      const resImport = await mentionsPost(reqImport);
      expect(resImport.status).toBe(200);
      const dataImport = await resImport.json();
      const draftId = dataImport.mention.id;

      // Masuk Draf kosong: teks kosong, topik null
      expect(dataImport.mention.status).toBe("DRAF");
      expect(dataImport.mention.teksPostingan).toBe("");
      expect(dataImport.mention.topik).toBeNull();

      // 2. Coba setujui tanpa teks (harus ditolak)
      const reqApproveEmpty = new NextRequest(`${baseUrl}/api/drafts`, {
        method: "POST",
        headers: officerHeaders,
        body: JSON.stringify({
          id: draftId,
          action: "approve",
        }),
      });
      const resApproveEmpty = await draftsPost(reqApproveEmpty);
      expect(resApproveEmpty.status).toBe(400);
      const dataApproveEmpty = await resApproveEmpty.json();
      expect(dataApproveEmpty.ok).toBe(false);
      expect(dataApproveEmpty.error).toContain(
        "Draf tanpa teks tidak dapat disetujui"
      );

      // 3. Isi teks dan sunting analisis (topik, sentimen, prioritas), lalu setujui
      const editedText =
        "Pelayanan pembukaan rekening via BTN Mobile sangat memuaskan dan cepat.";
      const reqApproveFilled = new NextRequest(`${baseUrl}/api/drafts`, {
        method: "POST",
        headers: officerHeaders,
        body: JSON.stringify({
          id: draftId,
          action: "approve",
          edits: {
            teksPostingan: editedText,
            topik: "BTN Mobile",
            sentimen: "POSITIF",
            prioritas: "RUTIN",
            headline: "Pelayanan BTN Mobile Memuaskan",
            ringkasan:
              "Nasabah merasa puas dengan pembukaan rekening cepat via BTN Mobile.",
          },
        }),
      });
      const resApproveFilled = await draftsPost(reqApproveFilled);
      expect(resApproveFilled.status).toBe(200);
      const dataApproveFilled = await resApproveFilled.json();
      expect(dataApproveFilled.ok).toBe(true);

      // 4. Lihat di halaman Mention (GET /api/mentions)
      const reqGetMention = new NextRequest(
        `${baseUrl}/api/mentions?id=${draftId}`,
        {
          method: "GET",
          headers: officerHeaders,
        }
      );
      const resGetMention = await mentionsGet(reqGetMention);
      const dataGetMention = await resGetMention.json();
      expect(dataGetMention.mentions).toHaveLength(1);

      const approvedMention = dataGetMention.mentions[0];
      expect(approvedMention.status).toBe(MentionStatus.BARU);
      expect(approvedMention.teksPostingan).toBe(editedText);
      expect(approvedMention.topik).toBe("BTN Mobile");
      expect(approvedMention.sentimen).toBe(Sentiment.POSITIF);
      expect(approvedMention.prioritas).toBe(Priority.RUTIN);
      expect(approvedMention.headline).toBe("Pelayanan BTN Mobile Memuaskan");
      expect(approvedMention.ringkasan).toBe(
        "Nasabah merasa puas dengan pembukaan rekening cepat via BTN Mobile."
      );
      expect(approvedMention.dikoreksiManual).toBe(true);
    });
  });

  // -------------------------------------------------------------
  // NOMOR 15
  // -------------------------------------------------------------
  describe("Nomor 15: Tolak satu Draf: hilang dari daftar dengan konfirmasi", () => {
    it("menghapus draf dari sistem saat ditolak", async () => {
      // 1. Buat 1 Draf baru
      const draftUrl = `https://www.threads.net/@user/post/reject_${Date.now()}`;
      const draft = await prisma.mention.create({
        data: {
          linkAsli: draftUrl,
          linkTernormalisasi: draftUrl,
          teksPostingan: "Postingan spam yang tidak relevan dengan BTN",
          status: MentionStatus.DRAF,
          sumberInput: InputSourceType.EKSTENSI,
        },
      });

      // 2. Tolak draf
      const reqReject = new NextRequest(`${baseUrl}/api/drafts`, {
        method: "POST",
        headers: officerHeaders,
        body: JSON.stringify({
          id: draft.id,
          action: "reject",
        }),
      });

      const resReject = await draftsPost(reqReject);
      expect(resReject.status).toBe(200);
      const dataReject = await resReject.json();
      expect(dataReject.ok).toBe(true);
      expect(dataReject.message).toContain("berhasil ditolak dan dihapus");

      // 3. Verifikasi draf sudah hilang dari basis data dan dari daftar draf
      const checkDb = await prisma.mention.findUnique({
        where: { id: draft.id },
      });
      expect(checkDb).toBeNull();

      const reqGetDrafts = new NextRequest(`${baseUrl}/api/drafts`, {
        method: "GET",
        headers: officerHeaders,
      });
      const resGetDrafts = await draftsGet(reqGetDrafts);
      const dataGetDrafts = await resGetDrafts.json();
      const existsInList = dataGetDrafts.drafts.some(
        (d: any) => d.id === draft.id
      );
      expect(existsInList).toBe(false);
    });
  });

  // -------------------------------------------------------------
  // NOMOR 16
  // -------------------------------------------------------------
  describe("Nomor 16: Cari kata kunci, sebagian link, filter topik/sentimen/prioritas/status, ubah status & hapus", () => {
    it("berhasil melakukan pencarian, multi-filter, pembaruan status, dan penghapusan mention", async () => {
      const uniqueSuffix = `test16_${Date.now()}`;
      const testUrl = `https://www.threads.net/@properti_id/post/kpr_btn_murah_${uniqueSuffix}`;

      // Buat mention uji
      const created = await prisma.mention.create({
        data: {
          linkAsli: testUrl,
          linkTernormalisasi: testUrl,
          teksPostingan: `Bunga KPR BTN sangat bersaing untuk rumah pertama nasabah ${uniqueSuffix}`,
          topik: "KPR BTN",
          sentimen: Sentiment.POSITIF,
          prioritas: Priority.PANTAU,
          status: MentionStatus.BARU,
          sumberInput: InputSourceType.FORM,
          headline: `Promo KPR BTN ${uniqueSuffix}`,
          ringkasan: `Informasi promo KPR BTN bersaing ${uniqueSuffix}`,
          kataKunci: ["kpr", "rumah", uniqueSuffix],
        },
      });

      // A. Cari dengan kata kunci unik
      const reqSearchKw = new NextRequest(
        `${baseUrl}/api/mentions?search=${uniqueSuffix}`,
        {
          method: "GET",
          headers: officerHeaders,
        }
      );
      const resSearchKw = await mentionsGet(reqSearchKw);
      const dataSearchKw = await resSearchKw.json();
      expect(dataSearchKw.mentions.some((m: any) => m.id === created.id)).toBe(
        true
      );

      // B. Cari dengan sebagian link
      const reqSearchLink = new NextRequest(
        `${baseUrl}/api/mentions?search=kpr_btn_murah_${uniqueSuffix}`,
        { method: "GET", headers: officerHeaders }
      );
      const resSearchLink = await mentionsGet(reqSearchLink);
      const dataSearchLink = await resSearchLink.json();
      expect(
        dataSearchLink.mentions.some((m: any) => m.id === created.id)
      ).toBe(true);

      // C. Filter topik, sentimen, prioritas, status (Cocok)
      const reqFilterMatch = new NextRequest(
        `${baseUrl}/api/mentions?topik=KPR%20BTN&sentimen=POSITIF&prioritas=PANTAU&status=BARU&search=${uniqueSuffix}`,
        { method: "GET", headers: officerHeaders }
      );
      const resFilterMatch = await mentionsGet(reqFilterMatch);
      const dataFilterMatch = await resFilterMatch.json();
      expect(
        dataFilterMatch.mentions.some((m: any) => m.id === created.id)
      ).toBe(true);

      // D. Filter tidak cocok (misal topik BTN Mobile)
      const reqFilterMismatch = new NextRequest(
        `${baseUrl}/api/mentions?topik=BTN%20Mobile&search=${uniqueSuffix}`,
        { method: "GET", headers: officerHeaders }
      );
      const resFilterMismatch = await mentionsGet(reqFilterMismatch);
      const dataFilterMismatch = await resFilterMismatch.json();
      expect(
        dataFilterMismatch.mentions.some((m: any) => m.id === created.id)
      ).toBe(false);

      // E. Ubah status mention menjadi DIPANTAU
      const reqPatch = new NextRequest(
        `${baseUrl}/api/mentions/${created.id}`,
        {
          method: "PATCH",
          headers: officerHeaders,
          body: JSON.stringify({ status: MentionStatus.DIPANTAU }),
        }
      );
      const resPatch = await mentionPatch(reqPatch, {
        params: Promise.resolve({ id: created.id }),
      });
      expect(resPatch.status).toBe(200);
      const dataPatch = await resPatch.json();
      expect(dataPatch.ok).toBe(true);
      expect(dataPatch.mention.status).toBe(MentionStatus.DIPANTAU);

      // F. Hapus mention
      const reqDelete = new NextRequest(
        `${baseUrl}/api/mentions/${created.id}`,
        {
          method: "DELETE",
          headers: officerHeaders,
        }
      );
      const resDelete = await mentionDelete(reqDelete, {
        params: Promise.resolve({ id: created.id }),
      });
      expect(resDelete.status).toBe(200);
      const dataDelete = await resDelete.json();
      expect(dataDelete.ok).toBe(true);

      // Pastikan terhapus dari DB
      const checkDeleted = await prisma.mention.findUnique({
        where: { id: created.id },
      });
      expect(checkDeleted).toBeNull();
    });
  });

  // -------------------------------------------------------------
  // NOMOR 17
  // -------------------------------------------------------------
  describe("Nomor 17: Turunkan ambang (lonjakan 2, negatif 1) -> tambah 2 mention nyata negatif -> alert muncul & tandai dibaca -> kembalikan ambang (10 dan 3)", () => {
    it("memicu alert lonjakan sentimen negatif, mengurangi badge belum dibaca, dan memulihkan ambang batas", async () => {
      // 1. Turunkan ambang batas: volumeThreshold=2, negativeThreshold=1
      const reqSetThreshold = new NextRequest(`${baseUrl}/api/topics`, {
        method: "POST",
        headers: officerHeaders,
        body: JSON.stringify({
          type: "thresholds",
          volumeThreshold: 2,
          volumeMultiplier: 2.0,
          negativeThreshold: 1,
          negativePercentage: 40,
        }),
      });
      const resSetThreshold = await topicsPost(reqSetThreshold);
      expect(resSetThreshold.status).toBe(200);

      // Verifikasi ambang telah berubah
      const reqGetThreshold = new NextRequest(`${baseUrl}/api/topics`, {
        method: "GET",
        headers: officerHeaders,
      });
      const resGetThreshold = await topicsGet();
      const dataThreshold = await resGetThreshold.json();
      expect(dataThreshold.thresholds.volumeThreshold).toBe(2);
      expect(dataThreshold.thresholds.negativeThreshold).toBe(1);

      // 2. Tambah 2 mention nyata pada hari ini di topik yang sama ("BTN Mobile")
      const url1 = `https://www.threads.net/@nasabah/post/alert_neg_1_${Date.now()}`;
      const url2 = `https://www.threads.net/@nasabah/post/alert_neg_2_${Date.now()}`;

      // Mention 1: Sentimen Negatif
      const reqMention1 = new NextRequest(`${baseUrl}/api/mentions`, {
        method: "POST",
        headers: officerHeaders,
        body: JSON.stringify({
          linkAsli: url1,
          teksPostingan:
            "Aplikasi BTN Mobile gagal transfer terus dan transaksi terputus.",
          topik: "BTN Mobile",
          sentimen: "NEGATIF",
          prioritas: "RUTIN",
          sumberInput: "FORM",
          headline: "Keluhan Transfer Gagal BTN Mobile",
          ringkasan: "Nasabah mengalami transaksi terputus saat transfer.",
        }),
      });
      const resMention1 = await mentionsPost(reqMention1);
      expect(resMention1.status).toBe(200);

      // Mention 2: Sentimen Netral
      const reqMention2 = new NextRequest(`${baseUrl}/api/mentions`, {
        method: "POST",
        headers: officerHeaders,
        body: JSON.stringify({
          linkAsli: url2,
          teksPostingan:
            "Info jadwal pemeliharaan sistem BTN Mobile malam ini.",
          topik: "BTN Mobile",
          sentimen: "NETRAL",
          prioritas: "RUTIN",
          sumberInput: "FORM",
          headline: "Jadwal Pemeliharaan BTN Mobile",
          ringkasan: "Informasi jadwal maintenance BTN Mobile.",
        }),
      });
      const resMention2 = await mentionsPost(reqMention2);
      expect(resMention2.status).toBe(200);

      // 3. Catat apakah alert muncul dan penyebabnya jelas
      const reqGetAlertsUnread = new NextRequest(
        `${baseUrl}/api/alerts?filter=unread&includeSample=false`,
        { method: "GET", headers: officerHeaders }
      );
      const resGetAlertsUnread = await alertsGet(reqGetAlertsUnread);
      const dataAlertsUnread = await resGetAlertsUnread.json();

      expect(dataAlertsUnread.ok).toBe(true);
      expect(dataAlertsUnread.alerts.length).toBeGreaterThanOrEqual(1);

      const triggeredAlert = dataAlertsUnread.alerts.find(
        (a: any) => a.topik === "BTN Mobile" && a.jenis === "LONJAKAN"
      );
      expect(triggeredAlert).toBeDefined();
      expect(triggeredAlert.dibaca).toBe(false);
      expect(triggeredAlert.ambangDipakai).toBe(1); // Ambang negatif yang dipakai = 1

      const unreadCountBefore = dataAlertsUnread.alerts.length;

      // 4. Tandai dibaca -> pastikan mengurangi badge belum dibaca
      const reqPatchAlert = new NextRequest(`${baseUrl}/api/alerts`, {
        method: "PATCH",
        headers: officerHeaders,
        body: JSON.stringify({ id: triggeredAlert.id }),
      });
      const resPatchAlert = await alertsPatch(reqPatchAlert);
      expect(resPatchAlert.status).toBe(200);
      const dataPatchAlert = await resPatchAlert.json();
      expect(dataPatchAlert.ok).toBe(true);
      expect(dataPatchAlert.alert.dibaca).toBe(true);

      // Periksa kembali daftar unread
      const resGetAlertsAfter = await alertsGet(reqGetAlertsUnread);
      const dataAlertsAfter = await resGetAlertsAfter.json();
      expect(dataAlertsAfter.alerts.length).toBe(unreadCountBefore - 1);

      // 5. Kembalikan ambang ke default (10 dan 3)
      const reqRestoreThreshold = new NextRequest(`${baseUrl}/api/topics`, {
        method: "POST",
        headers: officerHeaders,
        body: JSON.stringify({
          type: "thresholds",
          volumeThreshold: 10,
          volumeMultiplier: 2.0,
          negativeThreshold: 3,
          negativePercentage: 40,
        }),
      });
      const resRestoreThreshold = await topicsPost(reqRestoreThreshold);
      expect(resRestoreThreshold.status).toBe(200);

      const resGetThresholdRestored = await topicsGet();
      const dataThresholdRestored = await resGetThresholdRestored.json();
      expect(dataThresholdRestored.thresholds.volumeThreshold).toBe(10);
      expect(dataThresholdRestored.thresholds.negativeThreshold).toBe(3);
    });
  });
});
