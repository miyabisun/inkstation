import { describe, test, expect } from "bun:test";
import { mkdtemp, mkdir, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { recognizeText, parseNdlocrOutput } from "$server/ocr";

describe("recognizeText", () => {
  test("returns empty string when tools are not available", async () => {
    const svg = Buffer.from("<svg></svg>");
    const result = await recognizeText(svg);
    expect(result).toBe("");
  });
});

describe("parseNdlocrOutput", () => {
  test("extracts text from XML files in output directory", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "ocr-test-"));

    try {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<page>
  <block>
    <line>
      <char>Hello</char>
      <char>World</char>
    </line>
  </block>
</page>`;

      await writeFile(join(tempDir, "result.xml"), xml, "utf-8");

      const result = await parseNdlocrOutput(tempDir);
      expect(result).toContain("Hello");
      expect(result).toContain("World");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("handles nested directories with multiple XML files", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "ocr-test-"));

    try {
      const subDir = join(tempDir, "sub");
      await mkdir(subDir, { recursive: true });

      await writeFile(
        join(tempDir, "a.xml"),
        "<root><text>First</text></root>",
        "utf-8",
      );
      await writeFile(
        join(subDir, "b.xml"),
        "<root><text>Second</text></root>",
        "utf-8",
      );

      const result = await parseNdlocrOutput(tempDir);
      expect(result).toContain("First");
      expect(result).toContain("Second");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("returns empty string for non-existent directory", async () => {
    const result = await parseNdlocrOutput("/tmp/does-not-exist-xyz");
    expect(result).toBe("");
  });
});
