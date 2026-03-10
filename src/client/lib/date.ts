const JST_OFFSET = 9 * 60;
const DAY_BOUNDARY_HOUR = 5;

function toJST(date: Date): Date {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  return new Date(utc + JST_OFFSET * 60000);
}

function formatTwoDigit(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatYmd(date: Date): string {
  const y = date.getFullYear();
  const m = formatTwoDigit(date.getMonth() + 1);
  const d = formatTwoDigit(date.getDate());
  return `${y}-${m}-${d}`;
}

export function formatDate(date: Date): string {
  return formatYmd(toJST(date));
}

export function getCurrentPageDate(now: Date = new Date()): string {
  const jst = toJST(now);
  if (jst.getHours() < DAY_BOUNDARY_HOUR) {
    jst.setDate(jst.getDate() - 1);
  }
  return formatYmd(jst);
}

export function getDateRange(days: number, from: Date = new Date()): string[] {
  const baseDate = getCurrentPageDate(from);
  const dates: string[] = [];
  for (let i = 0; i < days; i++) {
    dates.push(addDays(baseDate, -i));
  }
  return dates;
}

export function isToday(dateStr: string, now: Date = new Date()): boolean {
  return dateStr === getCurrentPageDate(now);
}

export function isWithinRange(
  dateStr: string,
  days: number,
  now: Date = new Date(),
): boolean {
  const today = getCurrentPageDate(now);
  const oldest = addDays(today, -(days - 1));
  return dateStr >= oldest && dateStr <= today;
}

export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatYmdUtc(date: Date): string {
  const y = date.getUTCFullYear();
  const m = formatTwoDigit(date.getUTCMonth() + 1);
  const d = formatTwoDigit(date.getUTCDate());
  return `${y}-${m}-${d}`;
}

export function addDays(dateStr: string, days: number): string {
  const date = parseDate(dateStr);
  date.setUTCDate(date.getUTCDate() + days);
  return formatYmdUtc(date);
}
