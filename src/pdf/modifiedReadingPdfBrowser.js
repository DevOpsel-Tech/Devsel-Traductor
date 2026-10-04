import basicFontUrl from "@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff?url";
import extendedFontUrl from "@fontsource/noto-sans/files/noto-sans-latin-ext-400-normal.woff?url";
import { createModifiedReadingPdf, loadFont } from "./modifiedReadingPdf.js";

export async function createModifiedReadingPdfInBrowser(sourceBytes, modifiedPages) {
  const fonts = await Promise.all([loadFont(basicFontUrl), loadFont(extendedFontUrl)]);
  return createModifiedReadingPdf(sourceBytes, modifiedPages, fonts);
}
