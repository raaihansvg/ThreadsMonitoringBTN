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
 * - Anti-spam: Menyimpan waktu kirim terakhir per kunci (jenis + topik) di Map memori proses (jendela 5 menit).
 *   Catatan Arsitektur: Map memori proses bersifat lokal per worker/instance Node.js dan tidak
 *   berjalan lintas instance pada arsitektur serverless (misal multi-region Vercel functions).
 * - Keamanan: Memfilter teks menggunakan maskPii dan tidak mencatat (log) API key.
 * - Timeout: Batas waktu permintaan jaringan maksimal 5 detik via AbortController.
 */

import { AlertType, InputSourceType } from "@prisma/client";
import { maskPii } from "@/lib/pii";

export interface AlertEmailPayload {
  id?: string;
  jenis?: AlertType | string | null;
  topik?: string | null;
  periode?: string | null;
  jumlah?: number;
  ambangDipakai?: number | null;
  sumberInput?: InputSourceType;
  dibuatPada?: Date;
}

// Pelacak tugas email yang sedang berjalan untuk kebutuhan pengujian asinkron yang deterministik
const pendingEmailTasks = new Set<Promise<boolean>>();

// Map memori proses untuk anti-spam: key = `${jenis}:${topik}`, value = timestamp waktu kirim terakhir (ms)
const lastSentTimestamps = new Map<string, number>();
const ANTI_SPAM_WINDOW_MS = 5 * 60 * 1000; // 5 menit

/**
 * Helper untuk mereset memori anti-spam (digunakan pada pengujian).
 */
export function _resetAntiSpamForTesting(): void {
  lastSentTimestamps.clear();
}

/**
 * Helper pengujian: Menunggu semua tugas pengiriman email yang sedang aktif selesai diproses.
 * Menggantikan sleep/delay acak pada pengujian integrasi.
 */
export function waitForPendingAlertEmails(): Promise<boolean[]> {
  return Promise.all(Array.from(pendingEmailTasks));
}

/**
 * Memetakan enum AlertType ke label ramah pengguna bahasa Indonesia.
 * Mengembalikan null jika jenis alert tidak dikenal atau kosong.
 */
export function getAlertJenisLabel(
  jenis?: AlertType | string | null
): "Lonjakan" | "Perlu Perhatian" | null {
  if (!jenis) return null;
  if (jenis === AlertType.LONJAKAN || jenis === "LONJAKAN") {
    return "Lonjakan";
  }
  if (jenis === AlertType.PERLU_PERHATIAN || jenis === "PERLU_PERHATIAN") {
    return "Perlu Perhatian";
  }
  return null;
}

async function executeSendAlertEmail(
  alert: AlertEmailPayload,
  reason?: string
): Promise<boolean> {
  // 1. Validasi jenis alert (Point 3)
  const jenisLabel = getAlertJenisLabel(alert?.jenis);
  if (!jenisLabel) {
    console.warn(
      `[sendAlertEmail] Jenis alert tidak valid atau kosong: "${alert?.jenis}". Pengiriman email dibatalkan.`
    );
    return false;
  }

  // 2. Alert dari sumberInput CONTOH (Data Contoh) tidak mengirim email
  if (alert?.sumberInput === InputSourceType.CONTOH) {
    return false;
  }

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

  const topikText = alert.topik?.trim() || "Umum";

  // 3. Anti-Spam: Cek apakah ada alert serupa (jenis + topik sama) dalam 5 menit terakhir di memori proses
  const antiSpamKey = `${alert.jenis}:${topikText}`;
  const now = Date.now();
  const lastSent = lastSentTimestamps.get(antiSpamKey);

  if (lastSent && now - lastSent < ANTI_SPAM_WINDOW_MS) {
    const diffMinutes = Math.max(1, Math.round((now - lastSent) / 60000));
    console.warn(
      `[sendAlertEmail] Email di-skip: email serupa sudah dikirim ${diffMinutes} menit lalu untuk ${jenisLabel} - ${topikText}`
    );
    return false;
  }

  // Reservasi waktu kirim di Map SEBELUM fetch untuk mencegah duplikasi pada panggilan paralel
  lastSentTimestamps.set(antiSpamKey, now);

  // 4. Format Pesan Email
  const subject = `[BTN Alert] ${jenisLabel} di ${topikText}`;

  const safeReason = reason ? maskPii(reason).maskedText : "";
  const lines: string[] = [
    "Alert Baru Terdeteksi - BTN Threads Monitoring",
    "==============================================",
    `Jenis: ${jenisLabel}`,
    `Topik: ${topikText}`,
    `Jumlah Mention: ${alert.jumlah ?? 1}`,
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

  // 5. Kirim ke Resend REST API dengan batas waktu 5 detik
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
      // Hapus reservasi jika non-2xx agar bisa dicoba lagi
      lastSentTimestamps.delete(antiSpamKey);
      return false;
    }

    return true;
  } catch (error: unknown) {
    // Hapus reservasi jika gagal (error/timeout) agar bisa dicoba lagi
    lastSentTimestamps.delete(antiSpamKey);
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
