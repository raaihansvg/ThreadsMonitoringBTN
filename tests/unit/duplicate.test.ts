import { describe, it, expect } from "vitest";
import { isDuplicateLink } from "@/lib/duplicate";

describe("Deteksi Duplikasi Mention (AC-03 & FR-07)", () => {
  const existingList = [
    "https://threads.net/@btn_official/post/ABC12345",
    "https://threads.net/@nasabah/post/XYZ789",
  ];

  it("mendeteksi duplikat saat URL sama persis dimasukkan", () => {
    const res = isDuplicateLink(
      "https://threads.net/@btn_official/post/ABC12345",
      existingList
    );
    expect(res.isDuplicate).toBe(true);
  });

  it("mendeteksi duplikat meskipun URL memiliki query parameter pelacak", () => {
    const res = isDuplicateLink(
      "https://threads.net/@btn_official/post/ABC12345?igshid=123456&utm_source=threads",
      existingList
    );
    expect(res.isDuplicate).toBe(true);
  });

  it("mendeteksi duplikat meskipun menggunakan host threads.com atau www", () => {
    const res = isDuplicateLink(
      "https://www.threads.com/@btn_official/post/ABC12345",
      existingList
    );
    expect(res.isDuplicate).toBe(true);
  });

  it("lolos (bukan duplikat) untuk postingan baru yang belum pernah dicatat", () => {
    const res = isDuplicateLink(
      "https://threads.net/@user_baru/post/BARU999",
      existingList
    );
    expect(res.isDuplicate).toBe(false);
  });
});
