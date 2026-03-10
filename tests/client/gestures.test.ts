import { describe, it, expect } from "bun:test";
import { classifyGesture, type TouchState } from "$client/lib/gestures";

function state(x: number, y: number): TouchState {
  return { startX: x, startY: y, startTime: Date.now() };
}

describe("classifyGesture", () => {
  it("returns none for small movement", () => {
    expect(classifyGesture(state(100, 100), 105, 102)).toBe("none");
  });

  it("returns nav-next for leftward swipe", () => {
    expect(classifyGesture(state(200, 100), 50, 100)).toBe("nav-next");
  });

  it("returns nav-prev for rightward swipe", () => {
    expect(classifyGesture(state(50, 100), 200, 100)).toBe("nav-prev");
  });

  it("returns scroll for vertical movement", () => {
    expect(classifyGesture(state(100, 100), 105, 250)).toBe("scroll");
  });

  it("returns scroll for diagonal movement", () => {
    expect(classifyGesture(state(100, 100), 200, 250)).toBe("scroll");
  });
});
