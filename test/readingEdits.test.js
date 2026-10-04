import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createDocumentRouter } from "../server/routes/documents.js";
import { createFileCache } from "../server/services/fileCache.js";
import {
  applyReadingEdits,
  countSelectionOccurrences,
  findSelectionRange,
  textFingerprint,
} from "../src/reading/readingEdits.js";

test("applies individual replacement and below-line edits and ignores stale bases", () => {
  const base = "First sentence. Second sentence.";
  const firstRange = findSelectionRange(base, "First sentence.");
  const secondRange = findSelectionRange(base, "Second sentence.", "First sentence. ");
  const edits = [
    {
      ...firstRange,
      mode: "replace",
      sourceText: "First sentence.",
      translatedText: "Primera frase.",
      baseHash: textFingerprint(base),
    },
    {
      ...secondRange,
      mode: "below",
      sourceText: "Second sentence.",
      translatedText: "Segunda frase.",
      baseHash: textFingerprint(base),
    },
  ];

  assert.deepEqual(firstRange, { start: 0, end: 15 });
  assert.deepEqual(
    findSelectionRange("One, one.", "one", "One, "),
    { start: 5, end: 8 },
  );
  assert.equal(countSelectionOccurrences("One, one, one", "one"), 3);
  assert.deepEqual(
    findSelectionRange("One, one, one.", "one", "", 2),
    { start: 10, end: 13 },
  );
  assert.deepEqual(
    findSelectionRange("First\nsentence. Second sentence.", "Second   sentence.", "First\nsentence. "),
    { start: 16, end: 32 },
  );
  assert.equal(
    applyReadingEdits(base, edits),
    "Primera frase. Second sentence.\nSegunda frase.",
  );
  assert.equal(applyReadingEdits("Changed base", edits), "Changed base");
});

test("persists reading edits, lists variants, and undoes only the selected edit", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "folio-reading-edits-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const documentId = "5b4c5705-8385-4f8a-a933-4309cb0c5f3d";
  const document = {
    id: documentId,
    name: "lesson.pdf",
    size: 9,
    createdAt: new Date().toISOString(),
    fileUrl: `/api/documents/${documentId}/file`,
  };
  const store = {
    async get(id) {
      return id === documentId ? document : null;
    },
    async list() {
      return [document];
    },
  };
  const cache = createFileCache(directory);
  const app = express();
  app.use(express.json());
  app.use("/api/documents", createDocumentRouter(store, cache, {}));
  app.use((error, _request, response, _next) => {
    response.status(error.status ?? 500).json({ error: error.message });
  });
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/documents/${documentId}`;
  const payload = (variant, start, sourceText, translatedText, occurrence) => ({
    variant,
    mode: "replace",
    sourceText,
    translatedText,
    start,
    end: start + sourceText.length,
    baseHash: "a1b2c3d4",
    occurrence,
  });
  const createEdit = async (body) =>
    fetch(`${baseUrl}/pages/2/edits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  const originalEdit = await createEdit(payload("original", 0, "Hello", "Hola", 2));
  const spanishEdit = await createEdit(payload("spanish", 6, "world", "mundo"));
  const overlap = await createEdit(payload("original", 2, "llo", "lo"));
  assert.equal(originalEdit.status, 201, JSON.stringify(await originalEdit.clone().json()));
  assert.equal((await originalEdit.json()).occurrence, 2);
  assert.equal(spanishEdit.status, 201);
  assert.equal(overlap.status, 409);

  const saved = await fetch(`${baseUrl}/pages/2/edits`);
  const savedBody = await saved.json();
  assert.equal(savedBody.original.length, 1);
  assert.equal(savedBody.spanish.length, 1);
  const modified = await fetch("http://127.0.0.1:" + server.address().port + "/api/documents/modified");
  assert.deepEqual(
    (await modified.json()).map(({ variant, pages }) => ({ variant, pages })),
    [
      { variant: "spanish", pages: [2] },
    ],
  );

  const undo = await fetch(`${baseUrl}/pages/2/edits/${savedBody.original[0].id}?variant=original`, {
    method: "DELETE",
  });
  assert.equal(undo.status, 204);
  const remaining = await (await fetch(`${baseUrl}/pages/2/edits`)).json();
  assert.deepEqual(remaining.original, []);
  assert.equal(remaining.spanish.length, 1);
});
