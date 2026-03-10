import { describe, it, expect } from "bun:test";
import { classifyBullet, detectTransition } from "$client/lib/classifier";
import type { StrokePoint } from "$client/lib/types";

function pt(x: number, y: number): StrokePoint {
  return { x, y, pressure: 0.5, timestamp: Date.now() };
}

describe("classifyBullet", () => {
  it("returns dot for empty strokes", () => {
    expect(classifyBullet([])).toBe("\u00b7");
  });

  it("returns dot for very short stroke", () => {
    expect(classifyBullet([[pt(5, 5), pt(6, 5)]])).toBe("\u00b7");
  });

  it("returns dash for horizontal line", () => {
    expect(classifyBullet([[pt(0, 10), pt(50, 10)]])).toBe("-");
  });

  it("returns circle for closed shape", () => {
    const circle = [
      pt(20, 0), pt(40, 10), pt(40, 30), pt(20, 40),
      pt(0, 30), pt(0, 10), pt(20, 1),
    ];
    expect(classifyBullet([circle])).toBe("o");
  });

  it("returns \u00d7 for two crossing strokes", () => {
    const s1 = [pt(0, 0), pt(20, 20)];
    const s2 = [pt(20, 0), pt(0, 20)];
    expect(classifyBullet([s1, s2])).toBe("\u00d7");
  });
});

describe("detectTransition", () => {
  it("detects \u00b7 \u2192 \u00d7 transition", () => {
    expect(detectTransition("\u00b7", "\u00d7")).toBe("\u00d7");
  });

  it("returns null for non-transition", () => {
    expect(detectTransition("-", "\u00d7")).toBeNull();
  });
});
