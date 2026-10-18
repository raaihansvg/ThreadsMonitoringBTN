/**
 * SPIKE Q-02: Skrip Uji Manual Pratinjau Metadata Tautan Threads
 *
 * Batasan & Ketentuan (Diperbarui sesuai Koreksi Audit Tahap 1.8):
 * 1. Membaca maksimal 10 URL dari scripts/spike-urls.txt.
 * 2. Protokol WAJIB HTTPS dan host WAJIB threads.net / threads.com / instagram.com (divalidasi di setiap redirect, maks 5).
 * 3. Timeout 8 detik per permintaan.
 * 4. Batas pembacaan badan respon maksimal 1 MB (1.048.576 byte).
 * 5. Tanpa cookie, tanpa sesi login, tanpa headless browser.
 * 6. User-Agent jujur: "ThreadsMonitoring-spike/0.1" tanpa header penyamaran browser.
 * 7. Jeda berurutan 2 detik antar permintaan.
 * 8. Menampilkan: alamat akhir (host+path), jumlah redirect, ada/tidaknya og:title dan og:description, dan status akhir.
 * 9. Segera BERHENTI jika menerima kode status HTTP 403 atau 429 (tidak menembus blokir).
 */

import fs from "fs";
import path from "path";

interface PreviewRow {
  urlAsal: string;
  alamatAkhir: string; // Host & path saja
  jumlahRedirect: number;
  hasOgTitle: string; // "Ya" / "Tidak"
  hasOgDesc: string; // "Ya" / "Tidak"
  statusAkhir: number | string;
  panjangTeks: number;
  snippet120: string;
}

const ALLOWED_HOSTS = [
  "threads.net",
  "www.threads.net",
  "threads.com",
  "www.threads.com",
  "instagram.com",
  "www.instagram.com",
];

const MAX_URLS = 10;
const TIMEOUT_MS = 8000;
const MAX_BYTES = 1024 * 1024; // 1 MB
const DELAY_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isValidThreadsUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== "https:") return false;
    const hostname = parsed.hostname.toLowerCase();
    return ALLOWED_HOSTS.includes(hostname);
  } catch {
    return false;
  }
}

function getHostAndPath(urlString: string): string {
  try {
    const parsed = new URL(urlString);
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return urlString;
  }
}

function extractMeta(html: string): {
  title: string;
  hasOgTitle: boolean;
  ogTitle: string;
  hasOgDescription: boolean;
  ogDescription: string;
  twitterDescription: string;
  bestText: string;
} {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const ogTitleMatch =
    html.match(
      /<meta\s+property=["']og:title["']\s+content=["']([^"']*)["']/i
    ) ||
    html.match(/<meta\s+content=["']([^"']*)["']\s+property=["']og:title["']/i);
  const ogDescMatch =
    html.match(
      /<meta\s+property=["']og:description["']\s+content=["']([^"']*)["']/i
    ) ||
    html.match(
      /<meta\s+content=["']([^"']*)["']\s+property=["']og:description["']/i
    );
  const twitterDescMatch =
    html.match(
      /<meta\s+name=["']twitter:description["']\s+content=["']([^"']*)["']/i
    ) ||
    html.match(
      /<meta\s+content=["']([^"']*)["']\s+name=["']twitter:description["']/i
    );

  const title = titleMatch ? titleMatch[1].trim() : "";
  const ogTitle = ogTitleMatch ? ogTitleMatch[1].trim() : "";
  const ogDescription = ogDescMatch ? ogDescMatch[1].trim() : "";
  const twitterDescription = twitterDescMatch ? twitterDescMatch[1].trim() : "";

  const bestText =
    ogDescription || twitterDescription || ogTitle || title || "";

  return {
    title,
    hasOgTitle: !!ogTitleMatch && ogTitle.length > 0,
    ogTitle,
    hasOgDescription: !!ogDescMatch && ogDescription.length > 0,
    ogDescription,
    twitterDescription,
    bestText,
  };
}

async function fetchWithRedirects(
  initialUrl: string,
  maxRedirects = 5
): Promise<{
  status: number;
  text: string;
  finalUrl: string;
  redirectsCount: number;
}> {
  let currentUrl = initialUrl;
  let redirectsCount = 0;

  while (redirectsCount <= maxRedirects) {
    if (!isValidThreadsUrl(currentUrl)) {
      throw new Error(
        `URL atau target redirect tidak diizinkan: ${currentUrl}`
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(currentUrl, {
        method: "GET",
        headers: {
          "User-Agent": "ThreadsMonitoring-spike/0.1",
        },
        redirect: "manual",
        signal: controller.signal,
      });

      clearTimeout(timer);

      // Cek redirect (301, 302, 303, 307, 308)
      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const location = res.headers.get("location");
        if (!location) {
          throw new Error("Redirect status tanpa header Location");
        }
        const resolvedUrl = new URL(location, currentUrl).toString();
        currentUrl = resolvedUrl;
        redirectsCount++;
        continue;
      }

      // Handle 403 / 429
      if (res.status === 403 || res.status === 429) {
        return {
          status: res.status,
          text: "",
          finalUrl: currentUrl,
          redirectsCount,
        };
      }

      // Batasi pembacaan maksimal 1 MB
      const reader = res.body?.getReader();
      if (!reader) {
        const text = await res.text();
        return {
          status: res.status,
          text: text.slice(0, MAX_BYTES),
          finalUrl: currentUrl,
          redirectsCount,
        };
      }

      const chunks: Uint8Array[] = [];
      let totalBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          totalBytes += value.length;
          chunks.push(value);
          if (totalBytes >= MAX_BYTES) {
            reader.cancel();
            break;
          }
        }
      }

      const buffer = Buffer.concat(chunks);
      const text = buffer.toString("utf-8");
      return { status: res.status, text, finalUrl: currentUrl, redirectsCount };
    } catch (err: any) {
      clearTimeout(timer);
      if (err.name === "AbortError") {
        throw new Error(`Timeout melebihi ${TIMEOUT_MS / 1000} detik`);
      }
      throw err;
    }
  }

  throw new Error(`Melebihi batas maksimal redirect (${maxRedirects})`);
}

async function main() {
  const filePath = path.resolve(__dirname, "spike-urls.txt");
  if (!fs.existsSync(filePath)) {
    console.error("Berkas scripts/spike-urls.txt tidak ditemukan.");
    process.exit(1);
  }

  const rawLines = fs.readFileSync(filePath, "utf-8").split("\n");
  const urls = rawLines
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .slice(0, MAX_URLS);

  if (urls.length === 0) {
    console.log("Berkas scripts/spike-urls.txt masih kosong.");
    console.log(
      "Silakan isi maksimal 10 URL Threads untuk menjalankan evaluasi pratinjau."
    );
    return;
  }

  console.log(`=== Memulai Evaluasi SPIKE Q-02 (${urls.length} URL) ===\n`);
  console.log(
    `User-Agent: ThreadsMonitoring-spike/0.1 (tanpa penyamaran browser)\n`
  );

  const results: PreviewRow[] = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    console.log(`[${i + 1}/${urls.length}] Mengevaluasi: ${url}`);

    if (!isValidThreadsUrl(url)) {
      results.push({
        urlAsal: url,
        alamatAkhir: "-",
        jumlahRedirect: 0,
        hasOgTitle: "Tidak",
        hasOgDesc: "Tidak",
        statusAkhir: "INVALID",
        panjangTeks: 0,
        snippet120: "Bukan URL HTTPS Threads yang valid",
      });
      continue;
    }

    try {
      const response = await fetchWithRedirects(url, 5);

      if (response.status === 403 || response.status === 429) {
        console.warn(
          `\n[PERINGATAN] Terdeteksi HTTP ${response.status} pada ${url}.`
        );
        console.warn(
          "Menghentikan evaluasi sesuai instruksi keamanan (tidak menembus blokir)."
        );
        results.push({
          urlAsal: url,
          alamatAkhir: getHostAndPath(response.finalUrl),
          jumlahRedirect: response.redirectsCount,
          hasOgTitle: "Tidak",
          hasOgDesc: "Tidak",
          statusAkhir: response.status,
          panjangTeks: 0,
          snippet120: "Akses diblokir / Rate Limited (403/429)",
        });
        break;
      }

      const meta = extractMeta(response.text);
      const cleanSnippet = meta.bestText.replace(/\s+/g, " ").slice(0, 120);

      results.push({
        urlAsal: url,
        alamatAkhir: getHostAndPath(response.finalUrl),
        jumlahRedirect: response.redirectsCount,
        hasOgTitle: meta.hasOgTitle ? "Ya" : "Tidak",
        hasOgDesc: meta.hasOgDescription ? "Ya" : "Tidak",
        statusAkhir: response.status,
        panjangTeks: meta.bestText.length,
        snippet120: cleanSnippet || "(Metadata kosong)",
      });
    } catch (err: any) {
      results.push({
        urlAsal: url,
        alamatAkhir: "-",
        jumlahRedirect: 0,
        hasOgTitle: "Tidak",
        hasOgDesc: "Tidak",
        statusAkhir: "ERROR",
        panjangTeks: 0,
        snippet120: err.message || "Gagal mengambil data",
      });
    }

    // Jeda 2 detik antar permintaan jika masih ada URL berikutnya
    if (i < urls.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  console.log("\n=== HASIL EVALUASI SPIKE PRATINJAU THREADS ===");
  console.table(
    results.map((r) => ({
      "URL Asal": r.urlAsal,
      "Alamat Akhir (Host+Path)": r.alamatAkhir,
      "Jml Redir": r.jumlahRedirect,
      "og:title": r.hasOgTitle,
      "og:desc": r.hasOgDesc,
      "Status Akhir": r.statusAkhir,
      "Pjg Teks": r.panjangTeks,
      "120 Karakter Cuplikan": r.snippet120,
    }))
  );
}

main().catch((err) => {
  console.error("Kesalahan skrip spike:", err);
});
