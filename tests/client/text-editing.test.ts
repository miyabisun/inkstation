import { describe, it, expect } from "bun:test";
import {
  getCharBBoxes,
  findStrikethroughChars,
  findInsertPosition,
  applyStrikethrough,
  applyInsertion,
  isHorizontalStroke,
  isVerticalStroke,
} from "$client/lib/text-editing";
import type { StrokePoint } from "$client/lib/types";

function pt(x: number, y: number): StrokePoint {
  return { x, y, pressure: 0.5, timestamp: Date.now() };
}

describe("getCharBBoxes", () => {
  it("creates correct bboxes for text", () => {
    const bboxes = getCharBBoxes("abc", 10, 20);
    expect(bboxes).toHaveLength(3);
    expect(bboxes[0]).toEqual({ index: 0, x: 0, y: 0, width: 10, height: 20 });
    expect(bboxes[1]).toEqual({ index: 1, x: 10, y: 0, width: 10, height: 20 });
    expect(bboxes[2]).toEqual({ index: 2, x: 20, y: 0, width: 10, height: 20 });
  });
});

describe("isHorizontalStroke / isVerticalStroke", () => {
  it("detects horizontal stroke", () => {
    expect(isHorizontalStroke([pt(0, 10), pt(50, 12)])).toBe(true);
    expect(isHorizontalStroke([pt(0, 0), pt(5, 50)])).toBe(false);
  });

  it("detects vertical stroke", () => {
    expect(isVerticalStroke([pt(10, 0), pt(12, 50)])).toBe(true);
    expect(isVerticalStroke([pt(0, 0), pt(50, 5)])).toBe(false);
  });
});

describe("findStrikethroughChars", () => {
  it("finds chars crossed by horizontal stroke", () => {
    const bboxes = getCharBBoxes("hello", 10, 20);
    const stroke = [pt(5, 10), pt(35, 10)];
    const indices = findStrikethroughChars(stroke, bboxes);
    expect(indices).toEqual([0, 1, 2, 3]);
  });

  it("returns empty for vertical stroke", () => {
    const bboxes = getCharBBoxes("hello", 10, 20);
    const stroke = [pt(15, 0), pt(15, 30)];
    expect(findStrikethroughChars(stroke, bboxes)).toEqual([]);
  });
});

describe("findInsertPosition", () => {
  it("finds insert position from vertical stroke", () => {
    const bboxes = getCharBBoxes("hello", 10, 20);
    const stroke = [pt(25, 0), pt(25, 25)];
    const pos = findInsertPosition(stroke, bboxes);
    expect(pos).toBe(3);
  });

  it("returns 0 for position before first char", () => {
    const bboxes = getCharBBoxes("hello", 10, 20);
    const stroke = [pt(2, 0), pt(2, 25)];
    const pos = findInsertPosition(stroke, bboxes);
    expect(pos).toBe(0);
  });
});

describe("applyStrikethrough", () => {
  it("removes characters at given indices", () => {
    expect(applyStrikethrough("hello", [1, 3])).toBe("hlo");
  });

  it("handles empty indices", () => {
    expect(applyStrikethrough("hello", [])).toBe("hello");
  });
});

describe("applyInsertion", () => {
  it("inserts text at position", () => {
    expect(applyInsertion("helo", 3, "l")).toBe("hello");
  });

  it("appends at end", () => {
    expect(applyInsertion("hell", 4, "o")).toBe("hello");
  });
});
