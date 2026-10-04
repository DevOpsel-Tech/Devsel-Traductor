import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createDocumentRouter } from "../server/routes/documents.js";
import { createDocumentStore } from "../server/services/documentStore.js";
import { createFileCache } from "../server/services/fileCache.js";

test("archives generated PDFs separately from uploaded originals", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "folio-modified-pdf-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const documents = createDocumentStore(path.join(directory, "documents"));
  const cache = createFileCache(path.join(directory, "cache"));
  const source = await documents.save({
    buffer: Buffer.from("%PDF-source"),
    originalname: "source.pdf",
    size: 11,
  });
  const app = express();
  app.use(express.json());
  app.use("/api/documents", createDocumentRouter(documents, cache, {}));
  app.use((error, _request, response, _next) => {
    response.status(error.status ?? 500).json({ error: error.message });
  });
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/documents`;
  const form = new FormData();
  form.append("file", new Blob(["%PDF-modified"], { type: "application/pdf" }), "reading.pdf");
  form.append("sourceDocumentId", source.id);
  form.append("variant", "spanish");
  form.append("pages", JSON.stringify([2, 4]));

  const save = await fetch(`${baseUrl}/modified-pdf`, { method: "POST", body: form });
  assert.equal(save.status, 201);
  const saved = await save.json();
  assert.equal(saved.modifiedFrom, source.id);
  assert.equal(saved.variant, "spanish");
  assert.deepEqual(saved.pages, [2, 4]);

  const originals = await fetch(baseUrl);
  assert.deepEqual((await originals.json()).map(({ id }) => id), [source.id]);
  const modified = await fetch(`${baseUrl}/modified`);
  const entries = await modified.json();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].savedPdf, true);
  assert.equal(entries[0].document.id, saved.id);

  const secondForm = new FormData();
  secondForm.append("file", new Blob(["%PDF-modified-again"], { type: "application/pdf" }), "reading-again.pdf");
  secondForm.append("sourceDocumentId", saved.id);
  secondForm.append("variant", "original");
  secondForm.append("pages", JSON.stringify([3]));
  const secondSave = await fetch(`${baseUrl}/modified-pdf`, {
    method: "POST",
    body: secondForm,
  });
  assert.equal(secondSave.status, 201);
  const savedAgain = await secondSave.json();
  assert.equal(savedAgain.modifiedFrom, saved.id);
  assert.equal(savedAgain.sourceName, source.name);

  const addEdit = await fetch(`${baseUrl}/${savedAgain.id}/pages/3/edits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      variant: "original",
      mode: "replace",
      sourceText: "A phrase",
      translatedText: "Una frase",
      start: 0,
      end: 8,
      baseHash: "a1b2c3d4",
    }),
  });
  assert.equal(addEdit.status, 201, JSON.stringify(await addEdit.clone().json()));
  const thirdForm = new FormData();
  thirdForm.append("file", new Blob(["%PDF-modified-third"], { type: "application/pdf" }), "reading-third.pdf");
  thirdForm.append("sourceDocumentId", savedAgain.id);
  thirdForm.append("variant", "original");
  thirdForm.append("pages", JSON.stringify([3]));
  const thirdSave = await fetch(`${baseUrl}/modified-pdf`, {
    method: "POST",
    body: thirdForm,
  });
  assert.equal(thirdSave.status, 201);
  const savedThird = await thirdSave.json();
  assert.equal(savedThird.modifiedFrom, savedAgain.id);

  const updatedOriginals = await fetch(baseUrl);
  assert.deepEqual((await updatedOriginals.json()).map(({ id }) => id), [source.id]);
  const updatedModified = await fetch(`${baseUrl}/modified`);
  const savedEntries = (await updatedModified.json()).filter((entry) => entry.savedPdf);
  assert.deepEqual(
    savedEntries.map((entry) => entry.document.id).sort(),
    [saved.id, savedAgain.id, savedThird.id].sort(),
  );
});
