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
}
