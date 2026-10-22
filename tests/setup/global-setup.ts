/**
 * Global setup Vitest (Tahap 3E): dijalankan SEKALI sebelum seluruh tes.
 * 1. Menolak berjalan bila DATABASE_URL_TEST kosong / sama dengan DATABASE_URL.
 * 2. Menerapkan migrasi Prisma ke database tes (prisma migrate deploy).
 * 3. Mengarahkan DATABASE_URL proses ini (dan worker turunannya) ke database tes.
 */
import { execSync } from "node:child_process";
import { resolveTestDatabaseUrl } from "./test-db-guard";

export default function globalSetup() {
  const testUrl = resolveTestDatabaseUrl();

  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: testUrl },
  });

  process.env.DATABASE_URL = testUrl;

  if (
    !process.env.SESSION_SECRET ||
    process.env.SESSION_SECRET.trim().length < 32
  ) {
    process.env.SESSION_SECRET =
      "test-session-secret-at-least-32-characters-long-key-2026";
  }

  process.env.ANALYSIS_PROVIDER = "keyword";
  delete process.env.RESEND_API_KEY;
}
