# Offline Queue & Reconnection

## Queue Storage

- Queue entries stored in `localStorage` as a JSON array
- Key: `inkstation-queue`

## Behavior

Only state-mutating messages are queued: `create-row`, `edit-row`, `update-page`. Read-only messages (`get-page`, `list-pages`, `ping`) are never queued.

1. When WebSocket is connected: messages are sent directly, and also written to the queue
2. Server acknowledges each message (echoes `id`) → client removes that entry from the queue
3. When WebSocket is disconnected: messages are written to the queue only
4. On reconnection: queued messages are replayed in order (FIFO), then normal operation resumes

## Queue Entry Format

Same as WebSocket client → server messages, stored as-is.

## Connection State

- **Online**: WebSocket `open` state
- **Offline**: WebSocket `closed` or `error` state
- Banner displayed when offline: "オフライン — 変更はローカルに保存されます"

## Reconnection Strategy

Android tablets may silently kill WebSocket connections when the browser tab is backgrounded or the user switches apps. Three mechanisms work together to ensure fast recovery:

1. **Exponential backoff** — background reconnection attempts: 1s → 2s → 4s → 8s → max 30s
2. **`visibilitychange` event** — when the tab becomes visible again, immediately attempt reconnection, bypassing the backoff timer
3. **`online` event** — when the browser detects network recovery, immediately attempt reconnection

## Heartbeat

Periodic ping/pong to detect zombie connections (TCP dead but WebSocket `close` event never fired):

- Client sends `{ "type": "ping" }` every **30 seconds**
- Server responds with `{ "type": "pong" }`
- If no `pong` is received within **5 seconds**, the client treats the connection as dead, closes it, and triggers reconnection
- Heartbeat is **paused** when the tab is hidden (`visibilitychange`) to avoid unnecessary traffic while backgrounded

## Reconnection Flow

```
Tab backgrounded / connection lost
    │
    ├── WebSocket `close` fires → start exponential backoff
    │
    ├── Tab becomes visible (`visibilitychange`)
    │   └── Immediate reconnect attempt (reset backoff)
    │
    ├── Network restored (`online` event)
    │   └── Immediate reconnect attempt (reset backoff)
    │
    └── On successful reconnect:
        1. Replay offline queue (FIFO)
        2. Re-fetch current page (`get-page`)
        3. Hide offline banner
```
