import test from "node:test";
import assert from "node:assert/strict";
import { createSessionKey, validatePdf } from "../src/session.js";

test("migrates a matching legacy key into memory and removes persistent settings", () => {
  const data = new Map([["settings", JSON.stringify({ endpoint: "https://example.com", apiKey: "secret" })]]);
  const storage = { getItem: (k) => data.get(k), removeItem: (k) => data.delete(k) };
  const session = createSessionKey(storage, "https://example.com");
  assert.equal(session.get(), "secret");
  assert.equal(data.has("settings"), false);
  session.set("");
  assert.equal(session.get(), "");
  assert.equal(createSessionKey(storage, "https://example.com").get(), "");
});

test("does not migrate another provider or malformed settings", () => {
  for (const value of ['{"endpoint":"other","apiKey":"secret"}', '{']) {
    let saved = value;
    const session = createSessionKey({ getItem: () => saved, removeItem: () => { saved = null; } }, "expected");
    assert.equal(session.get(), "");
    assert.equal(saved, null);
  }
});

test("checks PDF size and header before opening", () => {
  const encode = (text) => new TextEncoder().encode(text).buffer;
  assert.doesNotThrow(() => validatePdf(encode("%PDF-1.7\ncontent")));
  assert.throws(() => validatePdf(encode("")), /50 MiB/);
  assert.throws(() => validatePdf(encode("not a PDF")), /PDF/);
  assert.throws(() => validatePdf(new ArrayBuffer(50 * 1024 * 1024 + 1)), /50 MiB/);
});
