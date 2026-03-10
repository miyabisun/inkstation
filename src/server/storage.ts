import * as yaml from "js-yaml";
import { readdir, mkdir } from "node:fs/promises";
import type { Page, Action } from "$shared/types";

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const VALID_ACTIONS: ReadonlySet<string> = new Set<Action>(["add", "insert"]);

export class PageStorage {
  readonly dataDir: string;

  constructor(dataDir?: string) {
    this.dataDir = dataDir ?? process.env.DATA_DIR ?? "./inkstation-data";
  }

  /** Return sorted date strings (descending) for pages that have page.yaml */
  async listPages(): Promise<string[]> {
    let entries: string[];
    try {
      entries = await readdir(this.dataDir);
    } catch {
      return [];
    }

    const candidates = entries.filter((name) => DATE_RE.test(name));
    const checks = await Promise.all(
      candidates.map(async (name) => {
        const exists = await Bun.file(`${this.dataDir}/${name}/page.yaml`).exists();
        return exists ? name : null;
      }),
    );

    return checks.filter((name): name is string => name !== null).sort().reverse();
  }

  /** Load a page by date. Returns null if not found. */
  async loadPage(date: string): Promise<Page | null> {
    if (!DATE_RE.test(date)) return null;

    try {
      const text = await Bun.file(`${this.dataDir}/${date}/page.yaml`).text();
      return yaml.load(text, { schema: yaml.JSON_SCHEMA }) as Page;
    } catch {
      return null;
    }
  }

  /** Save a page to page.yaml */
  async savePage(date: string, page: Page): Promise<string> {
    if (!DATE_RE.test(date)) {
      throw new Error(`Invalid date format: ${date}`);
    }

    const pageDir = `${this.dataDir}/${date}`;
    await mkdir(pageDir, { recursive: true });

    const text = yaml.dump(page, { noRefs: true });
    await Bun.write(`${pageDir}/page.yaml`, text);
    return text;
  }

  /** Save an SVG file. Returns the filename (not full path). */
  async saveSvg(
    date: string,
    rowId: number,
    action: string,
    svgContent: Buffer | string,
  ): Promise<string> {
    if (!DATE_RE.test(date)) {
      throw new Error(`Invalid date format: ${date}`);
    }
    if (!VALID_ACTIONS.has(action)) {
      throw new Error(`Invalid action: ${action}`);
    }
    if (!Number.isInteger(rowId) || rowId < 0) {
      throw new Error(`Invalid rowId: ${rowId}`);
    }

    const pageDir = `${this.dataDir}/${date}`;
    await mkdir(pageDir, { recursive: true });

    const seq = await this.nextSeq(pageDir);
    const filename = `${String(seq).padStart(3, "0")}_${String(rowId).padStart(5, "0")}_${action}.svg`;
    await Bun.write(`${pageDir}/${filename}`, svgContent);
    return filename;
  }

  /** Find the next sequence number from existing SVG files in a directory. */
  async nextSeq(pageDir: string): Promise<number> {
    let entries: string[];
    try {
      entries = await readdir(pageDir);
    } catch {
      return 0;
    }

    let max = -1;
    for (const name of entries) {
      if (!name.endsWith(".svg")) continue;
      const seqStr = name.split("_")[0];
      const seq = parseInt(seqStr, 10);
      if (!isNaN(seq) && seq > max) {
        max = seq;
      }
    }

    return max + 1;
  }
}
