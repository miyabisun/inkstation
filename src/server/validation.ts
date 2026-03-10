import type { BulletSymbol, Row } from "$shared/types";
import { BULLET_STATUS } from "$shared/types";

export const VALID_BULLETS: ReadonlySet<string> = new Set<BulletSymbol>(
  Object.keys(BULLET_STATUS) as BulletSymbol[],
);
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_ROW_DEPTH = 3;

export function validateDate(date: unknown): date is string {
  if (typeof date !== "string" || !DATE_RE.test(date)) return false;
  const d = new Date(date + "T00:00:00Z");
  return !isNaN(d.getTime()) && d.toISOString().startsWith(date);
}

export function validateRow(row: unknown, depth = 0): row is Row {
  if (depth > MAX_ROW_DEPTH) return false;
  if (typeof row !== "object" || row === null) return false;
  const r = row as Record<string, unknown>;
  return (
    typeof r.id === "number" &&
    typeof r.bullet === "string" &&
    VALID_BULLETS.has(r.bullet) &&
    typeof r.ocr_text === "string" &&
    Array.isArray(r.children) &&
    r.children.every((c: unknown) => validateRow(c, depth + 1))
  );
}

/** Collect all row IDs recursively */
function collectIds(rows: Row[], ids: Set<number>): boolean {
  for (const row of rows) {
    if (ids.has(row.id)) return false; // duplicate
    ids.add(row.id);
    if (!collectIds(row.children, ids)) return false;
  }
  return true;
}

export function validatePage(
  page: unknown,
  date: string,
): page is { date: string; next_row_id: number; rows: Row[] } {
  if (typeof page !== "object" || page === null) return false;
  const p = page as Record<string, unknown>;
  if (
    p.date !== date ||
    typeof p.next_row_id !== "number" ||
    !Number.isInteger(p.next_row_id) ||
    p.next_row_id < 1 ||
    !Array.isArray(p.rows) ||
    !p.rows.every(validateRow)
  ) {
    return false;
  }

  // Check all IDs < next_row_id and no duplicates
  const ids = new Set<number>();
  if (!collectIds(p.rows as Row[], ids)) return false;
  for (const id of ids) {
    if (id >= (p.next_row_id as number)) return false;
  }

  return true;
}
