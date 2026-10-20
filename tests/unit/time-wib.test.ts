import { describe, it, expect } from "vitest";
import {
  getWIBDateString,
  getStartOfWIBDay,
  getEndOfWIBDay,
  subDaysWIB,
  getStartOfWIBMonth,
  getStartOfWIBWeek,
  formatWIBHeaderDate,
  formatWIBShortDate,
  formatWIBFullDate,
  getPresetDateRanges,
} from "@/lib/time";

describe("Utilitas Waktu dan Zona Waktu Asia/Jakarta (WIB) - Tahap 3C", () => {
  it("getWIBDateString mengembalikan format YYYY-MM-DD dalam zona waktu WIB (+07:00)", () => {
    // 2026-10-18 18:00 UTC = 2026-10-19 01:00 WIB (keesokan harinya di WIB)
    const d1 = new Date("2026-10-18T18:00:00.000Z");
    expect(getWIBDateString(d1)).toBe("2026-10-19");

    // 2026-10-19 16:30 UTC = 2026-10-19 23:30 WIB (masih 19 Okt di WIB)
    const d2 = new Date("2026-10-19T16:30:00.000Z");
    expect(getWIBDateString(d2)).toBe("2026-10-19");

    // 2026-10-19 17:05 UTC = 2026-10-20 00:05 WIB (sudah 20 Okt di WIB)
    const d3 = new Date("2026-10-19T17:05:00.000Z");
    expect(getWIBDateString(d3)).toBe("2026-10-20");
  });

  it("getStartOfWIBDay dan getEndOfWIBDay membatasi rentang tepat satu hari WIB", () => {
    const start = getStartOfWIBDay("2026-10-19");
    const end = getEndOfWIBDay("2026-10-19");

    // 00:00:00 WIB = 17:00:00 UTC kemarin
    expect(start.toISOString()).toBe("2026-10-18T17:00:00.000Z");
    // 23:59:59.999 WIB = 16:59:59.999 UTC hari yang sama
    expect(end.toISOString()).toBe("2026-10-19T16:59:59.999Z");

    // Mention di tengah hari WIB
    const midDay = new Date("2026-10-19T05:00:00.000Z"); // 12:00 WIB
    expect(midDay >= start && midDay <= end).toBe(true);

    // Mention tepat dekat awal hari (00:01 WIB)
    const nearStart = new Date("2026-10-18T17:01:00.000Z"); // 00:01 WIB
    expect(nearStart >= start && nearStart <= end).toBe(true);

    // Mention tepat dekat akhir hari (23:59 WIB)
    const nearEnd = new Date("2026-10-19T16:59:00.000Z"); // 23:59 WIB
    expect(nearEnd >= start && nearEnd <= end).toBe(true);
  });

  it("subDaysWIB mengurangi hari dengan benar termasuk melintasi batas bulan", () => {
    expect(subDaysWIB("2026-10-19", 6)).toBe("2026-10-13");
    expect(subDaysWIB("2026-10-19", 29)).toBe("2026-09-20");
    expect(subDaysWIB("2026-10-01", 1)).toBe("2026-09-30");
  });

  it("getStartOfWIBMonth mengembalikan awal bulan WIB", () => {
    const startMonth = getStartOfWIBMonth("2026-10-19");
    expect(startMonth.toISOString()).toBe("2026-09-30T17:00:00.000Z"); // 2026-10-01 00:00:00 WIB
  });

  it("getStartOfWIBWeek mengembalikan hari Senin awal pekan berjalan WIB", () => {
    // 2026-10-19 adalah hari Senin (WIB)
    const monday = new Date("2026-10-19T05:00:00.000Z");
    const startOfWeek = getStartOfWIBWeek(monday);
    expect(startOfWeek.toISOString()).toBe("2026-10-18T17:00:00.000Z"); // 2026-10-19 00:00:00 WIB

    // 2026-10-25 adalah hari Minggu (WIB), awal pekannya tetap Senin 2026-10-19
    const sunday = new Date("2026-10-25T05:00:00.000Z");
    const startOfWeekFromSunday = getStartOfWIBWeek(sunday);
    expect(startOfWeekFromSunday.toISOString()).toBe(
      "2026-10-18T17:00:00.000Z"
    );
  });

  it("formatWIBHeaderDate memformat tanggal dalam bahasa Indonesia untuk header", () => {
    // 2026-10-19 10:00 WIB adalah Senin
    const d = new Date("2026-10-19T03:00:00.000Z");
    const formatted = formatWIBHeaderDate(d);
    expect(formatted).toMatch(/Sen,\s+19\s+Okt/);
  });

  it("getPresetDateRanges menghasilkan 4 preset dinamis berbasis waktu WIB", () => {
    const ref = new Date("2026-10-19T03:00:00.000Z"); // 19 Okt 2026 WIB
    const presets = getPresetDateRanges(ref);

    expect(presets).toHaveLength(4);

    // 7 Hari Terakhir
    expect(presets[0].label).toContain("13 Okt");
    expect(presets[0].label).toContain("19 Okt 2026");

    // 14 Hari Terakhir
    expect(presets[1].label).toContain("06 Okt");
    expect(presets[1].label).toContain("19 Okt 2026");

    // 30 Hari Terakhir
    expect(presets[2].label).toContain("30 Hari Terakhir");
    expect(presets[2].label).toContain("20 Sep");
    expect(presets[2].label).toContain("19 Okt 2026");

    // Bulan Ini
    expect(presets[3].label).toBe("Bulan Ini (Okt 2026)");
    expect(presets[3].startDate).toBe("2026-09-30T17:00:00.000Z");
    expect(presets[3].endDate).toBe("2026-10-19T16:59:59.999Z");
  });
});
