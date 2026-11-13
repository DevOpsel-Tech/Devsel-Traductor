import test from "node:test";
import assert from "node:assert/strict";
import { translateWithOpenRouter, detectSourceLanguage } from "../src/openrouter.js";

test("rechaza la petición cuando la red falla", async () => {
  await assert.rejects(
    translateWithOpenRouter("hello", "key", async () => { throw new TypeError("Failed to fetch"); }),
    /No se pudo conectar con la API/
  );
});

test("rechaza la petición cuando se agota el tiempo", async () => {
  const err = new Error("The operation was aborted due to timeout");
  err.name = "TimeoutError";
  await assert.rejects(
    translateWithOpenRouter("hello", "key", async () => { throw err; }),
    /tardado demasiado/
  );
});

test("rechaza una respuesta que no es JSON", async () => {
  await assert.rejects(
    translateWithOpenRouter("hello", "key", async () => ({ ok: true, json: async () => { throw new Error("bad json"); } })),
    /no válida/
  );
});

test("rechaza una respuesta vacía", async () => {
  await assert.rejects(
    translateWithOpenRouter("hello", "key", async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: "   " } }] }) })),
    /no devolvió una traducción/
  );
});

test("detectSourceLanguage devuelve null para respuesta ambigua", async () => {
  const mock = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: "English or French" } }] }) });
  assert.equal(await detectSourceLanguage("sample", "key", mock), null);
});

test("detectSourceLanguage lanza error si la respuesta está vacía", async () => {
  const mock = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: "" } }] }) });
  await assert.rejects(detectSourceLanguage("sample", "key", mock), /no devolvió una traducción/);
});
