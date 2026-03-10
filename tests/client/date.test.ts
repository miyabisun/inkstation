import { describe, it, expect } from "bun:test";
import {
  getCurrentPageDate,
  getDateRange,
  formatDate,
  isToday,
  isWithinRange,
  addDays,
} from "$client/lib/date";

function jstDate(year: number, month: number, day: number, hour: number): Date {
  const d = new Date(Date.UTC(year, month - 1, day, hour - 9));
  return d;
}

describe("getCurrentPageDate", () => {
  it("returns current date when after 05:00 JST", () => {
    const date = jstDate(2026, 3, 10, 10);
    expect(getCurrentPageDate(date)).toBe("2026-03-10");
  });

  it("returns previous date when before 05:00 JST", () => {
    const date = jstDate(2026, 3, 10, 3);
    expect(getCurrentPageDate(date)).toBe("2026-03-09");
  });

  it("returns current date at exactly 05:00 JST", () => {
    const date = jstDate(2026, 3, 10, 5);
    expect(getCurrentPageDate(date)).toBe("2026-03-10");
  });
});

describe("getDateRange", () => {
  it("returns correct number of dates", () => {
    const now = jstDate(2026, 3, 10, 12);
    const range = getDateRange(3, now);
    expect(range).toHaveLength(3);
    expect(range[0]).toBe("2026-03-10");
    expect(range[1]).toBe("2026-03-09");
    expect(range[2]).toBe("2026-03-08");
  });

  it("returns single date for days=1", () => {
    const now = jstDate(2026, 3, 10, 12);
    const range = getDateRange(1, now);
    expect(range).toHaveLength(1);
    expect(range[0]).toBe("2026-03-10");
  });
});

describe("isToday", () => {
  it("returns true for today's date", () => {
    const now = jstDate(2026, 3, 10, 12);
    expect(isToday("2026-03-10", now)).toBe(true);
  });

  it("returns false for yesterday", () => {
    const now = jstDate(2026, 3, 10, 12);
    expect(isToday("2026-03-09", now)).toBe(false);
  });
});

describe("isWithinRange", () => {
  it("returns true for dates within range", () => {
    const now = jstDate(2026, 3, 10, 12);
    expect(isWithinRange("2026-03-10", 7, now)).toBe(true);
    expect(isWithinRange("2026-03-04", 7, now)).toBe(true);
  });

  it("returns false for dates outside range", () => {
    const now = jstDate(2026, 3, 10, 12);
    expect(isWithinRange("2026-03-03", 7, now)).toBe(false);
  });
});

describe("addDays", () => {
  it("adds days correctly", () => {
    expect(addDays("2026-03-10", 1)).toBe("2026-03-11");
    expect(addDays("2026-03-10", -1)).toBe("2026-03-09");
  });

  it("handles month boundaries", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
  });
});

describe("formatDate", () => {
  it("formats date correctly", () => {
    const date = jstDate(2026, 1, 5, 12);
    expect(formatDate(date)).toBe("2026-01-05");
  });
});
