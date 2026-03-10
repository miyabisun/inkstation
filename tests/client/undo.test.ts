import { describe, test, expect } from "bun:test";
import type { Page } from "$shared/types";

/**
 * Pure-logic undo/redo engine for testing without Svelte runes ($state).
 * Mirrors the behavior of src/lib/stores/undo.svelte.ts.
 */
const MAX_STACK = 30;

interface UndoEngine {
  undoStack: Page[];
  redoStack: Page[];
  currentPage: Page | null;
}

function createEngine(): UndoEngine {
  return { undoStack: [], redoStack: [], currentPage: null };
}

function pushUndo(engine: UndoEngine, page: Page): void {
  engine.undoStack = [...engine.undoStack, structuredClone(page)].slice(
    -MAX_STACK,
  );
  engine.redoStack = [];
}

function undo(engine: UndoEngine): void {
  if (engine.undoStack.length === 0 || !engine.currentPage) return;
  const current = structuredClone(engine.currentPage);
  engine.redoStack = [...engine.redoStack, current].slice(-MAX_STACK);
  const prev = engine.undoStack[engine.undoStack.length - 1];
  engine.undoStack = engine.undoStack.slice(0, -1);
  engine.currentPage = prev;
}

function redo(engine: UndoEngine): void {
  if (engine.redoStack.length === 0 || !engine.currentPage) return;
  const current = structuredClone(engine.currentPage);
  engine.undoStack = [...engine.undoStack, current].slice(-MAX_STACK);
  const next = engine.redoStack[engine.redoStack.length - 1];
  engine.redoStack = engine.redoStack.slice(0, -1);
  engine.currentPage = next;
}

function makePage(date: string, rowCount: number): Page {
  return {
    date,
    next_row_id: rowCount,
    rows: Array.from({ length: rowCount }, (_, i) => ({
      id: i,
      bullet: "·" as const,
      status: "open" as const,
      ocr_text: `row-${i}`,
      children: [],
    })),
  };
}

describe("undo/redo engine", () => {
  test("push + undo restores previous state", () => {
    const engine = createEngine();
    const page1 = makePage("2026-03-10", 1);
    const page2 = makePage("2026-03-10", 2);

    engine.currentPage = page2;
    pushUndo(engine, page1);

    undo(engine);
    expect(engine.currentPage).toEqual(page1);
    expect(engine.undoStack.length).toBe(0);
    expect(engine.redoStack.length).toBe(1);
  });

  test("redo after undo restores the state", () => {
    const engine = createEngine();
    const page1 = makePage("2026-03-10", 1);
    const page2 = makePage("2026-03-10", 2);

    engine.currentPage = page2;
    pushUndo(engine, page1);

    undo(engine);
    expect(engine.currentPage).toEqual(page1);

    redo(engine);
    expect(engine.currentPage).toEqual(page2);
    expect(engine.undoStack.length).toBe(1);
    expect(engine.redoStack.length).toBe(0);
  });

  test("new mutation clears redo stack", () => {
    const engine = createEngine();
    const page1 = makePage("2026-03-10", 1);
    const page2 = makePage("2026-03-10", 2);
    const page3 = makePage("2026-03-10", 3);

    engine.currentPage = page2;
    pushUndo(engine, page1);

    undo(engine);
    expect(engine.redoStack.length).toBe(1);

    // New mutation should clear redo
    engine.currentPage = page3;
    pushUndo(engine, engine.currentPage);
    expect(engine.redoStack.length).toBe(0);
  });

  test("max 30 entries in undo stack", () => {
    const engine = createEngine();
    engine.currentPage = makePage("2026-03-10", 0);

    for (let i = 0; i < 40; i++) {
      pushUndo(engine, makePage("2026-03-10", i));
    }

    expect(engine.undoStack.length).toBe(MAX_STACK);
    // Oldest entries should have been trimmed; first entry should be i=10
    expect(engine.undoStack[0].next_row_id).toBe(10);
  });

  test("max 30 entries in redo stack", () => {
    const engine = createEngine();

    // Build up 35 undo entries
    for (let i = 0; i < 35; i++) {
      engine.currentPage = makePage("2026-03-10", i + 1);
      pushUndo(engine, makePage("2026-03-10", i));
    }

    // Undo all 30 (stack was capped at 30)
    for (let i = 0; i < 30; i++) {
      undo(engine);
    }

    expect(engine.redoStack.length).toBe(MAX_STACK);
  });

  test("undo with empty stack is no-op", () => {
    const engine = createEngine();
    const page = makePage("2026-03-10", 1);
    engine.currentPage = page;

    undo(engine);
    expect(engine.currentPage).toEqual(page);
  });

  test("redo with empty stack is no-op", () => {
    const engine = createEngine();
    const page = makePage("2026-03-10", 1);
    engine.currentPage = page;

    redo(engine);
    expect(engine.currentPage).toEqual(page);
  });

  test("undo/redo without currentPage is no-op", () => {
    const engine = createEngine();
    pushUndo(engine, makePage("2026-03-10", 1));

    undo(engine);
    expect(engine.currentPage).toBeNull();

    redo(engine);
    expect(engine.currentPage).toBeNull();
  });

  test("deep clone prevents mutation leakage", () => {
    const engine = createEngine();
    const page1 = makePage("2026-03-10", 1);
    engine.currentPage = makePage("2026-03-10", 2);
    pushUndo(engine, page1);

    // Mutate original page1 after pushing
    page1.rows[0].ocr_text = "mutated";

    undo(engine);
    expect(engine.currentPage!.rows[0].ocr_text).toBe("row-0");
  });
});
