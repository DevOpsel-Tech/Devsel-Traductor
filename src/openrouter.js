export const defaultEndpoint = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
export const defaultModel = "gemini-3.5-flash-lite";
export const providers = Object.freeze({
  gemini: { name: "Gemini", endpoint: defaultEndpoint, model: defaultModel },
  openai: { name: "OpenAI", endpoint: "https://api.openai.com/v1/chat/completions", model: "gpt-5.4-mini" },
  anthropic: { name: "Claude", endpoint: "https://api.anthropic.com/v1/messages", model: "claude-haiku-4-5" },
  openrouter: { name: "OpenRouter", endpoint: "https://openrouter.ai/api/v1/chat/completions", model: "openrouter/free" },
  deepseek: { name: "DeepSeek", endpoint: "https://api.deepseek.com/chat/completions", model: "deepseek-flash" },
  mistral: { name: "Mistral", endpoint: "https://api.mistral.ai/v1/chat/completions", model: "mistral-small-latest" },
  groq: { name: "Groq", endpoint: "https://api.groq.com/openai/v1/chat/completions", model: "openai/gpt-oss-120b" },
});

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
  const isClaude = url === providers.anthropic.endpoint;
  let response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: isClaude ? { "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true", "Content-Type": "application/json" } : { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(isClaude ? { model: model.trim(), max_tokens: 1024, system: instruction, messages: [{ role: "user", content: text }] } : {
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
      404: "El proveedor no encuentra el modelo o no está disponible para esta cuenta.",
      503: "El modelo no está disponible ahora. Inténtalo más tarde.",
    };
    throw new Error(messages[response.status] ?? `La API devolvió el error HTTP ${response.status}.`);
  }
  let data;
  try { data = await response.json(); } catch { throw new Error("La API devolvió una respuesta no válida."); }
  const translated = isClaude ? (Array.isArray(data.content) ? data.content.filter((item) => item.type === "text" && typeof item.text === "string").map((item) => item.text).join("\n") : null) : data.choices?.[0]?.message?.content;
  if (typeof translated !== "string" || !translated.trim()) throw new Error("La API no devolvió una traducción compatible.");
  return translated.trim();
}
