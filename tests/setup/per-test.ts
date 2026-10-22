/**
 * Setup per-file Vitest (Tahap 3E): berjalan di setiap worker SEBELUM file tes diimpor.
 * - Memvalidasi ulang dan mengarahkan DATABASE_URL ke DATABASE_URL_TEST, sehingga
 *   `@/lib/prisma` yang diimpor tes selalu terhubung ke database tes.
 * - Membersihkan seluruh tabel aplikasi setelah SETIAP tes (TRUNCATE ... CASCADE).
 * - Guard jaringan: Memastikan pemanggilan ke Resend selalu di-mock dan tidak pernah
 *   bocor ke internet.
 *
 * Klien pembersih dibuat terpisah dari `@/lib/prisma` agar tetap bekerja walau
 * file tes memakai vi.mock("@/lib/prisma").
 */
import { afterEach, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { resolveTestDatabaseUrl } from "./test-db-guard";
import { _resetAntiSpamForTesting } from "@/lib/email/service";

const testUrl = resolveTestDatabaseUrl();
process.env.DATABASE_URL = testUrl;

if (
  !process.env.SESSION_SECRET ||
  process.env.SESSION_SECRET.trim().length < 32
) {
  process.env.SESSION_SECRET =
    "test-session-secret-at-least-32-characters-long-key-2026";
}

// Cegah panggilan jaringan ke LLM eksternal dan gunakan mock key untuk Resend
process.env.ANALYSIS_PROVIDER = "keyword";
process.env.RESEND_API_KEY = "re_test_mock";
process.env.ALERT_EMAIL_TO = "test@example.com";

// Guard fetch global: pastikan ada error jika api.resend.com dipanggil tanpa mock khusus tes
const nativeFetch = globalThis.fetch;
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;

  if (url.includes("api.resend.com")) {
    throw new Error(
      `[TEST GUARD] Panggilan jaringan ke api.resend.com terdeteksi tanpa mock: ${url}`
    );
  }
  return nativeFetch(input, init);
};

const cleaner = new PrismaClient({ datasourceUrl: testUrl });

const TABLES = [
  "Mention",
  "Alert",
  "Topic",
  "ImportBatch",
  "AlertConfig",
  "PreviewLimitState",
];

afterEach(async () => {
  _resetAntiSpamForTesting();
  const list = TABLES.map((t) => `"${t}"`).join(", ");
  await cleaner.$executeRawUnsafe(`TRUNCATE TABLE ${list} CASCADE`);
});

afterAll(async () => {
  await cleaner.$disconnect();
});
