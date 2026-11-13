import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("la interfaz contiene los elementos que usa el lector", async () => {
  const [html, script, css] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/main.js", import.meta.url), "utf8"),
    readFile(new URL("../src/styles.css", import.meta.url), "utf8"),
  ]);
  for (const [, id] of script.matchAll(/\$\("#([\w-]+)"\)/g)) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `Falta #${id}`);
  }
  for (const name of ["reader", "reader-area", "open-pdf", "pdf-page", "line-controls", "translation-line-button", "translation-overlay"]) {
    assert.ok(css.includes(`.${name}`), `Falta el estilo .${name}`);
  }
});
