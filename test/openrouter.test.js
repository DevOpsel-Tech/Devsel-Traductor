import test from "node:test";
import assert from "node:assert/strict";
import { detectSourceLanguage, translateWithOpenRouter } from "../src/openrouter.js";

test("envía el texto y la clave sin espacios a Gemini", async () => {
  const result = await translateWithOpenRouter("hello", "  test-key  ", async (url, options) => {
    assert.equal(url, "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
    assert.equal(options.headers.Authorization, "Bearer test-key");
    const body = JSON.parse(options.body);
    assert.equal(body.model, "gemini-3.5-flash-lite");
    assert.equal(body.messages[1].content, "hello");
    return { ok: true, json: async () => ({ choices: [{ message: { content: "hola" } }] }) };
  });
  assert.equal(result, "hola");
});

test("identifica claves rechazadas y límites", async () => {
  for (const [status, message] of [[401, /clave/], [404, /modelo/], [429, /límite/]]) {
    await assert.rejects(translateWithOpenRouter("hello", "key", async () => ({ ok: false, status })), message);
  }
});

test("distingue el límite de la cuenta de la saturación del proveedor", async () => {
  const response = (source) => ({ ok: false, status: 429, json: async () => ({ error: { metadata: { limit_source: source } } }) });
  const endpoint = "https://openrouter.ai/api/v1/chat/completions";
  await assert.rejects(translateWithOpenRouter("hello", "key", async () => response("openrouter_free_tier_per_minute"), endpoint), /por minuto/);
  await assert.rejects(translateWithOpenRouter("hello", "key", async () => response("upstream_provider_shared_pool"), endpoint), /proveedor.*saturado/);
});

test("admite otro proveedor compatible y rechaza direcciones inseguras", async () => {
  const mock = async (url, options) => {
    assert.equal(url, "https://example.com/v1/chat/completions");
    assert.equal(JSON.parse(options.body).model, "modelo-test");
    return { ok: true, json: async () => ({ choices: [{ message: { content: "hola" } }] }) };
  };
  assert.equal(await translateWithOpenRouter("hello", "key", mock, "https://example.com/v1/chat/completions", "modelo-test"), "hola");
  await assert.rejects(translateWithOpenRouter("hello", "key", mock, "http://example.com", "modelo-test"), /HTTPS/);
});

test("solicita detectar el idioma y traducir al destino elegido", async () => {
  const mock = async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.match(body.messages[0].content, /Detect the language/);
    assert.match(body.messages[0].content, /French/);
    return { ok: true, json: async () => ({ choices: [{ message: { content: "bonjour" } }] }) };
  };
  assert.equal(await translateWithOpenRouter("hello", "key", mock, undefined, undefined, "fr"), "bonjour");
  await assert.rejects(translateWithOpenRouter("hello", "key", mock, undefined, undefined, "invalid"), /idioma/);
});

test("identifica un código de idioma conocido y rechaza respuestas ambiguas", async () => {
  const answer = (text) => async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: text } }] }) });
  assert.equal(await detectSourceLanguage("A sample", "key", answer("en")), "en");
  assert.equal(await detectSourceLanguage("A sample", "key", answer("English or French")), null);
});

test("distingue el idioma del texto de origen del idioma de la aplicación o destino", async () => {
  const mock = async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.match(body.messages[0].content, /text itself/);
    assert.match(body.messages[0].content, /Do not infer it from the app language/);
    assert.match(body.messages[0].content, /If it is English, reply en/);
    return { ok: true, json: async () => ({ choices: [{ message: { content: "en" } }] }) };
  };
  assert.equal(await detectSourceLanguage("This document is written in English.", "key", mock), "en");
});
