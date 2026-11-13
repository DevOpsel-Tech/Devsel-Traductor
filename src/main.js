import "./styles.css";
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "pdfjs-dist/web/pdf_viewer.css";
import { translateWithOpenRouter, detectSourceLanguage, defaultEndpoint, defaultModel, languages } from "./openrouter.js";
import { deleteDocument, getDocument, listDocuments, saveDocument } from "./documentLibrary.js";
import { groupTextLines, fittingFontSize } from "./pdfLayout.js";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const $ = (s) => document.querySelector(s);
let pdf, pageNumber = 1, zoom = 1, rendering = false, resizePending = false;
let currentDocumentId = null;
let languageVersion = 0;
let detectionVersion = 0;
const translations = new Map();

const status = (m) => { $("#status").textContent = m; };
const action = (fn) => async (...a) => { try { await fn(...a); } catch (e) { status(String(e)); } };

const store = {
  get: (k, fb = null) => { const r = localStorage.getItem(k); if (r === null) return fb; try { return JSON.parse(r); } catch { return fb; } },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
};

const settings = () => {
  const saved = store.get("settings", { apiKey: "" });
  // Never send a key saved for a different provider to Gemini.
  if (saved.endpoint !== defaultEndpoint) return { apiKey: "", endpoint: defaultEndpoint, model: defaultModel };
  return { ...saved, endpoint: defaultEndpoint, model: defaultModel };
};
const saveSettings = (s) => store.set("settings", s);
function updateKeyState() {
  $("#keyState").textContent = settings().apiKey
    ? "Clave guardada; conexión sin verificar."
    : "No hay ninguna clave guardada.";
}
function saveReadingPosition() {
  if (currentDocumentId && pdf) {
    store.set("readingPosition", { id: currentDocumentId, page: pageNumber, zoom, scrollY: window.scrollY, readerScrollTop: $(".reader-area").scrollTop });
  }
}

async function render() {
  if (rendering || !pdf) return;
  rendering = true;
  for (const id of ["prev", "next", "bottomPrev", "bottomNext", "zoomOut", "zoomIn"]) $(`#${id}`).disabled = true;
  try {
  const page = await pdf.getPage(pageNumber);
  const unscaled = page.getViewport({ scale: 1 });
  const reader = $(".reader-area");
  const readerStyle = getComputedStyle(reader);
  const horizontalPadding = parseFloat(readerStyle.paddingLeft) + parseFloat(readerStyle.paddingRight);
  const availableWidth = Math.max(100, reader.clientWidth - horizontalPadding - 28);
  const baseScale = Math.min(1.3, availableWidth / unscaled.width);
  const vp = page.getViewport({ scale: baseScale * zoom });
  const wrapper = $("#pdfPage");
  wrapper.style.width = `${vp.width}px`; wrapper.style.height = `${vp.height}px`;
  wrapper.style.setProperty("--scale-factor", vp.scale);
  $("#text").replaceChildren(); $("#lineControls").replaceChildren(); $("#translationOverlays").replaceChildren();
  wrapper.hidden = false;
  const canvas = $("#canvas"); canvas.width = Math.ceil(vp.width); canvas.height = Math.ceil(vp.height);
  await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
  const tc = await page.getTextContent();
  await new pdfjs.TextLayer({ textContentSource: tc, container: $("#text"), viewport: vp }).render();
  const pageRect = wrapper.getBoundingClientRect();
  const parts = [];
  for (const span of $("#text").querySelectorAll("span")) {
    if (!span.textContent.trim()) continue;
    const rect = span.getBoundingClientRect();
    if (!rect.width || !rect.height) continue;
    parts.push({ text: span.textContent, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height });
  }
  const lines = groupTextLines(parts, pageRect.width);
  for (const [index, line] of lines.entries()) {
    createLineControl(line.text, `${pageNumber}:${index}`, {
      left: line.left - pageRect.left, top: line.top - pageRect.top,
      width: line.right - line.left, height: line.bottom - line.top,
    });
  }
  if (!lines.length) status("Esta página no contiene texto seleccionable; necesita OCR.");
  $("#page").textContent = `${pageNumber} / ${pdf.numPages}`;
  $("#bottomPage").textContent = `${pageNumber} / ${pdf.numPages}`;
  $("#zoomLevel").textContent = `${Math.round(zoom * 100)} %`;
  saveReadingPosition();
  return lines.length > 0;
  } finally {
    rendering = false;
    for (const id of ["prev", "next", "bottomPrev", "bottomNext", "zoomOut", "zoomIn"]) $(`#${id}`).disabled = false;
    if (resizePending && pdf) { resizePending = false; void render().catch((error) => status(String(error))); }
  }
}

async function openDocument(name, bytes, save, id = null, position = null) {
  const loaded = await pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise;
  if (save) {
    try { id = await saveDocument(name, bytes); }
    catch (error) { await loaded.destroy(); throw new Error("No se pudo guardar el PDF en este dispositivo: " + error.message); }
  }
  if (pdf) await pdf.destroy();
  pdf = loaded;
  translations.clear();
  currentDocumentId = id;
  pageNumber = Number.isSafeInteger(position?.page) ? Math.max(1, Math.min(position.page, pdf.numPages)) : 1;
  if (Number.isFinite(position?.zoom)) zoom = Math.max(.5, Math.min(2.5, position.zoom));
  const hasText = await render();
  $("#openPdf").hidden = true;
  $("#currentPdf").hidden = false;
  $("#zoomControls").hidden = false;
  $("#bottomNavigation").hidden = false;
  $("#readerHelp").hidden = false;
  $("#libraryMenu").open = false;
  if (hasText) status(`Cargado: ${name}`);
  void detectDocumentLanguage(loaded);
  if (position) requestAnimationFrame(() => {
    $(".reader-area").scrollTop = Math.max(0, Number(position.readerScrollTop) || 0);
    window.scrollTo(0, Math.max(0, Number(position.scrollY) || 0));
    saveReadingPosition();
  });
}

async function refreshLibrary() {
  const documents = await listDocuments();
  const list = $("#documentList");
  list.replaceChildren();
  if (!documents.length) { list.textContent = "Todavía no hay PDF guardados."; return; }
  for (const doc of documents) {
    const row = document.createElement("div");
    row.className = "document-row";
    const button = document.createElement("button");
    button.type = "button"; button.textContent = doc.name;
    button.addEventListener("click", action(async () => {
      const saved = await getDocument(doc.id);
      if (!saved) throw new Error("No se encontró el PDF guardado.");
      await openDocument(saved.name, saved.bytes, false, saved.id);
    }));
    const remove = document.createElement("button");
    remove.type = "button"; remove.className = "delete-document"; remove.textContent = "Eliminar";
    remove.setAttribute("aria-label", `Eliminar ${doc.name}`);
    remove.addEventListener("click", action(async () => {
      if (!window.confirm(`¿Eliminar «${doc.name}» de los PDF guardados?`)) return;
      await deleteDocument(doc.id);
      if (currentDocumentId === doc.id) { currentDocumentId = null; localStorage.removeItem("readingPosition"); }
      await refreshLibrary();
      status("PDF eliminado de la biblioteca.");
    }));
    row.append(button, remove);
    list.append(row);
  }
}

$("#file").addEventListener("change", action(async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try {
    if (f.size > 50 * 1024 * 1024) throw new Error("El PDF supera 50 MiB.");
    await openDocument(f.name, await f.arrayBuffer(), true);
    await refreshLibrary();
  } finally { e.target.value = ""; }
}));

$("#closePdf").addEventListener("click", action(async () => {
  detectionVersion++;
  $("#sourceLanguage").textContent = "Origen: pendiente";
  translations.clear();
  currentDocumentId = null;
  localStorage.removeItem("readingPosition");
  const current = pdf; pdf = null;
  if (current) await current.destroy();
  $("#text").replaceChildren(); $("#lineControls").replaceChildren(); $("#translationOverlays").replaceChildren(); $("#pdfPage").hidden = true;
  $("#canvas").width = 0; $("#canvas").height = 0;
  $("#page").textContent = "0 / 0";
  $("#currentPdf").hidden = true; $("#openPdf").hidden = false;
  $("#zoomControls").hidden = true;
  $("#bottomNavigation").hidden = true;
  $("#readerHelp").hidden = true;
  status("PDF cerrado. Puedes abrir otro o elegir uno guardado.");
}));

async function detectDocumentLanguage(document) {
  const version = ++detectionVersion;
  const { apiKey, endpoint = defaultEndpoint, model = defaultModel } = settings();
  const label = $("#sourceLanguage");
  if (!apiKey) { label.textContent = "Origen: conecta una API"; return; }
  label.textContent = "Origen: detectando…";
  try {
    let sample = "";
    const pageCount = document.numPages;
    const samplePages = [...new Set([1, Math.ceil(pageCount / 2), pageCount])];
    for (const number of samplePages) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      sample += "\n" + content.items.map((item) => item.str ?? "").join(" ");
    }
    sample = sample.replace(/\s+/g, " ").trim().slice(0, 3000);
    if (sample.length < 40) {
      if (version === detectionVersion) label.textContent = "Origen: texto insuficiente";
      return;
    }
    const code = await detectSourceLanguage(sample, apiKey, fetch, endpoint, model);
    if (version !== detectionVersion || pdf !== document) return;
    const option = code && $("#targetLanguage").querySelector(`option[value="${code}"]`);
    label.textContent = option ? `Origen: ${option.textContent} (estimado)` : "Origen: no identificado";
  } catch {
    if (version === detectionVersion && pdf === document) label.textContent = "Origen: no disponible";
  }
}
$("#prev").addEventListener("click", action(async () => { if (pdf && pageNumber > 1) { pageNumber--; await render(); } }));
$("#next").addEventListener("click", action(async () => { if (pdf && pageNumber < pdf.numPages) { pageNumber++; await render(); } }));
$("#bottomPrev").addEventListener("click", action(async () => { if (pdf && !rendering && pageNumber > 1) { pageNumber--; await render(); } }));
$("#bottomNext").addEventListener("click", action(async () => { if (pdf && !rendering && pageNumber < pdf.numPages) { pageNumber++; await render(); } }));
$("#zoomOut").addEventListener("click", action(async () => {
  if (pdf && !rendering) { zoom = Math.max(.5, Math.round((zoom - .1) * 10) / 10); await render(); }
}));
$("#zoomIn").addEventListener("click", action(async () => {
  if (pdf && !rendering) { zoom = Math.min(2.5, Math.round((zoom + .1) * 10) / 10); await render(); }
}));

function createLineControl(text, key, box) {
  const button = document.createElement("button"); button.type = "button"; button.className = "translation-line-button";
  button.textContent = "文"; button.title = "Traducir línea"; button.setAttribute("aria-label", `Traducir línea: ${text}`);
  button.setAttribute("aria-pressed", "false");
  button.style.top = `${box.top + box.height / 2}px`;
  button.style.left = `${Math.min(box.left + box.width + 4, $("#pdfPage").clientWidth + 4)}px`;
  const result = document.createElement("div"); result.className = "translation-overlay"; result.setAttribute("role", "status"); result.hidden = true;
  result.addEventListener("click", () => status(result.textContent));
  Object.assign(result.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` });
  const existing = translations.get(key);
  if (existing) { showOverlayText(result, existing, box); button.classList.add("translated"); button.setAttribute("aria-pressed", "true"); }
  let request = 0;
  button.addEventListener("click", action(async () => {
    if (!result.hidden || button.getAttribute("aria-busy") === "true") {
      request++; result.hidden = true; translations.delete(key); button.classList.remove("translated"); button.setAttribute("aria-pressed", "false"); button.removeAttribute("aria-busy");
      return;
    }
    const { apiKey, endpoint = defaultEndpoint, model = defaultModel } = settings();
    if (!apiKey) throw new Error("Pon tu API key en 'Conectar API'.");
    const current = ++request;
    const currentLanguage = languageVersion;
    button.setAttribute("aria-busy", "true");
    try {
      const translated = await translateWithOpenRouter(text, apiKey, fetch, endpoint, model, $("#targetLanguage").value);
      if (current !== request || currentLanguage !== languageVersion || !button.isConnected) return;
      showOverlayText(result, translated, box); translations.set(key, translated); button.classList.add("translated"); button.setAttribute("aria-pressed", "true");
    } catch (error) {
      if (current === request && button.isConnected) { result.hidden = true; button.classList.remove("translated"); }
      throw error;
    } finally {
      if (current === request) button.removeAttribute("aria-busy");
    }
  }));
  $("#lineControls").append(button);
  $("#translationOverlays").append(result);
}

function showOverlayText(element, text, box) {
  const initial = Math.max(7, box.height * .85);
  const context = document.createElement("canvas").getContext("2d");
  if (context) context.font = `${initial}px sans-serif`;
  const size = fittingFontSize(context?.measureText(text).width ?? box.width, box.width, initial);
  element.style.fontSize = `${size}px`;
  element.textContent = text;
  element.title = text;
  element.hidden = false;
}

$("#text").addEventListener("click", action(async (event) => {
  if (window.getSelection().toString().trim()) return;
  const caret = document.caretPositionFromPoint?.(event.clientX, event.clientY);
  const range = caret ? null : document.caretRangeFromPoint?.(event.clientX, event.clientY);
  const node = caret?.offsetNode ?? range?.startContainer, offset = caret?.offset ?? range?.startOffset;
  if (!node || node.nodeType !== Node.TEXT_NODE || !$("#text").contains(node)) return;
  const word = [...new Intl.Segmenter("en", { granularity: "word" }).segment(node.textContent)]
    .find((segment) => segment.isWordLike && offset >= segment.index && offset < segment.index + segment.segment.length);
  if (!word) return;
  const { apiKey, endpoint = defaultEndpoint, model = defaultModel } = settings();
  if (!apiKey) throw new Error("Pon tu API key en 'Conectar API'.");
  const wordRange = document.createRange(); wordRange.setStart(node, word.index); wordRange.setEnd(node, word.index + word.segment.length);
  const rect = wordRange.getBoundingClientRect(), pageRect = $("#pdfPage").getBoundingClientRect();
  const result = document.createElement("button"); result.type = "button"; result.className = "translation-overlay word-overlay";
  const box = { left: rect.left - pageRect.left, top: rect.top - pageRect.top, width: rect.width, height: rect.height };
  Object.assign(result.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` });
  result.hidden = true; result.setAttribute("aria-label", "Ocultar traducción y mostrar el original");
  result.addEventListener("click", () => result.remove());
  $("#translationOverlays").append(result);
  const currentLanguage = languageVersion;
  try {
    const translated = await translateWithOpenRouter(word.segment, apiKey, fetch, endpoint, model, $("#targetLanguage").value);
    if (result.isConnected && currentLanguage === languageVersion) {
      showOverlayText(result, translated, box);
      status(`Traducción: ${translated}`);
    }
  } catch (error) {
    result.remove();
    throw error;
  }
}));

$("#targetLanguage").addEventListener("change", action(async () => {
  const target = $("#targetLanguage").value;
  if (!Object.hasOwn(languages, target)) return;
  store.set("targetLanguage", target);
  languageVersion++;
  translations.clear();
  $("#translationOverlays").replaceChildren();
  if (pdf && !rendering) await render();
  status("Idioma de destino actualizado.");
}));

$("#settings").addEventListener("click", action(async () => {
  const apiKey = $("#key").value.trim();
  if (!apiKey) throw new Error("Introduce una clave antes de guardarla.");
  saveSettings({ apiKey, endpoint: defaultEndpoint, model: defaultModel });
  $("#key").value = apiKey;
  updateKeyState();
  status("Clave guardada. La conexión todavía no se ha comprobado.");
  $("#settings").closest("details").open = false;
  if (pdf) void detectDocumentLanguage(pdf);
}));

$("#testKey").addEventListener("click", async () => {
  const button = $("#testKey");
  const apiKey = $("#key").value.trim();
  if (!apiKey) { $("#keyState").textContent = "Introduce una clave para probarla."; return; }
  button.disabled = true;
  $("#keyState").textContent = "Comprobando la conexión…";
  try {
    await translateWithOpenRouter("hello", apiKey);
    if ($("#key").value.trim() === apiKey) $("#keyState").textContent = "Conexión con Gemini correcta.";
  } catch (error) {
    if ($("#key").value.trim() === apiKey) $("#keyState").textContent = error.message;
  } finally { button.disabled = false; }
});

$("#clearKey").addEventListener("click", action(async () => {
  saveSettings({ ...settings(), apiKey: "" });
  detectionVersion++;
  $("#sourceLanguage").textContent = pdf ? "Origen: conecta una API" : "Origen: pendiente";
  $("#key").value = "";
  updateKeyState();
  $("#key").focus();
  status("Clave eliminada. Puedes introducir otra.");
}));

// init
const s = settings();
const savedTarget = store.get("targetLanguage", "es");
$("#targetLanguage").value = Object.hasOwn(languages, savedTarget) ? savedTarget : "es";
$("#key").value = s.apiKey;
updateKeyState();
status("Listo. Abre un PDF.");
window.addEventListener("scroll", saveReadingPosition, { passive: true });
let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (!pdf) return;
    if (rendering) { resizePending = true; return; }
    void render().catch((error) => status(String(error)));
  }, 200);
});
$(".reader-area").addEventListener("scroll", saveReadingPosition, { passive: true });
async function restoreReading() {
  await refreshLibrary();
  const position = store.get("readingPosition");
  if (!position?.id) return;
  const saved = await getDocument(position.id);
  if (!saved) { localStorage.removeItem("readingPosition"); return; }
  await openDocument(saved.name, saved.bytes, false, saved.id, position);
}
restoreReading().catch(() => status("No se pudo restaurar el PDF guardado."));
