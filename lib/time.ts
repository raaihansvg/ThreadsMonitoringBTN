/**
 * Utilitas Waktu dan Zona Waktu Asia/Jakarta (WIB, UTC+7)
 * Memastikan perhitungan "hari ini", rentang tanggal, filter database,
 * dan tampilan header konsisten di sisi server maupun klien.
 */

export const TIMEZONE_WIB = "Asia/Jakarta";

/**
 * Mengambil tanggal dalam format string "YYYY-MM-DD" pada zona waktu Asia/Jakarta.
 */
export function getWIBDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE_WIB,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Mendapatkan objek Date untuk awal hari WIB (00:00:00.000 WIB / +07:00).
 */
export function getStartOfWIBDay(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000+07:00`);
}

/**
 * Mendapatkan objek Date untuk akhir hari WIB (23:59:59.999 WIB / +07:00).
 */
export function getEndOfWIBDay(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999+07:00`);
}

/**
 * Mengurangi sejumlah hari dari tanggal acuan WIB (YYYY-MM-DD).
 */
export function subDaysWIB(baseDateStr: string, days: number): string {
  const d = new Date(`${baseDateStr}T12:00:00.000+07:00`);
  d.setDate(d.getDate() - days);
  return getWIBDateString(d);
}

/**
 * Mendapatkan objek Date untuk awal bulan WIB (01 00:00:00.000 WIB / +07:00).
 */
export function getStartOfWIBMonth(dateStr: string): Date {
  const [year, month] = dateStr.split("-");
  return new Date(`${year}-${month}-01T00:00:00.000+07:00`);
}

/**
 * Mendapatkan objek Date untuk awal pekan berjalan (Senin 00:00:00.000 WIB / +07:00).
 */
export function getStartOfWIBWeek(date: Date = new Date()): Date {
  const dateStr = getWIBDateString(date);
  const midDay = new Date(`${dateStr}T12:00:00.000+07:00`);
  // getDay(): 0 = Minggu, 1 = Senin, ..., 6 = Sabtu
  const dayOfWeek = midDay.getDay();
  // Jarak mundur ke hari Senin (bila Minggu (0), mundur 6 hari)
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const mondayStr = subDaysWIB(dateStr, daysToMonday);
  return getStartOfWIBDay(mondayStr);
}

/**
 * Format tanggal WIB dalam bahasa Indonesia untuk header utama (mis. "Sen, 19 Okt").
 */
export function formatWIBHeaderDate(date: Date = new Date()): string {
  const formatted = new Intl.DateTimeFormat("id-ID", {
    timeZone: TIMEZONE_WIB,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
  // Bersihkan tanda titik bila ada (mis. "Sen, 19 Okt.")
  return formatted.replace(/\./g, "");
}

/**
 * Format tanggal singkat untuk label (mis. "19 Okt").
 */
export function formatWIBShortDate(date: Date): string {
  const formatted = new Intl.DateTimeFormat("id-ID", {
    timeZone: TIMEZONE_WIB,
    day: "2-digit",
    month: "short",
  }).format(date);
  return formatted.replace(/\./g, "");
}

/**
 * Format tanggal lengkap untuk label (mis. "19 Okt 2026").
 */
export function formatWIBFullDate(date: Date): string {
  const formatted = new Intl.DateTimeFormat("id-ID", {
    timeZone: TIMEZONE_WIB,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
  return formatted.replace(/\./g, "");
}

export interface PresetDateRange {
  label: string;
  startDate: string;
  endDate: string;
}

/**
 * Menghasilkan 4 opsi rentang tanggal standar yang dihitung secara dinamis
 * berdasarkan waktu nyata Asia/Jakarta (WIB).
 */
export function getPresetDateRanges(
  refDate: Date = new Date()
): PresetDateRange[] {
  const todayStr = getWIBDateString(refDate);
  const endOfToday = getEndOfWIBDay(todayStr).toISOString();

  // 1. 7 Hari Terakhir (hari ini dan 6 hari sebelumnya)
  const d7StartStr = subDaysWIB(todayStr, 6);
  const d7StartDate = getStartOfWIBDay(d7StartStr);
  const d7Label = `${formatWIBShortDate(d7StartDate)} - ${formatWIBFullDate(getStartOfWIBDay(todayStr))}`;

  // 2. 14 Hari Terakhir
  const d14StartStr = subDaysWIB(todayStr, 13);
  const d14StartDate = getStartOfWIBDay(d14StartStr);
  const d14Label = `${formatWIBShortDate(d14StartDate)} - ${formatWIBFullDate(getStartOfWIBDay(todayStr))}`;

  // 3. 30 Hari Terakhir
  const d30StartStr = subDaysWIB(todayStr, 29);
  const d30StartDate = getStartOfWIBDay(d30StartStr);
  const d30Label = `${formatWIBShortDate(d30StartDate)} - ${formatWIBFullDate(getStartOfWIBDay(todayStr))}`;

  // 4. Bulan Ini
  const [year] = todayStr.split("-");
  const monthStart = getStartOfWIBMonth(todayStr);
  const monthName = new Intl.DateTimeFormat("id-ID", {
    timeZone: TIMEZONE_WIB,
    month: "short",
  })
    .format(monthStart)
    .replace(/\./g, "");
  const monthLabel = `Bulan Ini (${monthName} ${year})`;

  return [
    {
      label: d7Label,
      startDate: d7StartDate.toISOString(),
      endDate: endOfToday,
    },
    {
      label: d14Label,
      startDate: d14StartDate.toISOString(),
      endDate: endOfToday,
    },
    {
      label: `30 Hari Terakhir (${d30Label})`,
      startDate: d30StartDate.toISOString(),
      endDate: endOfToday,
    },
    {
      label: monthLabel,
      startDate: monthStart.toISOString(),
      endDate: endOfToday,
    },
  ];
}
