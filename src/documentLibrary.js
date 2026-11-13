const databaseName = "traductor-pdf-library";
const storeName = "documents";

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transaction(mode, operation) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const request = operation(tx.objectStore(storeName));
    let value;
    request.onsuccess = () => { value = request.result; };
    tx.oncomplete = () => { db.close(); resolve(value); };
    tx.onabort = tx.onerror = () => { db.close(); reject(tx.error || request.error); };
  });
}

export async function saveDocument(name, bytes) {
  const id = crypto.randomUUID();
  await transaction("readwrite", (store) => store.add({ id, name, bytes, createdAt: Date.now() }));
  return id;
}

export async function getDocument(id) {
  return (await transaction("readonly", (store) => store.get(id))) ?? null;
}

export async function deleteDocument(id) {
  await transaction("readwrite", (store) => store.delete(id));
}

export async function listDocuments() {
  const records = await transaction("readonly", (store) => store.getAll());
  return records.map(({ id, name, createdAt }) => ({ id, name, createdAt }))
    .sort((a, b) => b.createdAt - a.createdAt);
}
