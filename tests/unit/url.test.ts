import { describe, it, expect } from "vitest";
import { validateThreadsUrl, normalizeThreadsUrl } from "@/lib/url";

describe("Validasi Tautan Threads (AC-01)", () => {
  it("menerima URL threads.net valid dengan protokol HTTPS", () => {
    const res = validateThreadsUrl(
      "https://www.threads.net/@user_btn/post/DF123456"
    );
    expect(res.valid).toBe(true);
    expect(res.normalizedUrl).toBe(
      "https://threads.net/@user_btn/post/DF123456"
    );
  });

  it("menerima URL threads.com valid dengan protokol HTTPS", () => {
    const res = validateThreadsUrl(
      "https://threads.com/@user_btn/post/DF78910"
    );
    expect(res.valid).toBe(true);
    expect(res.normalizedUrl).toBe(
      "https://threads.net/@user_btn/post/DF78910"
    );
  });

  it("menerima URL threads.com format /share/<id> valid dengan protokol HTTPS", () => {
    const res = validateThreadsUrl("https://www.threads.com/share/H5AYuuM-5/");
    expect(res.valid).toBe(true);
    expect(res.normalizedUrl).toBe("https://threads.net/share/H5AYuuM-5");
  });

  it("menerima URL threads.net format /share/<id> tanpa www", () => {
    const res = validateThreadsUrl("https://threads.net/share/OLU5ZNFDe");
    expect(res.valid).toBe(true);
    expect(res.normalizedUrl).toBe("https://threads.net/share/OLU5ZNFDe");
  });

  it("menolak URL non-HTTPS (mis. http://)", () => {
    const res = validateThreadsUrl(
      "http://threads.net/@user_btn/post/DF123456"
    );
    expect(res.valid).toBe(false);
    expect(res.error).toContain("protokol aman HTTPS");
  });

  it("menolak URL dari host non-Threads", () => {
    const res = validateThreadsUrl("https://instagram.com/p/DF123456");
    expect(res.valid).toBe(false);
    expect(res.error).toContain("threads.net atau threads.com");
  });

  it("menolak URL Threads yang bukan postingan spesifik atau share", () => {
    const res = validateThreadsUrl("https://threads.net/@user_btn");
    expect(res.valid).toBe(false);
    expect(res.error).toContain("/post/ atau /share/<id>");
  });

  it("menolak URL /share/ tanpa ID", () => {
    const res = validateThreadsUrl("https://threads.net/share/");
    expect(res.valid).toBe(false);
  });

  it("menolak input kosong atau null", () => {
    const res = validateThreadsUrl("");
    expect(res.valid).toBe(false);
  });
});

describe("Normalisasi Tautan Threads (AC-03)", () => {
  it("membersihkan parameter pelacakan (tracking query params) seperti igshid dan utm", () => {
    const raw =
      "https://www.threads.net/@nasabah/post/ABC12345?igshid=MzRlODBiNWFlZA==&utm_source=share";
    const normalized = normalizeThreadsUrl(raw);
    expect(normalized).toBe("https://threads.net/@nasabah/post/ABC12345");
  });

  it("menyeragamkan threads.com dan membuang www", () => {
    const raw = "https://www.threads.com/@user/post/XYZ999";
    const normalized = normalizeThreadsUrl(raw);
    expect(normalized).toBe("https://threads.net/@user/post/XYZ999");
  });

  it("menghapus trailing slash pada akhir URL", () => {
    const raw = "https://threads.net/@user/post/XYZ999/";
    const normalized = normalizeThreadsUrl(raw);
    expect(normalized).toBe("https://threads.net/@user/post/XYZ999");
  });
});
