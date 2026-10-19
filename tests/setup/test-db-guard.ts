/**
 * Pengaman database tes (Tahap 3E).
 *
 * Tes WAJIB berjalan di database terpisah (DATABASE_URL_TEST).
 * Pengaman MENOLAK (melempar error) bila:
 *  - DATABASE_URL_TEST kosong, atau
 *  - DATABASE_URL_TEST menunjuk ke database yang sama dengan DATABASE_URL
 *    (dibandingkan per host, port, nama database, dan schema — bukan hanya string).
 */
import { loadEnvConfig } from "@next/env";

function dbIdentity(url: string): string {
  const u = new URL(url);
  const port = u.port || "5432";
  const dbName = u.pathname.replace(/^\//, "");
  const schema = u.searchParams.get("schema") || "public";
  return `${u.hostname.toLowerCase()}:${port}/${dbName}?schema=${schema}`;
}

/** Fungsi murni (dapat diuji): mengembalikan URL tes yang sah atau melempar error. */
export function assertSeparateTestDb(
  devUrlRaw: string | undefined,
  testUrlRaw: string | undefined
): string {
  const devUrl = (devUrlRaw || "").trim();
  const testUrl = (testUrlRaw || "").trim();

  if (!testUrl) {
    throw new Error(
      "[tes] DATABASE_URL_TEST kosong. Tes ditolak agar tidak menyentuh database pengembangan. " +
        "Lihat README bagian 'Database Tes'."
    );
  }

  if (
    devUrl &&
    (testUrl === devUrl || dbIdentity(testUrl) === dbIdentity(devUrl))
  ) {
    throw new Error(
      "[tes] DATABASE_URL_TEST sama dengan DATABASE_URL. Tes ditolak agar tidak menyentuh database pengembangan."
    );
  }

  return testUrl;
}

/** Memuat .env lalu memvalidasi. Nilai DATABASE_URL asli disimpan sekali agar tidak tertimpa. */
export function resolveTestDatabaseUrl(): string {
  loadEnvConfig(process.cwd(), false, { info: () => {}, error: console.error });

  if (!process.env.__DEV_DATABASE_URL_ORIGINAL) {
    process.env.__DEV_DATABASE_URL_ORIGINAL = process.env.DATABASE_URL || "";
  }

  return assertSeparateTestDb(
    process.env.__DEV_DATABASE_URL_ORIGINAL,
    process.env.DATABASE_URL_TEST
  );
}
