import type { StrokePoint } from "$client/lib/types";

export interface CharBBox {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getCharBBoxes(
  text: string,
  charWidth: number,
  lineHeight: number,
  offsetX: number = 0,
  offsetY: number = 0,
): CharBBox[] {
  return [...text].map((_, i) => ({
    index: i,
    x: offsetX + i * charWidth,
    y: offsetY,
    width: charWidth,
    height: lineHeight,
  }));
}

export function isHorizontalStroke(points: StrokePoint[]): boolean {
  if (points.length < 2) return false;
  const start = points[0];
  const end = points[points.length - 1];
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);
  return dx > 20 && dy < dx * 0.4;
}

export function isVerticalStroke(points: StrokePoint[]): boolean {
  if (points.length < 2) return false;
  const start = points[0];
  const end = points[points.length - 1];
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);
  return dy > 15 && dx < dy * 0.4;
}

export function findStrikethroughChars(
  points: StrokePoint[],
  bboxes: CharBBox[],
): number[] {
  if (!isHorizontalStroke(points)) return [];

  const startX = Math.min(points[0].x, points[points.length - 1].x);
  const endX = Math.max(points[0].x, points[points.length - 1].x);
  const strokeY = (points[0].y + points[points.length - 1].y) / 2;

  return bboxes
    .filter(
      (bbox) =>
        bbox.x + bbox.width > startX &&
        bbox.x < endX &&
        strokeY >= bbox.y &&
        strokeY <= bbox.y + bbox.height,
    )
    .map((bbox) => bbox.index);
}

export function findInsertPosition(
  points: StrokePoint[],
  bboxes: CharBBox[],
): number {
  if (!isVerticalStroke(points)) return -1;
  const x = (points[0].x + points[points.length - 1].x) / 2;

  if (bboxes.length === 0) return 0;

  for (let i = 0; i < bboxes.length; i++) {
    const mid = bboxes[i].x + bboxes[i].width / 2;
    if (x < mid) return i;
  }
  return bboxes.length;
}

export function applyStrikethrough(text: string, indices: number[]): string {
  const sorted = [...new Set(indices)].sort((a, b) => b - a);
  const chars = [...text];
  for (const idx of sorted) {
    if (idx >= 0 && idx < chars.length) {
      chars.splice(idx, 1);
    }
  }
  return chars.join("");
}

export function applyInsertion(
  text: string,
  position: number,
  insert: string,
): string {
  if (position < 0) return text;
  if (position >= text.length) return text + insert;
  return text.slice(0, position) + insert + text.slice(position);
}
