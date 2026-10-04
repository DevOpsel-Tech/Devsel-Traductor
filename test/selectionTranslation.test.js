import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import test from "node:test";
import { createSelectionRouter } from "../server/routes/selections.js";

test("translates selected text to English on request and keeps Spanish as the default", async (context) => {
  const targets = [];
  const app = express();
  app.use(express.json());
  app.use(
    "/api/selections",
    createSelectionRouter({
      async translate(text, target, source) {
        targets.push({ text, target, source });
        return `${source}->${target}:${text}`;
      },
    }),
  );
  app.use((error, _request, response, _next) => {
    response.status(error.status ?? 500).json({ error: error.message });
  });

  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));
  const address = server.address();
  const endpoint = `http://127.0.0.1:${address.port}/api/selections/translate`;
  const englishResponse = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "Hola", target: "en", source: "es" }),
  });
  const spanishResponse = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "Hello" }),
  });
  const unsupportedResponse = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "Hello", target: "fr" }),
  });

  assert.equal(englishResponse.status, 200);
  assert.deepEqual(await englishResponse.json(), { translatedText: "es->en:Hola" });
  assert.equal(spanishResponse.status, 200);
  assert.deepEqual(await spanishResponse.json(), { translatedText: "auto->es:Hello" });
  assert.equal(unsupportedResponse.status, 400);
  assert.deepEqual(targets, [
    { text: "Hola", target: "en", source: "es" },
    { text: "Hello", target: "es", source: "auto" },
  ]);
});
