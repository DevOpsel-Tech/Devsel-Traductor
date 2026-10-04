import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export function createFileCache(directory) {
  function keyFor(value) {
    return createHash("sha256").update(value).digest("hex");
  }

  async function get(documentId, kind, page, key) {
    const location = path.join(directory, documentId, kind, `${page}-${key}.json`);
    try {
      return JSON.parse(await readFile(location, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async function set(documentId, kind, page, key, value) {
    const location = path.join(directory, documentId, kind, `${page}-${key}.json`);
    await mkdir(path.dirname(location), { recursive: true });
    const temporary = `${location}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(value), { flag: "wx" });
    await rename(temporary, location);
    return value;
  }

  async function removeKey(documentId, kind, page, key) {
    await rm(path.join(directory, documentId, kind, `${page}-${key}.json`), { force: true });
  }

  async function removeDocument(documentId) {
    await rm(path.join(directory, documentId), { recursive: true, force: true });
  }

  return { get, keyFor, removeDocument, removeKey, set };
}
