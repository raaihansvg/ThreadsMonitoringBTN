/**
 * Content Script - BTN Threads Monitoring Extension (FR-09)
 * Berjalan hanya pada host https://www.threads.net/* dan https://threads.net/*
 */

function extractPostText() {
  // 1. Prioritas utama: Teks yang sedang diseleksi / disorot oleh petugas
  const selectedText = window.getSelection()?.toString().trim();
  if (selectedText && selectedText.length > 5) {
    return selectedText;
  }

  // 2. Ekstraksi dari elemen artikel postingan aktif
  const activeArticle =
    document.querySelector("article[data-pressable-container='true']") ||
    document.querySelector("article") ||
    document.querySelector("div[data-pressable-container='true']");

  if (activeArticle) {
    // Ambil elemen teks di dalam artikel, hindari tombol aksi dan timestamp
    const textSpans = activeArticle.querySelectorAll(
      "span[dir='auto'], div[dir='auto']"
    );
    const textParts = [];
    textSpans.forEach((el) => {
      const text = el.innerText?.trim();
      if (
        text &&
        text.length > 3 &&
        !text.includes("Balas") &&
        !text.includes("Suka") &&
        !text.includes("Bagikan") &&
        !text.includes("Komentar")
      ) {
        textParts.push(text);
      }
    });

    if (textParts.length > 0) {
      return textParts.join("\n\n");
    }

    if (activeArticle.innerText?.trim()) {
      return activeArticle.innerText.trim();
    }
  }

  // 3. Fallback: Open Graph Description dari meta tag
  const ogDesc = document
    .querySelector("meta[property='og:description']")
    ?.getAttribute("content");
  if (ogDesc && ogDesc.trim()) {
    return ogDesc.trim();
  }

  return "";
}

function getNormalizedUrl() {
  const rawUrl = window.location.href;
  return rawUrl.split("?")[0].replace(/\/$/, "");
}

// Mendengarkan permintaan ekstraksi data dari popup ekstensi
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "GET_POST_DATA") {
    const url = getNormalizedUrl();
    const text = extractPostText();
    sendResponse({ url, text, success: true });
  }
  return true;
});
