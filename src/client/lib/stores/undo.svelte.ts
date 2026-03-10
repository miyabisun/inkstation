import type { Page } from "../types";
import { pageStore } from "./page.svelte";

const MAX_STACK = 30;

let undoStack = $state<Page[]>([]);
let redoStack = $state<Page[]>([]);

export const undoStore = {
  get canUndo() {
    return undoStack.length > 0;
  },
  get canRedo() {
    return redoStack.length > 0;
  },
  get undoSize() {
    return undoStack.length;
  },
  get redoSize() {
    return redoStack.length;
  },

  pushUndo(page: Page) {
    undoStack = [...undoStack, structuredClone(page)].slice(-MAX_STACK);
    redoStack = [];
  },

  undo(send: (msg: unknown) => void) {
    if (undoStack.length === 0 || !pageStore.page) return;
    const current = structuredClone(pageStore.page);
    redoStack = [...redoStack, current].slice(-MAX_STACK);
    const prev = undoStack[undoStack.length - 1];
    undoStack = undoStack.slice(0, -1);
    pageStore.updatePage(prev.date, prev, send);
  },

  redo(send: (msg: unknown) => void) {
    if (redoStack.length === 0 || !pageStore.page) return;
    const current = structuredClone(pageStore.page);
    undoStack = [...undoStack, current].slice(-MAX_STACK);
    const next = redoStack[redoStack.length - 1];
    redoStack = redoStack.slice(0, -1);
    pageStore.updatePage(next.date, next, send);
  },

  reset() {
    undoStack = [];
    redoStack = [];
  },
};
