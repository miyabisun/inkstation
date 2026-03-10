import { describe, expect, test } from "bun:test";
import { holidays } from "$client/lib/holidays";

function countByYear(year: number): number {
  return Object.keys(holidays).filter((d) => d.startsWith(`${year}-`)).length;
}

function getByYear(year: number): Record<string, string> {
  return Object.fromEntries(
    Object.entries(holidays).filter(([d]) => d.startsWith(`${year}-`)),
  );
}

describe("holidays", () => {
  test("exports a Record<string, string>", () => {
    expect(typeof holidays).toBe("object");
    for (const [key, value] of Object.entries(holidays)) {
      expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof value).toBe("string");
    }
  });

  describe("known holidays exist with correct names", () => {
    const cases: [string, string][] = [
      ["2025-01-01", "元日"],
      ["2025-02-11", "建国記念の日"],
      ["2025-05-03", "憲法記念日"],
      ["2025-05-05", "こどもの日"],
      ["2025-08-11", "山の日"],
      ["2025-11-03", "文化の日"],
      ["2026-04-29", "昭和の日"],
      ["2027-11-23", "勤労感謝の日"],
      // Happy Monday
      ["2025-01-13", "成人の日"],
      ["2026-07-20", "海の日"],
      ["2027-09-20", "敬老の日"],
      ["2025-10-13", "スポーツの日"],
      // Equinox
      ["2025-03-20", "春分の日"],
      ["2026-09-23", "秋分の日"],
      ["2027-03-21", "春分の日"],
    ];

    for (const [date, name] of cases) {
      test(`${date} is ${name}`, () => {
        expect(holidays[date]).toBe(name);
      });
    }
  });

  describe("substitute holidays (振替休日)", () => {
    test("2025-02-24 振替休日 (天皇誕生日 2/23 is Sunday)", () => {
      expect(holidays["2025-02-24"]).toBe("振替休日");
    });

    test("2025-05-06 振替休日 (みどりの日 5/4 is Sunday)", () => {
      expect(holidays["2025-05-06"]).toBe("振替休日");
    });

    test("2025-11-24 振替休日 (勤労感謝の日 11/23 is Sunday)", () => {
      expect(holidays["2025-11-24"]).toBe("振替休日");
    });

    test("2026-05-06 振替休日 (憲法記念日 5/3 is Sunday)", () => {
      expect(holidays["2026-05-06"]).toBe("振替休日");
    });

    test("2027-03-22 振替休日 (春分の日 3/21 is Sunday)", () => {
      expect(holidays["2027-03-22"]).toBe("振替休日");
    });
  });

  describe("国民の休日", () => {
    test("2026-09-22 国民の休日 (between 敬老の日 and 秋分の日)", () => {
      expect(holidays["2026-09-22"]).toBe("国民の休日");
    });
  });

  describe("total count per year is reasonable (16-20)", () => {
    // Base: 10 fixed + 4 happy monday + 2 equinox = 16
    // Plus substitute holidays and national holidays: up to ~19
    const expected: Record<number, number> = { 2025: 19, 2026: 18, 2027: 17 };

    for (const year of [2025, 2026, 2027]) {
      test(`${year} has ${expected[year]} holidays`, () => {
        const count = countByYear(year);
        expect(count).toBe(expected[year]);
      });
    }
  });

  test("day-of-week verification for substitute holidays", () => {
    // Verify the original holidays actually fall on Sunday
    const sundayHolidays: [string, string][] = [
      ["2025-02-23", "2025-02-24"],
      ["2025-05-04", "2025-05-06"],
      ["2025-11-23", "2025-11-24"],
      ["2026-05-03", "2026-05-06"],
      ["2027-03-21", "2027-03-22"],
    ];

    for (const [originalDate, substituteDate] of sundayHolidays) {
      const original = new Date(originalDate + "T00:00:00");
      expect(original.getDay()).toBe(0); // Sunday

      const substitute = new Date(substituteDate + "T00:00:00");
      const subDay = substitute.getDay();
      expect(subDay).toBeGreaterThanOrEqual(1); // weekday
      expect(subDay).toBeLessThanOrEqual(5);
    }
  });
});
