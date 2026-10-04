const STORAGE_KEY = "folio-vocabulary-v1";

function readEntries() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function listVocabulary() {
  return readEntries();
}

export function addVocabulary(entry) {
  const entries = readEntries();
  const existing = entries.find(
    (item) =>
      item.word.toLocaleLowerCase() === entry.word.toLocaleLowerCase() &&
      item.documentId === entry.documentId &&
      item.page === entry.page &&
      item.sourceLanguage === entry.sourceLanguage &&
      item.targetLanguage === entry.targetLanguage,
  );
  if (existing) {
    return existing;
  }
  const saved = { ...entry, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  entries.unshift(saved);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  return saved;
}

export function removeVocabulary(id) {
  const entries = readEntries().filter((entry) => entry.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}
