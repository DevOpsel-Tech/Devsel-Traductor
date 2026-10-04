import assert from "node:assert/strict";
import test from "node:test";
import { extractPageLayout } from "../src/pdf/extractPageText.js";

test("measures the original text column and dominant body size", () => {
  const layout = extractPageLayout([
    { str: "Titulo ancho", width: 120, transform: [12, 0, 0, 12, 50, 700] },
    { str: "Linea de cuerpo mucho mas larga", width: 300, transform: [11, 0, 0, 11, 50, 660] },
    { str: "fin", width: 30, transform: [11, 0, 0, 11, 340, 620] },
  ]);
  assert.equal(layout.left, 50);
  assert.equal(layout.right, 370);
  // Mediana ponderada por caracteres: el título grande no se impone.
  assert.equal(layout.fontSize, 11);
});

test("returns null when the page has no positioned text", () => {
  assert.equal(extractPageLayout([]), null);
  assert.equal(extractPageLayout([{ str: "sin transform", width: 10 }]), null);
  assert.equal(
    extractPageLayout([{ str: "   ", width: 10, transform: [10, 0, 0, 10, 20, 30] }]),
    null,
  );
});
