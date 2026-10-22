/**
 * Layanan Notifikasi Email Alert (Resend REST API)
 *
 * Konfigurasi Lingkungan (Environment Variables):
 * - RESEND_API_KEY: API Key dari Resend (https://resend.com). Format: re_xxx.
 *   Catatan: Tanpa domain kustom yang terverifikasi di Resend, pengiriman hanya
 *   bisa ditujukan ke alamat email pemilik akun Resend tersebut.
 * - ALERT_EMAIL_TO: Alamat email penerima notifikasi alert (bisa lebih dari satu,
 *   dipisahkan dengan tanda koma, mis. admin1@btn.co.id, admin2@btn.co.id).
 * - ALERT_EMAIL_FROM: Alamat pengirim email (opsional). Format dapat berupa
 *   "Nama <email@domain>". Default jika kosong: "BTN Threads Alert <onboarding@resend.dev>".
 * - APP_BASE_URL: URL basis aplikasi dashboard untuk tautan langsung di email.
 *   Default: "http://localhost:3000".
 *
 * Karakteristik Operasional:
 * - Non-blocking: fungsi dipanggil secara asinkron tanpa mengganggu alur simpan mention.
 * - Anti-spam: Memeriksa riwayat alert 5 menit terakhir untuk jenis & topik yang sama.
 * - Keamanan: Memfilter teks menggunakan maskPii dan tidak mencatat (log) API key.
 * - Timeout: Batas waktu permintaan jaringan maksimal 5 detik via AbortController.
 */

import { prisma } from "@/lib/prisma";
import { AlertType, InputSourceType } from "@prisma/client";
import { maskPii } from "@/lib/pii";

export interface AlertEmailPayload {
  id?: string;
  jenis: AlertType;
  topik: string | null;
  periode?: string | null;
  jumlah: number;
  ambangDipakai?: number | null;
  sumberInput?: InputSourceType;
  dibuatPada?: Date;
}

// Pelacak tugas email yang sedang berjalan untuk kebutuhan pengujian asinkron yang deterministik
const pendingEmailTasks = new Set<Promise<boolean>>();

/**
 * Helper pengujian: Menunggu semua tugas pengiriman email yang sedang aktif selesai diproses.
 * Menggantikan sleep/delay acak pada pengujian integrasi.
 */
export function waitForPendingAlertEmails(): Promise<boolean[]> {
  return Promise.all(Array.from(pendingEmailTasks));
}

async function executeSendAlertEmail(
  alert: AlertEmailPayload,
  reason?: string
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const alertEmailTo = process.env.ALERT_EMAIL_TO?.trim();

  // Validasi konfigurasi wajib
  if (!apiKey || !alertEmailTo) {
    console.warn(
      "[sendAlertEmail] RESEND_API_KEY atau ALERT_EMAIL_TO belum dikonfigurasi. Pengiriman email alert dilewati."
    );
    return false;
  }

  const recipients = alertEmailTo
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  if (recipients.length === 0) {
    console.warn(
      "[sendAlertEmail] ALERT_EMAIL_TO tidak berisi alamat email penerima yang valid."
    );
    return false;
  }

  const alertEmailFrom =
    process.env.ALERT_EMAIL_FROM?.trim() ||
    "BTN Threads Alert <onboarding@resend.dev>";
  const baseUrl = (
    process.env.APP_BASE_URL?.trim() || "http://localhost:3000"
  ).replace(/\/+$/, "");

  // Anti-Spam: Cek apakah ada alert serupa (jenis + topik sama) dalam 5 menit terakhir
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentAlert = await prisma.alert.findFirst({
      where: {
        ...(alert.id ? { id: { not: alert.id } } : {}),
        jenis: alert.jenis,
        topik: alert.topik ?? null,
        dibuatPada: { gte: fiveMinutesAgo },
      },
      orderBy: { dibuatPada: "desc" },
    });

    if (recentAlert) {
      const diffMs = Date.now() - recentAlert.dibuatPada.getTime();
      const diffMinutes = Math.max(1, Math.round(diffMs / 60000));
      console.warn(
        `[sendAlertEmail] Email di-skip: email serupa sudah dikirim ${diffMinutes} menit lalu untuk ${alert.jenis} - ${alert.topik || "Umum"}`
      );
      return false;
    }
  } catch (dbError) {
    console.warn(
      `[sendAlertEmail] Gagal mengecek anti-spam di database: ${
        dbError instanceof Error ? dbError.message : String(dbError)
      }`
    );
  }

  // Format Pesan Email
  const topikText = alert.topik?.trim() || "Umum";
  const subject = `[BTN Alert] ${alert.jenis} di ${topikText}`;

  const safeReason = reason ? maskPii(reason).maskedText : "";
  const lines: string[] = [
    "Alert Baru Terdeteksi - BTN Threads Monitoring",
    "==============================================",
    `Jenis: ${alert.jenis}`,
    `Topik: ${topikText}`,
    `Jumlah Mention: ${alert.jumlah}`,
  ];

  if (alert.ambangDipakai != null) {
    lines.push(`Ambang Batas: ${alert.ambangDipakai}`);
  }
  if (alert.periode) {
    lines.push(`Periode: ${alert.periode}`);
  }
  if (safeReason) {
    lines.push(`Keterangan: ${safeReason}`);
  }

  lines.push("");
  lines.push("Buka dashboard untuk melihat detail alert:");
  lines.push(`${baseUrl}/alert`);

  const bodyText = lines.join("\n");

  // Kirim ke Resend REST API dengan batas waktu 5 detik
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: alertEmailFrom,
        to: recipients,
        subject,
        text: bodyText,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn(
        `[sendAlertEmail] Resend API merespons status ${res.status}`
      );
      return false;
    }

    return true;
  } catch (error: unknown) {
    const isTimeout = error instanceof Error && error.name === "AbortError";
    console.warn(
      `[sendAlertEmail] Gagal mengirim email alert: ${
        isTimeout
          ? "Timeout 5 detik tercapai"
          : error instanceof Error
            ? error.message
            : "Kesalahan jaringan"
      }`
    );
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Mengirim notifikasi email alert menggunakan Resend API.
 * Berjalan secara asinkron tanpa melempar pengecualian (non-throwing).
 */
export function sendAlertEmail(
  alert: AlertEmailPayload,
  reason?: string
): Promise<boolean> {
  const task = executeSendAlertEmail(alert, reason);
  pendingEmailTasks.add(task);
  task.finally(() => {
    pendingEmailTasks.delete(task);
  });
  return task;
}
