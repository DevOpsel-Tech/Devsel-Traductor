import { Router } from "express";
import { explainSelection } from "../services/study/explainSelection.js";

export function createSelectionRouter(translator) {
  const router = Router();

  router.post("/translate", async (request, response, next) => {
    try {
      const text = readSelection(request.body?.text);
      const target = readTarget(request.body?.target);
      const source = readSource(request.body?.source);
      const translatedText = await translator.translate(text, target, source);
      return response.json({ translatedText });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/explain", async (request, response, next) => {
    try {
      const text = readSelection(request.body?.text);
      const context = readContext(request.body?.context);
      const translatedText = await translator.translate(text);
      return response.json({
        translatedText,
        explanation: explainSelection(text, context, translatedText),
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

function readTarget(target) {
  if (target === undefined) {
    return "es";
  }
  if (target !== "es" && target !== "en") {
    const error = new Error("El idioma de destino debe ser español o inglés.");
    error.status = 400;
    throw error;
  }
  return target;
}

function readSource(source) {
  if (source === undefined) {
    return "auto";
  }
  if (source !== "auto" && source !== "es" && source !== "en") {
    const error = new Error("El idioma de origen debe ser español, inglés o automático.");
    error.status = 400;
    throw error;
  }
  return source;
}

function readSelection(text) {
  if (typeof text !== "string" || !text.trim() || text.length > 10_000) {
    const error = new Error("Selecciona un texto de hasta 10 000 caracteres.");
    error.status = 400;
    throw error;
  }
  return text;
}

function readContext(context) {
  if (context === undefined) {
    return "";
  }
  if (typeof context !== "string" || context.length > 12_000) {
    const error = new Error("El contexto de la selección es demasiado largo.");
    error.status = 400;
    throw error;
  }
  return context;
}
