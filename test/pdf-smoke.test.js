import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, StandardFonts } from "pdf-lib";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { validatePdf } from "../src/session.js";

test("smoke: opens a PDF and extracts text for translation", async () => {
  const source = await PDFDocument.create();
  const page = source.addPage();
  const font = await source.embedFont(StandardFonts.Helvetica);
  page.drawText("Hello world", { x: 40, y: 700, font });
  const bytes = await source.save();
  validatePdf(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const document = await pdfjs.getDocument({ data: bytes }).promise;
  try {
    assert.equal(document.numPages, 1);
    const content = await (await document.getPage(1)).getTextContent();
    assert.match(content.items.map((item) => item.str).join(" "), /Hello world/);
  } finally { await document.destroy(); }
});
