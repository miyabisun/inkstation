# UI Specification

## Page View Layout

- **Top-left**: Current page's date (auto-updated at 05:00 JST) — **tap to open calendar**
- **Top-right**: Undo / Redo buttons (disabled when respective stack is empty)
- **Top banner**: Offline indicator (when disconnected)
- **Navigation labels**: "前日" / "翌日" during page-switch gesture
- **Main area**: Ruled notebook with ~20 visible rows

### Row Structure

```
[drag handle] [bullet symbol (1 char)] [text field]
```

## Calendar

Tapping the date label (top-left) opens a calendar overlay for quick page navigation. Any input type triggers it (stylus, finger, mouse click).

- **Monthly calendar view** with the current page's date highlighted
- **Japanese holidays** are displayed in red with the holiday name
- **Sundays** in red, **Saturdays** in blue
- Dates with existing notes show a 📝 marker
- **Only dates with notes (or today) are tappable** — dates without notes are displayed but not interactive
- Tapping a date navigates to that page (sends `get-page` via WebSocket)
- Tapping outside the calendar or pressing the date label again closes it
- Month navigation via left/right arrows

### Note Existence Data

When the calendar is opened (or the displayed month changes), the client sends a `list-pages` message to get the list of dates that have notes.

### Japanese Holiday Data

Holiday data is bundled as a static file in the frontend build. No external API dependency.

- **Source**: Cabinet Office (内閣府) published holiday CSV
- **Format**: `{ "YYYY-MM-DD": "holiday name" }` mapping
- **Coverage**: 2025–2027
- **File**: `src/client/lib/holidays.ts`

Holidays covered:
- Fixed-date holidays (元日, 建国記念の日, 天皇誕生日, etc.)
- Happy Monday holidays (成人の日, 海の日, スポーツの日, 敬老の日)
- Equinox holidays (春分の日, 秋分の日) — calculated via approximate formula
- Substitute holidays (振替休日) — when a holiday falls on Sunday, the next weekday is a holiday
- Citizens' Holiday (国民の休日) — a weekday sandwiched between two holidays

## Input

- **Stylus-only** for handwriting (`PointerEvent.pointerType === "pen"`)
- **Two-finger vertical swipe**: Scroll page
- **Two-finger horizontal swipe**: Navigate between days (±20° threshold)
- **Stylus long-press** on drag handle: Reorder row
- **Stylus double-tap** on right edge: Delete row

### Two-Finger Gesture Disambiguation

| Swipe angle                              | Action          |
| ---------------------------------------- | --------------- |
| Within ±20° of horizontal                | Page navigation |
| All other angles (> 20° from horizontal) | Vertical scroll |

## Pen Style

- Fixed **black** ink, no color options
- 4096-level stylus pressure → `stroke-width` in SVG (4–5 discrete levels)
- On-screen rendering: uniform thickness for performance

## Stroke Processing

### Stroke Capture

1. `pointerdown` (pen) → start recording `StrokePoint[]`
2. `pointermove` → append points with `{ x, y, pressure, timestamp }`
3. `pointerup` → end stroke
4. After **2 seconds** of no further input on the row → trigger SVG generation and send

### Stroke Point

```typescript
interface StrokePoint {
  x: number;
  y: number;
  pressure: number;   // 0.0–1.0
  timestamp: number;
}
```

### Stroke Smoothing

3-point moving average applied to raw stroke points before SVG generation.

## Bullet Symbol Lifecycle

The bullet symbol is classified **locally in the browser** using stroke heuristics — no OCR roundtrip.

| Symbol | Meaning       | How it's created                      |
| ------ | ------------- | ------------------------------------- |
| `·`    | Task (open)   | Write a dot                           |
| `×`    | Task (done)   | Draw X over existing `·`              |
| `-`    | Note          | Write a dash                          |
| `>`    | Migrated      | Write a right-arrow over a symbol     |
| `o`    | Event         | Write a small circle                  |

## Text Editing (post-OCR)

### Font

GenJyuuGothic Monospace (源柔ゴシック Monospace) — required for character position calculations.

### Strikethrough Delete

1. Draw a horizontal line through characters
2. Overlapped characters highlighted in red (real-time)
3. On stylus lift: highlighted characters deleted, text left-justified

### Insertion Caret

1. Draw a vertical line between two characters
2. Callout bubble appears below the row
3. Write text in the callout bubble
4. Stylus lifts for ~2 seconds → SVG sent for OCR
5. OCR result inserted at the caret position

## Undo / Redo

Client-side undo/redo with server-side operation log. Undo/Redo is driven entirely by the client for instant response and offline support.

### Client-Side Stacks

- In-memory page snapshot stack, managed by `stores/undo.svelte.ts`
- Before each page mutation, the current page state is pushed onto the undo stack
- **Undo**: pop from undo stack → push current state onto redo stack → restore popped state → send `update-page` to server
- **Redo**: pop from redo stack → push current state onto undo stack → restore popped state → send `update-page` to server
- New mutation clears the redo stack
- Maximum **30 entries** each for the undo stack and the redo stack
- History is per-page and resets on page navigation
- History is lost on page reload (not persisted)
- Works offline — undo/redo operates on local state, `update-page` is queued
