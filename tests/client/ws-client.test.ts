import { describe, test, expect, beforeEach } from "bun:test";

// -- Minimal mocks for browser APIs --

const store: Record<string, string> = {};

const mockLocalStorage = {
  getItem(key: string): string | null {
    return store[key] ?? null;
  },
  setItem(key: string, value: string) {
    store[key] = value;
  },
  removeItem(key: string) {
    delete store[key];
  },
  clear() {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
  },
};

// Assign mocks to globalThis so the module can use them
Object.defineProperty(globalThis, "localStorage", { value: mockLocalStorage, writable: true });
Object.defineProperty(globalThis, "document", {
  value: { addEventListener() {} },
  writable: true,
});
Object.defineProperty(globalThis, "window", {
  value: { addEventListener() {} },
  writable: true,
});
Object.defineProperty(globalThis, "location", {
  value: { protocol: "http:", host: "localhost:3000" },
  writable: true,
});

// Minimal WebSocket mock
class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  readyState = MockWebSocket.OPEN;
  sent: string[] = [];
  listeners: Record<string, Function[]> = {};

  constructor(_url: string) {}
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = MockWebSocket.CLOSED;
  }
  addEventListener(event: string, fn: Function) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }
  removeEventListener() {}

  // Helper to trigger events in tests
  trigger(event: string, data?: unknown) {
    for (const fn of this.listeners[event] ?? []) {
      fn(data);
    }
  }
}

Object.defineProperty(globalThis, "WebSocket", { value: MockWebSocket, writable: true });

// Import after mocks are set up
// We test queue logic by directly manipulating localStorage with the same key
const QUEUE_KEY = "inkstation-queue";

describe("WsClient offline queue", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  test("mutating messages are written to localStorage queue", async () => {
    // Dynamically import to get fresh module with mocks in place
    const { wsClient } = await import("$client/lib/ws");

    const msg = {
      type: "create-row" as const,
      id: "abc-123",
      date: "2026-03-10",
      bullet: "·" as const,
      indent: 0,
    };

    // send without connection — message should be queued
    wsClient.send(msg);

    const raw = mockLocalStorage.getItem(QUEUE_KEY);
    expect(raw).not.toBeNull();
    const queue = JSON.parse(raw!);
    expect(queue).toHaveLength(1);
    expect(queue[0].id).toBe("abc-123");
    expect(queue[0].type).toBe("create-row");
  });

  test("non-mutating messages are not queued", async () => {
    const { wsClient } = await import("$client/lib/ws");

    wsClient.send({ type: "list-pages" });
    wsClient.send({ type: "get-page", date: "2026-03-10" });
    wsClient.send({ type: "ping" });

    const raw = mockLocalStorage.getItem(QUEUE_KEY);
    // Queue should be empty or null
    if (raw) {
      expect(JSON.parse(raw)).toHaveLength(0);
    } else {
      expect(raw).toBeNull();
    }
  });

  test("acknowledge removes message from queue", async () => {
    const { wsClient } = await import("$client/lib/ws");

    // Pre-populate queue
    const messages = [
      { type: "create-row", id: "msg-1", date: "2026-03-10", bullet: "·", indent: 0 },
      { type: "edit-row", id: "msg-2", date: "2026-03-10", rowId: 1, action: "add", svg: "<svg/>" },
    ];
    mockLocalStorage.setItem(QUEUE_KEY, JSON.stringify(messages));

    wsClient.acknowledge("msg-1");

    const raw = mockLocalStorage.getItem(QUEUE_KEY);
    const queue = JSON.parse(raw!);
    expect(queue).toHaveLength(1);
    expect(queue[0].id).toBe("msg-2");
  });

  test("acknowledge with unknown id does not remove anything", async () => {
    const { wsClient } = await import("$client/lib/ws");

    const messages = [
      { type: "create-row", id: "msg-1", date: "2026-03-10", bullet: "·", indent: 0 },
    ];
    mockLocalStorage.setItem(QUEUE_KEY, JSON.stringify(messages));

    wsClient.acknowledge("unknown-id");

    const queue = JSON.parse(mockLocalStorage.getItem(QUEUE_KEY)!);
    expect(queue).toHaveLength(1);
  });

  test("duplicate messages are not double-queued", async () => {
    const { wsClient } = await import("$client/lib/ws");

    // Clear any prior state
    mockLocalStorage.clear();

    const msg = {
      type: "create-row" as const,
      id: "dup-1",
      date: "2026-03-10",
      bullet: "·" as const,
      indent: 0,
    };

    wsClient.send(msg);
    wsClient.send(msg);

    const queue = JSON.parse(mockLocalStorage.getItem(QUEUE_KEY)!);
    expect(queue).toHaveLength(1);
  });

  test("queue survives invalid JSON gracefully", async () => {
    const { wsClient } = await import("$client/lib/ws");

    // Write garbage to localStorage
    mockLocalStorage.setItem(QUEUE_KEY, "not-valid-json{{{");

    const msg = {
      type: "update-page" as const,
      id: "pg-1",
      date: "2026-03-10",
      page: { date: "2026-03-10", next_row_id: 1, rows: [] },
    };

    // Should not throw, should start fresh queue
    wsClient.send(msg);

    const queue = JSON.parse(mockLocalStorage.getItem(QUEUE_KEY)!);
    expect(queue).toHaveLength(1);
    expect(queue[0].id).toBe("pg-1");
  });

  test("queue serialization roundtrip preserves data", () => {
    const messages = [
      { type: "create-row", id: "rt-1", date: "2026-03-10", bullet: "·", indent: 2 },
      {
        type: "edit-row",
        id: "rt-2",
        date: "2026-03-10",
        rowId: 5,
        action: "insert",
        svg: '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>',
        position: 3,
      },
    ];

    mockLocalStorage.setItem(QUEUE_KEY, JSON.stringify(messages));
    const raw = mockLocalStorage.getItem(QUEUE_KEY);
    const parsed = JSON.parse(raw!);

    expect(parsed).toEqual(messages);
    expect(parsed[1].svg).toContain("<path");
    expect(parsed[1].position).toBe(3);
  });
});
