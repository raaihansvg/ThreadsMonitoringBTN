/**
 * Setup per-file Vitest (Tahap 3E): berjalan di setiap worker SEBELUM file tes diimpor.
 * - Memvalidasi ulang dan mengarahkan DATABASE_URL ke DATABASE_URL_TEST, sehingga
 *   `@/lib/prisma` yang diimpor tes selalu terhubung ke database tes.
 * - Membersihkan seluruh tabel aplikasi setelah SETIAP tes (TRUNCATE ... CASCADE).
 *
 * Klien pembersih dibuat terpisah dari `@/lib/prisma` agar tetap bekerja walau
 * file tes memakai vi.mock("@/lib/prisma").
 */
import { afterEach, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { resolveTestDatabaseUrl } from "./test-db-guard";

const testUrl = resolveTestDatabaseUrl();
process.env.DATABASE_URL = testUrl;

if (
  !process.env.SESSION_SECRET ||
  process.env.SESSION_SECRET.trim().length < 32
) {
  process.env.SESSION_SECRET =
    "test-session-secret-at-least-32-characters-long-key-2026";
}

// Cegah panggilan jaringan ke LLM eksternal dan Resend saat menjalankan tes
process.env.ANALYSIS_PROVIDER = "keyword";
delete process.env.RESEND_API_KEY;

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
  const list = TABLES.map((t) => `"${t}"`).join(", ");
  await cleaner.$executeRawUnsafe(`TRUNCATE TABLE ${list} CASCADE`);
});

afterAll(async () => {
  await cleaner.$disconnect();
});
