/**
 * SPIKE Q-02: Skrip Uji Manual Pratinjau Metadata Tautan Threads
 *
 * Batasan & Ketentuan:
 * 1. Membaca maksimal 10 URL dari scripts/spike-urls.txt.
 * 2. Protokol WAJIB HTTPS dan host WAJIB threads.net atau threads.com (divalidasi di setiap redirect, maks 3).
 * 3. Timeout 8 detik per permintaan.
 * 4. Batas pembacaan badan respon maksimal 1 MB (1.048.576 byte).
 * 5. Tanpa cookie, tanpa sesi login, tanpa headless browser.
 * 6. Jeda berurutan 2 detik antar permintaan.
 * 7. Mengekstrak <title>, og:title, og:description, dan twitter:description.
 * 8. Segera BERHENTI jika menerima kode status HTTP 403 atau 429 (tidak menembus blokir).
 */

import fs from "fs";
import path from "path";

interface PreviewRow {
  url: string;
  status: number | string;
  panjangTeks: number;
  snippet120: string;
  catatan?: string;
}

const ALLOWED_HOSTS = [
  "threads.net",
  "www.threads.net",
  "threads.com",
  "www.threads.com",
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

function extractMeta(html: string): {
  title: string;
  ogTitle: string;
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

  return { title, ogTitle, ogDescription, twitterDescription, bestText };
}

async function fetchWithRedirects(
  initialUrl: string,
  maxRedirects = 3
): Promise<{ status: number; text: string; finalUrl: string }> {
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
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "id,en-US;q=0.9,en;q=0.8",
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
        return { status: res.status, text: "", finalUrl: currentUrl };
      }

      // Batasi pembacaan maksimal 1 MB
      const reader = res.body?.getReader();
      if (!reader) {
        const text = await res.text();
        return {
          status: res.status,
          text: text.slice(0, MAX_BYTES),
          finalUrl: currentUrl,
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
      return { status: res.status, text, finalUrl: currentUrl };
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

  const results: PreviewRow[] = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    console.log(`[${i + 1}/${urls.length}] Mengevaluasi: ${url}`);

    if (!isValidThreadsUrl(url)) {
      results.push({
        url,
        status: "INVALID",
        panjangTeks: 0,
        snippet120: "-",
        catatan: "Bukan URL HTTPS Threads yang valid",
      });
      continue;
    }

    try {
      const response = await fetchWithRedirects(url, 3);

      if (response.status === 403 || response.status === 429) {
        console.warn(
          `\n[PERINGATAN] Terdeteksi HTTP ${response.status} pada ${url}.`
        );
        console.warn(
          "Menghentikan evaluasi sesuai instruksi keamanan (tidak menembus blokir)."
        );
        results.push({
          url,
          status: response.status,
          panjangTeks: 0,
          snippet120: "-",
          catatan: "Akses diblokir / Rate Limited (403/429)",
        });
        break;
      }

      const meta = extractMeta(response.text);
      const cleanSnippet = meta.bestText.replace(/\s+/g, " ").slice(0, 120);

      results.push({
        url,
        status: response.status,
        panjangTeks: meta.bestText.length,
        snippet120: cleanSnippet || "(Metadata kosong)",
        catatan: meta.ogDescription
          ? "og:description"
          : meta.title
            ? "title"
            : "-",
      });
    } catch (err: any) {
      results.push({
        url,
        status: "ERROR",
        panjangTeks: 0,
        snippet120: "-",
        catatan: err.message || "Gagal mengambil data",
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
      URL: r.url.length > 45 ? r.url.slice(0, 42) + "..." : r.url,
      Status: r.status,
      "Pjg Teks": r.panjangTeks,
      "120 Karakter Pertama": r.snippet120,
      Catatan: r.catatan,
    }))
  );
}

main().catch((err) => {
  console.error("Kesalahan skrip spike:", err);
});
