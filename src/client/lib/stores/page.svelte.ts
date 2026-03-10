import type { BulletSymbol, Page, Row, ServerMessage } from "../types";
import { updateRowRecursive } from "../types";

export const MAX_ROWS = 100;

let currentPage = $state<Page | null>(null);
let loading = $state(false);

/** Set of message ids awaiting server acknowledgement */
const pendingIds = new Set<string>();

function genId(): string {
  return crypto.randomUUID();
}

export const pageStore = {
  get page() {
    return currentPage;
  },
  get loading() {
    return loading;
  },

  loadPage(date: string, send: (msg: unknown) => void) {
    loading = true;
    send({ type: "get-page", date });
  },

  createRow(
    date: string,
    bullet: BulletSymbol,
    indent: number,
    send: (msg: unknown) => void,
  ): string | null {
    if (currentPage && currentPage.rows.length >= MAX_ROWS) return null;
    const id = genId();
    pendingIds.add(id);
    send({ type: "create-row", id, date, bullet, indent });
    return id;
  },

  editRow(
    date: string,
    rowId: number,
    action: string,
    svg: string,
    send: (msg: unknown) => void,
    position?: number,
  ): string {
    const id = genId();
    pendingIds.add(id);
    send({ type: "edit-row", id, date, rowId, action, svg, position });
    return id;
  },

  updatePage(date: string, page: Page, send: (msg: unknown) => void): string {
    const id = genId();
    pendingIds.add(id);
    currentPage = page;
    send({ type: "update-page", id, date, page });
    return id;
  },

  handleMessage(msg: ServerMessage) {
    switch (msg.type) {
      case "page": {
        currentPage = msg.page;
        loading = false;
        break;
      }
      case "row-created": {
        pendingIds.delete(msg.id);
        if (currentPage && msg.date === currentPage.date) {
          currentPage = {
            ...currentPage,
            rows: [...currentPage.rows, msg.row],
          };
        }
        break;
      }
      case "row-edited": {
        pendingIds.delete(msg.id);
        break;
      }
      case "ocr-result": {
        if (currentPage && msg.date === currentPage.date) {
          const rows = updateRowRecursive(currentPage.rows, msg.rowId, (r) => ({
            ...r,
            ocr_text: msg.ocrText,
          }));
          currentPage = { ...currentPage, rows };
        }
        break;
      }
      case "page-updated": {
        pendingIds.delete(msg.id);
        break;
      }
      case "error": {
        if (msg.id) pendingIds.delete(msg.id);
        loading = false;
        break;
      }
    }
  },

  isPending(id: string): boolean {
    return pendingIds.has(id);
  },

  reset() {
    currentPage = null;
    loading = false;
    pendingIds.clear();
  },
};
