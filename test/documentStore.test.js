import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createDocumentStore } from "../server/services/documentStore.js";

test("lists saved PDFs so they can be retrieved after recreating the store", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "folio-document-store-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const store = createDocumentStore(directory);
  const file = (originalname) => ({
    buffer: Buffer.from("%PDF-test"),
    originalname,
    size: 9,
  });

  const first = await store.save(file("first.pdf"));
  const second = await store.save(file("second.pdf"));
  const reopenedStore = createDocumentStore(directory);
  const saved = await reopenedStore.list();

  assert.equal(saved.length, 2);
  assert.deepEqual(
    saved.map(({ id, name, fileUrl }) => ({ id, name, fileUrl })).sort((left, right) => left.name.localeCompare(right.name)),
    [first, second]
      .map(({ id, name, fileUrl }) => ({ id, name, fileUrl }))
      .sort((left, right) => left.name.localeCompare(right.name)),
  );

  assert.equal(await reopenedStore.remove(first.id), true);
  assert.equal(await reopenedStore.get(first.id), null);
  assert.deepEqual((await reopenedStore.list()).map(({ id }) => id), [second.id]);
  assert.equal(await reopenedStore.remove(first.id), false);
});
