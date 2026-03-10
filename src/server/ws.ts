import type { ServerWebSocket } from "bun";
import { PageStorage, DATE_RE, VALID_ACTIONS } from "./storage";
import { HistoryLog } from "./history";
import { recognizeText } from "./ocr";
import type {
  ServerMessage,
  Row,
  BulletSymbol,
  Action,
} from "$shared/types";
import { BULLET_STATUS, updateRowRecursive } from "$shared/types";

const VALID_BULLETS = new Set<string>(["·", "×", "-", ">", "o"]);
const VALID_STATUSES = new Set<string>(["open", "done", "note", "migrated", "event"]);
const MAX_SVG_LENGTH = 2 * 1024 * 1024; // 2MB base64

function send(ws: ServerWebSocket, msg: ServerMessage): void {
  ws.send(JSON.stringify(msg));
}

function findRow(rows: Row[], rowId: number): Row | null {
  for (const row of rows) {
    if (row.id === rowId) return row;
    const found = findRow(row.children, rowId);
    if (found) return found;
  }
  return null;
}

function validateDate(date: unknown): date is string {
  if (typeof date !== "string" || !DATE_RE.test(date)) return false;
  const d = new Date(date + "T00:00:00Z");
  return !isNaN(d.getTime()) && d.toISOString().startsWith(date);
}

const MAX_ROW_DEPTH = 3;

function validateRow(row: unknown, depth = 0): row is Row {
  if (depth > MAX_ROW_DEPTH) return false;
  if (typeof row !== "object" || row === null) return false;
  const r = row as Record<string, unknown>;
  return (
    typeof r.id === "number" &&
    typeof r.bullet === "string" &&
    VALID_BULLETS.has(r.bullet) &&
    typeof r.status === "string" &&
    VALID_STATUSES.has(r.status) &&
    typeof r.ocr_text === "string" &&
    Array.isArray(r.children) &&
    r.children.every((c: unknown) => validateRow(c, depth + 1))
  );
}

function validatePage(page: unknown, date: string): page is { date: string; next_row_id: number; rows: Row[] } {
  if (typeof page !== "object" || page === null) return false;
  const p = page as Record<string, unknown>;
  return (
    p.date === date &&
    typeof p.next_row_id === "number" &&
    Number.isInteger(p.next_row_id) &&
    p.next_row_id >= 1 &&
    Array.isArray(p.rows) &&
    p.rows.every(validateRow)
  );
}

export async function handleWsMessage(
  ws: ServerWebSocket,
  message: string,
  storage: PageStorage,
  history: HistoryLog,
): Promise<void> {
  let msg: Record<string, unknown>;
  try {
    msg = JSON.parse(message);
  } catch {
    send(ws, { type: "error", message: "Invalid JSON" });
    return;
  }

  if (typeof msg !== "object" || msg === null || typeof msg.type !== "string") {
    send(ws, { type: "error", message: "Missing message type" });
    return;
  }

  switch (msg.type) {
    case "ping": {
      send(ws, { type: "pong" });
      break;
    }

    case "list-pages": {
      const dates = await storage.listPages();
      send(ws, { type: "page-list", dates });
      break;
    }

    case "get-page": {
      if (!validateDate(msg.date)) {
        send(ws, { type: "error", message: "Invalid date" });
        return;
      }
      const page = await storage.loadPage(msg.date);
      if (page) {
        send(ws, { type: "page", date: msg.date, page });
      } else {
        send(ws, {
          type: "page",
          date: msg.date,
          page: { date: msg.date, next_row_id: 1, rows: [] },
        });
      }
      break;
    }

    case "create-row": {
      const id = msg.id;
      const date = msg.date;
      const bullet = msg.bullet;
      const indent = msg.indent;

      if (typeof id !== "string") {
        send(ws, { type: "error", message: "Missing id" });
        return;
      }
      if (!validateDate(date)) {
        send(ws, { type: "error", id, message: "Invalid date" });
        return;
      }
      if (typeof bullet !== "string" || !VALID_BULLETS.has(bullet)) {
        send(ws, { type: "error", id, message: `Invalid bullet: ${bullet}` });
        return;
      }
      if (typeof indent !== "number" || ![0, 1, 2].includes(indent)) {
        send(ws, { type: "error", id, message: `Invalid indent: ${indent}` });
        return;
      }

      let page = await storage.loadPage(date);
      if (!page) {
        page = { date, next_row_id: 1, rows: [] };
      }

      const newRow: Row = {
        id: page.next_row_id,
        bullet: bullet as BulletSymbol,
        status: BULLET_STATUS[bullet as BulletSymbol],
        ocr_text: "",
        children: [],
      };
      page.next_row_id++;

      if (indent === 0) {
        page.rows.push(newRow);
      } else if (indent === 1) {
        if (page.rows.length > 0) {
          page.rows[page.rows.length - 1].children.push(newRow);
        } else {
          page.rows.push(newRow);
        }
      } else if (indent === 2) {
        if (page.rows.length > 0) {
          const lastRoot = page.rows[page.rows.length - 1];
          if (lastRoot.children.length > 0) {
            lastRoot.children[lastRoot.children.length - 1].children.push(
              newRow,
            );
          } else {
            lastRoot.children.push(newRow);
          }
        } else {
          page.rows.push(newRow);
        }
      }

      const pageYaml = await storage.savePage(date, page);
      history.appendLog(
        date,
        "create-row",
        { rowId: newRow.id, bullet, indent },
        pageYaml,
      );

      send(ws, { type: "row-created", id, date, row: newRow });
      break;
    }

    case "edit-row": {
      const id = msg.id;
      const date = msg.date;
      const rowId = msg.rowId;
      const action = msg.action;
      const svg = msg.svg;

      if (typeof id !== "string") {
        send(ws, { type: "error", message: "Missing id" });
        return;
      }
      if (!validateDate(date)) {
        send(ws, { type: "error", id, message: "Invalid date" });
        return;
      }
      if (typeof svg !== "string" || svg.length === 0) {
        send(ws, { type: "error", id, message: "Missing or invalid svg" });
        return;
      }
      if (svg.length > MAX_SVG_LENGTH) {
        send(ws, { type: "error", id, message: "SVG data too large" });
        return;
      }
      if (typeof action !== "string" || !VALID_ACTIONS.has(action)) {
        send(ws, { type: "error", id, message: `Invalid action: ${action}` });
        return;
      }
      if (typeof rowId !== "number" || !Number.isInteger(rowId) || rowId < 0) {
        send(ws, { type: "error", id, message: `Invalid rowId: ${rowId}` });
        return;
      }

      const page = await storage.loadPage(date);
      if (!page) {
        send(ws, { type: "error", id, message: `Page not found: ${date}` });
        return;
      }

      const row = findRow(page.rows, rowId);
      if (!row) {
        send(ws, { type: "error", id, message: `Row not found: ${rowId}` });
        return;
      }

      const svgBuffer = Buffer.from(svg, "base64");
      await storage.saveSvg(date, rowId, action, svgBuffer);

      const ocrText = await recognizeText(svgBuffer);

      if (action === "add") {
        row.ocr_text = ocrText;
      } else if (action === "insert") {
        const rawPos = msg.position;
        const pos = typeof rawPos === "number" && Number.isInteger(rawPos) && rawPos >= 0
          ? rawPos
          : row.ocr_text.length;
        row.ocr_text =
          row.ocr_text.slice(0, pos) + ocrText + row.ocr_text.slice(pos);
      }

      const editPageYaml = await storage.savePage(date, page);
      history.appendLog(
        date,
        "edit-row",
        { rowId, action },
        editPageYaml,
      );

      send(ws, {
        type: "ocr-result",
        id,
        date,
        rowId,
        action: action as Action,
        ocrText,
      });
      break;
    }

    case "update-page": {
      const id = msg.id;
      const date = msg.date;

      if (typeof id !== "string") {
        send(ws, { type: "error", message: "Missing id" });
        return;
      }
      if (!validateDate(date)) {
        send(ws, { type: "error", id, message: "Invalid date" });
        return;
      }
      if (!validatePage(msg.page, date)) {
        send(ws, { type: "error", id, message: "Invalid page data" });
        return;
      }
      const page = msg.page;

      const updatePageYaml = await storage.savePage(date, page);
      history.appendLog(
        date,
        "update-page",
        null,
        updatePageYaml,
      );

      send(ws, { type: "page-updated", id, date });
      break;
    }

    default: {
      send(ws, { type: "error", message: `Unknown message type: ${msg.type}` });
      break;
    }
  }
}
