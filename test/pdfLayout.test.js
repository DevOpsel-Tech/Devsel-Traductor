import test from "node:test";
import assert from "node:assert/strict";
import { groupTextLines, fittingFontSize } from "../src/pdfLayout.js";

const part = (text, left, top, width, height = 12) => ({ text, left, top, width, height, right: left + width, bottom: top + height });

test("separa columnas en la misma altura sin cubrir el espacio entre ellas", () => {
  const lines = groupTextLines([part("Hello", 10, 20, 30), part("world", 43, 20, 30), part("Second column", 300, 20, 80)], 600);
  assert.deepEqual(lines.map(({ text, left, right }) => ({ text, left, right })), [
    { text: "Hello world", left: 10, right: 73 },
    { text: "Second column", left: 300, right: 380 },
  ]);
});

test("mantiene las líneas separadas y une fragmentos contiguos", () => {
  const lines = groupTextLines([part("trans", 10, 20, 30), part("lation", 40, 20, 30), part("Next", 10, 42, 25)], 600);
  assert.deepEqual(lines.map((line) => line.text), ["translation", "Next"]);
});

test("reduce el tamaño para el espacio disponible sin bajar del mínimo", () => {
  assert.equal(fittingFontSize(200, 100, 12), 7);
  assert.equal(fittingFontSize(100, 80, 10), 8);
  assert.equal(fittingFontSize(40, 100, 12), 12);
});
