import type { ClientMessage, ServerMessage } from "./types";

const QUEUE_KEY = "inkstation-queue";
const PING_INTERVAL = 30_000;
const PONG_TIMEOUT = 5_000;
const MAX_BACKOFF = 30_000;

type MutatingMessage = Extract<
  ClientMessage,
  { type: "create-row" | "edit-row" | "update-page" }
>;

function isMutating(msg: ClientMessage): msg is MutatingMessage {
  return (
    msg.type === "create-row" ||
    msg.type === "edit-row" ||
    msg.type === "update-page"
  );
}

type MessageHandler = (msg: ServerMessage) => void;

class WsClient {
  private ws: WebSocket | null = null;
  private handlers: Set<MessageHandler> = new Set();
  private statusHandlers: Set<(connected: boolean) => void> = new Set();
  private backoff = 1000;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  connected = false;

  private setConnected(value: boolean) {
    if (this.connected !== value) {
      this.connected = value;
      for (const handler of this.statusHandlers) {
        handler(value);
      }
    }
  }

  connect() {
    this.clearReconnectTimer();

    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${location.host}/ws`;

    const ws = new WebSocket(url);

    ws.addEventListener("open", () => {
      this.ws = ws;
      this.setConnected(true);
      this.backoff = 1000;
      this.startHeartbeat();
      this.flushQueue();
    });

    ws.addEventListener("message", (event) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (msg.type === "pong") {
        this.clearPongTimer();
        return;
      }
      for (const handler of this.handlers) {
        handler(msg);
      }
    });

    ws.addEventListener("close", () => {
      this.handleDisconnect();
    });

    ws.addEventListener("error", () => {
      // close event will follow; disconnect handling happens there
    });
  }

  send(msg: ClientMessage) {
    if (isMutating(msg)) {
      this.enqueue(msg);
    }

    if (this.connected && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  subscribe(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  onStatusChange(handler: (connected: boolean) => void): () => void {
    this.statusHandlers.add(handler);
    return () => {
      this.statusHandlers.delete(handler);
    };
  }

  acknowledge(id: string) {
    const queue = this.getQueue();
    const filtered = queue.filter((m) => m.id !== id);
    this.setQueue(filtered);
  }

  // -- Private helpers --

  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "ping" }));
        this.pongTimer = setTimeout(() => {
          // Pong not received in time — force close
          this.ws?.close();
        }, PONG_TIMEOUT);
      }
    }, PING_INTERVAL);
  }

  private stopHeartbeat() {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    this.clearPongTimer();
  }

  private clearPongTimer() {
    if (this.pongTimer !== null) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private handleDisconnect() {
    this.ws = null;
    this.setConnected(false);
    this.stopHeartbeat();
    this.scheduleReconnect();
  }

  private scheduleReconnect() {
    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.backoff);
    this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF);
  }

  private flushQueue() {
    const queue = this.getQueue();
    for (const msg of queue) {
      if (this.ws?.readyState !== WebSocket.OPEN) break;
      this.ws.send(JSON.stringify(msg));
    }
  }

  private enqueue(msg: MutatingMessage) {
    const queue = this.getQueue();
    // Avoid duplicate entries for the same id
    if (!queue.some((m) => m.id === msg.id)) {
      queue.push(msg);
      this.setQueue(queue);
    }
  }

  private getQueue(): MutatingMessage[] {
    try {
      const raw = localStorage.getItem(QUEUE_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  private setQueue(queue: MutatingMessage[]) {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch {
      // localStorage quota exceeded — drop oldest entries and retry
      if (queue.length > 1) {
        this.setQueue(queue.slice(Math.ceil(queue.length / 2)));
      }
    }
  }

  /** Set up browser event listeners for reconnection */
  listen() {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        this.stopHeartbeat();
      } else if (document.visibilityState === "visible") {
        if (this.connected) {
          this.startHeartbeat();
        } else {
          this.clearReconnectTimer();
          this.backoff = 1000;
          this.connect();
        }
      }
    });

    window.addEventListener("online", () => {
      if (!this.connected) {
        this.clearReconnectTimer();
        this.backoff = 1000;
        this.connect();
      }
    });
  }
}

export const wsClient = new WsClient();
