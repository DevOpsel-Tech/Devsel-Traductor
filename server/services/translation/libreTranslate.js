export async function libreTranslate(text, target = "es", source = "auto") {
  const endpoint = process.env.LIBRETRANSLATE_URL ?? "http://127.0.0.1:5000/translate";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    let response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.LIBRETRANSLATE_API_KEY
            ? { "X-API-Key": process.env.LIBRETRANSLATE_API_KEY }
            : {}),
        },
        body: JSON.stringify({
          q: text,
          source,
          target,
          format: "text",
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error.name === "AbortError") {
        const timeoutError = new Error("La traducción agotó el tiempo de espera.");
        timeoutError.status = 504;
        throw timeoutError;
      }
      const unavailable = new Error(
        "No se pudo conectar con LibreTranslate. Comprueba que el servicio local esté iniciado.",
      );
      unavailable.status = 503;
      throw unavailable;
    }
    if (!response.ok) {
      const error = new Error(`LibreTranslate respondió con HTTP ${response.status}.`);
      error.status = 502;
      throw error;
    }
    let result;
    try {
      result = await response.json();
    } catch {
      const error = new Error("LibreTranslate devolvió una respuesta que no es JSON válida.");
      error.status = 502;
      throw error;
    }
    if (typeof result.translatedText !== "string" || !result.translatedText.trim()) {
      const error = new Error("LibreTranslate devolvió una respuesta sin traducción.");
      error.status = 502;
      throw error;
    }
    return result.translatedText;
  } finally {
    clearTimeout(timeout);
  }
}
