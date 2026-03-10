# Data Model

## Page

```typescript
interface Page {
  date: string;         // YYYY-MM-DD
  next_row_id: number;
  rows: Row[];
}
```

## Row

```typescript
interface Row {
  id: number;
  bullet: BulletSymbol;
  status: RowStatus;
  ocr_text: string;
  children: Row[];
}

type BulletSymbol = "·" | "×" | "-" | ">" | "o";
type RowStatus = "open" | "done" | "note" | "migrated" | "event";
```

## Bullet → Status Mapping

| Bullet | Status     |
| ------ | ---------- |
| `·`    | `open`     |
| `×`    | `done`     |
| `-`    | `note`     |
| `>`    | `migrated` |
| `o`    | `event`    |

## Day Boundary

A "day" rolls over at **05:00 JST**, not midnight. Writing at 03:00 on March 10th belongs to the March 9th page.

## Page Model

- **One page per day** (day boundary at 05:00 JST)
- ~20 visible rows, vertically scrollable via two-finger swipe
- New rows appended at the bottom, up to **100 rows per page**
- App always opens to **today's page**
- Past pages are browsable and editable — only dates that have notes can be navigated to
- Future pages cannot be navigated to — today is the newest boundary

## Page Creation

A page is **not** created on app open or date change. It is created on the server when the **first row is created** (`create-row` message). If a page has no rows, it does not exist on the server and does not appear in `list-pages` results.

## Row Hierarchy

3-level nesting: root → child → grandchild (indent 0, 1, 2).

Indent determines the parent row on creation:

- `0`: Top-level row (no parent)
- `1`: Child of the last root-level row
- `2`: Child of the last indent-1 row (grandchild)

```
· Parent task
    - Child note
        - Grandchild detail    ← max depth
    · Another child task
· Top-level task
```

## Data Storage

```
inkstation-data/
  history.db                  # SQLite — operation log (audit trail)
  2026-03-09/
    page.yaml
    001_00001_add.svg
    002_00001_insert.svg
    003_00003_add.svg
  2026-03-08/
    page.yaml
    001_00001_add.svg
    ...
```

- Each date has its own directory
- `page.yaml` is updated on every write operation
- SVG files are stored permanently as the canonical handwriting record
- `history.db` stores an append-only operation log
- No automatic purging — all data is retained indefinitely

### SVG File Naming

```
{seq}_{row-id}_{action}.svg
```

| Field    | Format  | Description                         |
| -------- | ------- | ----------------------------------- |
| `seq`    | 3-digit | Auto-increment sequence (per page)  |
| `row-id` | 5-digit | Target row ID                       |
| `action` |         | `add` or `insert`                   |

## Operation Log (SQLite)

Append-only log of all page mutations. Serves as an audit trail and enables future features (operation history viewer, etc.).

Database file: `{DATA_DIR}/history.db`

```sql
CREATE TABLE operation_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  page_date  TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now')),
  operation  TEXT    NOT NULL,  -- 'create-row', 'edit-row', 'update-page'
  detail     TEXT,              -- JSON: operation-specific context
  page_data  TEXT    NOT NULL   -- full page state AFTER this operation (YAML)
);

CREATE INDEX idx_operation_log_date ON operation_log(page_date);
```

No pruning is performed initially — the log grows indefinitely.
