import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handleWsMessage } from "$server/ws";
import { PageStorage } from "$server/storage";
import { HistoryLog } from "$server/history";
import { PageMutex } from "$server/mutex";
import { IdempotencyCache } from "$server/idempotency";
import type { Page, ServerMessage } from "$shared/types";

let tempDir: string;
let storage: PageStorage;
let history: HistoryLog;
let mutex: PageMutex;
let cache: IdempotencyCache;
let sent: ServerMessage[];
let ws: { send(data: string): void };

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "inkstation-ws-test-"));
  storage = new PageStorage(tempDir);
  history = new HistoryLog(join(tempDir, "history.db"));
  mutex = new PageMutex();
  cache = new IdempotencyCache();
  sent = [];
  ws = {
    send(data: string) {
      sent.push(JSON.parse(data));
    },
  };
});

afterEach(async () => {
  history.close();
  await rm(tempDir, { recursive: true, force: true });
});

function handle(msg: unknown) {
  return handleWsMessage(ws, JSON.stringify(msg), storage, history, mutex, cache);
}

function handleRaw(raw: string) {
  return handleWsMessage(ws, raw, storage, history, mutex, cache);
}

describe("handleWsMessage", () => {
  test("ping → pong", async () => {
    await handle({ type: "ping" });
    expect(sent).toEqual([{ type: "pong" }]);
  });

  test("invalid JSON → error", async () => {
    await handleRaw("not json");
    expect(sent[0].type).toBe("error");
    expect(sent[0].message).toBe("Invalid JSON");
  });

  test("unknown type → error", async () => {
    await handle({ type: "unknown-thing" });
    expect(sent[0].type).toBe("error");
    expect(sent[0].message).toContain("Unknown message type");
  });

  test("list-pages → page-list with empty dates", async () => {
    await handle({ type: "list-pages" });
    expect(sent).toEqual([{ type: "page-list", dates: [] }]);
  });

  test("list-pages → returns saved pages", async () => {
    await storage.savePage("2026-03-10", { date: "2026-03-10", next_row_id: 1, rows: [] });
    await storage.savePage("2026-01-01", { date: "2026-01-01", next_row_id: 1, rows: [] });

    await handle({ type: "list-pages" });
    expect(sent[0].type).toBe("page-list");
    expect(sent[0].dates).toEqual(["2026-03-10", "2026-01-01"]);
  });

  test("get-page → empty page for non-existent date", async () => {
    await handle({ type: "get-page", date: "2026-05-01" });
    expect(sent[0]).toEqual({
      type: "page",
      date: "2026-05-01",
      page: { date: "2026-05-01", next_row_id: 1, rows: [] },
    });
  });

  test("get-page → returns existing page", async () => {
    const page: Page = {
      date: "2026-03-10",
      next_row_id: 2,
      rows: [{ id: 1, bullet: "·", ocr_text: "test", children: [] }],
    };
    await storage.savePage("2026-03-10", page);

    await handle({ type: "get-page", date: "2026-03-10" });
    expect(sent[0].type).toBe("page");
    expect(sent[0].page.rows).toHaveLength(1);
    expect(sent[0].page.rows[0].ocr_text).toBe("test");
  });

  test("create-row → indent 0 appends to root", async () => {
    await handle({
      type: "create-row",
      id: "msg-1",
      date: "2026-03-10",
      bullet: "·",
      indent: 0,
    });

    expect(sent[0].type).toBe("row-created");
    expect(sent[0].id).toBe("msg-1");
    expect(sent[0].row.id).toBe(1);
    expect(sent[0].row.bullet).toBe("·");

    // Verify persisted
    const page = await storage.loadPage("2026-03-10");
    expect(page).not.toBeNull();
    expect(page!.rows).toHaveLength(1);
    expect(page!.next_row_id).toBe(2);
  });

  test("create-row → indent 1 appends to last root's children", async () => {
    await handle({
      type: "create-row",
      id: "msg-1",
      date: "2026-03-10",
      bullet: "·",
      indent: 0,
    });
    sent = [];

    await handle({
      type: "create-row",
      id: "msg-2",
      date: "2026-03-10",
      bullet: "×",
      indent: 1,
    });

    expect(sent[0].type).toBe("row-created");
    expect(sent[0].row.id).toBe(2);

    const page = await storage.loadPage("2026-03-10");
    expect(page!.rows).toHaveLength(1);
    expect(page!.rows[0].children).toHaveLength(1);
    expect(page!.rows[0].children[0].id).toBe(2);
  });

  test("create-row → indent 2 appends to last indent-1's children", async () => {
    await handle({ type: "create-row", id: "1", date: "2026-03-10", bullet: "·", indent: 0 });
    await handle({ type: "create-row", id: "2", date: "2026-03-10", bullet: "-", indent: 1 });
    sent = [];
    await handle({ type: "create-row", id: "3", date: "2026-03-10", bullet: "o", indent: 2 });

    expect(sent[0].row.id).toBe(3);

    const page = await storage.loadPage("2026-03-10");
    expect(page!.rows[0].children[0].children).toHaveLength(1);
    expect(page!.rows[0].children[0].children[0].id).toBe(3);
  });

  test("create-row → increments next_row_id", async () => {
    for (let i = 0; i < 3; i++) {
      await handle({
        type: "create-row",
        id: `msg-${i}`,
        date: "2026-03-10",
        bullet: "·",
        indent: 0,
      });
    }

    const page = await storage.loadPage("2026-03-10");
    expect(page!.next_row_id).toBe(4);
    expect(page!.rows.map((r) => r.id)).toEqual([1, 2, 3]);
  });

  test("edit-row → error if page not found", async () => {
    await handle({
      type: "edit-row",
      id: "msg-1",
      date: "2026-12-31",
      rowId: 1,
      action: "add",
      svg: btoa("<svg></svg>"),
    });

    expect(sent[0].type).toBe("error");
    expect(sent[0].message).toContain("Page not found");
  });

  test("edit-row → error if row not found", async () => {
    await storage.savePage("2026-03-10", {
      date: "2026-03-10",
      next_row_id: 2,
      rows: [{ id: 1, bullet: "·", ocr_text: "", children: [] }],
    });

    await handle({
      type: "edit-row",
      id: "msg-1",
      date: "2026-03-10",
      rowId: 999,
      action: "add",
      svg: btoa("<svg></svg>"),
    });

    expect(sent[0].type).toBe("error");
    expect(sent[0].message).toContain("Row not found");
  });

  test("edit-row → add action saves SVG and returns row-edited immediately", async () => {
    await storage.savePage("2026-03-10", {
      date: "2026-03-10",
      next_row_id: 2,
      rows: [{ id: 1, bullet: "·", ocr_text: "", children: [] }],
    });

    await handle({
      type: "edit-row",
      id: "msg-1",
      date: "2026-03-10",
      rowId: 1,
      action: "add",
      svg: btoa("<svg></svg>"),
    });

    // First message should be the immediate ACK
    expect(sent[0].type).toBe("row-edited");
    expect(sent[0].id).toBe("msg-1");
    expect(sent[0].rowId).toBe(1);
  });

  test("edit-row → insert action returns row-edited", async () => {
    await storage.savePage("2026-03-10", {
      date: "2026-03-10",
      next_row_id: 2,
      rows: [{ id: 1, bullet: "·", ocr_text: "hello world", children: [] }],
    });

    await handle({
      type: "edit-row",
      id: "msg-1",
      date: "2026-03-10",
      rowId: 1,
      action: "insert",
      svg: btoa("<svg></svg>"),
      position: 5,
    });

    expect(sent[0].type).toBe("row-edited");
    expect(sent[0].id).toBe("msg-1");
  });

  test("edit-row → OCR result sent asynchronously", async () => {
    await storage.savePage("2026-03-10", {
      date: "2026-03-10",
      next_row_id: 2,
      rows: [{ id: 1, bullet: "·", ocr_text: "", children: [] }],
    });

    await handle({
      type: "edit-row",
      id: "msg-1",
      date: "2026-03-10",
      rowId: 1,
      action: "add",
      svg: btoa("<svg></svg>"),
    });

    // Wait for async OCR to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    const ocrMsg = sent.find((m) => m.type === "ocr-result");
    expect(ocrMsg).toBeDefined();
    expect(ocrMsg.rowId).toBe(1);
    expect(ocrMsg.action).toBe("add");
    // OCR tools are not available in test, so ocrText will be empty
    expect(ocrMsg.ocrText).toBe("");
  });

  test("update-page → saves and responds", async () => {
    const page: Page = {
      date: "2026-03-10",
      next_row_id: 3,
      rows: [
        { id: 1, bullet: "·", ocr_text: "updated", children: [] },
        { id: 2, bullet: "×", ocr_text: "done", children: [] },
      ],
    };

    await handle({
      type: "update-page",
      id: "msg-1",
      date: "2026-03-10",
      page,
    });

    expect(sent[0]).toEqual({ type: "page-updated", id: "msg-1", date: "2026-03-10" });

    const loaded = await storage.loadPage("2026-03-10");
    expect(loaded!.rows).toHaveLength(2);
    expect(loaded!.rows[0].ocr_text).toBe("updated");
  });

  test("edit-row → finds nested row", async () => {
    await storage.savePage("2026-03-10", {
      date: "2026-03-10",
      next_row_id: 4,
      rows: [
        {
          id: 1,
          bullet: "·",
          ocr_text: "",
          children: [
            {
              id: 2,
              bullet: "-",
              ocr_text: "",
              children: [
                { id: 3, bullet: "o", ocr_text: "nested", children: [] },
              ],
            },
          ],
        },
      ],
    });

    await handle({
      type: "edit-row",
      id: "msg-1",
      date: "2026-03-10",
      rowId: 3,
      action: "add",
      svg: btoa("<svg></svg>"),
    });

    expect(sent[0].type).toBe("row-edited");
    expect(sent[0].rowId).toBe(3);
  });

  // --- ID integrity tests ---

  test("update-page → rejects duplicate row IDs", async () => {
    await handle({
      type: "update-page",
      id: "msg-dup",
      date: "2026-03-10",
      page: {
        date: "2026-03-10",
        next_row_id: 3,
        rows: [
          { id: 1, bullet: "·", ocr_text: "", children: [] },
          { id: 1, bullet: "-", ocr_text: "", children: [] },
        ],
      },
    });

    expect(sent[0].type).toBe("error");
    expect(sent[0].message).toContain("Invalid page data");
  });

  test("update-page → rejects row ID >= next_row_id", async () => {
    await handle({
      type: "update-page",
      id: "msg-high",
      date: "2026-03-10",
      page: {
        date: "2026-03-10",
        next_row_id: 2,
        rows: [
          { id: 5, bullet: "·", ocr_text: "", children: [] },
        ],
      },
    });

    expect(sent[0].type).toBe("error");
    expect(sent[0].message).toContain("Invalid page data");
  });

  // --- loadPage validation test ---

  test("loadPage → returns null for invalid data on disk", async () => {
    // Write invalid YAML (row with id >= next_row_id)
    const pageDir = `${tempDir}/2026-06-15`;
    const { mkdir } = await import("node:fs/promises");
    await mkdir(pageDir, { recursive: true });
    const yamlContent = `date: "2026-06-15"\nnext_row_id: 1\nrows:\n  - id: 5\n    bullet: "·"\n    ocr_text: ""\n    children: []\n`;
    await Bun.write(`${pageDir}/page.yaml`, yamlContent);

    const page = await storage.loadPage("2026-06-15");
    expect(page).toBeNull();
  });

  // --- Idempotency tests ---

  test("idempotent → same message ID returns cached response", async () => {
    await handle({
      type: "create-row",
      id: "idem-1",
      date: "2026-03-10",
      bullet: "·",
      indent: 0,
    });
    expect(sent).toHaveLength(1);
    expect(sent[0].type).toBe("row-created");

    sent = [];
    // Send same message again
    await handle({
      type: "create-row",
      id: "idem-1",
      date: "2026-03-10",
      bullet: "·",
      indent: 0,
    });
    expect(sent).toHaveLength(1);
    expect(sent[0].type).toBe("row-created");
    expect(sent[0].id).toBe("idem-1");

    // Should NOT have created a second row
    const page = await storage.loadPage("2026-03-10");
    expect(page!.rows).toHaveLength(1);
  });

  // --- Concurrent mutation test ---

  test("mutex → concurrent create-rows are serialized", async () => {
    // Fire two create-rows concurrently
    const p1 = handle({
      type: "create-row",
      id: "c-1",
      date: "2026-03-10",
      bullet: "·",
      indent: 0,
    });
    const p2 = handle({
      type: "create-row",
      id: "c-2",
      date: "2026-03-10",
      bullet: "×",
      indent: 0,
    });

    await Promise.all([p1, p2]);

    const page = await storage.loadPage("2026-03-10");
    expect(page!.rows).toHaveLength(2);
    expect(page!.next_row_id).toBe(3);
    // IDs should be 1 and 2 (serialized, no lost updates)
    const ids = page!.rows.map((r) => r.id).sort();
    expect(ids).toEqual([1, 2]);
  });
});
