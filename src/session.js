export function createSessionKey(storage, endpoint, persist = null) {
  let key = "";
  try {
    const saved = JSON.parse((storage && typeof storage.getItem === "function" ? storage.getItem("settings") : null) || "{}");
    if (saved && saved.endpoint === endpoint && typeof saved.apiKey === "string") key = saved.apiKey;
  } catch { /* Ignore malformed legacy settings. */ }
  if (storage && typeof storage.removeItem === "function") storage.removeItem("settings");

  return {
    get: () => key,
    set: (value) => {
      key = typeof value === "string" ? value : "";
      if (persist && typeof persist.write === "function") {
        void persist.write(key);
      }
      return key;
    },
    clear: () => {
      key = "";
      if (persist && typeof persist.clear === "function") {
        void persist.clear();
      }
      return key;
    },
    hydrate: async () => {
      if (!persist || typeof persist.read !== "function") return key;
      const persisted = await persist.read();
      if (typeof persisted === "string") key = persisted;
      return key;
    }
  };
}

export function validatePdf(bytes) {
  if (!bytes.byteLength || bytes.byteLength > 50 * 1024 * 1024) throw new Error("El archivo est\u00e1 vac\u00edo o supera 50 MiB.");
  if (!new TextDecoder("latin1").decode(bytes.slice(0, 1024)).includes("%PDF-")) throw new Error("El archivo seleccionado no parece ser un PDF v\u00e1lido.");
}
