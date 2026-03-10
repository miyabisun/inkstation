# Architecture

## Overview

InkStation is a handwritten bullet journal web application. It consolidates two predecessor projects — **inkflow** (Tauri + Svelte Android tablet app) and **inkport** (Python + FastAPI server) — into a single monolithic web application.

Users access InkStation through a browser on any device with a stylus. The server handles data persistence, OCR processing, and serves the frontend SPA.

## Tech Stack

| Component   | Technology           |
| ----------- | -------------------- |
| Runtime     | Bun                  |
| Backend     | Hono                 |
| Frontend    | Svelte 5 (runes)     |
| Build       | Vite                 |
| Protocol    | WebSocket (data) + HTTP (static files) |
| SVG → PNG   | resvg (CLI)          |
| OCR engine  | NDLOCR-Lite (CLI)    |
| Data format | YAML + SVG files     |
| History     | SQLite (`bun:sqlite`) |

## System Diagram

```
[Browser (stylus device)]  <--WebSocket-->  [Hono server (Bun)]
                                                 |
                                            resvg (SVG → PNG)
                                                 |
                                            NDLOCR-Lite (OCR)
                                                 |
                                       ┌─────────┴─────────┐
                                  YAML + SVG files    SQLite (audit log)
```

Single process serves:

- Static SPA files (Svelte build output) via HTTP
- WebSocket endpoint for all data operations
- **No authentication** — deploy behind OAuth2 Proxy or similar if needed

## Project Structure

```
inkstation/
├── src/
│   ├── client/                     # Frontend (Svelte SPA)
│   │   ├── app.html                # HTML shell
│   │   ├── main.ts                 # Entry point
│   │   ├── App.svelte              # Root component
│   │   ├── pages/
│   │   │   └── PageView.svelte     # Main journal page
│   │   ├── components/
│   │   │   ├── TopBar.svelte           # Date + undo/redo buttons
│   │   │   ├── Row.svelte              # Single journal row
│   │   │   ├── WritingCanvas.svelte    # Stroke capture overlay
│   │   │   ├── BulletArea.svelte       # Bullet symbol input
│   │   │   ├── PostOcrText.svelte      # OCR text + editing gestures
│   │   │   ├── NavigationLabels.svelte # Page-switch overlay
│   │   │   ├── CalloutBubble.svelte    # Insertion caret bubble
│   │   │   ├── Calendar.svelte         # Calendar overlay with holidays
│   │   │   ├── OcrScanEffect.svelte    # Scanning animation during OCR
│   │   │   └── OfflineBanner.svelte    # Offline indicator
│   │   └── lib/
│   │       ├── stroke.ts               # Pen input helpers
│   │       ├── svg.ts                  # Stroke → SVG generation
│   │       ├── classifier.ts           # Bullet symbol classifier
│   │       ├── text-editing.ts         # Strikethrough + insertion logic
│   │       ├── gestures.ts             # Two-finger gesture detection
│   │       ├── date.ts                 # JST 05:00 day boundary
│   │       ├── holidays.ts             # Japanese holiday data (static)
│   │       ├── ws.ts                   # WebSocket client + offline queue
│   │       └── stores/
│   │           ├── page.svelte.ts      # Page state (via WebSocket)
│   │           ├── undo.svelte.ts      # Undo/redo stacks (in-memory)
│   │           └── connection.svelte.ts # WebSocket connection state
│   ├── server/                     # Backend (Hono)
│   │   ├── index.ts                # Hono app entry + static files
│   │   ├── ws.ts                   # WebSocket handler + message dispatch
│   │   ├── storage.ts              # YAML + SVG file I/O
│   │   ├── history.ts              # SQLite operation log (audit trail)
│   │   └── ocr.ts                  # resvg + NDLOCR-Lite pipeline
│   └── shared/                     # Shared types between client/server
│       └── types.ts                # Type definitions
├── tests/
│   ├── client/                     # Frontend tests
│   └── server/                     # Backend tests
├── package.json
├── tsconfig.json
├── vite.config.ts
├── Dockerfile
├── docker-compose.yml
└── LICENSE
```

## Configuration

| Variable   | Default              | Description              |
| ---------- | -------------------- | ------------------------ |
| `PORT`     | `3000`               | Server listen port       |
| `DATA_DIR` | `./inkstation-data`  | Data storage root        |
