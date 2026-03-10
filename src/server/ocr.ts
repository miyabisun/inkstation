import { mkdtemp, rm, readdir, readFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

let toolsAvailable: boolean | null = null;

async function checkTools(): Promise<boolean> {
  if (toolsAvailable !== null) return toolsAvailable;

  try {
    const resvg = Bun.which("resvg");
    const ndlocr = Bun.which("ndlocr");
    toolsAvailable = resvg !== null && ndlocr !== null;
  } catch {
    toolsAvailable = false;
  }

  return toolsAvailable;
}

/**
 * Parse NDLOCR XML output directory, extracting all text content from XML elements.
 */
export async function parseNdlocrOutput(outputDir: string): Promise<string> {
  const texts: string[] = [];

  let entries: string[];
  try {
    entries = await readdir(outputDir, { recursive: true }) as unknown as string[];
  } catch {
    return "";
  }

  for (const entry of entries) {
    if (!entry.endsWith(".xml")) continue;

    const filePath = join(outputDir, entry);
    const content = await readFile(filePath, "utf-8");

    // Extract text content from XML elements.
    // Matches text between > and < that is not purely whitespace.
    const matches = content.match(/>([^<]+)</g);
    if (matches) {
      for (const m of matches) {
        const text = m.slice(1, -1).trim();
        if (text) {
          texts.push(text);
        }
      }
    }
  }

  return texts.join("\n");
}

/**
 * Convert SVG content to text via resvg (SVG->PNG) and ndlocr (OCR).
 * Returns empty string if tools are not installed.
 */
export async function recognizeText(svgContent: Buffer): Promise<string> {
  if (!(await checkTools())) {
    return "";
  }

  const tempDir = await mkdtemp(join(tmpdir(), "inkstation-ocr-"));

  try {
    const svgPath = join(tempDir, "input.svg");
    const pngPath = join(tempDir, "output.png");
    const ocrOutputDir = join(tempDir, "ocr_output");

    // Write SVG to temp file
    await Bun.write(svgPath, svgContent);

    const PROCESS_TIMEOUT = 30_000;

    // Run resvg: SVG -> PNG
    const resvgProc = Bun.spawn(["resvg", svgPath, pngPath], {
      stdout: "ignore",
      stderr: "pipe",
    });
    const resvgExit = await Promise.race([
      resvgProc.exited,
      new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), PROCESS_TIMEOUT)),
    ]);
    if (resvgExit === "timeout") {
      resvgProc.kill();
      console.error("resvg timed out");
      return "";
    }
    if (resvgExit !== 0) {
      const stderr = await new Response(resvgProc.stderr).text();
      console.error(`resvg failed (exit ${resvgExit}): ${stderr}`);
      return "";
    }

    // Run ndlocr: PNG -> OCR output
    const ndlocrProc = Bun.spawn(["ndlocr", pngPath, "-o", ocrOutputDir], {
      stdout: "ignore",
      stderr: "pipe",
    });
    const ndlocrExit = await Promise.race([
      ndlocrProc.exited,
      new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), PROCESS_TIMEOUT)),
    ]);
    if (ndlocrExit === "timeout") {
      ndlocrProc.kill();
      console.error("ndlocr timed out");
      return "";
    }
    if (ndlocrExit !== 0) {
      const stderr = await new Response(ndlocrProc.stderr).text();
      console.error(`ndlocr failed (exit ${ndlocrExit}): ${stderr}`);
      return "";
    }

    return await parseNdlocrOutput(ocrOutputDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
