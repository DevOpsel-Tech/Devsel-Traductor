import assert from "node:assert/strict";
import test from "node:test";
import {
  addVocabulary,
  listVocabulary,
  removeVocabulary,
} from "../src/study/vocabularyStore.js";

test("keeps same-page vocabulary entries distinct by translation direction", () => {
  const previousStorage = globalThis.localStorage;
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };

  try {
    const common = {
      documentId: "document",
      document: "book.pdf",
      page: 1,
      context: "A page of text",
    };
    const english = addVocabulary({
      ...common,
      word: "gift",
      translation: "regalo",
      sourceLanguage: "Inglés",
      targetLanguage: "Español",
    });
    const spanish = addVocabulary({
      ...common,
      word: "gift",
      translation: "don",
      sourceLanguage: "Español",
      targetLanguage: "Inglés",
    });

    assert.notEqual(english.id, spanish.id);
    assert.equal(listVocabulary().length, 2);
    removeVocabulary(english.id);
    assert.deepEqual(
      listVocabulary().map(({ word, translation, sourceLanguage, targetLanguage }) => ({
        word,
        translation,
        sourceLanguage,
        targetLanguage,
      })),
      [{
        word: "gift",
        translation: "don",
        sourceLanguage: "Español",
        targetLanguage: "Inglés",
      }],
    );
  } finally {
    if (previousStorage === undefined) {
      delete globalThis.localStorage;
    } else {
      globalThis.localStorage = previousStorage;
    }
  }
});
