import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PageStorage } from "$server/storage";
import type { Page } from "$shared/types";

let tempDir: string;
let storage: PageStorage;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "inkstation-test-"));
  storage = new PageStorage(tempDir);
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("PageStorage", () => {
  describe("listPages", () => {
    test("returns empty array for empty directory", async () => {
      const pages = await storage.listPages();
      expect(pages).toEqual([]);
    });

    test("returns empty array for non-existent directory", async () => {
      const s = new PageStorage("/tmp/does-not-exist-" + Date.now());
      const pages = await s.listPages();
      expect(pages).toEqual([]);
    });

    test("returns sorted dates descending", async () => {
      const dates = ["2026-01-01", "2026-03-10", "2026-02-15"];
      for (const date of dates) {
        await storage.savePage(date, {
          date,
          next_row_id: 1,
          rows: [],
        });
      }

      const pages = await storage.listPages();
      expect(pages).toEqual(["2026-03-10", "2026-02-15", "2026-01-01"]);
    });

    test("ignores directories without page.yaml", async () => {
      const { mkdir } = await import("node:fs/promises");
      await mkdir(join(tempDir, "2026-01-01"), { recursive: true });
      // No page.yaml written

      const pages = await storage.listPages();
      expect(pages).toEqual([]);
    });
  });

  describe("savePage + loadPage roundtrip", () => {
    test("saves and loads a page correctly", async () => {
      const page: Page = {
        date: "2026-03-10",
        next_row_id: 3,
        rows: [
          {
            id: 1,
            bullet: "·",
            status: "open",
            ocr_text: "Hello world",
            children: [],
          },
          {
            id: 2,
            bullet: "×",
            status: "done",
            ocr_text: "Done task",
            children: [],
          },
        ],
      };

      await storage.savePage("2026-03-10", page);
      const loaded = await storage.loadPage("2026-03-10");

      expect(loaded).not.toBeNull();
      expect(loaded!.date).toBe("2026-03-10");
      expect(loaded!.next_row_id).toBe(3);
      expect(loaded!.rows).toHaveLength(2);
      expect(loaded!.rows[0].ocr_text).toBe("Hello world");
      expect(loaded!.rows[1].status).toBe("done");
    });

    test("loadPage returns null for non-existent page", async () => {
      const loaded = await storage.loadPage("2026-12-31");
      expect(loaded).toBeNull();
    });

    test("loadPage returns null for invalid date format", async () => {
      const loaded = await storage.loadPage("not-a-date");
      expect(loaded).toBeNull();
    });

    test("savePage throws on invalid date format", async () => {
      expect(
        storage.savePage("bad", { date: "bad", next_row_id: 1, rows: [] }),
      ).rejects.toThrow("Invalid date format");
    });
  });

  describe("saveSvg", () => {
    test("returns correct filename with sequence 0 for first SVG", async () => {
      // Create the page dir first
      await storage.savePage("2026-03-10", {
        date: "2026-03-10",
        next_row_id: 1,
        rows: [],
      });

      const filename = await storage.saveSvg(
        "2026-03-10",
        1,
        "add",
        "<svg></svg>",
      );

      expect(filename).toBe("000_00001_add.svg");
    });

    test("increments sequence number", async () => {
      await storage.savePage("2026-03-10", {
        date: "2026-03-10",
        next_row_id: 1,
        rows: [],
      });

      const f1 = await storage.saveSvg("2026-03-10", 1, "add", "<svg>1</svg>");
      const f2 = await storage.saveSvg(
        "2026-03-10",
        2,
        "insert",
        "<svg>2</svg>",
      );

      expect(f1).toBe("000_00001_add.svg");
      expect(f2).toBe("001_00002_insert.svg");
    });

    test("writes SVG content to disk", async () => {
      await storage.savePage("2026-03-10", {
        date: "2026-03-10",
        next_row_id: 1,
        rows: [],
      });

      const svgContent = "<svg><circle r='10'/></svg>";
      const filename = await storage.saveSvg(
        "2026-03-10",
        1,
        "add",
        svgContent,
      );

      const filePath = join(tempDir, "2026-03-10", filename);
      const content = await Bun.file(filePath).text();
      expect(content).toBe(svgContent);
    });

    test("throws on invalid date format", async () => {
      expect(
        storage.saveSvg("invalid", 1, "add", "<svg/>"),
      ).rejects.toThrow("Invalid date format");
    });
  });

  describe("nextSeq", () => {
    test("returns 0 for empty directory", async () => {
      const { mkdir } = await import("node:fs/promises");
      const dir = join(tempDir, "empty-dir");
      await mkdir(dir, { recursive: true });

      const seq = await storage.nextSeq(dir);
      expect(seq).toBe(0);
    });

    test("returns 0 for non-existent directory", async () => {
      const seq = await storage.nextSeq(join(tempDir, "nope"));
      expect(seq).toBe(0);
    });
  });
});
