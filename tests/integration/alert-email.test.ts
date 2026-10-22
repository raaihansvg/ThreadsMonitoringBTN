import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  AlertType,
  InputSourceType,
  Priority,
  Sentiment,
} from "@prisma/client";
import { triggerAlertsForMention } from "@/lib/alert/service";
import { waitForPendingAlertEmails } from "@/lib/email/service";

describe("Integrasi Email Alert via Resend REST API", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.RESEND_API_KEY;
    delete process.env.ALERT_EMAIL_TO;
    delete process.env.ALERT_EMAIL_FROM;
    delete process.env.APP_BASE_URL;
  });

  it("1. Alert dibuat -> email dikirim async (tunggu promise selesai lewat helper)", async () => {
    process.env.RESEND_API_KEY = "re_test_mock_key";
    process.env.ALERT_EMAIL_TO = "admin1@example.com, admin2@example.com";
    process.env.ALERT_EMAIL_FROM = "BTN Threads Alert <alert@btn.co.id>";
    process.env.APP_BASE_URL = "http://localhost:3000";

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "msg_12345" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    globalThis.fetch = fetchMock;

    const mentionInput = {
      id: "mention-test-email-1",
      topik: "BTN Mobile",
      prioritas: Priority.PERLU_PERHATIAN,
      sentimen: Sentiment.NEGATIF,
      sumberInput: InputSourceType.FORM,
      tanggalDitemukan: new Date(),
    };

    const alerts = await triggerAlertsForMention(mentionInput);
    expect(alerts.length).toBeGreaterThan(0);

    // Tunggu tugas email asinkron selesai via helper deterministik
    await waitForPendingAlertEmails();

    // Pastikan fetch dipanggil ke Resend REST API
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(options.method).toBe("POST");
    expect(options.headers["Authorization"]).toBe("Bearer re_test_mock_key");
    expect(options.headers["Content-Type"]).toBe("application/json");

    const payload = JSON.parse(options.body);
    expect(payload.from).toBe("BTN Threads Alert <alert@btn.co.id>");
    expect(payload.to).toEqual(["admin1@example.com", "admin2@example.com"]);
    expect(payload.subject).toContain(
      "[BTN Alert] PERLU_PERHATIAN di BTN Mobile"
    );
    expect(payload.text).toContain("Jenis: PERLU_PERHATIAN");
    expect(payload.text).toContain("Topik: BTN Mobile");
    expect(payload.text).toContain("http://localhost:3000/alert");
  });

  it("2. Key kosong -> skip dengan warning, alert tetap jadi", async () => {
    // Pastikan RESEND_API_KEY tidak diset
    delete process.env.RESEND_API_KEY;
    process.env.ALERT_EMAIL_TO = "admin@example.com";

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    const mentionInput = {
      id: "mention-test-email-2",
      topik: "KPR BTN",
      prioritas: Priority.PERLU_PERHATIAN,
      sentimen: Sentiment.NEGATIF,
      sumberInput: InputSourceType.FORM,
      tanggalDitemukan: new Date(),
    };

    const alerts = await triggerAlertsForMention(mentionInput);
    expect(alerts.length).toBeGreaterThan(0);

    await waitForPendingAlertEmails();

    // Tidak ada panggilan HTTP ke Resend
    expect(fetchMock).not.toHaveBeenCalled();

    // Log warning muncul
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "RESEND_API_KEY atau ALERT_EMAIL_TO belum dikonfigurasi"
      )
    );

    // Alert tetap tersimpan di database
    const alertInDb = await prisma.alert.findFirst({
      where: {
        jenis: AlertType.PERLU_PERHATIAN,
        topik: "KPR BTN",
      },
    });
    expect(alertInDb).not.toBeNull();
  });

  it("3. Resend balas 429/500 atau timeout -> proses alert tidak terganggu", async () => {
    process.env.RESEND_API_KEY = "re_test_mock_key";
    process.env.ALERT_EMAIL_TO = "admin@example.com";

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Kasus 3a: Resend merespons HTTP 429 (Rate Limit)
    const fetchMock500 = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "Rate limit exceeded" }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      })
    );
    globalThis.fetch = fetchMock500;

    const mentionInput = {
      id: "mention-test-email-3",
      topik: "Tabungan BTN",
      prioritas: Priority.PERLU_PERHATIAN,
      sentimen: Sentiment.NEGATIF,
      sumberInput: InputSourceType.FORM,
      tanggalDitemukan: new Date(),
    };

    // Proses trigger alert tidak boleh melempar error
    const alerts = await triggerAlertsForMention(mentionInput);
    expect(alerts.length).toBeGreaterThan(0);

    await waitForPendingAlertEmails();
    expect(fetchMock500).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Resend API merespons status 429")
    );

    // Alert tetap berhasil tersimpan
    const alertInDb = await prisma.alert.findFirst({
      where: {
        jenis: AlertType.PERLU_PERHATIAN,
        topik: "Tabungan BTN",
      },
    });
    expect(alertInDb).not.toBeNull();
  });

  it("4. Anti-spam: alert kedua (jenis + topik sama) dalam 5 menit -> email kedua di-skip", async () => {
    process.env.RESEND_API_KEY = "re_test_mock_key";
    process.env.ALERT_EMAIL_TO = "admin@example.com";

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "msg_success" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    globalThis.fetch = fetchMock;

    const now = new Date();

    // Alert 1 (sumber FORM)
    const mention1 = {
      id: "mention-test-email-4a",
      topik: "Anti-Spam Topik",
      prioritas: Priority.PERLU_PERHATIAN,
      sentimen: Sentiment.NEGATIF,
      sumberInput: InputSourceType.FORM,
      tanggalDitemukan: now,
    };
    await triggerAlertsForMention(mention1);
    await waitForPendingAlertEmails();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Alert 2 (sumber EKSTENSI sehingga menghasilkan record Alert berbeda untuk jenis & topik sama)
    const mention2 = {
      id: "mention-test-email-4b",
      topik: "Anti-Spam Topik",
      prioritas: Priority.PERLU_PERHATIAN,
      sentimen: Sentiment.NEGATIF,
      sumberInput: InputSourceType.EKSTENSI,
      tanggalDitemukan: new Date(now.getTime() + 1000), // 1 detik kemudian
    };
    await triggerAlertsForMention(mention2);
    await waitForPendingAlertEmails();

    // fetchMock tetap 1 kali (alert kedua di-skip pengiriman emailnya)
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Verifikasi log anti-spam tercatat
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("email serupa sudah dikirim")
    );

    // Verifikasi kedua alert tetap tersimpan di database
    const allAlerts = await prisma.alert.findMany({
      where: {
        jenis: AlertType.PERLU_PERHATIAN,
        topik: "Anti-Spam Topik",
      },
    });
    expect(allAlerts.length).toBe(2);
  });
});
