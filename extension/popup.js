document.addEventListener("DOMContentLoaded", async () => {
  const serverUrlInput = document.getElementById("serverUrl");
  const tokenInput = document.getElementById("token");
  const btnSaveConfig = document.getElementById("btnSaveConfig");
  const configMsg = document.getElementById("configMsg");
  const connBadge = document.getElementById("connBadge");

  const postUrlInput = document.getElementById("postUrl");
  const postTextInput = document.getElementById("postText");
  const btnSend = document.getElementById("btnSend");
  const statusMsg = document.getElementById("statusMsg");

  function normalizeServerUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== "string") return null;
    const trimmed = rawUrl.trim().replace(/\/+$/, "");
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return null;
      }
      return trimmed;
    } catch {
      return null;
    }
  }

  function updateConnectionBadge(isConnected) {
    if (!connBadge) return;
    if (isConnected) {
      connBadge.textContent = "Terhubung";
      connBadge.className = "status-badge badge-connected";
    } else {
      connBadge.textContent = "Belum terhubung";
      connBadge.className = "status-badge badge-disconnected";
    }
  }

  async function testServerConnection(url) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(`${url}/api/auth/token`, {
        method: "GET",
        signal: controller.signal,
      });
      clearTimeout(timer);
      return res.ok || res.status < 500;
    } catch {
      return false;
    }
  }

  // 1. Muat pengaturan dari chrome.storage.local
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(
      ["serverUrl", "extensionToken", "inputToken"],
      (res) => {
        if (res.serverUrl) serverUrlInput.value = res.serverUrl;
        if (res.extensionToken) tokenInput.value = res.extensionToken;
        else if (res.inputToken) tokenInput.value = res.inputToken;

        const cleanUrl = normalizeServerUrl(serverUrlInput.value);
        if (cleanUrl) {
          testServerConnection(cleanUrl).then((ok) =>
            updateConnectionBadge(ok)
          );
        } else {
          updateConnectionBadge(false);
        }
      }
    );
  }

  // 2. Tombol Simpan Pengaturan
  btnSaveConfig.addEventListener("click", async () => {
    configMsg.className = "status";
    configMsg.textContent = "";

    const cleanUrl = normalizeServerUrl(serverUrlInput.value);
    const token = tokenInput.value.trim();

    if (!cleanUrl) {
      configMsg.className = "status error";
      configMsg.textContent =
        "Aplikasi tidak dapat dihubungi. Periksa alamat aplikasi.";
      updateConnectionBadge(false);
      return;
    }

    btnSaveConfig.disabled = true;
    configMsg.className = "status";
    configMsg.textContent = "Memeriksa koneksi...";

    const isConnected = await testServerConnection(cleanUrl);
    btnSaveConfig.disabled = false;

    if (!isConnected) {
      configMsg.className = "status error";
      configMsg.textContent =
        "Aplikasi tidak dapat dihubungi. Periksa alamat aplikasi.";
      updateConnectionBadge(false);
      return;
    }

    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        serverUrl: cleanUrl,
        extensionToken: token,
        inputToken: token,
      });
    }

    updateConnectionBadge(true);
    configMsg.className = "status success";
    configMsg.textContent = "Pengaturan berhasil disimpan.";
  });

  // 3. Ambil data URL dan teks dari tab aktif
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab && tab.id) {
      const tabUrl = tab.url || "";
      const isThreads =
        tabUrl.includes("threads.net") || tabUrl.includes("threads.com");
      const isPost = tabUrl.includes("/post/");

      if (!isThreads || !isPost) {
        postUrlInput.value = tabUrl ? tabUrl.split("?")[0] : "";
        statusMsg.className = "status error";
        statusMsg.textContent =
          "Buka halaman postingan Threads terlebih dahulu.";
        return;
      }

      chrome.tabs.sendMessage(
        tab.id,
        { action: "GET_POST_DATA" },
        (response) => {
          if (chrome.runtime.lastError || !response) {
            postUrlInput.value = tabUrl.split("?")[0];
            statusMsg.className = "status info";
            statusMsg.textContent =
              "Teks postingan belum berhasil diambil. Tautan tetap dapat dikirim sebagai Draf untuk dilengkapi nanti.";
            return;
          }
          if (response.url) postUrlInput.value = response.url;
          if (response.text && response.text.trim().length > 0) {
            postTextInput.value = response.text.trim();
          } else {
            statusMsg.className = "status info";
            statusMsg.textContent =
              "Teks postingan belum berhasil diambil. Tautan tetap dapat dikirim sebagai Draf untuk dilengkapi nanti.";
          }
        }
      );
    }
  } catch {
    statusMsg.className = "status error";
    statusMsg.textContent = "Buka halaman postingan Threads terlebih dahulu.";
  }

  // 4. Tombol Kirim sebagai Draf
  btnSend.addEventListener("click", async () => {
    statusMsg.className = "status";
    statusMsg.textContent = "";

    const serverUrl = normalizeServerUrl(serverUrlInput.value);
    const token = tokenInput.value.trim();
    const linkAsli = postUrlInput.value.trim();
    const teksPostingan = postTextInput.value.trim();

    if (!serverUrl) {
      statusMsg.className = "status error";
      statusMsg.textContent =
        "Aplikasi tidak dapat dihubungi. Periksa alamat aplikasi.";
      updateConnectionBadge(false);
      return;
    }

    if (!token) {
      statusMsg.className = "status error";
      statusMsg.textContent =
        "Kode koneksi tidak valid. Periksa kembali kode yang diberikan.";
      return;
    }

    const isThreadsDomain =
      linkAsli.includes("threads.net") || linkAsli.includes("threads.com");
    if (!linkAsli || !isThreadsDomain || !linkAsli.includes("/post/")) {
      statusMsg.className = "status error";
      statusMsg.textContent = "Buka halaman postingan Threads terlebih dahulu.";
      return;
    }

    // Simpan token & serverUrl untuk penggunaan selanjutnya
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        serverUrl,
        extensionToken: token,
        inputToken: token,
      });
    }

    btnSend.disabled = true;
    statusMsg.className = "status";
    statusMsg.textContent = "Mengirim draf ke server...";

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${serverUrl}/api/mentions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          linkAsli,
          teksPostingan,
          sumberInput: "EKSTENSI",
          status: "DRAF",
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await response.json().catch(() => null);

      if (response.ok) {
        updateConnectionBadge(true);
        statusMsg.className = "status success";
        statusMsg.textContent =
          "Berhasil dikirim sebagai Draf. Tinjau data tersebut melalui menu Draf.";
      } else if (response.status === 401 || response.status === 403) {
        statusMsg.className = "status error";
        statusMsg.textContent =
          "Kode koneksi tidak valid. Periksa kembali kode yang diberikan.";
      } else if (response.status === 409) {
        updateConnectionBadge(true);
        statusMsg.className = "status error";
        statusMsg.textContent = "Tautan ini sudah pernah tercatat di sistem.";
      } else {
        statusMsg.className = "status error";
        statusMsg.textContent =
          data?.error ||
          "Aplikasi tidak dapat dihubungi. Periksa alamat aplikasi.";
      }
    } catch {
      updateConnectionBadge(false);
      statusMsg.className = "status error";
      statusMsg.textContent =
        "Aplikasi tidak dapat dihubungi. Periksa alamat aplikasi.";
    } finally {
      btnSend.disabled = false;
    }
  });
});
