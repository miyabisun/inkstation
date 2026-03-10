import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handleWsMessage } from "$server/ws";
import { PageStorage } from "$server/storage";
import { HistoryLog } from "$server/history";
import type { Page } from "$shared/types";

let tempDir: string;
let storage: PageStorage;
let history: HistoryLog;
let sent: any[];
let ws: any;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "inkstation-ws-test-"));
  storage = new PageStorage(tempDir);
  history = new HistoryLog(join(tempDir, "history.db"));
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

describe("handleWsMessage", () => {
  test("ping → pong", async () => {
    await handleWsMessage(ws, JSON.stringify({ type: "ping" }), storage, history);
    expect(sent).toEqual([{ type: "pong" }]);
  });

  test("invalid JSON → error", async () => {
    await handleWsMessage(ws, "not json", storage, history);
    expect(sent[0].type).toBe("error");
    expect(sent[0].message).toBe("Invalid JSON");
  });

  test("unknown type → error", async () => {
    await handleWsMessage(ws, JSON.stringify({ type: "unknown-thing" }), storage, history);
    expect(sent[0].type).toBe("error");
    expect(sent[0].message).toContain("Unknown message type");
  });

  test("list-pages → page-list with empty dates", async () => {
    await handleWsMessage(ws, JSON.stringify({ type: "list-pages" }), storage, history);
    expect(sent).toEqual([{ type: "page-list", dates: [] }]);
  });

  test("list-pages → returns saved pages", async () => {
    await storage.savePage("2026-03-10", { date: "2026-03-10", next_row_id: 1, rows: [] });
    await storage.savePage("2026-01-01", { date: "2026-01-01", next_row_id: 1, rows: [] });

    await handleWsMessage(ws, JSON.stringify({ type: "list-pages" }), storage, history);
    expect(sent[0].type).toBe("page-list");
    expect(sent[0].dates).toEqual(["2026-03-10", "2026-01-01"]);
  });

  test("get-page → empty page for non-existent date", async () => {
    await handleWsMessage(
      ws,
      JSON.stringify({ type: "get-page", date: "2026-05-01" }),
      storage,
      history,
    );
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
      rows: [{ id: 1, bullet: "·", status: "open", ocr_text: "test", children: [] }],
    };
    await storage.savePage("2026-03-10", page);

    await handleWsMessage(
      ws,
      JSON.stringify({ type: "get-page", date: "2026-03-10" }),
      storage,
      history,
    );
    expect(sent[0].type).toBe("page");
    expect(sent[0].page.rows).toHaveLength(1);
    expect(sent[0].page.rows[0].ocr_text).toBe("test");
  });

  test("create-row → indent 0 appends to root", async () => {
    await handleWsMessage(
      ws,
      JSON.stringify({
        type: "create-row",
        id: "msg-1",
        date: "2026-03-10",
        bullet: "·",
        indent: 0,
      }),
      storage,
      history,
    );

    expect(sent[0].type).toBe("row-created");
    expect(sent[0].id).toBe("msg-1");
    expect(sent[0].row.id).toBe(1);
    expect(sent[0].row.bullet).toBe("·");
    expect(sent[0].row.status).toBe("open");

    // Verify persisted
    const page = await storage.loadPage("2026-03-10");
    expect(page).not.toBeNull();
    expect(page!.rows).toHaveLength(1);
    expect(page!.next_row_id).toBe(2);
  });

  test("create-row → indent 1 appends to last root's children", async () => {
    // Create a root row first
    await handleWsMessage(
      ws,
      JSON.stringify({
        type: "create-row",
        id: "msg-1",
        date: "2026-03-10",
        bullet: "·",
        indent: 0,
      }),
      storage,
      history,
    );

    sent = [];

    // Create indented row
    await handleWsMessage(
      ws,
      JSON.stringify({
        type: "create-row",
        id: "msg-2",
        date: "2026-03-10",
        bullet: "×",
        indent: 1,
      }),
      storage,
      history,
    );

    expect(sent[0].type).toBe("row-created");
    expect(sent[0].row.id).toBe(2);
    expect(sent[0].row.status).toBe("done");

    const page = await storage.loadPage("2026-03-10");
    expect(page!.rows).toHaveLength(1);
    expect(page!.rows[0].children).toHaveLength(1);
    expect(page!.rows[0].children[0].id).toBe(2);
  });

  test("create-row → indent 2 appends to last indent-1's children", async () => {
    // Create root
    await handleWsMessage(
      ws,
      JSON.stringify({ type: "create-row", id: "1", date: "2026-03-10", bullet: "·", indent: 0 }),
      storage,
      history,
    );
    // Create indent-1
    await handleWsMessage(
      ws,
      JSON.stringify({ type: "create-row", id: "2", date: "2026-03-10", bullet: "-", indent: 1 }),
      storage,
      history,
    );
    sent = [];
    // Create indent-2
    await handleWsMessage(
      ws,
      JSON.stringify({ type: "create-row", id: "3", date: "2026-03-10", bullet: "o", indent: 2 }),
      storage,
      history,
    );

    expect(sent[0].row.id).toBe(3);
    expect(sent[0].row.status).toBe("event");

    const page = await storage.loadPage("2026-03-10");
    expect(page!.rows[0].children[0].children).toHaveLength(1);
    expect(page!.rows[0].children[0].children[0].id).toBe(3);
  });

  test("create-row → increments next_row_id", async () => {
    for (let i = 0; i < 3; i++) {
      await handleWsMessage(
        ws,
        JSON.stringify({
          type: "create-row",
          id: `msg-${i}`,
          date: "2026-03-10",
          bullet: "·",
          indent: 0,
        }),
        storage,
        history,
      );
    }

    const page = await storage.loadPage("2026-03-10");
    expect(page!.next_row_id).toBe(4);
    expect(page!.rows.map((r) => r.id)).toEqual([1, 2, 3]);
  });

  test("edit-row → error if page not found", async () => {
    await handleWsMessage(
      ws,
      JSON.stringify({
        type: "edit-row",
        id: "msg-1",
        date: "2026-12-31",
        rowId: 1,
        action: "add",
        svg: btoa("<svg></svg>"),
      }),
      storage,
      history,
    );

    expect(sent[0].type).toBe("error");
    expect(sent[0].message).toContain("Page not found");
  });

  test("edit-row → error if row not found", async () => {
    await storage.savePage("2026-03-10", {
      date: "2026-03-10",
      next_row_id: 2,
      rows: [{ id: 1, bullet: "·", status: "open", ocr_text: "", children: [] }],
    });

    await handleWsMessage(
      ws,
      JSON.stringify({
        type: "edit-row",
        id: "msg-1",
        date: "2026-03-10",
        rowId: 999,
        action: "add",
        svg: btoa("<svg></svg>"),
      }),
      storage,
      history,
    );

    expect(sent[0].type).toBe("error");
    expect(sent[0].message).toContain("Row not found");
  });

  test("edit-row → add action saves SVG and returns ocr-result", async () => {
    await storage.savePage("2026-03-10", {
      date: "2026-03-10",
      next_row_id: 2,
      rows: [{ id: 1, bullet: "·", status: "open", ocr_text: "", children: [] }],
    });

    await handleWsMessage(
      ws,
      JSON.stringify({
        type: "edit-row",
        id: "msg-1",
        date: "2026-03-10",
        rowId: 1,
        action: "add",
        svg: btoa("<svg></svg>"),
      }),
      storage,
      history,
    );

    expect(sent[0].type).toBe("ocr-result");
    expect(sent[0].id).toBe("msg-1");
    expect(sent[0].rowId).toBe(1);
    expect(sent[0].action).toBe("add");
    // OCR tools are not available in test, so ocrText will be empty
    expect(sent[0].ocrText).toBe("");
  });

  test("edit-row → insert action at position", async () => {
    await storage.savePage("2026-03-10", {
      date: "2026-03-10",
      next_row_id: 2,
      rows: [{ id: 1, bullet: "·", status: "open", ocr_text: "hello world", children: [] }],
    });

    await handleWsMessage(
      ws,
      JSON.stringify({
        type: "edit-row",
        id: "msg-1",
        date: "2026-03-10",
        rowId: 1,
        action: "insert",
        svg: btoa("<svg></svg>"),
        position: 5,
      }),
      storage,
      history,
    );

    expect(sent[0].type).toBe("ocr-result");
    expect(sent[0].action).toBe("insert");

    // Verify the ocr_text was spliced (OCR returns "" so text stays same length)
    const page = await storage.loadPage("2026-03-10");
    expect(page!.rows[0].ocr_text).toBe("hello world");
  });

  test("update-page → saves and responds", async () => {
    const page: Page = {
      date: "2026-03-10",
      next_row_id: 3,
      rows: [
        { id: 1, bullet: "·", status: "open", ocr_text: "updated", children: [] },
        { id: 2, bullet: "×", status: "done", ocr_text: "done", children: [] },
      ],
    };

    await handleWsMessage(
      ws,
      JSON.stringify({
        type: "update-page",
        id: "msg-1",
        date: "2026-03-10",
        page,
      }),
      storage,
      history,
    );

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
          status: "open",
          ocr_text: "",
          children: [
            {
              id: 2,
              bullet: "-",
              status: "note",
              ocr_text: "",
              children: [
                { id: 3, bullet: "o", status: "event", ocr_text: "nested", children: [] },
              ],
            },
          ],
        },
      ],
    });

    await handleWsMessage(
      ws,
      JSON.stringify({
        type: "edit-row",
        id: "msg-1",
        date: "2026-03-10",
        rowId: 3,
        action: "add",
        svg: btoa("<svg></svg>"),
      }),
      storage,
      history,
    );

    expect(sent[0].type).toBe("ocr-result");
    expect(sent[0].rowId).toBe(3);
  });
});
