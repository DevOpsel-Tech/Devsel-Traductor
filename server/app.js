import { fileURLToPath } from "node:url";
import path from "node:path";
import { createDocumentRouter } from "./routes/documents.js";
import { createSelectionRouter } from "./routes/selections.js";
import { createDocumentStore } from "./services/documentStore.js";
import { createFileCache } from "./services/fileCache.js";
import { createTranslator } from "./services/translation/translator.js";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function createApp(express) {
  const app = express();
  const dataDirectory = path.join(rootDirectory, "data");
  const documentStore = createDocumentStore(path.join(dataDirectory, "documents"));
  const cache = createFileCache(path.join(dataDirectory, "cache"));
  const translator = createTranslator();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.use("/api/documents", createDocumentRouter(documentStore, cache, translator));
  app.use("/api/selections", createSelectionRouter(translator));

  if (process.env.NODE_ENV === "production") {
    const clientDirectory = path.join(rootDirectory, "dist");
    app.use(express.static(clientDirectory));
    app.get("*path", (_request, response) => {
      response.sendFile(path.join(clientDirectory, "index.html"));
    });
  }

  app.use((error, _request, response, _next) => {
    if (error?.code === "LIMIT_FILE_SIZE") {
      return response.status(413).json({ error: "El PDF supera el límite de 50 MB." });
    }
    if (error?.name === "MulterError") {
      return response.status(400).json({ error: error.message });
    }
    console.error(error);
    return response.status(error.status ?? 500).json({
      error: error.status ? error.message : "Error interno del servidor.",
    });
  });

  return app;
}
