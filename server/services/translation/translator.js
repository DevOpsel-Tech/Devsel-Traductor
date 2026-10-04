import { libreTranslate } from "./libreTranslate.js";

export function createTranslator() {
  const providers = new Map([["libretranslate", libreTranslate]]);

  return {
    async translate(text, target = "es", source = "auto") {
      const providerName = (process.env.TRANSLATION_PROVIDER ?? "libretranslate").toLowerCase();
      const provider = providers.get(providerName);
      if (!provider) {
        const error = new Error(`Proveedor de traducción no admitido: ${providerName}.`);
        error.status = 500;
        throw error;
      }
      return provider(text, target, source);
    },
  };
}
