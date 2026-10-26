import { describe, it, expect, vi, beforeEach } from "vitest";
import { DELETE as deleteMention } from "@/app/api/mentions/[id]/route";
import { prisma } from "@/lib/prisma";
import { createSignedSessionToken } from "@/lib/auth/session";
import { NextRequest } from "next/server";
import {
  AlertType,
  InputSourceType,
  Priority,
  MentionStatus,
  Sentiment,
} from "@prisma/client";
import { triggerAlertsForMention } from "@/lib/alert/service";
import * as emailService from "@/lib/email/service";
import { formatWIBFullDate } from "@/lib/time";

describe("Sinkronisasi Alert setelah Penghapusan Mention (Integrasi)", () => {
  const sessionToken = createSignedSessionToken();
  const baseUrl = "http://localhost:3000";

  function createDeleteRequest(id: string) {
    return new NextRequest(`${baseUrl}/api/mentions/${id}`, {
      method: "DELETE",
      headers: {
        Cookie: `petugas_session=${sessionToken}`,
      },
    });
  }

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("1. Satu Mention PERLU_PERHATIAN dihapus -> Alert ikut terhapus", async () => {
    const now = new Date();
    const periode = formatWIBFullDate(now);

    const mention = await prisma.mention.create({
      data: {
        linkAsli: "https://threads.net/@u/post/del_urgent_1",
        linkTernormalisasi: "https://threads.net/post/del_urgent_1",
        teksPostingan: "Keluhan mendesak saldo hilang",
        topik: "BTN Mobile",
        sentimen: Sentiment.NEGATIF,
        prioritas: Priority.PERLU_PERHATIAN,
        status: MentionStatus.BARU,
        sumberInput: InputSourceType.FORM,
        tanggalDitemukan: now,
      },
    });

    await triggerAlertsForMention({
      id: mention.id,
      topik: mention.topik,
      prioritas: mention.prioritas,
      sentimen: mention.sentimen,
      sumberInput: mention.sumberInput,
      tanggalDitemukan: mention.tanggalDitemukan,
    });

    const alertBefore = await prisma.alert.findUnique({
      where: {
        jenis_topik_periode_sumberInput: {
          jenis: AlertType.PERLU_PERHATIAN,
          topik: "BTN Mobile",
          periode,
          sumberInput: InputSourceType.FORM,
        },
      },
    });
    expect(alertBefore).not.toBeNull();
    expect(alertBefore?.jumlah).toBe(1);

    const res = await deleteMention(createDeleteRequest(mention.id), {
      params: Promise.resolve({ id: mention.id }),
    });
    expect(res.status).toBe(200);

    const alertAfter = await prisma.alert.findUnique({
      where: {
        jenis_topik_periode_sumberInput: {
          jenis: AlertType.PERLU_PERHATIAN,
          topik: "BTN Mobile",
          periode,
          sumberInput: InputSourceType.FORM,
        },
      },
    });
    expect(alertAfter).toBeNull();
  });

  it("2. Dua Mention PERLU_PERHATIAN -> hapus satu, Alert tetap dengan jumlah 1", async () => {
    const now = new Date();
    const periode = formatWIBFullDate(now);

    const m1 = await prisma.mention.create({
      data: {
        linkAsli: "https://threads.net/@u/post/del_urgent_2a",
        linkTernormalisasi: "https://threads.net/post/del_urgent_2a",
        teksPostingan: "Keluhan mendesak pertama",
        topik: "BTN Mobile",
        sentimen: Sentiment.NEGATIF,
        prioritas: Priority.PERLU_PERHATIAN,
        status: MentionStatus.BARU,
        sumberInput: InputSourceType.FORM,
        tanggalDitemukan: now,
      },
    });

    const m2 = await prisma.mention.create({
      data: {
        linkAsli: "https://threads.net/@u/post/del_urgent_2b",
        linkTernormalisasi: "https://threads.net/post/del_urgent_2b",
        teksPostingan: "Keluhan mendesak kedua",
        topik: "BTN Mobile",
        sentimen: Sentiment.NEGATIF,
        prioritas: Priority.PERLU_PERHATIAN,
        status: MentionStatus.BARU,
        sumberInput: InputSourceType.FORM,
        tanggalDitemukan: now,
      },
    });

    await triggerAlertsForMention({
      id: m1.id,
      topik: m1.topik,
      prioritas: m1.prioritas,
      sentimen: m1.sentimen,
      sumberInput: m1.sumberInput,
      tanggalDitemukan: m1.tanggalDitemukan,
    });
    await triggerAlertsForMention({
      id: m2.id,
      topik: m2.topik,
      prioritas: m2.prioritas,
      sentimen: m2.sentimen,
      sumberInput: m2.sumberInput,
      tanggalDitemukan: m2.tanggalDitemukan,
    });

    const alertBefore = await prisma.alert.findUnique({
      where: {
        jenis_topik_periode_sumberInput: {
          jenis: AlertType.PERLU_PERHATIAN,
          topik: "BTN Mobile",
          periode,
          sumberInput: InputSourceType.FORM,
        },
      },
    });
    expect(alertBefore?.jumlah).toBe(2);

    const res = await deleteMention(createDeleteRequest(m1.id), {
      params: Promise.resolve({ id: m1.id }),
    });
    expect(res.status).toBe(200);

    const alertAfter = await prisma.alert.findUnique({
      where: {
        jenis_topik_periode_sumberInput: {
          jenis: AlertType.PERLU_PERHATIAN,
          topik: "BTN Mobile",
          periode,
          sumberInput: InputSourceType.FORM,
        },
      },
    });
    expect(alertAfter).not.toBeNull();
    expect(alertAfter?.jumlah).toBe(1);
  });

  it("3. Status dibaca tetap dipertahankan jika Alert masih ada", async () => {
    const now = new Date();
    const periode = formatWIBFullDate(now);

    const m1 = await prisma.mention.create({
      data: {
        linkAsli: "https://threads.net/@u/post/del_read_3a",
        linkTernormalisasi: "https://threads.net/post/del_read_3a",
        teksPostingan: "Mendesak 1",
        topik: "KPR BTN",
        sentimen: Sentiment.NEGATIF,
        prioritas: Priority.PERLU_PERHATIAN,
        status: MentionStatus.BARU,
        sumberInput: InputSourceType.FORM,
        tanggalDitemukan: now,
      },
    });

    const m2 = await prisma.mention.create({
      data: {
        linkAsli: "https://threads.net/@u/post/del_read_3b",
        linkTernormalisasi: "https://threads.net/post/del_read_3b",
        teksPostingan: "Mendesak 2",
        topik: "KPR BTN",
        sentimen: Sentiment.NEGATIF,
        prioritas: Priority.PERLU_PERHATIAN,
        status: MentionStatus.BARU,
        sumberInput: InputSourceType.FORM,
        tanggalDitemukan: now,
      },
    });

    await triggerAlertsForMention({
      id: m1.id,
      topik: m1.topik,
      prioritas: m1.prioritas,
      sentimen: m1.sentimen,
      sumberInput: m1.sumberInput,
      tanggalDitemukan: m1.tanggalDitemukan,
    });
    await triggerAlertsForMention({
      id: m2.id,
      topik: m2.topik,
      prioritas: m2.prioritas,
      sentimen: m2.sentimen,
      sumberInput: m2.sumberInput,
      tanggalDitemukan: m2.tanggalDitemukan,
    });

    // Petugas menandai alert sudah dibaca
    const alertBefore = await prisma.alert.findUnique({
      where: {
        jenis_topik_periode_sumberInput: {
          jenis: AlertType.PERLU_PERHATIAN,
          topik: "KPR BTN",
          periode,
          sumberInput: InputSourceType.FORM,
        },
      },
    });
    expect(alertBefore).not.toBeNull();

    await prisma.alert.update({
      where: { id: alertBefore!.id },
      data: { dibaca: true },
    });

    // Hapus salah satu mention
    const res = await deleteMention(createDeleteRequest(m1.id), {
      params: Promise.resolve({ id: m1.id }),
    });
    expect(res.status).toBe(200);

    const alertAfter = await prisma.alert.findUnique({
      where: { id: alertBefore!.id },
    });
    expect(alertAfter).not.toBeNull();
    expect(alertAfter?.jumlah).toBe(1);
    expect(alertAfter?.dibaca).toBe(true); // Status dibaca tetap dipertahankan
  });

  it("4. Spike tidak lagi terpenuhi setelah Mention dihapus -> Alert LONJAKAN terhapus", async () => {
    const now = new Date();
    const periode = formatWIBFullDate(now);

    // Buat 3 mention negatif yang memicu spike (ambang negatif default = 3 dan 40%)
    const mentions = [];
    for (let i = 0; i < 3; i++) {
      const m = await prisma.mention.create({
        data: {
          linkAsli: `https://threads.net/@u/post/del_spike_4_${i}`,
          linkTernormalisasi: `https://threads.net/post/del_spike_4_${i}`,
          teksPostingan: `Keluhan negatif ${i}`,
          topik: "Layanan Cabang",
          sentimen: Sentiment.NEGATIF,
          prioritas: Priority.RUTIN,
          status: MentionStatus.BARU,
          sumberInput: InputSourceType.FORM,
          tanggalDitemukan: now,
        },
      });
      mentions.push(m);
    }

    await triggerAlertsForMention({
      id: mentions[2].id,
      topik: mentions[2].topik,
      prioritas: mentions[2].prioritas,
      sentimen: mentions[2].sentimen,
      sumberInput: mentions[2].sumberInput,
      tanggalDitemukan: mentions[2].tanggalDitemukan,
    });

    const alertBefore = await prisma.alert.findUnique({
      where: {
        jenis_topik_periode_sumberInput: {
          jenis: AlertType.LONJAKAN,
          topik: "Layanan Cabang",
          periode,
          sumberInput: InputSourceType.FORM,
        },
      },
    });
    expect(alertBefore).not.toBeNull();
    expect(alertBefore?.jumlah).toBe(3);

    // Hapus 1 mention sehingga sisa mention negatif = 2 (< ambang batas 3)
    const res = await deleteMention(createDeleteRequest(mentions[0].id), {
      params: Promise.resolve({ id: mentions[0].id }),
    });
    expect(res.status).toBe(200);

    const alertAfter = await prisma.alert.findUnique({
      where: {
        jenis_topik_periode_sumberInput: {
          jenis: AlertType.LONJAKAN,
          topik: "Layanan Cabang",
          periode,
          sumberInput: InputSourceType.FORM,
        },
      },
    });
    expect(alertAfter).toBeNull();
  });

  it("5. Spike masih terpenuhi -> Alert LONJAKAN tetap dengan jumlah terbaru", async () => {
    const now = new Date();
    const periode = formatWIBFullDate(now);

    // Buat 4 mention negatif
    const mentions = [];
    for (let i = 0; i < 4; i++) {
      const m = await prisma.mention.create({
        data: {
          linkAsli: `https://threads.net/@u/post/del_spike_5_${i}`,
          linkTernormalisasi: `https://threads.net/post/del_spike_5_${i}`,
          teksPostingan: `Keluhan negatif ${i}`,
          topik: "Tapera",
          sentimen: Sentiment.NEGATIF,
          prioritas: Priority.RUTIN,
          status: MentionStatus.BARU,
          sumberInput: InputSourceType.FORM,
          tanggalDitemukan: now,
        },
      });
      mentions.push(m);
    }

    await triggerAlertsForMention({
      id: mentions[3].id,
      topik: mentions[3].topik,
      prioritas: mentions[3].prioritas,
      sentimen: mentions[3].sentimen,
      sumberInput: mentions[3].sumberInput,
      tanggalDitemukan: mentions[3].tanggalDitemukan,
    });

    const alertBefore = await prisma.alert.findUnique({
      where: {
        jenis_topik_periode_sumberInput: {
          jenis: AlertType.LONJAKAN,
          topik: "Tapera",
          periode,
          sumberInput: InputSourceType.FORM,
        },
      },
    });
    expect(alertBefore?.jumlah).toBe(4);

    // Hapus 1 mention sehingga sisa 3 (masih memenuhi ambang batas 3)
    const res = await deleteMention(createDeleteRequest(mentions[0].id), {
      params: Promise.resolve({ id: mentions[0].id }),
    });
    expect(res.status).toBe(200);

    const alertAfter = await prisma.alert.findUnique({
      where: {
        jenis_topik_periode_sumberInput: {
          jenis: AlertType.LONJAKAN,
          topik: "Tapera",
          periode,
          sumberInput: InputSourceType.FORM,
        },
      },
    });
    expect(alertAfter).not.toBeNull();
    expect(alertAfter?.jumlah).toBe(3);
  });

  it("6. Mention CONTOH dan Mention nyata tidak saling memengaruhi", async () => {
    const now = new Date();
    const periode = formatWIBFullDate(now);

    // Mention CONTOH
    const sampleMention = await prisma.mention.create({
      data: {
        linkAsli: "https://threads.net/@u/post/sample_urgent",
        linkTernormalisasi: "https://threads.net/post/sample_urgent",
        teksPostingan: "Contoh simulasi urgent",
        topik: "KPR BTN",
        sentimen: Sentiment.NEGATIF,
        prioritas: Priority.PERLU_PERHATIAN,
        status: MentionStatus.BARU,
        sumberInput: InputSourceType.CONTOH,
        tanggalDitemukan: now,
      },
    });

    // Mention NYATA
    const realMention = await prisma.mention.create({
      data: {
        linkAsli: "https://threads.net/@u/post/real_urgent",
        linkTernormalisasi: "https://threads.net/post/real_urgent",
        teksPostingan: "Mention nyata urgent",
        topik: "KPR BTN",
        sentimen: Sentiment.NEGATIF,
        prioritas: Priority.PERLU_PERHATIAN,
        status: MentionStatus.BARU,
        sumberInput: InputSourceType.FORM,
        tanggalDitemukan: now,
      },
    });

    await triggerAlertsForMention({
      id: sampleMention.id,
      topik: sampleMention.topik,
      prioritas: sampleMention.prioritas,
      sentimen: sampleMention.sentimen,
      sumberInput: sampleMention.sumberInput,
      tanggalDitemukan: sampleMention.tanggalDitemukan,
    });
    await triggerAlertsForMention({
      id: realMention.id,
      topik: realMention.topik,
      prioritas: realMention.prioritas,
      sentimen: realMention.sentimen,
      sumberInput: realMention.sumberInput,
      tanggalDitemukan: realMention.tanggalDitemukan,
    });

    // Ada 2 alert: 1 CONTOH dan 1 FORM
    const sampleAlert = await prisma.alert.findUnique({
      where: {
        jenis_topik_periode_sumberInput: {
          jenis: AlertType.PERLU_PERHATIAN,
          topik: "KPR BTN",
          periode,
          sumberInput: InputSourceType.CONTOH,
        },
      },
    });
    const realAlert = await prisma.alert.findUnique({
      where: {
        jenis_topik_periode_sumberInput: {
          jenis: AlertType.PERLU_PERHATIAN,
          topik: "KPR BTN",
          periode,
          sumberInput: InputSourceType.FORM,
        },
      },
    });
    expect(sampleAlert).not.toBeNull();
    expect(realAlert).not.toBeNull();

    // Hapus mention CONTOH
    const res = await deleteMention(createDeleteRequest(sampleMention.id), {
      params: Promise.resolve({ id: sampleMention.id }),
    });
    expect(res.status).toBe(200);

    // Alert CONTOH terhapus
    const sampleAlertAfter = await prisma.alert.findUnique({
      where: {
        jenis_topik_periode_sumberInput: {
          jenis: AlertType.PERLU_PERHATIAN,
          topik: "KPR BTN",
          periode,
          sumberInput: InputSourceType.CONTOH,
        },
      },
    });
    expect(sampleAlertAfter).toBeNull();

    // Alert NYATA tetap utuh!
    const realAlertAfter = await prisma.alert.findUnique({
      where: {
        jenis_topik_periode_sumberInput: {
          jenis: AlertType.PERLU_PERHATIAN,
          topik: "KPR BTN",
          periode,
          sumberInput: InputSourceType.FORM,
        },
      },
    });
    expect(realAlertAfter).not.toBeNull();
    expect(realAlertAfter?.jumlah).toBe(1);
  });

  it("7. Draf dihapus -> tidak ada Alert yang berubah", async () => {
    const now = new Date();
    const periode = formatWIBFullDate(now);

    // Buat alert aktif nyata terlebih dahulu
    const activeMention = await prisma.mention.create({
      data: {
        linkAsli: "https://threads.net/@u/post/active_m",
        linkTernormalisasi: "https://threads.net/post/active_m",
        teksPostingan: "Mention aktif",
        topik: "Tabungan BTN",
        sentimen: Sentiment.NEGATIF,
        prioritas: Priority.PERLU_PERHATIAN,
        status: MentionStatus.BARU,
        sumberInput: InputSourceType.FORM,
        tanggalDitemukan: now,
      },
    });

    await triggerAlertsForMention({
      id: activeMention.id,
      topik: activeMention.topik,
      prioritas: activeMention.prioritas,
      sentimen: activeMention.sentimen,
      sumberInput: activeMention.sumberInput,
      tanggalDitemukan: activeMention.tanggalDitemukan,
    });

    const alertBefore = await prisma.alert.findUnique({
      where: {
        jenis_topik_periode_sumberInput: {
          jenis: AlertType.PERLU_PERHATIAN,
          topik: "Tabungan BTN",
          periode,
          sumberInput: InputSourceType.FORM,
        },
      },
    });
    expect(alertBefore?.jumlah).toBe(1);

    // Buat mention berstatus DRAF
    const draftMention = await prisma.mention.create({
      data: {
        linkAsli: "https://threads.net/@u/post/draft_m",
        linkTernormalisasi: "https://threads.net/post/draft_m",
        teksPostingan: "Draf mentah",
        topik: "Tabungan BTN",
        sentimen: Sentiment.NEGATIF,
        prioritas: Priority.PERLU_PERHATIAN,
        status: MentionStatus.DRAF,
        sumberInput: InputSourceType.FORM,
        tanggalDitemukan: now,
      },
    });

    // Hapus mention DRAF
    const res = await deleteMention(createDeleteRequest(draftMention.id), {
      params: Promise.resolve({ id: draftMention.id }),
    });
    expect(res.status).toBe(200);

    // Alert tetap utuh dan tidak terpengaruh
    const alertAfter = await prisma.alert.findUnique({
      where: {
        jenis_topik_periode_sumberInput: {
          jenis: AlertType.PERLU_PERHATIAN,
          topik: "Tabungan BTN",
          periode,
          sumberInput: InputSourceType.FORM,
        },
      },
    });
    expect(alertAfter?.jumlah).toBe(1);
  });

  it("8. Tidak ada pemanggilan email akibat DELETE", async () => {
    const now = new Date();

    const mention = await prisma.mention.create({
      data: {
        linkAsli: "https://threads.net/@u/post/no_email_test",
        linkTernormalisasi: "https://threads.net/post/no_email_test",
        teksPostingan: "Uji tidak kirim email saat hapus",
        topik: "BTN Syariah",
        sentimen: Sentiment.NEGATIF,
        prioritas: Priority.PERLU_PERHATIAN,
        status: MentionStatus.BARU,
        sumberInput: InputSourceType.FORM,
        tanggalDitemukan: now,
      },
    });

    await triggerAlertsForMention({
      id: mention.id,
      topik: mention.topik,
      prioritas: mention.prioritas,
      sentimen: mention.sentimen,
      sumberInput: mention.sumberInput,
      tanggalDitemukan: mention.tanggalDitemukan,
    });

    // Pasang spy pada sendAlertEmail
    const emailSpy = vi.spyOn(emailService, "sendAlertEmail");

    // Hapus mention
    const res = await deleteMention(createDeleteRequest(mention.id), {
      params: Promise.resolve({ id: mention.id }),
    });
    expect(res.status).toBe(200);

    // Verifikasi sendAlertEmail sama sekali tidak dipanggil saat DELETE
    expect(emailSpy).not.toHaveBeenCalled();
  });
});
