import { Database, Statement } from "bun:sqlite";

export class HistoryLog {
  private db: Database;
  private stmt: Statement;

  constructor(dbPath: string) {
    this.db = new Database(dbPath, { create: true });
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS operation_log (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        page_date  TEXT    NOT NULL,
        created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now')),
        operation  TEXT    NOT NULL,
        detail     TEXT,
        page_data  TEXT    NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_operation_log_date ON operation_log(page_date);
    `);
    this.stmt = this.db.prepare(
      "INSERT INTO operation_log (page_date, operation, detail, page_data) VALUES (?, ?, ?, ?)",
    );
  }

  appendLog(
    pageDate: string,
    operation: string,
    detail: object | null,
    pageData: string,
  ): void {
    this.stmt.run(pageDate, operation, detail ? JSON.stringify(detail) : null, pageData);
  }

  close(): void {
    this.db.close();
  }
}

export function createHistoryLog(): HistoryLog {
  const DATA_DIR = process.env.DATA_DIR || "./inkstation-data";
  return new HistoryLog(`${DATA_DIR}/history.db`);
}
