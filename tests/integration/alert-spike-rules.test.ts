import { describe, it, expect } from "vitest";
import { POST as postMention } from "@/app/api/mentions/route";
import { POST as postDraft } from "@/app/api/drafts/route";
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
import { formatWIBFullDate } from "@/lib/time";

describe("Aturan Alert & Spike Satu Logika (Tahap 3E - Item 4)", () => {
  const sessionToken = createSignedSessionToken();

  it("alert Perlu Perhatian memiliki ambangDipakai = null dan jumlah = 1, serta tidak duplikat", async () => {
    const now = new Date();
    const periode = formatWIBFullDate(now);

    // 1. Simpan mention berprioritas PERLU_PERHATIAN
    const res = await postMention(
      new NextRequest("http://localhost:3000/api/mentions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `petugas_session=${sessionToken}`,
        },
        body: JSON.stringify({
          linkAsli: "https://www.threads.com/@user/post/alert_test_1",
          teksPostingan:
            "Gangguan sistem saldo berkurang transaksi gagal di BTN Mobile.",
          topik: "BTN Mobile",
          sentimen: "NEGATIF",
          prioritas: Priority.PERLU_PERHATIAN,
          sumberInput: InputSourceType.FORM,
        }),
      })
    );
    expect(res.status).toBe(200);

    // Verifikasi alert di DB
    const alert = await prisma.alert.findUnique({
      where: {
        jenis_topik_periode_sumberInput: {
          jenis: AlertType.PERLU_PERHATIAN,
          topik: "BTN Mobile",
          periode,
          sumberInput: InputSourceType.FORM,
        },
      },
    });

    expect(alert).not.toBeNull();
    expect(alert?.ambangDipakai).toBeNull(); // Sesuai aturan: null
    expect(alert?.jumlah).toBe(1); // Sesuai aturan: 1

    // 2. Simpan mention kedua dengan topik & prioritas sama di hari yang sama: tidak menimbulkan duplikat
    const res2 = await postMention(
      new NextRequest("http://localhost:3000/api/mentions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `petugas_session=${sessionToken}`,
        },
        body: JSON.stringify({
          linkAsli: "https://www.threads.com/@user/post/alert_test_2",
          teksPostingan:
            "Keluhan kedua mengenai saldo berkurang di BTN Mobile.",
          topik: "BTN Mobile",
          sentimen: "NEGATIF",
          prioritas: Priority.PERLU_PERHATIAN,
          sumberInput: InputSourceType.FORM,
        }),
      })
    );
    expect(res2.status).toBe(200);

    const alertCount = await prisma.alert.count({
      where: {
        jenis: AlertType.PERLU_PERHATIAN,
        topik: "BTN Mobile",
        periode,
        sumberInput: InputSourceType.FORM,
      },
    });
    expect(alertCount).toBe(1); // Batasan unik mencegah alert ganda
  });

  it("pembuatan Draf TIDAK memicu alert; persetujuan draf memicu alert", async () => {
    // 1. Simpan entri draf tanpa teks atau sumber ekstensi/impor (status dipaksa DRAF)
    const draftRes = await postMention(
      new NextRequest("http://localhost:3000/api/mentions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `petugas_session=${sessionToken}`,
        },
        body: JSON.stringify({
          linkAsli: "https://www.threads.com/@user/post/draft_no_alert",
          teksPostingan: "", // Draf kosong
          sumberInput: InputSourceType.IMPOR,
          prioritas: Priority.PERLU_PERHATIAN,
        }),
      })
    );
    expect(draftRes.status).toBe(200);
    const draftJson = await draftRes.json();
    expect(draftJson.mention.status).toBe(MentionStatus.DRAF);

    // Pastikan BELUM ada alert yang dibuat untuk draf
    const alertBeforeApprove = await prisma.alert.count();
    expect(alertBeforeApprove).toBe(0);

    // 2. Setujui draf dengan melengkapi teks
    const approveRes = await postDraft(
      new NextRequest("http://localhost:3000/api/drafts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `petugas_session=${sessionToken}`,
        },
        body: JSON.stringify({
          id: draftJson.mention.id,
          action: "approve",
          edits: {
            teksPostingan:
              "Teks sudah dilengkapi oleh petugas saat verifikasi.",
            topik: "KPR BTN",
            prioritas: Priority.PERLU_PERHATIAN,
          },
        }),
      })
    );
    expect(approveRes.status).toBe(200);

    // Setelah disetujui ke BARU, alert baru terpicu
    const alertAfterApprove = await prisma.alert.findFirst({
      where: {
        jenis: AlertType.PERLU_PERHATIAN,
        topik: "KPR BTN",
        sumberInput: InputSourceType.IMPOR,
      },
    });
    expect(alertAfterApprove).not.toBeNull();
    expect(alertAfterApprove?.ambangDipakai).toBeNull();
    expect(alertAfterApprove?.jumlah).toBe(1);
  });

  it("deteksi spike menggunakan detectSpike pada entri non-DRAF dan memisahkan kelas sumber (tanpa campuran)", async () => {
    const now = new Date();

    // Buat 5 mention DRAF pada topik "KPR BTN" (tidak boleh dihitung spike)
    for (let i = 0; i < 5; i++) {
      await prisma.mention.create({
        data: {
          linkAsli: `https://threads.com/@u/post/spike_draft_${i}`,
          linkTernormalisasi: `https://threads.com/@u/post/spike_draft_${i}`,
          teksPostingan: "Draf belum disetujui",
          sumberInput: InputSourceType.FORM,
          status: MentionStatus.DRAF,
          topik: "KPR BTN",
          sentimen: Sentiment.NEGATIF,
          tanggalDitemukan: now,
        },
      });
    }

    // Buat 5 mention CONTOH (data sintetis - tidak boleh dicampur ke perhitungan alert nyata)
    for (let i = 0; i < 5; i++) {
      await prisma.mention.create({
        data: {
          linkAsli: `https://threads.com/@u/post/spike_sample_${i}`,
          linkTernormalisasi: `https://threads.com/@u/post/spike_sample_${i}`,
          teksPostingan: "Contoh sintetis",
          sumberInput: InputSourceType.CONTOH,
          status: MentionStatus.BARU,
          topik: "KPR BTN",
          sentimen: Sentiment.NEGATIF,
          tanggalDitemukan: now,
        },
      });
    }

    // Simpan mention nyata rutin pertama
    const realMention = await prisma.mention.create({
      data: {
        linkAsli: "https://threads.com/@u/post/real_spike_1",
        linkTernormalisasi: "https://threads.com/@u/post/real_spike_1",
        teksPostingan: "Keluhan KPR",
        sumberInput: InputSourceType.FORM,
        status: MentionStatus.BARU,
        topik: "KPR BTN",
        sentimen: Sentiment.NEGATIF,
        prioritas: Priority.RUTIN,
        tanggalDitemukan: now,
      },
    });

    // Pemicu evaluasi alert
    await triggerAlertsForMention({
      id: realMention.id,
      topik: realMention.topik,
      prioritas: realMention.prioritas,
      sentimen: realMention.sentimen,
      sumberInput: realMention.sumberInput,
      tanggalDitemukan: realMention.tanggalDitemukan,
    });

    // Karena baru ada 1 mention nyata non-DRAF, volume nyata = 1 (< ambang 3/10)
    // dan mention draf maupun contoh tidak ikut dihitung
    const realAlerts = await prisma.alert.findMany({
      where: {
        sumberInput: InputSourceType.FORM,
      },
    });
    expect(realAlerts.length).toBe(0);
  });

  it("mention kedua dengan jenis + topik + hari sama setelah alert pertama ditandai dibaca -> alert muncul lagi sebagai belum dibaca dan jumlah bertambah", async () => {
    const now = new Date();
    const periode = formatWIBFullDate(now);

    // 1. Simpan mention pertama berprioritas PERLU_PERHATIAN
    const res1 = await postMention(
      new NextRequest("http://localhost:3000/api/mentions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `petugas_session=${sessionToken}`,
        },
        body: JSON.stringify({
          linkAsli: "https://www.threads.com/@user/post/alert_repeat_1",
          teksPostingan:
            "Gangguan saldo berkurang di BTN Mobile saat transaksi transfer.",
          topik: "BTN Mobile",
          sentimen: "NEGATIF",
          prioritas: Priority.PERLU_PERHATIAN,
          sumberInput: InputSourceType.FORM,
        }),
      })
    );
    expect(res1.status).toBe(200);

    // Verifikasi alert pertama dibuat: dibaca = false, jumlah = 1
    const alert1 = await prisma.alert.findUnique({
      where: {
        jenis_topik_periode_sumberInput: {
          jenis: AlertType.PERLU_PERHATIAN,
          topik: "BTN Mobile",
          periode,
          sumberInput: InputSourceType.FORM,
        },
      },
    });
    expect(alert1).not.toBeNull();
    expect(alert1?.dibaca).toBe(false);
    expect(alert1?.jumlah).toBe(1);

    // 2. Tandai alert pertama sebagai sudah dibaca
    await prisma.alert.update({
      where: { id: alert1!.id },
      data: { dibaca: true },
    });

    const alertAfterRead = await prisma.alert.findUnique({
      where: { id: alert1!.id },
    });
    expect(alertAfterRead?.dibaca).toBe(true);

    // 3. Simpan mention kedua dengan jenis, topik, dan hari yang sama
    const res2 = await postMention(
      new NextRequest("http://localhost:3000/api/mentions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `petugas_session=${sessionToken}`,
        },
        body: JSON.stringify({
          linkAsli: "https://www.threads.com/@user/post/alert_repeat_2",
          teksPostingan:
            "Keluhan mendesak kedua: saldo terpotong lagi di BTN Mobile.",
          topik: "BTN Mobile",
          sentimen: "NEGATIF",
          prioritas: Priority.PERLU_PERHATIAN,
          sumberInput: InputSourceType.FORM,
        }),
      })
    );
    expect(res2.status).toBe(200);

    // 4. Verifikasi alert muncul lagi sebagai belum dibaca (dibaca: false) dan jumlah bertambah (jumlah: 2)
    const updatedAlert = await prisma.alert.findUnique({
      where: { id: alert1!.id },
    });
    expect(updatedAlert).not.toBeNull();
    expect(updatedAlert?.id).toBe(alert1!.id);
    expect(updatedAlert?.dibaca).toBe(false);
    expect(updatedAlert?.jumlah).toBe(2);
  });
});
