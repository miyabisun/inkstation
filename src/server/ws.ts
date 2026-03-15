import type { ServerWebSocket } from "bun";
import { PageStorage, VALID_ACTIONS } from "./storage";
import { HistoryLog } from "./history";
import { recognizeText } from "./ocr";
import { PageMutex } from "./mutex";
import { IdempotencyCache } from "./idempotency";
import { validateDate, validatePage, VALID_BULLETS } from "./validation";
import type {
  ServerMessage,
  Row,
  BulletSymbol,
  Action,
} from "$shared/types";

const MAX_SVG_LENGTH = 2 * 1024 * 1024; // 2MB base64

function send(ws: ServerWebSocket, msg: ServerMessage): void {
  if (ws.readyState >= 2) return;
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

export async function handleWsMessage(
  ws: ServerWebSocket,
  message: string,
  storage: PageStorage,
  history: HistoryLog,
  mutex: PageMutex,
  cache: IdempotencyCache,
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

  // Idempotency check for mutating messages
  const msgId = typeof msg.id === "string" ? msg.id : null;
  if (msgId && cache.has(msgId)) {
    const cached = cache.get(msgId) as ServerMessage;
    send(ws, cached);
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

      const release = await mutex.acquire(date);
      try {
        let page = await storage.loadPage(date);
        if (!page) {
          page = { date, next_row_id: 1, rows: [] };
        }

        const newRow: Row = {
          id: page.next_row_id,
          bullet: bullet as BulletSymbol,
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

        const response: ServerMessage = { type: "row-created", id, date, row: newRow };
        cache.set(id, response);
        send(ws, response);
      } finally {
        release();
      }
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

      const release = await mutex.acquire(date);
      let page: Awaited<ReturnType<PageStorage["loadPage"]>>;
      try {
        page = await storage.loadPage(date);
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

        // Send immediate ACK
        const ackResponse: ServerMessage = { type: "row-edited", id, date, rowId };
        cache.set(id, ackResponse);
        send(ws, ackResponse);

        // Fire-and-forget OCR
        const capturedAction = action as Action;
        const capturedPosition = msg.position;
        recognizeText(svgBuffer)
          .then(async (ocrText) => {
            const innerRelease = await mutex.acquire(date);
            try {
              const freshPage = await storage.loadPage(date);
              if (!freshPage) return;
              const freshRow = findRow(freshPage.rows, rowId);
              if (!freshRow) return;

              if (capturedAction === "add") {
                freshRow.ocr_text = ocrText;
              } else if (capturedAction === "insert") {
                const rawPos = capturedPosition;
                const pos =
                  typeof rawPos === "number" && Number.isInteger(rawPos) && rawPos >= 0
                    ? rawPos
                    : freshRow.ocr_text.length;
                freshRow.ocr_text =
                  freshRow.ocr_text.slice(0, pos) + ocrText + freshRow.ocr_text.slice(pos);
              }

              const editPageYaml = await storage.savePage(date, freshPage);
              history.appendLog(date, "edit-row", { rowId, action: capturedAction }, editPageYaml);

              send(ws, {
                type: "ocr-result",
                id,
                date,
                rowId,
                action: capturedAction,
                ocrText,
              });
            } finally {
              innerRelease();
            }
          })
          .catch(() => {});
      } finally {
        release();
      }
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

      const release = await mutex.acquire(date);
      try {
        const page = msg.page;
        const updatePageYaml = await storage.savePage(date, page);
        history.appendLog(date, "update-page", null, updatePageYaml);

        const response: ServerMessage = { type: "page-updated", id, date };
        cache.set(id, response);
        send(ws, response);
      } finally {
        release();
      }
      break;
    }

    default: {
      send(ws, { type: "error", message: `Unknown message type: ${msg.type}` });
      break;
    }
  }
}
