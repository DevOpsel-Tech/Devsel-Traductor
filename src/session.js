export function createSessionKey(storage, endpoint) {
  let key = "";
  try {
    const saved = JSON.parse(storage.getItem("settings") || "{}");
    if (saved && saved.endpoint === endpoint && typeof saved.apiKey === "string") key = saved.apiKey;
  } catch { /* Ignore malformed legacy settings. */ }
  storage.removeItem("settings");
  return { get: () => key, set: (value) => { key = value; } };
}

export function validatePdf(bytes) {
  if (!bytes.byteLength || bytes.byteLength > 50 * 1024 * 1024) throw new Error("El archivo est\u00e1 vac\u00edo o supera 50 MiB.");
  if (!new TextDecoder("latin1").decode(bytes.slice(0, 1024)).includes("%PDF-")) throw new Error("El archivo seleccionado no parece ser un PDF v\u00e1lido.");
}
