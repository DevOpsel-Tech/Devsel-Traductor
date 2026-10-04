import multer from "multer";
import { Router } from "express";
import { randomUUID } from "node:crypto";

const MAX_TEXT_LENGTH = 120_000;

export function createDocumentRouter(documents, cache, translator) {
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024, files: 1 },
  });

  router.get("/", async (_request, response, next) => {
    try {
      return response.json((await documents.list()).filter((document) => !document.modifiedFrom));
    } catch (error) {
      return next(error);
    }
  });

  router.get("/modified", async (_request, response, next) => {
    try {
      const savedDocuments = await documents.list();
      const modified = [];
      for (const document of savedDocuments) {
        if (document.modifiedFrom) {
          modified.push({
            document,
            variant: document.variant,
            pages: document.pages,
            savedPdf: true,
          });
        }
        const index = await cache.get(document.id, "reading-edits", 0, "index");
        for (const variant of ["original", "spanish"]) {
          const pages = index?.[variant] ?? [];
          if (pages.length) {
            modified.push({ document, variant, pages });
          }
        }
      }
      return response.json(modified);
    } catch (error) {
      return next(error);
    }
  });

  router.post("/", upload.single("file"), async (request, response, next) => {
    try {
      if (!request.file) {
        return response.status(400).json({ error: "Selecciona un archivo PDF." });
      }
      const document = await documents.save(request.file);
      return response.status(201).json(document);
    } catch (error) {
      return next(error);
    }
  });

  router.post("/modified-pdf", upload.single("file"), async (request, response, next) => {
    try {
      if (!request.file) {
        return response.status(400).json({ error: "Selecciona el PDF modificado que se va a guardar." });
      }
      const sourceDocumentId = readDocumentId(request.body?.sourceDocumentId);
      const sourceDocument = await documents.get(sourceDocumentId);
      if (!sourceDocument) {
        return response.status(404).json({ error: "No se encontró el PDF de origen." });
      }
      const variant = readVariant(request.body?.variant);
      const pages = readModifiedPages(request.body?.pages);
      const saved = await documents.save(request.file, {
        modifiedFrom: sourceDocumentId,
        sourceName: sourceDocument.sourceName ?? sourceDocument.name,
        variant,
        pages,
      });
      return response.status(201).json(saved);
    } catch (error) {
      return next(error);
    }
  });

  router.get("/:documentId", async (request, response, next) => {
    try {
      const document = await documents.get(request.params.documentId);
      return document
        ? response.json(document)
        : response.status(404).json({ error: "No se encontró el documento." });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/:documentId/file", async (request, response, next) => {
    try {
      const document = await documents.get(request.params.documentId);
      if (!document) {
        return response.status(404).json({ error: "No se encontró el documento." });
      }
      return response.sendFile(documents.filePath(document.id), {
        headers: { "Content-Type": "application/pdf" },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/:documentId/pages/:page", async (request, response, next) => {
    try {
      const document = await documents.get(request.params.documentId);
      if (!document) {
        return response.status(404).json({ error: "No se encontró el documento." });
      }
      const page = parsePage(request.params.page);
      const ocr = await cache.get(document.id, "ocr", page, "latest");
      return response.json({ documentId: document.id, page, ocrText: ocr?.text ?? null });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/:documentId/pages/:page/translate", async (request, response, next) => {
    try {
      const document = await documents.get(request.params.documentId);
      if (!document) {
        return response.status(404).json({ error: "No se encontró el documento." });
      }
      const page = parsePage(request.params.page);
      const sourceText = readText(request.body?.sourceText, MAX_TEXT_LENGTH);
      const key = cache.keyFor(`${process.env.TRANSLATION_PROVIDER ?? "libretranslate"}\n${sourceText}`);
      if (!request.body?.force) {
        const cached = await cache.get(document.id, "translation", page, key);
        if (cached) {
          return response.json({ ...cached, cached: true });
        }
      }
      const translatedText = await translator.translate(sourceText);
      const result = {
        translatedText,
        cached: false,
        updatedAt: new Date().toISOString(),
      };
      await cache.set(document.id, "translation", page, key, result);
      return response.json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.post("/:documentId/pages/:page/ocr", async (request, response, next) => {
    try {
      const document = await documents.get(request.params.documentId);
      if (!document) {
        return response.status(404).json({ error: "No se encontró el documento." });
      }
      const page = parsePage(request.params.page);
      const text = readText(request.body?.text, 50_000);
      const result = { text, updatedAt: new Date().toISOString() };
      await cache.set(document.id, "ocr", page, "latest", result);
      return response.json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.get("/:documentId/pages/:page/edits", async (request, response, next) => {
    try {
      const document = await documents.get(request.params.documentId);
      if (!document) {
        return response.status(404).json({ error: "No se encontró el documento." });
      }
      const page = parsePage(request.params.page);
      const [original, spanish] = await Promise.all([
        cache.get(document.id, "reading-edits", page, "original"),
        cache.get(document.id, "reading-edits", page, "spanish"),
      ]);
      return response.json({
        original: original?.edits ?? [],
        spanish: spanish?.edits ?? [],
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/:documentId/pages/:page/edits", async (request, response, next) => {
    try {
      const document = await documents.get(request.params.documentId);
      if (!document) {
        return response.status(404).json({ error: "No se encontró el documento." });
      }
      const page = parsePage(request.params.page);
      const edit = readReadingEdit(request.body);
      const saved = (await cache.get(document.id, "reading-edits", page, edit.variant)) ?? {
        edits: [],
      };
      if (saved.edits.length >= 500) {
        const error = new Error("Esta página ya tiene el máximo de 500 cambios guardados.");
        error.status = 409;
        throw error;
      }
      if (
        saved.edits.some(
          (item) =>
            item.baseHash === edit.baseHash &&
            edit.start < item.end &&
            edit.end > item.start,
        )
      ) {
        const error = new Error("Este fragmento se solapa con otro cambio. Deshazlo antes de añadir uno en la misma zona.");
        error.status = 409;
        throw error;
      }
      const entry = { ...edit, id: randomUUID(), createdAt: new Date().toISOString() };
      const edits = [...saved.edits, entry];
      await cache.set(document.id, "reading-edits", page, edit.variant, { edits });
      const index =
        (await cache.get(document.id, "reading-edits", 0, "index")) ?? {
          original: [],
          spanish: [],
        };
      const pages = new Set(index[edit.variant] ?? []);
      pages.add(page);
      index[edit.variant] = [...pages].sort((left, right) => left - right);
      await cache.set(document.id, "reading-edits", 0, "index", index);
      return response.status(201).json(entry);
    } catch (error) {
      return next(error);
    }
  });

  router.delete("/:documentId/pages/:page/edits/:editId", async (request, response, next) => {
    try {
      const document = await documents.get(request.params.documentId);
      if (!document) {
        return response.status(404).json({ error: "No se encontró el documento." });
      }
      const page = parsePage(request.params.page);
      const variant = readVariant(request.query.variant);
      const saved = await cache.get(document.id, "reading-edits", page, variant);
      const edits = saved?.edits ?? [];
      const remaining = edits.filter((edit) => edit.id !== request.params.editId);
      if (remaining.length === edits.length) {
        return response.status(404).json({ error: "No se encontró el cambio guardado." });
      }
      if (remaining.length) {
        await cache.set(document.id, "reading-edits", page, variant, { edits: remaining });
      } else {
        await cache.removeKey(document.id, "reading-edits", page, variant);
      }
      const index =
        (await cache.get(document.id, "reading-edits", 0, "index")) ?? {
          original: [],
          spanish: [],
        };
      if (!remaining.length) {
        index[variant] = (index[variant] ?? []).filter((savedPage) => savedPage !== page);
      }
      if (!index.original.length && !index.spanish.length) {
        await cache.removeKey(document.id, "reading-edits", 0, "index");
      } else {
        await cache.set(document.id, "reading-edits", 0, "index", index);
      }
      return response.status(204).end();
    } catch (error) {
      return next(error);
    }
  });

  router.delete("/:documentId", async (request, response, next) => {
    try {
      const removed = await documents.remove(request.params.documentId);
      if (!removed) {
        return response.status(404).json({ error: "No se encontró el documento." });
      }
      await cache.removeDocument(request.params.documentId);
      return response.status(204).end();
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

function parsePage(value) {
  const page = Number(value);
  if (!Number.isSafeInteger(page) || page < 1 || page > 10_000) {
    const error = new Error("El número de página no es válido.");
    error.status = 400;
    throw error;
  }
  return page;
}

function readText(value, maxLength) {
  if (typeof value !== "string" || !value.trim() || value.length > maxLength) {
    const error = new Error("El texto está vacío o supera el límite permitido.");
    error.status = 400;
    throw error;
  }
  return value;
}

function readVariant(value) {
  if (value !== "original" && value !== "spanish") {
    const error = new Error("La lectura debe ser original o española.");
    error.status = 400;
    throw error;
  }
  return value;
}

function readDocumentId(value) {
  if (typeof value !== "string" || !/^[0-9a-f-]{36}$/i.test(value)) {
    const error = new Error("El documento original no es válido.");
    error.status = 400;
    throw error;
  }
  return value;
}

function readModifiedPages(value) {
  if (typeof value !== "string") {
    const error = new Error("La lista de páginas modificadas no es válida.");
    error.status = 400;
    throw error;
  }
  let pages;
  try {
    pages = JSON.parse(value);
  } catch {
    const error = new Error("La lista de páginas modificadas no es válida.");
    error.status = 400;
    throw error;
  }
  if (
    !Array.isArray(pages) ||
    !pages.length ||
    pages.length > 10_000 ||
    pages.some((page) => !Number.isSafeInteger(page) || page < 1 || page > 10_000)
  ) {
    const error = new Error("La lista de páginas modificadas no es válida.");
    error.status = 400;
    throw error;
  }
  return [...new Set(pages)].sort((left, right) => left - right);
}

function readReadingEdit(value) {
  const variant = readVariant(value?.variant);
  const mode = value?.mode;
  if (mode !== "replace" && mode !== "below") {
    const error = new Error("El cambio debe sustituir el texto o añadirse debajo.");
    error.status = 400;
    throw error;
  }
  const sourceText = readText(value?.sourceText, 10_000);
  const translatedText = readText(value?.translatedText, 10_000);
  const start = value?.start;
  const end = value?.end;
  const occurrence = value?.occurrence;
  if (
    !Number.isSafeInteger(start) ||
    start < 0 ||
    !Number.isSafeInteger(end) ||
    end <= start ||
    end > MAX_TEXT_LENGTH ||
    end - start > 20_000 ||
    typeof value?.baseHash !== "string" ||
    !/^[0-9a-f]{8}$/i.test(value.baseHash) ||
    (occurrence !== undefined &&
      (!Number.isSafeInteger(occurrence) || occurrence < 0 || occurrence > MAX_TEXT_LENGTH))
  ) {
    const error = new Error("La posición del texto seleccionado no es válida.");
    error.status = 400;
    throw error;
  }
  return {
    variant,
    mode,
    sourceText,
    translatedText,
    start,
    end,
    baseHash: value.baseHash,
    occurrence,
  };
}
