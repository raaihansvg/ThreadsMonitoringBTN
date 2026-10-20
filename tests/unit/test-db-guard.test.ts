import { describe, it, expect } from "vitest";
import { assertSeparateTestDb } from "../setup/test-db-guard";

const DEV =
  "postgresql://threads_monitoring:pw@localhost:5432/threads_monitoring?schema=public";
const TEST =
  "postgresql://threads_monitoring:pw@localhost:5432/threads_monitoring_test?schema=public";

describe("Pengaman database tes (Tahap 3E)", () => {
  it("menolak bila DATABASE_URL_TEST kosong", () => {
    expect(() => assertSeparateTestDb(DEV, "")).toThrow(/kosong/);
    expect(() => assertSeparateTestDb(DEV, undefined)).toThrow(/kosong/);
  });

  it("menolak bila DATABASE_URL_TEST identik dengan DATABASE_URL", () => {
    expect(() => assertSeparateTestDb(DEV, DEV)).toThrow(/sama/);
  });

  it("menolak bila hanya beda kredensial/kapitalisasi host tetapi database sama", () => {
    const sameDbOtherUser =
      "postgresql://lain:rahasia@LOCALHOST/threads_monitoring?schema=public";
    expect(() => assertSeparateTestDb(DEV, sameDbOtherUser)).toThrow(/sama/);
  });

  it("menerima database tes yang terpisah", () => {
    expect(assertSeparateTestDb(DEV, TEST)).toBe(TEST);
  });
});
