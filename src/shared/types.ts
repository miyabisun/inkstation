export type BulletSymbol = "·" | "×" | "-" | ">" | "o";

export type RowStatus = "open" | "done" | "note" | "migrated" | "event";

export const BULLET_STATUS: Record<BulletSymbol, RowStatus> = {
  "·": "open",
  "×": "done",
  "-": "note",
  ">": "migrated",
  o: "event",
};

export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
  timestamp: number;
}

export interface Row {
  id: number;
  bullet: BulletSymbol;
  status: RowStatus;
  ocr_text: string;
  children: Row[];
}

export interface Page {
  date: string;
  next_row_id: number;
  rows: Row[];
}

export type Action = "add" | "insert";

export function updateRowRecursive(rows: Row[], rowId: number, updater: (r: Row) => Row): Row[] {
  return rows.map((r) => {
    if (r.id === rowId) return updater(r);
    if (r.children.length > 0) {
      return { ...r, children: updateRowRecursive(r.children, rowId, updater) };
    }
    return r;
  });
}

// Client → Server messages
export type ClientMessage =
  | { type: "list-pages" }
  | { type: "get-page"; date: string }
  | { type: "create-row"; id: string; date: string; bullet: BulletSymbol; indent: number }
  | { type: "edit-row"; id: string; date: string; rowId: number; action: Action; svg: string; position?: number }
  | { type: "update-page"; id: string; date: string; page: Page }
  | { type: "ping" };

// Server → Client messages
export type ServerMessage =
  | { type: "page-list"; dates: string[] }
  | { type: "pong" }
  | { type: "page"; date: string; page: Page }
  | { type: "row-created"; id: string; date: string; row: Row }
  | { type: "ocr-result"; id: string; date: string; rowId: number; action: Action; ocrText: string }
  | { type: "page-updated"; id: string; date: string }
  | { type: "error"; id?: string; message: string };
