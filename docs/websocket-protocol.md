# WebSocket Protocol

Single endpoint: `ws://{host}:{port}/ws`

All messages are JSON. SVG data is base64-encoded within JSON messages.

## Client → Server

### `ping`

Heartbeat. Sent every 30 seconds while the tab is visible.

```json
{ "type": "ping" }
```

### `list-pages`

Request the list of dates that have notes. Used by the calendar to show 📝 markers and determine which dates are tappable.

```json
{ "type": "list-pages" }
```

### `get-page`

Request a page by date.

```json
{ "type": "get-page", "date": "2026-03-09" }
```

### `create-row`

Create a new empty row.

```json
{
  "type": "create-row",
  "id": "msg-001",
  "date": "2026-03-09",
  "bullet": "·",
  "indent": 0
}
```

### `edit-row`

Send SVG stroke data for OCR processing.

```json
{
  "type": "edit-row",
  "id": "msg-002",
  "date": "2026-03-09",
  "rowId": 1,
  "action": "add",
  "svg": "<base64-encoded SVG>"
}
```

For insert action:

```json
{
  "type": "edit-row",
  "id": "msg-003",
  "date": "2026-03-09",
  "rowId": 1,
  "action": "insert",
  "position": 5,
  "svg": "<base64-encoded SVG>"
}
```

### `update-page`

Send full page update (reorder, delete, text edit, bullet change).

```json
{
  "type": "update-page",
  "id": "msg-004",
  "date": "2026-03-09",
  "page": {
    "date": "2026-03-09",
    "next_row_id": 4,
    "rows": [...]
  }
}
```

## Server → Client

### `pong`

Heartbeat response.

```json
{ "type": "pong" }
```

### `page-list`

List of dates that have notes (response to `list-pages`). The `dates` array is sorted in descending order (newest first).

```json
{
  "type": "page-list",
  "dates": ["2026-03-09", "2026-03-07", "2026-03-01", "2026-02-28"]
}
```

### `page`

Full page data (response to `get-page`). The top-level `date` and `page.date` are intentionally redundant — the top-level `date` is for routing/matching, `page.date` is part of the canonical page data structure.

```json
{
  "type": "page",
  "date": "2026-03-09",
  "page": {
    "date": "2026-03-09",
    "next_row_id": 4,
    "rows": [
      {
        "id": 1,
        "bullet": "·",
        "status": "open",
        "ocr_text": "Design the API schema",
        "children": []
      }
    ]
  }
}
```

### `row-created`

Acknowledgment for `create-row`.

```json
{
  "type": "row-created",
  "id": "msg-001",
  "date": "2026-03-09",
  "row": {
    "id": 4,
    "bullet": "·",
    "status": "open",
    "ocr_text": "",
    "children": []
  }
}
```

### `ocr-result`

OCR completion notification (response to `edit-row`).

```json
{
  "type": "ocr-result",
  "id": "msg-002",
  "date": "2026-03-09",
  "rowId": 1,
  "action": "add",
  "ocrText": "Design the API schema"
}
```

### `page-updated`

Acknowledgment for `update-page`.

```json
{
  "type": "page-updated",
  "id": "msg-004",
  "date": "2026-03-09"
}
```

### `error`

Error response.

```json
{
  "type": "error",
  "id": "msg-002",
  "message": "Row not found: 99"
}
```

## Message ID

Every client message that modifies state includes an `id` field (client-generated UUID). The server echoes this `id` in its response. This enables:

1. Matching responses to requests
2. Offline queue acknowledgment tracking

The server does **not** perform deduplication — it processes every message as-is. If a queued message is replayed after reconnection, it will be applied again. For `update-page` this is naturally idempotent (same YAML overwrites the same state). For `create-row` and `edit-row`, the client should remove acknowledged entries from the queue promptly to avoid double-application.
