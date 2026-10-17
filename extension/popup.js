document.addEventListener("DOMContentLoaded", async () => {
  const serverUrlInput = document.getElementById("serverUrl");
  const tokenInput = document.getElementById("token");
  const postUrlInput = document.getElementById("postUrl");
  const postTextInput = document.getElementById("postText");
  const btnSend = document.getElementById("btnSend");
  const statusMsg = document.getElementById("statusMsg");

  // 1. Muat pengaturan dari chrome.storage.local
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["serverUrl", "inputToken"], (res) => {
      if (res.serverUrl) serverUrlInput.value = res.serverUrl;
      if (res.inputToken) tokenInput.value = res.inputToken;
    });
  }

  // 2. Ambil data URL dan teks dari tab aktif
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab && tab.id) {
      chrome.tabs.sendMessage(
        tab.id,
        { action: "GET_POST_DATA" },
        (response) => {
          if (chrome.runtime.lastError || !response) {
            postUrlInput.value = tab.url ? tab.url.split("?")[0] : "";
            statusMsg.textContent = "Buka halaman postingan Threads spesifik.";
            return;
          }
          if (response.url) postUrlInput.value = response.url;
          if (response.text) postTextInput.value = response.text;
        }
      );
    }
  } catch (err) {
    statusMsg.textContent = "Gagal membaca tab aktif.";
  }

  // 3. Tombol Kirim ke API
  btnSend.addEventListener("click", async () => {
    const serverUrl = serverUrlInput.value.trim().replace(/\/$/, "");
    const token = tokenInput.value.trim();
    const linkAsli = postUrlInput.value.trim();
    const teksPostingan = postTextInput.value.trim();

    if (!token) {
      statusMsg.className = "status error";
      statusMsg.textContent = "Token petugas wajib diisi.";
      return;
    }

    if (!linkAsli || !linkAsli.includes("threads.")) {
      statusMsg.className = "status error";
      statusMsg.textContent =
        "Tautan harus berasal dari threads.net/threads.com.";
      return;
    }

    if (!teksPostingan) {
      statusMsg.className = "status error";
      statusMsg.textContent = "Teks postingan tidak boleh kosong.";
      return;
    }

    // Simpan token & serverUrl untuk penggunaan selanjutnya
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ serverUrl, inputToken: token });
    }

    btnSend.disabled = true;
    statusMsg.className = "status";
    statusMsg.textContent = "Mengirim draf ke server...";

    try {
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
      });

      const data = await response.json().catch(() => null);

      if (response.ok) {
        statusMsg.className = "status success";
        statusMsg.textContent = "Berhasil! Postingan tersimpan sebagai Draf.";
      } else if (response.status === 409) {
        statusMsg.className = "status error";
        statusMsg.textContent = "Tautan ini sudah pernah tercatat di sistem.";
      } else {
        statusMsg.className = "status error";
        statusMsg.textContent =
          data?.error || `Gagal (${response.status}). Periksa token.`;
      }
    } catch (err) {
      statusMsg.className = "status error";
      statusMsg.textContent = "Gagal terhubung ke server aplikasi.";
    } finally {
      btnSend.disabled = false;
    }
  });
});
