/**
 * scripts/cleanup-dev.ts
 *
 * Skrip pembersihan data lama pada database pengembangan (Tahap 3E).
 * Menghapus HANYA 4 ID yang ditentukan secara eksplisit.
 * Meminta konfirmasi ketik "ya" dari petugas sebelum menghapus.
 *
 * PERHATIAN: ID cmveq7o1a0000yec9u5hhki6y DILINDUNGI dan TIDAK AKAN PERNAH dihapus.
 * JANGAN menjalankan skrip ini secara otomatis sebelum disetujui pengguna.
 */

import { PrismaClient } from "@prisma/client";
import * as readline from "readline";

const prisma = new PrismaClient();

// 4 ID target yang diizinkan untuk dibersihkan
const TARGET_IDS = [
  "cmver5qvl0000yeovm8xd919d",
  "cmver4jpx0000ye896g2zxa1a",
  "cmvc3oi2d000qye6bxpdyrq7u",
  "cmvc3oi2e000rye6b92slwr35",
];

// ID terlarang (data milik user yang WAJIB dilindungi)
const PROTECTED_IDS = ["cmveq7o1a0000yec9u5hhki6y"];

async function main() {
  console.log("=== Skrip Pembersihan Data Pengembangan (Tahap 3E) ===\n");

  // Validasi pengaman internal
  for (const pid of PROTECTED_IDS) {
    if (TARGET_IDS.includes(pid)) {
      console.error(
        `[FATAL] ID yang dilindungi (${pid}) terdeteksi di daftar target! Operasi dibatalkan demi keamanan.`
      );
      process.exit(1);
    }
  }

  // 1. Ambil data baris yang cocok di database
  const rows = await prisma.mention.findMany({
    where: { id: { in: TARGET_IDS } },
    select: {
      id: true,
      headline: true,
      status: true,
      sumberInput: true,
      tanggalDitemukan: true,
    },
  });

  console.log(
    `Ditemukan ${rows.length} dari ${TARGET_IDS.length} target ID di database:\n`
  );

  rows.forEach((r, idx) => {
    const headline = (r.headline || "-").slice(0, 40);
    console.log(
      ` ${idx + 1}. [${r.id}] ${r.status} (${r.sumberInput}) - "${headline}"`
    );
  });

  // Tampilkan juga status data yang dilindungi
  const protectedRow = await prisma.mention.findUnique({
    where: { id: PROTECTED_IDS[0] },
    select: { id: true, status: true, sumberInput: true, headline: true },
  });

  console.log("\nStatus data terlindungi (TIDAK AKAN DIHAPUS):");
  if (protectedRow) {
    console.log(
      ` ✓ [${protectedRow.id}] ${protectedRow.status} (${protectedRow.sumberInput}) - "${(protectedRow.headline || "").slice(0, 40)}"`
    );
  } else {
    console.log(` - ID ${PROTECTED_IDS[0]} tidak ditemukan di database.`);
  }

  if (rows.length === 0) {
    console.log("\nTidak ada baris yang perlu dihapus. Selesai.");
    return;
  }

  // 2. Minta konfirmasi interaktif ketik "ya"
  console.log(`\nTotal baris yang akan dihapus: ${rows.length} baris mention.`);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise<string>((resolve) => {
    rl.question(
      'Ketik "ya" untuk mengonfirmasi penghapusan data di atas: ',
      (ans) => {
        rl.close();
        resolve(ans.trim());
      }
    );
  });

  if (answer.toLowerCase() === "ya") {
    const result = await prisma.mention.deleteMany({
      where: { id: { in: TARGET_IDS } },
    });
    console.log(
      `\n✓ Berhasil menghapus ${result.count} baris dari database pengembangan.`
    );
  } else {
    console.log("\nPenghapusan DIBATALKAN. Tidak ada data yang diubah.");
  }
}

main()
  .catch((e) => {
    console.error("Terjadi kesalahan:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
