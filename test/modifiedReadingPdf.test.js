import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { createModifiedReadingPdf } from "../src/pdf/modifiedReadingPdf.js";

const fontBytes = await Promise.all([
  readFile(new URL("../node_modules/@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff", import.meta.url)),
  readFile(new URL("../node_modules/@fontsource/noto-sans/files/noto-sans-latin-ext-400-normal.woff", import.meta.url)),
]);

test("creates a modified-reading PDF while preserving untouched pages", async () => {
  const source = await PDFDocument.create();
  const font = await source.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < 3; index += 1) {
    const page = source.addPage([420, 595]);
    page.drawText(`Original page ${index + 1}`, { x: 40, y: 520, font, size: 12 });
  }

  const resultBytes = await createModifiedReadingPdf(
    await source.save(),
    [{
      page: 2,
      variantLabel: "español",
      text: "Texto sustituido.\nLínea añadida debajo. →",
    }],
    fontBytes,
  );
  const result = await PDFDocument.load(resultBytes);

  assert.equal(result.getPageCount(), 3);
  assert.deepEqual(result.getPage(0).getSize(), { width: 420, height: 595 });
  assert.deepEqual(result.getPage(1).getSize(), { width: 420, height: 595 });
  assert.deepEqual(result.getPage(2).getSize(), { width: 420, height: 595 });
});

test("continues long modified text on extra pages instead of truncating", async () => {
  const source = await PDFDocument.create();
  source.addPage([200, 160]);
  const longText = Array.from({ length: 300 }, (_, index) => `Texto ${index}`).join("\n");

  const resultBytes = await createModifiedReadingPdf(await source.save(), [{
      page: 1,
      variantLabel: "español",
      text: longText,
    }], fontBytes);
  const result = await PDFDocument.load(resultBytes);
  assert.ok(result.getPageCount() > 1);
});
