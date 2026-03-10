import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { PageStorage } from "./storage";
import { HistoryLog } from "./history";
import { handleWsMessage } from "./ws";

const DATA_DIR = process.env.DATA_DIR || "./inkstation-data";
const storage = new PageStorage(DATA_DIR);
const history = new HistoryLog(`${DATA_DIR}/history.db`);

const app = new Hono();
app.get("/*", serveStatic({ root: "./dist" }));
app.get("/*", serveStatic({ root: "./dist", path: "index.html" }));

const port = Number(process.env.PORT) || 3000;

Bun.serve({
  port,
  fetch(req, server) {
    const url = new URL(req.url);
    if (url.pathname === "/ws") {
      if (server.upgrade(req)) return;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }
    return app.fetch(req, server);
  },
  websocket: {
    message(ws, message) {
      handleWsMessage(ws, String(message), storage, history).catch((err) => {
        console.error("WebSocket message handler error:", err);
        try {
          ws.send(JSON.stringify({ type: "error", message: "Internal server error" }));
        } catch { /* ws may be closed */ }
      });
    },
    open(ws) {
      console.log("WebSocket connected");
    },
    close(ws) {
      console.log("WebSocket disconnected");
    },
  },
});

console.log(`InkStation server listening on http://localhost:${port}`);

function shutdown() {
  history.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
