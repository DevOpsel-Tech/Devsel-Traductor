import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_PDF_SIZE = 50 * 1024 * 1024;

export function createDocumentStore(directory) {
  async function ensureDirectory() {
    await mkdir(directory, { recursive: true });
  }

  function documentPath(id) {
    return path.join(directory, `${id}.pdf`);
  }

  function metadataPath(id) {
    return path.join(directory, `${id}.json`);
  }

  async function get(id) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return null;
    }
    try {
      return JSON.parse(await readFile(metadataPath(id), "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async function list() {
    await ensureDirectory();
    const entries = await readdir(directory, { withFileTypes: true });
    const metadataFiles = entries.filter(
      (entry) => entry.isFile() && /^[0-9a-f-]{36}\.json$/i.test(entry.name),
    );
    const documents = await Promise.all(
      metadataFiles.map(async ({ name }) => {
        const metadata = JSON.parse(await readFile(path.join(directory, name), "utf8"));
        if (
          !metadata ||
          typeof metadata.id !== "string" ||
          typeof metadata.name !== "string" ||
          !Number.isSafeInteger(metadata.size) ||
          typeof metadata.createdAt !== "string" ||
          typeof metadata.fileUrl !== "string"
        ) {
          throw new Error(`Los metadatos del documento ${name} no son válidos.`);
        }
        return metadata;
      }),
    );
    return documents.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async function save(file, metadataFields = {}) {
    if (!file || file.size === 0 || file.size > MAX_PDF_SIZE) {
      const error = new Error("El PDF debe ocupar entre 1 byte y 50 MB.");
      error.status = 400;
      throw error;
    }
    if (!file.buffer.subarray(0, 1024).includes(Buffer.from("%PDF-"))) {
      const error = new Error("El archivo no contiene una cabecera PDF válida.");
      error.status = 400;
      throw error;
    }

    await ensureDirectory();
    const id = randomUUID();
    const metadata = {
      id,
      name: path.basename(file.originalname).slice(0, 180) || "documento.pdf",
      size: file.size,
      createdAt: new Date().toISOString(),
      fileUrl: `/api/documents/${id}/file`,
      ...metadataFields,
    };
    const temporaryPdf = `${documentPath(id)}.tmp`;
    const temporaryMetadata = `${metadataPath(id)}.tmp`;
    await writeFile(temporaryPdf, file.buffer, { flag: "wx" });
    await rename(temporaryPdf, documentPath(id));
    await writeFile(temporaryMetadata, JSON.stringify(metadata), { flag: "wx" });
    await rename(temporaryMetadata, metadataPath(id));
    return metadata;
  }

  async function remove(id) {
    const metadata = await get(id);
    if (!metadata) {
      return false;
    }
    await Promise.all([
      rm(documentPath(id), { force: true }),
      rm(metadataPath(id), { force: true }),
    ]);
    return true;
  }

  return { get, list, remove, save, filePath: documentPath };
}
