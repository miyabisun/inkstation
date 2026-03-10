import { describe, test, expect, afterEach } from "bun:test";
import { HistoryLog } from "$server/history";
import { unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";

function tmpDbPath(): string {
  return join(tmpdir(), `inkstation-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
}

describe("HistoryLog", () => {
  const dbPaths: string[] = [];

  function createTestLog(): { log: HistoryLog; dbPath: string } {
    const dbPath = tmpDbPath();
    dbPaths.push(dbPath);
    return { log: new HistoryLog(dbPath), dbPath };
  }

  afterEach(() => {
    for (const p of dbPaths) {
      try { unlinkSync(p); } catch {}
      try { unlinkSync(p + "-wal"); } catch {}
      try { unlinkSync(p + "-shm"); } catch {}
    }
    dbPaths.length = 0;
  });

  test("appendLog inserts a row correctly", () => {
    const { log, dbPath } = createTestLog();

    const detail = { action: "draw", color: "#000" };
    const pageData = "title: Test Page\nstrokes: []";

    log.appendLog("2026-03-10", "stroke_add", detail, pageData);
    log.close();

    const db = new Database(dbPath, { readonly: true });
    const rows = db.prepare("SELECT * FROM operation_log").all() as any[];

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(1);
    expect(rows[0].page_date).toBe("2026-03-10");
    expect(rows[0].operation).toBe("stroke_add");
    expect(JSON.parse(rows[0].detail)).toEqual(detail);
    expect(rows[0].page_data).toBe(pageData);
    expect(rows[0].created_at).toBeTruthy();

    db.close();
  });

  test("appendLog with null detail stores NULL", () => {
    const { log, dbPath } = createTestLog();

    log.appendLog("2026-03-10", "page_clear", null, "title: Empty");
    log.close();

    const db = new Database(dbPath, { readonly: true });
    const row = db.prepare("SELECT detail FROM operation_log WHERE id = 1").get() as any;

    expect(row.detail).toBeNull();

    db.close();
  });

  test("multiple entries for same page_date", () => {
    const { log, dbPath } = createTestLog();

    log.appendLog("2026-03-10", "stroke_add", { index: 0 }, "strokes: [s0]");
    log.appendLog("2026-03-10", "stroke_add", { index: 1 }, "strokes: [s0, s1]");
    log.appendLog("2026-03-10", "stroke_delete", { index: 0 }, "strokes: [s1]");
    log.close();

    const db = new Database(dbPath, { readonly: true });
    const rows = db.prepare(
      "SELECT * FROM operation_log WHERE page_date = ? ORDER BY id",
    ).all("2026-03-10") as any[];

    expect(rows).toHaveLength(3);
    expect(rows[0].operation).toBe("stroke_add");
    expect(rows[1].operation).toBe("stroke_add");
    expect(rows[2].operation).toBe("stroke_delete");
    expect(rows[0].id).toBeLessThan(rows[1].id);
    expect(rows[1].id).toBeLessThan(rows[2].id);

    db.close();
  });
});
