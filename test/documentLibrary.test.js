import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import { deleteDocument, getDocument, listDocuments, saveDocument } from "../src/documentLibrary.js";

test("guarda y recupera un PDF de la biblioteca", async () => {
  const bytes = new TextEncoder().encode("%PDF-test").buffer;
  const id = await saveDocument("libro.pdf", bytes);
  const listing = await listDocuments();
  assert.equal(listing.length, 1);
  assert.equal(listing[0].name, "libro.pdf");
  assert.equal(listing[0].id, id);
  assert.equal("bytes" in listing[0], false);
  const saved = await getDocument(id);
  assert.deepEqual(new Uint8Array(saved.bytes), new Uint8Array(bytes));
  assert.equal(await getDocument("missing"), null);
  await deleteDocument(id);
  assert.equal(await getDocument(id), null);
  assert.deepEqual(await listDocuments(), []);
});
