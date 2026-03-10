import { describe, it, expect } from "bun:test";
import { generateSvgPath, generateSvg, generateSvgFilename } from "$client/lib/svg";
import type { StrokePoint } from "$client/lib/types";

function point(x: number, y: number, pressure = 0.5): StrokePoint {
  return { x, y, pressure, timestamp: Date.now() };
}

describe("generateSvgPath", () => {
  it("returns empty string for empty points", () => {
    expect(generateSvgPath([])).toBe("");
  });

  it("generates path from points", () => {
    const points = [point(0, 0), point(10, 10), point(20, 20)];
    const path = generateSvgPath(points);
    expect(path).toContain("M");
    expect(path).toContain("L");
  });
});

describe("generateSvg", () => {
  it("generates valid SVG", () => {
    const strokes = [{ points: [point(0, 0), point(10, 10), point(20, 5)] }];
    const svg = generateSvg(strokes, 100, 50);
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("<path");
    expect(svg).toContain('stroke-width="3"');
  });

  it("handles empty strokes", () => {
    const svg = generateSvg([], 100, 50);
    expect(svg).toContain("<svg");
    expect(svg).not.toContain("<path");
  });
});

describe("generateSvgFilename", () => {
  it("generates correct filename format", () => {
    const name = generateSvgFilename("2026-03-10", 1, 5, "text");
    expect(name).toBe("2026-03-10_0001_5_text.svg");
  });
});
