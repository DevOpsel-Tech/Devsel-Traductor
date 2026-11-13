export const defaultEndpoint = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
export const defaultModel = "gemini-3.5-flash-lite";

export function validateConnection(endpoint, model) {
  let url;
  try { url = new URL(endpoint); } catch { throw new Error("Introduce una dirección de API válida."); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error("La dirección debe usar HTTPS y no incluir credenciales ni parámetros.");
  if (!model.trim()) throw new Error("Introduce el identificador del modelo.");
  return url.href;
}

export const languages = Object.freeze({
  es: "Spanish", en: "English", fr: "French", de: "German", it: "Italian",
  pt: "Portuguese", ca: "Catalan", eu: "Basque", gl: "Galician",
  ar: "Arabic", zh: "Chinese", ja: "Japanese", ko: "Korean",
});

export async function translateWithOpenRouter(text, apiKey, fetchImpl = fetch, endpoint = defaultEndpoint, model = defaultModel, target = "es") {
  if (!Object.hasOwn(languages, target)) throw new Error("El idioma de destino no es válido.");
  return requestCompletion(text, apiKey, fetchImpl, endpoint, model, `Detect the language of the text and translate it into ${languages[target]}. Return only the translation.`);
}

export async function detectSourceLanguage(text, apiKey, fetchImpl = fetch, endpoint = defaultEndpoint, model = defaultModel) {
  const instruction = "Identify the dominant language in the user's text itself. Do not infer it from the app language, this instruction, or any translation target; classify only the vocabulary and grammar in the text. If it is English, reply en. Reply only with a two-letter ISO 639-1 language code, or und if uncertain.";
  const response = await requestCompletion(text, apiKey, fetchImpl, endpoint, model, instruction);
  const code = response.trim().toLowerCase();
  return Object.hasOwn(languages, code) ? code : null;
}

async function requestCompletion(text, apiKey, fetchImpl, endpoint, model, instruction) {
  const key = apiKey.trim();
  if (!key) throw new Error("Introduce tu clave en Conectar API.");
  const url = validateConnection(endpoint, model);
  const isOpenRouter = new URL(url).hostname === "openrouter.ai";
  let response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model.trim(),
        messages: [
          { role: "system", content: instruction },
          { role: "user", content: text },
        ],
      }),
      signal: AbortSignal.timeout(60000),
    });
  } catch (error) {
    if (error.name === "TimeoutError") throw new Error("La conexión con la API ha tardado demasiado. Inténtalo de nuevo.");
    throw new Error("No se pudo conectar con la API. Comprueba la dirección, la conexión y que el proveedor permita peticiones desde la aplicación.");
  }
  if (!response.ok) {
    if (response.status === 429) {
      let data;
      try { data = await response.json(); } catch { /* OpenRouter may return no JSON details. */ }
      const metadata = data?.error?.metadata;
      const source = metadata?.limit_source;
      const headers = metadata?.headers ?? {};
      const reset = Number(headers["X-RateLimit-Reset"] ?? headers["x-ratelimit-reset"]);
      const seconds = Number.isFinite(reset) && reset > Date.now()
        ? Math.ceil((reset - Date.now()) / 1000)
        : null;
      if (isOpenRouter && source === "openrouter_free_tier_per_minute") {
        throw new Error(seconds
          ? `OpenRouter ha limitado las solicitudes gratuitas. Espera unos ${seconds} segundos.`
          : "OpenRouter ha limitado las solicitudes gratuitas por minuto. Espera un momento.");
      }
      if (isOpenRouter && source === "upstream_provider_shared_pool") {
        throw new Error("El proveedor del modelo gratuito está saturado. Prueba de nuevo más tarde.");
      }
      throw new Error("La API ha aplicado un límite de solicitudes o el modelo está ocupado. Revisa los límites de tu cuenta.");
    }
    const messages = {
      401: "La API no acepta la clave. Comprueba que sea válida para ese proveedor.",
      402: "La API ha rechazado la petición por el límite o saldo de la cuenta.",
      403: "La API ha denegado el acceso. Revisa los permisos y ajustes de la cuenta.",
      404: "Gemini no encuentra el modelo o no está disponible para este proyecto. Comprueba el acceso en Google AI Studio.",
      503: "El modelo no está disponible ahora. Inténtalo más tarde.",
    };
    throw new Error(messages[response.status] ?? `La API devolvió el error HTTP ${response.status}.`);
  }
  let data;
  try { data = await response.json(); } catch { throw new Error("La API devolvió una respuesta no válida."); }
  const translated = data.choices?.[0]?.message?.content;
  if (typeof translated !== "string" || !translated.trim()) throw new Error("La API no devolvió una traducción compatible.");
  return translated.trim();
}
