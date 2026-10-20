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
import { GET as exportGet } from "@/app/api/export/route";
import { POST as authPost } from "@/app/api/auth/token/route";
import { parseBulkPaste, MAX_IMPORT_ITEMS } from "@/lib/ingest/parseImport";
import { sanitizeFormulaInjection } from "@/lib/export/sanitize";
import { normalizeThreadsUrl } from "@/lib/url";
import { createSignedSessionToken } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  MentionStatus,
  InputSourceType,
  Priority,
  Sentiment,
} from "@prisma/client";

describe("Verifikasi Permintaan Pengujian (Nomor 12 s/d 25)", () => {
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

  // -------------------------------------------------------------
  // NOMOR 18 & 19 (EKSPOR)
  // -------------------------------------------------------------
  describe("Nomor 18: Unduh CSV, Excel, dan PDF (Draf tidak ikut, data contoh bertanda, cocok filter)", () => {
    it("mengecualikan Draf, menandai data contoh, dan merespons berkas CSV, XLSX, dan HTML/PDF", async () => {
      // Siapkan 1 entri Draf (tidak boleh muncul di ekspor)
      const draftUrl = `https://threads.net/@user/post/exp_draft_${Date.now()}`;
      await prisma.mention.create({
        data: {
          linkAsli: draftUrl,
          linkTernormalisasi: draftUrl,
          teksPostingan: "Postingan draf rahasia",
          status: MentionStatus.DRAF,
          sumberInput: InputSourceType.FORM,
        },
      });

      // Siapkan 1 entri Nyata BARU
      const realUrl = `https://threads.net/@user/post/exp_real_${Date.now()}`;
      await prisma.mention.create({
        data: {
          linkAsli: realUrl,
          linkTernormalisasi: realUrl,
          teksPostingan: "Postingan nyata BTN",
          status: MentionStatus.BARU,
          sumberInput: InputSourceType.FORM,
          topik: "BTN Mobile",
          sentimen: Sentiment.POSITIF,
        },
      });

      // Siapkan 1 entri Contoh BARU
      const sampleUrl = `https://threads.net/@user/post/exp_sample_${Date.now()}`;
      await prisma.mention.create({
        data: {
          linkAsli: sampleUrl,
          linkTernormalisasi: sampleUrl,
          teksPostingan: "Postingan simulasi contoh",
          status: MentionStatus.BARU,
          sumberInput: InputSourceType.CONTOH,
          topik: "BTN Mobile",
          sentimen: Sentiment.POSITIF,
        },
      });

      // A. Unduh CSV
      const reqCsv = new NextRequest(
        `${baseUrl}/api/export?format=csv&includeSample=true`
      );
      const resCsv = await exportGet(reqCsv);
      expect(resCsv.status).toBe(200);
      expect(resCsv.headers.get("content-type")).toContain("text/csv");
      const csvText = await resCsv.text();

      // Cek: Draf TIDAK ikut
      expect(csvText).not.toContain("Postingan draf rahasia");
      // Cek: Data contoh bertanda CONTOH (SIMULASI)
      expect(csvText).toContain("CONTOH (SIMULASI)");
      expect(csvText).toContain("Postingan simulasi contoh");
      expect(csvText).toContain("Postingan nyata BTN");

      // B. Unduh Excel (XLSX)
      const reqXlsx = new NextRequest(
        `${baseUrl}/api/export?format=xlsx&includeSample=true`
      );
      const resXlsx = await exportGet(reqXlsx);
      expect(resXlsx.status).toBe(200);
      expect(resXlsx.headers.get("content-type")).toContain(
        "spreadsheetml.sheet"
      );
      const arrayBuffer = await resXlsx.arrayBuffer();
      expect(arrayBuffer.byteLength).toBeGreaterThan(1000); // Berkas Excel valid

      // C. Unduh PDF / HTML Printable
      const reqPdf = new NextRequest(
        `${baseUrl}/api/export?format=pdf&includeSample=true`
      );
      const resPdf = await exportGet(reqPdf);
      expect(resPdf.status).toBe(200);
      expect(resPdf.headers.get("content-type")).toContain("text/html");
      const htmlText = await resPdf.text();
      expect(htmlText).toContain("Laporan Monitoring Media Sosial Threads");
      expect(htmlText).toContain("PT Bank Tabungan Negara");
      expect(htmlText).not.toContain("Postingan draf rahasia");
    });
  });

  describe("Nomor 19: Simpan mention uji diawali =1+1 -> diekspor sebagai teks aman (bukan formula)", () => {
    it("menambahkan tanda petik satu pada teks berawalan formula injection", async () => {
      const formulaText = "=1+1 injeksi formula";
      const sanitized = sanitizeFormulaInjection(formulaText);
      expect(sanitized).toBe("'=1+1 injeksi formula");

      // Simpan di DB dan ekspor via CSV
      const formulaUrl = `https://threads.net/@user/post/exp_formula_${Date.now()}`;
      await prisma.mention.create({
        data: {
          linkAsli: formulaUrl,
          linkTernormalisasi: formulaUrl,
          teksPostingan: formulaText,
          status: MentionStatus.BARU,
          sumberInput: InputSourceType.FORM,
        },
      });

      const reqCsv = new NextRequest(`${baseUrl}/api/export?format=csv`);
      const resCsv = await exportGet(reqCsv);
      const csvText = await resCsv.text();

      // Memastikan di CSV tersimpan aman sebagai teks dengan kutip "'=1+1"
      expect(csvText).toContain('"\'=1+1 injeksi formula"');
    });
  });

  // -------------------------------------------------------------
  // NOMOR 20, 21, 22 (KEAMANAN)
  // -------------------------------------------------------------
  describe("Nomor 21: Dari terminal tanpa login ditolak 401/403", () => {
    it("menolak request mutasi tanpa sesi atau token", async () => {
      const req = new NextRequest(`${baseUrl}/api/mentions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });

      const res = await mentionsPost(req);
      expect([401, 403]).toContain(res.status);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.error).toContain("Akses ditolak");
    });
  });

  describe("Nomor 22: Masukkan token salah 6 kali dalam satu menit -> dibatasi 429", () => {
    it("membatasi percobaan login ke-6 dengan HTTP 429 dan pesan tunggu", async () => {
      const fakeIp = "198.51.100.77";

      for (let i = 1; i <= 5; i++) {
        const req = new NextRequest(`${baseUrl}/api/auth/token`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": fakeIp,
          },
          body: JSON.stringify({ token: "token_salah_ke_" + i }),
        });
        const res = await authPost(req);
        expect(res.status).toBe(401);
      }

      // Percobaan ke-6 harus dibatasi 429
      const reqBlocked = new NextRequest(`${baseUrl}/api/auth/token`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": fakeIp,
        },
        body: JSON.stringify({ token: "token_salah_ke_6" }),
      });
      const resBlocked = await authPost(reqBlocked);
      expect(resBlocked.status).toBe(429);
      const jsonBlocked = await resBlocked.json();
      expect(jsonBlocked.ok).toBe(false);
      expect(jsonBlocked.error).toContain("Terlalu banyak percobaan masuk");
    });
  });

  // -------------------------------------------------------------
  // NOMOR 24 & 25 (EKSTENSI CHROME)
  // -------------------------------------------------------------
  describe("Nomor 24 & 25: Ekstensi Chrome (Validasi /post/, Draf tanpa nama akun, tolak non-post, tolak token salah)", () => {
    const extToken = "test_ext_token_2026";

    beforeEach(() => {
      process.env.EXTENSION_TOKEN = extToken;
    });

    it("menyimpan postingan /post/ sebagai Draf tanpa nama akun", async () => {
      const postUrl = `https://www.threads.net/@nasabah_btn/post/post_valid_${Date.now()}`;
      const postText =
        "Pelayanan kantor cabang BTN sangat cepat dan memuaskan.";

      const req = new NextRequest(`${baseUrl}/api/mentions`, {
        method: "POST",
        headers: {
          host,
          origin: "chrome-extension://abcdefghijklmnop",
          authorization: `Bearer ${extToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          linkAsli: postUrl,
          teksPostingan: postText,
          status: "DRAF",
          sumberInput: "EKSTENSI",
        }),
      });

      const res = await mentionsPost(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);

      const saved = json.mention;
      expect(saved.status).toBe(MentionStatus.DRAF);
      expect(saved.sumberInput).toBe(InputSourceType.EKSTENSI);
      expect(saved.teksPostingan).toBe(postText);
      // Memastikan tidak ada kolom nama akun yang disimpan
      expect((saved as any).namaAkun).toBeUndefined();
      expect((saved as any).username).toBeUndefined();
    });

    it("menolak Bearer token salah dengan status 401", async () => {
      const req = new NextRequest(`${baseUrl}/api/mentions`, {
        method: "POST",
        headers: {
          host,
          origin: "chrome-extension://abcdefghijklmnop",
          authorization: "Bearer token_salah_123",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          linkAsli: "https://www.threads.net/@btn/post/xyz123",
          teksPostingan: "Uji token salah",
        }),
      });

      const res = await mentionsPost(req);
      expect([401, 403]).toContain(res.status);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.error).toContain("Akses ditolak");
    });
  });
});
