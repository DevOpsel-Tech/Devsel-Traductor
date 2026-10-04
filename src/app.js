import {
  getPageData,
  getPageReadingEdits,
  listDocuments,
  listModifiedReadings,
  deleteDocument,
  saveModifiedPdf,
  addPageReadingEdit,
  deletePageReadingEdit,
  saveOcr,
  explainSelection,
  translatePage as requestPageTranslation,
  translateSelection,
  uploadDocument,
} from "./api/client.js";
import {
  applyReadingEdits,
  countSelectionOccurrences,
  findSelectionRange,
  hasOverlappingEdit,
  textFingerprint,
} from "./reading/readingEdits.js";
import { classifyPage } from "./classification/classifyContent.js";
import { correctTranslation } from "./classification/correctTranslation.js";
import { renderPdfTextEdits } from "./pdf/pdfTextEdits.js";
import {
  addVocabulary,
  listVocabulary,
  removeVocabulary,
} from "./study/vocabularyStore.js";
import { renderShell } from "./ui/shell.js";
import {
  renderEmptyPage,
  renderOcrSuggestion,
  renderScannedPrompt,
  renderTranslation,
} from "./ui/translationRenderer.js";

const $ = (selector) => document.querySelector(selector);
const PANEL_WIDTH_KEY = "folio-translation-panel-width-v1";
const PANEL_RESIZER_WIDTH = 12;
const MIN_PANEL_WIDTH = 320;

export function startApp() {
  renderShell($("#app"));

  const state = {
    document: null,
    pageSources: new Map(),
    ocr: new Map(),
    translations: new Map(),
    pageRequest: 0,
    selection: "",
    selectionPage: 1,
    selectionPrefix: "",
    selectionVariant: "original",
    pageDisplay: null,
    selectionDisplay: null,
    translationZoom: 1,
    translationMatches: [],
    translationMatchIndex: -1,
    selectionRange: null,
    selectionInTranslation: false,
    pageReadingEdits: new Map(),
    pdfZoomBaseScale: 0,
    pdfZoomFactor: 1,
  };
  const elements = {
    container: $("#viewerContainer"),
    viewer: $("#viewer"),
    translation: $("#translationContent"),
  };

  let reader;
  let floatingDialogOrder = 50;

  wirePanelResizer();
  wireDocumentControls();
  wireLibrary();
  wireViewerControls();
  wireTranslationTools();
  wireSelectionMenu();
  wireReadingEditActions();
  wireDialogDragging();
  wireVocabulary();
  wireResponsiveTabs();
  const translationStatus = $("#translationStatus");
  new MutationObserver(() => {
    translationStatus.title = translationStatus.textContent;
  }).observe(translationStatus, { childList: true, characterData: true, subtree: true });

  function setReaderEnabled(enabled) {
    for (const id of [
      "previousPageButton",
      "nextPageButton",
      "pageInput",
      "zoomOutButton",
      "zoomValueButton",
      "zoomInButton",
      "fitPageButton",
      "rotateButton",
      "toggleSearchButton",
      "downloadButton",
      "printButton",
      "fullscreenButton",
      "translatePageButton",
      "translationZoomOutButton",
      "translationZoomValueButton",
      "translationZoomInButton",
      "translationSearchButton",
      "translationDownloadButton",
      "translationFullscreenButton",
    ]) {
      $(`#${id}`).disabled = !enabled;
    }
  }

  function renderPdfReadingEdits(page) {
    const pageElement = elements.viewer.querySelector(
      `.page[data-page-number="${page}"]`,
    );
    const sourceText = state.pageSources.get(page);
    if (!pageElement || !sourceText || !state.pageReadingEdits.has(page)) {
      return { applied: 0, missing: 0 };
    }
    const baseText = classifyPage(
      combinePageText(sourceText, state.ocr.get(page) ?? ""),
    ).originalText;
    const edits = state.pageReadingEdits.get(page)?.original ?? [];
    return renderPdfTextEdits(pageElement, baseText, edits);
  }

  function wirePanelResizer() {
    const main = $("#readerMain");
    const resizer = $("#panelResizer");
    const desktop = window.matchMedia("(min-width: 768px)");
    let ratio = 0.42;

    try {
      const savedRatio = Number(localStorage.getItem(PANEL_WIDTH_KEY));
      if (Number.isFinite(savedRatio) && savedRatio > 0 && savedRatio < 1) {
        ratio = savedRatio;
      }
    } catch {
      // Resizing remains available when browser storage is disabled.
    }

    const availableWidth = () => main.getBoundingClientRect().width;
    const clampRatio = (value) => {
      const width = availableWidth();
      const minimumRatio = MIN_PANEL_WIDTH / width;
      const maximumRatio = (width - MIN_PANEL_WIDTH - PANEL_RESIZER_WIDTH) / width;
      return Math.min(maximumRatio, Math.max(minimumRatio, value));
    };
    const updateResizer = () => {
      if (!desktop.matches) {
        return;
      }
      ratio = clampRatio(ratio);
      main.style.setProperty("--translation-panel-width", `${ratio * 100}%`);
      resizer.setAttribute("aria-valuenow", String(Math.round(ratio * 100)));
      resizer.setAttribute("aria-valuetext", `${Math.round(ratio * 100)} % para la traducción`);
    };
    const saveRatio = () => {
      try {
        localStorage.setItem(PANEL_WIDTH_KEY, String(ratio));
      } catch {
        // Resizing remains available when browser storage is disabled.
      }
    };

    updateResizer();
    resizer.addEventListener("pointerdown", (event) => {
      if (!desktop.matches || event.button !== 0) {
        return;
      }
      event.preventDefault();
      resizer.setPointerCapture(event.pointerId);
      resizer.classList.add("is-dragging");
    });
    resizer.addEventListener("pointermove", (event) => {
      if (!resizer.hasPointerCapture(event.pointerId)) {
        return;
      }
      ratio = clampRatio((event.clientX - main.getBoundingClientRect().left) / availableWidth());
      updateResizer();
    });
    const finishDragging = (event) => {
      if (!resizer.hasPointerCapture(event.pointerId)) {
        return;
      }
      resizer.releasePointerCapture(event.pointerId);
      resizer.classList.remove("is-dragging");
      saveRatio();
    };
    resizer.addEventListener("pointerup", finishDragging);
    resizer.addEventListener("pointercancel", finishDragging);
    resizer.addEventListener("keydown", (event) => {
      if (!desktop.matches) {
        return;
      }
      const step = 24 / availableWidth();
      if (event.key === "ArrowLeft") {
        ratio -= step;
      } else if (event.key === "ArrowRight") {
        ratio += step;
      } else if (event.key === "Home") {
        ratio = MIN_PANEL_WIDTH / availableWidth();
      } else if (event.key === "End") {
        ratio = (availableWidth() - MIN_PANEL_WIDTH - PANEL_RESIZER_WIDTH) / availableWidth();
      } else {
        return;
      }
      event.preventDefault();
      updateResizer();
      saveRatio();
    });
    window.addEventListener("resize", updateResizer);
  }

  function addOcrRerunAction(page) {
    const action = document.createElement("button");
    action.type = "button";
    action.className = "mb-5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50";
    action.textContent = "Volver a ejecutar OCR";
    action.addEventListener("click", async () => {
      action.disabled = true;
      action.textContent = "Ejecutando OCR…";
      try {
        const { recognizePage } = await import("./ocr/ocrClient.js");
        const text = await recognizePage(reader.document, page);
        await saveOcr(state.document.id, page, text);
        state.ocr.set(page, text);
        state.translations.delete(page);
        state.currentPageContent = null;
        await handlePageChange(page);
        showToast("OCR actualizado.");
      } catch (error) {
        action.disabled = false;
        action.textContent = "Volver a ejecutar OCR";
        showToast(error.message);
      }
    });
    elements.translation.prepend(action);
  }

  function wireTranslationTools() {
    const content = elements.translation;
    const zoomStep = 0.1;
    const updateZoom = () => {
      content.style.zoom = String(state.translationZoom);
      $("#translationZoomValueButton").textContent = `${Math.round(state.translationZoom * 100)}%`;
      $("#translationZoomOutButton").disabled = !state.document || state.translationZoom <= 0.6;
      $("#translationZoomInButton").disabled = !state.document || state.translationZoom >= 2;
      $("#translationZoomValueButton").disabled = !state.document;
    };
    $("#translationZoomOutButton").addEventListener("click", () => {
      state.translationZoom = Math.max(0.6, Math.round((state.translationZoom - zoomStep) * 10) / 10);
      updateZoom();
    });
    $("#translationZoomInButton").addEventListener("click", () => {
      state.translationZoom = Math.min(2, Math.round((state.translationZoom + zoomStep) * 10) / 10);
      updateZoom();
    });
    $("#translationZoomValueButton").addEventListener("click", () => {
      state.translationZoom = 1;
      updateZoom();
    });

    $("#translationSearchButton").addEventListener("click", () => {
      $("#translationSearchBar").classList.remove("hidden");
      $("#translationSearchInput").focus();
      $("#translationSearchInput").select();
    });
    $("#translationSearchCloseButton").addEventListener("click", closeTranslationSearch);
    $("#translationSearchPreviousButton").addEventListener("click", () => moveTranslationMatch(-1));
    $("#translationSearchNextButton").addEventListener("click", () => moveTranslationMatch(1));
    const scheduleTranslationSearch = debounce((query) => {
      if (!$("#translationSearchBar").classList.contains("hidden")) {
        findInTranslation(query);
      }
    }, 120);
    $("#translationSearchInput").addEventListener("input", (event) => {
      scheduleTranslationSearch(event.currentTarget.value);
    });
    $("#translationSearchInput").addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        moveTranslationMatch(event.shiftKey ? -1 : 1);
      } else if (event.key === "Escape") {
        closeTranslationSearch();
      }
    });

    $("#translationDownloadButton").addEventListener("click", () => {
      if (state.document) {
        reader.download(state.document.name);
      }
    });
    $("#translationFullscreenButton").addEventListener("click", async () => {
      try {
        if (document.fullscreenElement === $("#translationPanel")) {
          await document.exitFullscreen();
        } else {
          await $("#translationPanel").requestFullscreen();
        }
      } catch (error) {
        showToast(`No se pudo activar la pantalla completa: ${error.message}`);
      }
    });
    document.addEventListener("fullscreenchange", () => {
      const active = document.fullscreenElement === $("#translationPanel");
      $("#translationFullscreenButton").textContent = active ? "×" : "⛶";
      $("#translationFullscreenButton").title = active
        ? "Salir de pantalla completa"
        : "Pantalla completa del panel de lectura";
      $("#translationFullscreenButton").setAttribute(
        "aria-label",
        $("#translationFullscreenButton").title,
      );
    });

    updateZoom();

    $("#saveReadingPdfButton").addEventListener("click", () => {
      void saveCurrentReadingPdf();
    });
  }

  function clearTranslationMatches() {
    for (const mark of elements.translation.querySelectorAll("mark.translation-search-match")) {
      mark.replaceWith(document.createTextNode(mark.textContent ?? ""));
    }
    state.translationMatches = [];
    state.translationMatchIndex = -1;
  }

  function findInTranslation(query) {
    clearTranslationMatches();
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      $("#translationSearchCount").textContent = "0 / 0";
      return;
    }

    const escapedQuery = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const expression = new RegExp(escapedQuery, "gi");
    const walker = document.createTreeWalker(elements.translation, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.textContent && node.parentElement?.closest("mark, button")) {
        continue;
      }
      if (node.textContent) {
        textNodes.push(node);
      }
    }

    for (const node of textNodes) {
      const value = node.textContent;
      expression.lastIndex = 0;
      const matches = [...value.matchAll(expression)];
      if (!matches.length) {
        continue;
      }
      const fragment = document.createDocumentFragment();
      let offset = 0;
      for (const match of matches) {
        const start = match.index;
        fragment.append(document.createTextNode(value.slice(offset, start)));
        const mark = document.createElement("mark");
        mark.className = "translation-search-match";
        mark.textContent = match[0];
        state.translationMatches.push(mark);
        fragment.append(mark);
        offset = start + match[0].length;
      }
      fragment.append(document.createTextNode(value.slice(offset)));
      node.replaceWith(fragment);
    }

    state.translationMatchIndex = state.translationMatches.length ? 0 : -1;
    updateTranslationMatchState(true);
  }

  function moveTranslationMatch(direction) {
    if (!state.translationMatches.length) {
      return;
    }
    state.translationMatchIndex =
      (state.translationMatchIndex + direction + state.translationMatches.length) %
      state.translationMatches.length;
    updateTranslationMatchState(true);
  }

  function updateTranslationMatchState(scrollToMatch) {
    for (const [index, mark] of state.translationMatches.entries()) {
      mark.classList.toggle("translation-search-current", index === state.translationMatchIndex);
    }
    $("#translationSearchCount").textContent = state.translationMatches.length
      ? `${state.translationMatchIndex + 1} / ${state.translationMatches.length}`
      : "0 / 0";
    if (scrollToMatch && state.translationMatchIndex >= 0) {
      state.translationMatches[state.translationMatchIndex].scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
    }
  }

  function closeTranslationSearch() {
    $("#translationSearchBar").classList.add("hidden");
    $("#translationSearchInput").value = "";
    clearTranslationMatches();
    $("#translationSearchCount").textContent = "0 / 0";
  }

  function wireLibrary() {
    const dialog = $("#libraryDialog");
    $("#libraryButton").addEventListener("click", () => void openLibrary());
    $("#closeLibraryButton").addEventListener("click", () => dialog.close());
    $("#libraryUploadButton").addEventListener("click", () => {
      dialog.close();
      $("#fileInput").click();
    });
    $("#libraryList").addEventListener("click", (event) => {
      const removeButton = event.target.closest("[data-delete-document-id]");
      if (removeButton) {
        void removeLibraryDocument(removeButton.dataset.deleteDocumentId);
        return;
      }
      const openButton = event.target.closest("[data-open-document-id]");
      if (!openButton) {
        return;
      }
      const pdfEntry = state.libraryDocuments?.find(
        (item) => item.id === openButton.dataset.openDocumentId,
      );
      if (pdfEntry) {
        dialog.close();
        void openDocument(pdfEntry);
      }
    });
    $("#modifiedReadingsList").addEventListener("click", (event) => {
      const removeButton = event.target.closest("[data-delete-modified-pdf]");
      if (removeButton) {
        void removeModifiedPdf(removeButton.dataset.deleteModifiedPdf);
        return;
      }
      const savedPdfButton = event.target.closest("[data-open-saved-modified-pdf]");
      if (savedPdfButton) {
        const reading = state.modifiedReadings?.find(
          (item) =>
            item.savedPdf &&
            item.document.id === savedPdfButton.dataset.openSavedModifiedPdf,
        );
        if (reading) {
          dialog.close();
          void openSavedModifiedPdf(reading);
        }
        return;
      }
      const button = event.target.closest("[data-open-modified-reading]");
      const reading = state.modifiedReadings?.[Number(button?.dataset.openModifiedReading)];
      if (reading) {
        dialog.close();
        void openModifiedReading(reading);
      }
    });
  }

  async function openLibrary() {
    const dialog = $("#libraryDialog");
    const list = $("#libraryList");
    list.replaceChildren();
    renderEmptyPage(list, "Cargando biblioteca", "Buscando los PDF guardados en este dispositivo…");
    openBlockingDialog(dialog);
    try {
      const [documents, modifiedReadings] = await Promise.all([
        listDocuments(),
        listModifiedReadings(),
      ]);
      state.libraryDocuments = documents;
      state.modifiedReadings = modifiedReadings;
      list.replaceChildren();
      if (!documents.length) {
        renderEmptyPage(list, "Tu biblioteca está vacía", "Al añadir un PDF, quedará guardado aquí para volver a abrirlo después.");
      } else {
        for (const pdfEntry of documents) {
          const row = document.createElement("div");
          row.className = "library-item";
          const openButton = document.createElement("button");
          openButton.type = "button";
          openButton.dataset.openDocumentId = pdfEntry.id;
          openButton.className = "library-open-button";
          const details = document.createElement("span");
          details.className = "min-w-0 flex-1";
          const name = document.createElement("span");
          name.className = "block truncate text-sm font-semibold text-slate-800";
          name.textContent = pdfEntry.name;
          const metadata = document.createElement("span");
          metadata.className = "mt-1 block text-xs text-slate-500";
          metadata.textContent = `${formatFileSize(pdfEntry.size)} · Guardado ${formatDocumentDate(pdfEntry.createdAt)}`;
          details.append(name, metadata);
          const action = document.createElement("span");
          action.className = "shrink-0 text-xs font-semibold text-indigo-600";
          action.textContent = state.document?.id === pdfEntry.id ? "Abierto" : "Abrir";
          openButton.append(details, action);

          const removeButton = document.createElement("button");
          removeButton.type = "button";
          removeButton.dataset.deleteDocumentId = pdfEntry.id;
          removeButton.className = "library-remove-button";
          removeButton.textContent = "Eliminar";
          removeButton.setAttribute("aria-label", `Eliminar ${pdfEntry.name}`);
          row.append(openButton, removeButton);
          list.append(row);
        }
      }
      renderModifiedReadings(modifiedReadings);
    } catch (error) {
      list.replaceChildren();
      renderEmptyPage(list, "No se pudo cargar la biblioteca", error.message);
      $("#modifiedReadingsList").replaceChildren();
    }
  }

  async function refreshModifiedReadings() {
    try {
      state.modifiedReadings = await listModifiedReadings();
      if ($("#libraryDialog").open) {
        renderModifiedReadings(state.modifiedReadings);
      }
    } catch (error) {
      showToast(`No se pudo actualizar la lista de lecturas modificadas: ${error.message}`);
    }
  }

  function renderModifiedReadings(readings) {
    const list = $("#modifiedReadingsList");
    list.replaceChildren();
    if (!readings.length) {
      const empty = document.createElement("p");
      empty.className = "py-3 text-center text-xs text-slate-500";
      empty.textContent = "Todavía no hay lecturas modificadas.";
      list.append(empty);
      return;
    }
    for (const [index, reading] of readings.entries()) {
      const name = document.createElement("span");
      name.className = "block truncate text-sm font-semibold text-slate-800";
      name.textContent = reading.document.name;
      const detail = document.createElement("span");
      detail.className = "mt-1 block text-xs text-slate-500";
      const variantLabel = reading.variant === "original" ? "Original" : "Español";
      detail.textContent = reading.savedPdf
        ? `PDF guardado · ${variantLabel} · página${reading.pages.length === 1 ? "" : "s"} ${reading.pages.join(", ")}`
        : `${variantLabel} modificado · página${reading.pages.length === 1 ? "" : "s"} ${reading.pages.join(", ")}`;
      const row = document.createElement("div");
      row.className = "library-item modified-library-item";
      const details = document.createElement("span");
      details.className = "min-w-0 flex-1";
      details.append(name, detail);
      row.append(details);
      if (reading.savedPdf) {
        const open = document.createElement("button");
        open.type = "button";
        open.className = "library-action-button";
        open.dataset.openSavedModifiedPdf = reading.document.id;
        open.textContent = "Abrir";
        open.setAttribute("aria-label", `Abrir ${reading.document.name}`);
        row.append(open);
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "library-remove-button";
        remove.dataset.deleteModifiedPdf = reading.document.id;
        remove.textContent = "Eliminar";
        remove.setAttribute("aria-label", `Eliminar ${reading.document.name}`);
        row.append(remove);
      } else {
        const open = document.createElement("button");
        open.type = "button";
        open.dataset.openModifiedReading = String(index);
        open.className = "library-action-button";
        open.textContent = "Abrir";
        open.setAttribute("aria-label", `Abrir lectura modificada de ${reading.document.name}`);
        row.append(open);
      }
      list.append(row);
    }
  }

  async function removeModifiedPdf(documentId) {
    const savedPdf = state.modifiedReadings?.find(
      (reading) => reading.savedPdf && reading.document.id === documentId,
    );
    if (!savedPdf) {
      return;
    }
    const confirmed = window.confirm(
      `¿Eliminar el PDF modificado «${savedPdf.document.name}»? El PDF original no se verá afectado.`,
    );
    if (!confirmed) {
      return;
    }
    try {
      await deleteDocument(documentId);
      await clearOpenDocumentIfCurrent(documentId);
      state.modifiedReadings = await listModifiedReadings();
      if ($("#libraryDialog").open) {
        renderModifiedReadings(state.modifiedReadings);
      }
      showToast("PDF modificado eliminado.");
    } catch (error) {
      showToast(`No se pudo eliminar el PDF modificado: ${error.message}`);
    }
  }

  async function openModifiedReading(reading) {
    await openDocument(reading.document);
    if (state.document?.id !== reading.document.id || !reader) {
      showToast("No se pudo abrir el documento de la lectura modificada.");
      return;
    }
    const page = reading.pages[0];
    if (reader.currentPage !== page) {
      reader.goToPage(page);
      await handlePageChange(page);
    }
    if (reading.variant === "spanish" && !state.pageDisplay?.translation) {
      await translateCurrentPage();
    }
    renderActiveContent();
  }

  async function openSavedModifiedPdf(reading) {
    await openDocument(reading.document);
    if (state.document?.id !== reading.document.id || !reader) {
      showToast("No se pudo abrir el PDF modificado.");
      return;
    }
    const page = reading.pages[0];
    if (page && reader.currentPage !== page) {
      reader.goToPage(page);
      await handlePageChange(page);
    }
  }

  async function removeLibraryDocument(documentId) {
    const pdfEntry = state.libraryDocuments?.find((item) => item.id === documentId);
    if (!pdfEntry) {
      return;
    }
    const confirmed = window.confirm(
      `¿Eliminar «${pdfEntry.name}» de los archivos subidos? También se borrarán su PDF y las traducciones y el OCR guardados. Esta acción no se puede deshacer.`,
    );
    if (!confirmed) {
      return;
    }

    const buttons = [...$("#libraryList").querySelectorAll("button")];
    buttons.forEach((button) => {
      button.disabled = true;
    });
    try {
      await deleteDocument(documentId);
      await clearOpenDocumentIfCurrent(documentId);
      await openLibrary();
      showToast(`Se eliminó «${pdfEntry.name}» y sus datos guardados.`);
    } catch (error) {
      buttons.forEach((button) => {
        button.disabled = false;
      });
      showToast(`No se pudo eliminar el archivo: ${error.message}`);
    }
  }

  async function clearOpenDocumentIfCurrent(documentId) {
    if (state.document?.id !== documentId) {
      return;
    }
    await reader?.close();
    state.pageRequest += 1;
    state.document = null;
    state.pageSources.clear();
    state.ocr.clear();
    state.translations.clear();
    state.pageReadingEdits.clear();
    state.pageDisplay = null;
    state.selectionDisplay = null;
    state.selectionRange = null;
    state.selectionInTranslation = false;
    state.currentPageContent = null;
    state.currentPageContentPage = null;
    window.getSelection()?.removeAllRanges();
    $("#selectionMenu").classList.add("hidden");
    setReaderEnabled(false);
    $("#documentName").textContent = "Espacio de lectura personal";
    $("#documentName").removeAttribute("title");
    $("#pageInput").value = "1";
    $("#pageCount").textContent = "—";
    $("#translationPageLabel").textContent = "— / —";
    $("#pdfEmptyState").classList.remove("hidden");
    renderEmptyPage(
      elements.translation,
      "Tu espacio de estudio",
      "Abre un PDF para leer su traducción junto al documento original.",
    );
    $("#translationStatus").textContent = "Las traducciones se guardan localmente en este dispositivo.";
  }

  function formatFileSize(size) {
    if (size < 1024 * 1024) {
      return `${Math.max(1, Math.round(size / 1024))} KB`;
    }
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDocumentDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "fecha desconocida"
      : new Intl.DateTimeFormat("es", { dateStyle: "medium" }).format(date);
  }

  function getOriginalLanguageLabel(fileName) {
    if (/(?:^|[_\W])(?:eng|engl|english)(?:$|[_\W])/i.test(fileName)) {
      return "Inglés";
    }
    if (/(?:^|[_\W])(?:spa|spanish|español|espanol)(?:$|[_\W])/i.test(fileName)) {
      return "Español";
    }
    return "Idioma original";
  }

  function renderActiveContent() {
    updateSaveReadingButton();
    if (state.selectionDisplay) {
      renderTranslation(elements.translation, state.selectionDisplay, "translated");
      renderSelectionNavigation(state.selectionDisplay);
      refreshTranslationSearch();
      return;
    }

    const display = state.pageDisplay;
    if (!display) {
      return;
    }

    if (display.kind === "scanned") {
      renderScannedPrompt(elements.translation, display.page, recognizeCurrentPage);
      refreshTranslationSearch();
      return;
    }
    if (display.kind === "empty") {
      renderEmptyPage(
        elements.translation,
        "No hay texto en esta página",
        "No contiene texto seleccionable ni imágenes que indiquen que sea un escaneo.",
      );
      refreshTranslationSearch();
      return;
    }

    if (display.translation) {
      renderTranslation(elements.translation, {
        ...display.translation,
      }, "translated", state.pageReadingEdits.get(display.page)?.spanish ?? []);
    } else if (display.isOcr) {
      renderEmptyPage(
        elements.translation,
        "Texto OCR listo",
        "El texto reconocido está listo. Pulsa «Traducir página» para traducirlo al español.",
      );
    } else if (display.hasSparseImageText) {
      renderOcrSuggestion(elements.translation, display.digitalText, display.page, recognizeCurrentPage);
    } else {
      renderEmptyPage(
        elements.translation,
        display.prepared.mode === "exercise" ? "Ejercicio listo para estudiar" : "Página lista",
        display.prepared.mode === "exercise"
          ? "El ejercicio se conservará en inglés y la ayuda aparecerá en español cuando traduzcas."
          : "La traducción se genera solo cuando la solicitas.",
      );
    }

    if (display.isOcr) {
      addOcrRerunAction(display.page);
    }
    refreshTranslationSearch();
  }

  function updateSaveReadingButton() {
    const button = $("#saveReadingPdfButton");
    if (!button) {
      return;
    }
    const page = state.pageDisplay?.page;
    const variant = page ? getSaveVariant(page) : "spanish";
    const baseText = page ? getPageVariantText(page, variant) : "";
    const edits = page ? state.pageReadingEdits.get(page)?.[variant] ?? [] : [];
    const hasCurrentEdits = edits.some(
      (edit) => edit.baseHash === textFingerprint(baseText),
    );
    button.disabled = !state.document || !hasCurrentEdits || button.dataset.saving === "true";
    button.title = hasCurrentEdits
      ? `Guardar las páginas modificadas en la variante ${variant === "original" ? "original" : "española"}`
      : "Aplica primero un cambio en esta página";
  }

  function getSaveVariant(page) {
    const edits = state.pageReadingEdits.get(page);
    const originalText = getPageVariantText(page, "original");
    const spanishText = getPageVariantText(page, "spanish");
    const original = (edits?.original ?? []).filter(
      (edit) => edit.baseHash === textFingerprint(originalText),
    );
    const spanish = (edits?.spanish ?? []).filter(
      (edit) => edit.baseHash === textFingerprint(spanishText),
    );
    if (!original.length) {
      return "spanish";
    }
    if (!spanish.length) {
      return "original";
    }
    const latestOriginal = Math.max(...original.map((edit) => Date.parse(edit.createdAt) || 0));
    const latestSpanish = Math.max(...spanish.map((edit) => Date.parse(edit.createdAt) || 0));
    return latestOriginal > latestSpanish ? "original" : "spanish";
  }

  async function saveCurrentReadingPdf() {
    const sourceDocument = state.document;
    const variant = state.pageDisplay?.page
      ? getSaveVariant(state.pageDisplay.page)
      : "spanish";
    if (!sourceDocument || !reader || $("#saveReadingPdfButton").disabled) {
      return;
    }
    const button = $("#saveReadingPdfButton");
    button.dataset.saving = "true";
    button.disabled = true;
    button.textContent = "Guardando…";
    $("#translationStatus").textContent = "Preparando las páginas modificadas…";
    try {
      const modifiedReadings = await listModifiedReadings();
      const reading = modifiedReadings.find(
        (item) =>
          !item.savedPdf &&
          item.document.id === sourceDocument.id &&
          item.variant === variant,
      );
      if (!reading?.pages.length) {
        throw new Error("No hay cambios guardados para esta variante.");
      }

      const modifiedPages = [];
      for (const [index, page] of reading.pages.entries()) {
        $("#translationStatus").textContent =
          `Preparando página modificada ${index + 1} de ${reading.pages.length}…`;
        const pageEdits = await getPageReadingEdits(sourceDocument.id, page);
        const edits = pageEdits[variant] ?? [];
        const pageText = await getModifiedPageBaseText(sourceDocument, page, variant);
        const applicableEdits = edits.filter(
          (edit) => edit.baseHash === textFingerprint(pageText),
        );
        if (!applicableEdits.length) {
          throw new Error(
            `Los cambios de la página ${page} ya no coinciden con el texto base y no se han incluido.`,
          );
        }
        modifiedPages.push({
          page,
          variantLabel: variant === "original" ? "original" : "español",
          text: applyReadingEdits(pageText, applicableEdits),
        });
      }

      $("#translationStatus").textContent = "Generando PDF de lectura…";
      const sourceResponse = await fetch(sourceDocument.fileUrl);
      if (!sourceResponse.ok) {
        throw new Error(`No se pudo leer el PDF original (HTTP ${sourceResponse.status}).`);
      }
      const sourceBytes = await sourceResponse.arrayBuffer();
      const { createModifiedReadingPdfInBrowser } =
        await import("./pdf/modifiedReadingPdfBrowser.js");
      const pdfBytes = await createModifiedReadingPdfInBrowser(sourceBytes, modifiedPages);
      const variantName = variant === "original" ? "original" : "espanol";
      const outputName = `${sourceDocument.name.replace(/\.pdf$/i, "")} - ${variantName} modificado.pdf`;
      const outputFile = new File([pdfBytes], outputName, { type: "application/pdf" });
      await saveModifiedPdf(outputFile, sourceDocument.id, variant, reading.pages);
      state.modifiedReadings = await listModifiedReadings();
      if ($("#libraryDialog").open) {
        renderModifiedReadings(state.modifiedReadings);
      }
      $("#translationStatus").textContent = "PDF modificado guardado en Archivos modificados.";
      showToast("PDF guardado en Archivos modificados. El original sigue intacto.");
    } catch (error) {
      $("#translationStatus").textContent = "No se pudo guardar el PDF modificado.";
      showToast(error.message);
    } finally {
      button.dataset.saving = "false";
      button.textContent = "Guardar PDF modificado";
      updateSaveReadingButton();
    }
  }

  async function getModifiedPageBaseText(sourceDocument, page, variant) {
    const digitalText =
      state.pageSources.get(page) ?? (await reader.getPageText(page));
    const pageData = await getPageData(sourceDocument.id, page);
    const ocrText = state.ocr.get(page) ?? pageData.ocrText ?? "";
    const prepared = classifyPage(combinePageText(digitalText, ocrText));
    if (variant === "original" || !prepared.translationSource) {
      return prepared.originalText;
    }

    let translation = state.translations.get(page);
    if (!translation) {
      const result = await requestPageTranslation(
        sourceDocument.id,
        page,
        prepared.translationSource,
      );
      translation = {
        originalText: prepared.originalText,
        translatedText: correctTranslation(
          prepared.originalText,
          prepared.restoreTranslation(result.translatedText),
        ),
        mode: prepared.mode,
        cached: result.cached,
      };
      state.translations.set(page, translation);
    }
    return translation.translatedText;
  }

  function getPageVariantText(page, variant) {
    const display = state.pageDisplay;
    if (!display || display.page !== page || display.kind !== "ready") {
      return "";
    }
    return variant === "original"
      ? display.prepared.originalText
      : display.translation?.translatedText ?? "";
  }

  function renderSelectionNavigation(display) {
    const navigation = document.createElement("div");
    navigation.className = "selection-view-navigation";

    const backButton = document.createElement("button");
    backButton.type = "button";
    backButton.className = "selection-view-back";
    backButton.setAttribute("aria-label", "Volver al texto de la página");
    backButton.title = "Volver al texto de la página";
    backButton.textContent = "←";
    backButton.addEventListener("click", () => {
      state.selectionDisplay = null;
      state.selectionRange = null;
      state.selectionInTranslation = false;
      window.getSelection()?.removeAllRanges();
      renderActiveContent();
    });

    const title = document.createElement("span");
    title.className = "selection-view-title";
    title.textContent =
      display.mode === "lesson"
        ? "Explicación de selección"
        : `Traducción de selección · ${display.sourceLanguage} → ${display.targetLanguage}`;
    navigation.append(backButton, title);
    elements.translation.prepend(navigation);
  }

  function openBlockingDialog(dialog) {
    for (const otherDialog of document.querySelectorAll(".centered-dialog[open]")) {
      if (otherDialog !== dialog) {
        otherDialog.close();
      }
    }
    if (!dialog.open) {
      dialog.showModal();
    }
    bringFloatingDialogToFront(dialog);
  }

  function bringFloatingDialogToFront(dialog) {
    floatingDialogOrder += 1;
    dialog.style.zIndex = String(floatingDialogOrder);
  }

  function wireDialogDragging() {
    for (const dialog of document.querySelectorAll(".centered-dialog")) {
      dialog.addEventListener("cancel", (event) => event.preventDefault());
      dialog.addEventListener("pointerdown", () => bringFloatingDialogToFront(dialog));
      const handle = dialog.querySelector("[data-dialog-drag-handle]");
      if (!handle) {
        continue;
      }

      let drag = null;
      handle.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || event.target.closest("button")) {
          return;
        }
        const bounds = dialog.getBoundingClientRect();
        drag = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          left: bounds.left,
          top: bounds.top,
        };
        handle.setPointerCapture(event.pointerId);
        event.preventDefault();
      });

      handle.addEventListener("pointermove", (event) => {
        if (!drag || event.pointerId !== drag.pointerId) {
          return;
        }
        const bounds = dialog.getBoundingClientRect();
        const maxLeft = Math.max(8, window.innerWidth - bounds.width - 8);
        const maxTop = Math.max(8, window.innerHeight - bounds.height - 8);
        const left = Math.min(maxLeft, Math.max(8, drag.left + event.clientX - drag.startX));
        const top = Math.min(maxTop, Math.max(8, drag.top + event.clientY - drag.startY));
        dialog.style.inset = "auto";
        dialog.style.left = `${left}px`;
        dialog.style.top = `${top}px`;
        dialog.style.right = "auto";
        dialog.style.bottom = "auto";
        dialog.style.transform = "none";
      });

      const stopDragging = (event) => {
        if (drag?.pointerId === event.pointerId) {
          drag = null;
        }
      };
      handle.addEventListener("pointerup", stopDragging);
      handle.addEventListener("pointercancel", stopDragging);
      dialog.addEventListener("close", () => {
        drag = null;
        dialog.removeAttribute("style");
      });
    }
  }

  function wireReadingEditActions() {
    const handleUndoClick = (event) => {
      const button = event.target.closest("[data-undo-reading-edit]");
      if (button) {
        event.preventDefault();
        event.stopPropagation();
        void undoReadingEdit(button);
      }
    };
    elements.translation.addEventListener("click", handleUndoClick);
    elements.container.addEventListener("click", handleUndoClick);
  }

  async function applyPendingSelectionEdit(pending) {
    if (!pending || !state.document || pending.documentId !== state.document.id) {
      showToast("No hay una selección válida para aplicar.");
      return false;
    }
    const range = findSelectionRange(
      pending.baseText,
      pending.sourceText,
      pending.precedingText,
    );
    if (!range) {
      showToast("No se encontró el texto seleccionado en la lectura actual.");
      return false;
    }
    const { start, end } = range;
    const editsForPage = state.pageReadingEdits.get(pending.page) ?? {
      original: [],
      spanish: [],
    };
    const baseHash = textFingerprint(pending.baseText);
    if (
      hasOverlappingEdit(
        editsForPage[pending.variant].filter((edit) => edit.baseHash === baseHash),
        start,
        end,
      )
    ) {
      showToast("Ese fragmento ya tiene un cambio. Deshazlo antes de aplicar otro en la misma zona.");
      return false;
    }
    try {
      const edit = await addPageReadingEdit(pending.documentId, pending.page, {
        variant: pending.variant,
        mode: "replace",
        sourceText: pending.sourceText,
        translatedText: pending.translatedText,
        occurrence: countSelectionOccurrences(pending.precedingText, pending.sourceText),
        start,
        end,
        baseHash,
      });
      if (state.document?.id === pending.documentId) {
        state.pageReadingEdits.set(pending.page, {
          ...editsForPage,
          [pending.variant]: [...editsForPage[pending.variant], edit],
        });
        if (pending.variant === "original") {
          const rendered = renderPdfReadingEdits(pending.page);
          const activeOriginalEdits = state.pageReadingEdits
            .get(pending.page)
            .original.filter((item) => item.baseHash === baseHash);
          if (rendered.applied < activeOriginalEdits.length) {
            try {
              await deletePageReadingEdit(
                pending.documentId,
                pending.page,
                "original",
                edit.id,
              );
            } catch (rollbackError) {
              updateSaveReadingButton();
              throw new Error(
                `No se pudo mostrar el cambio en el PDF ni revertirlo: ${rollbackError.message}`,
              );
            }
            state.pageReadingEdits.set(pending.page, {
              ...state.pageReadingEdits.get(pending.page),
              original: activeOriginalEdits.filter((item) => item.id !== edit.id),
            });
            renderPdfReadingEdits(pending.page);
            showToast("No se encontró la selección en el PDF; el cambio no se guardó.");
            return false;
          }
          window.getSelection()?.removeAllRanges();
          $("#selectionMenu").classList.add("hidden");
          updateSaveReadingButton();
        } else if (state.pageDisplay?.page === pending.page) {
          state.selectionDisplay = null;
          renderActiveContent();
        }
      }
      void refreshModifiedReadings();
      showToast("Traducción aplicada. Pasa el cursor por el texto marcado para revertirla.");
      return true;
    } catch (error) {
      showToast(`No se pudo guardar el cambio: ${error.message}`);
      return false;
    }
  }

  async function undoReadingEdit(button) {
    const page = Number(button.dataset.readingEditPage) || state.pageDisplay?.page;
    const documentId = state.document?.id;
    const variant = button.dataset.readingEditVariant;
    const editId = button.dataset.undoReadingEdit;
    if (!documentId || !page || !variant || !editId) {
      return;
    }
    button.disabled = true;
    try {
      await deletePageReadingEdit(documentId, page, variant, editId);
      if (state.document?.id === documentId) {
        const edits = state.pageReadingEdits.get(page) ?? { original: [], spanish: [] };
        state.pageReadingEdits.set(page, {
          ...edits,
          [variant]: edits[variant].filter((edit) => edit.id !== editId),
        });
        if (variant === "original") {
          renderPdfReadingEdits(page);
          window.getSelection()?.removeAllRanges();
          $("#selectionMenu").classList.add("hidden");
        }
        if (state.pageDisplay?.page === page) {
          renderActiveContent();
        }
      }
      void refreshModifiedReadings();
      showToast("Se deshizo el cambio seleccionado.");
    } catch (error) {
      button.disabled = false;
      showToast(`No se pudo deshacer el cambio: ${error.message}`);
    }
  }

  function refreshTranslationSearch() {
    const searchBar = $("#translationSearchBar");
    const query = $("#translationSearchInput").value;
    if (!searchBar.classList.contains("hidden") && query.trim()) {
      findInTranslation(query);
    }
  }

  async function chooseDocument(file) {
    if (!file) {
      return;
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      showToast("El archivo seleccionado no parece ser un PDF.");
      return;
    }
    $("#openDocumentButton").disabled = true;
    $("#translationStatus").textContent = "Subiendo documento…";
    try {
      const uploaded = await uploadDocument(file);
      await openDocument(uploaded);
    } catch (error) {
      state.document = null;
      setReaderEnabled(false);
      $("#pdfEmptyState").classList.remove("hidden");
      $("#translationStatus").textContent = "No se pudo abrir el documento.";
      showToast(error.message);
    } finally {
      $("#openDocumentButton").disabled = false;
    }
  }

  async function openDocument(documentToOpen) {
    $("#openDocumentButton").disabled = true;
    $("#translationStatus").textContent = "Abriendo documento guardado…";
    try {
      if (reader) {
        closeSearch();
        window.getSelection()?.removeAllRanges();
      }
      state.document = documentToOpen;
      state.pageSources.clear();
      state.ocr.clear();
      state.translations.clear();
      state.pageReadingEdits.clear();
      state.currentPageContent = null;
      state.currentPageContentPage = null;
      state.pageDisplay = null;
      state.selectionDisplay = null;
      $("#documentName").textContent = documentToOpen.name;
      $("#documentName").title = documentToOpen.name;
      $("#pdfEmptyState").classList.add("hidden");
      $("#pageInput").value = "1";
      $("#pageCount").textContent = "…";
      $("#translationPageLabel").textContent = "1 / …";
      $("#translationStatus").textContent = "Leyendo página 1…";
      renderEmptyPage(elements.translation, "Cargando documento", "Preparando el visor PDF.");
      if (!reader) {
        const { PdfReader } = await import("./pdf/pdfViewer.js");
        reader = new PdfReader(elements.container, elements.viewer, {
          onPageChange: (page) => void handlePageChange(page),
          onFindCountChange: updateFindCount,
        });
        reader.onTextLayerRendered = (page) => renderPdfReadingEdits(page);
        reader.onScaleChange = (scale) => {
          if (["page-fit", "page-width"].includes(reader.scaleMode)) {
            state.pdfZoomBaseScale = scale;
            state.pdfZoomFactor = 1;
          }
          $("#zoomValueButton").textContent = `${Math.round(state.pdfZoomFactor * 100)}%`;
        };
      }
      const pages = await reader.open(documentToOpen.fileUrl);
      setReaderEnabled(true);
      $("#pageCount").textContent = String(pages);
      await handlePageChange(reader.currentPage);
      showToast(`Documento abierto · ${pages} páginas`);
    } catch (error) {
      state.document = null;
      setReaderEnabled(false);
      $("#pdfEmptyState").classList.remove("hidden");
      $("#translationStatus").textContent = "No se pudo abrir el documento.";
      showToast(error.message);
    } finally {
      $("#openDocumentButton").disabled = false;
    }
  }

  async function handlePageChange(pageNumber) {
    if (!state.document || !reader.pageCount) {
      return;
    }
    const page = Math.min(Math.max(pageNumber, 1), reader.pageCount);
    state.currentPageContent = null;
    state.currentPageContentPage = null;
    state.pageDisplay = null;
    state.selectionDisplay = null;
    $("#pageInput").value = String(page);
    $("#translationPageLabel").textContent = `${page} / ${reader.pageCount}`;
    $("#previousPageButton").disabled = page <= 1;
    $("#nextPageButton").disabled = page >= reader.pageCount;
    $("#translatePageButton").disabled = true;
    $("#retranslateButton").classList.add("hidden");
    const requestId = ++state.pageRequest;
    $("#translationStatus").textContent = `Leyendo página ${page}…`;
    renderEmptyPage(elements.translation, `Página ${page}`, "Extrayendo texto real del PDF…");

    try {
      const [digitalText, cachedPage, pageEdits] = await Promise.all([
        state.pageSources.has(page) ? state.pageSources.get(page) : reader.getPageText(page),
        getPageData(state.document.id, page),
        getPageReadingEdits(state.document.id, page),
      ]);
      if (requestId !== state.pageRequest) {
        return;
      }
      state.pageSources.set(page, digitalText);
      const ocrText = state.ocr.get(page) ?? cachedPage.ocrText ?? "";
      if (ocrText) {
        state.ocr.set(page, ocrText);
      }
      state.pageReadingEdits.set(page, pageEdits);
      const text = combinePageText(digitalText, ocrText);
      if (!text) {
        $("#translationStatus").textContent = "Página sin texto seleccionable.";
        if (reader.hasPageImages(page)) {
          state.pageDisplay = { kind: "scanned", page };
          renderActiveContent();
        } else {
          state.pageDisplay = { kind: "empty", page };
          renderActiveContent();
        }
        return;
      }
      const prepared = classifyPage(text);
      state.currentPageContent = prepared;
      state.currentPageContentPage = page;
      $("#translatePageButton").disabled = false;
      const translation = state.translations.get(page);
      state.pageDisplay = {
        kind: "ready",
        page,
        prepared,
        translation: translation ?? null,
        digitalText,
        isOcr: state.ocr.has(page),
        hasSparseImageText: reader.hasPageImages(page) && isSparseText(digitalText),
      };
      renderPdfReadingEdits(page);
      if (translation) {
        renderActiveContent();
        $("#translationStatus").textContent =
          translation.cached ? "Traducción guardada en caché." : "Traducción de esta página.";
      } else if (state.ocr.has(page)) {
        renderActiveContent();
        $("#translationStatus").textContent =
          "Texto reconocido con OCR. Puedes leerlo o traducirlo bajo demanda.";
      } else if (state.pageDisplay.hasSparseImageText) {
        renderActiveContent();
        $("#translationStatus").textContent =
          "PDF.js encontró poco texto y una imagen; el OCR es opcional.";
      } else {
        renderActiveContent();
        $("#translationStatus").textContent = "Texto digital extraído con PDF.js.";
      }
    } catch (error) {
      if (requestId === state.pageRequest) {
        $("#translationStatus").textContent = "No se pudo procesar la página.";
        renderEmptyPage(elements.translation, "Error al leer la página", error.message);
      }
    }
  }

  async function translateCurrentPage(force = false) {
    const page = reader.currentPage;
    let prepared =
      state.currentPageContentPage === page ? state.currentPageContent : null;
    if (!prepared) {
      const text = state.ocr.get(page) ??
        state.pageSources.get(page) ??
        (await reader.getPageText(page));
      if (!text.trim()) {
        renderScannedPrompt(elements.translation, page, recognizeCurrentPage);
        return;
      }
      prepared = classifyPage(text);
      state.currentPageContent = prepared;
      state.currentPageContentPage = page;
    }
    if (!prepared.translationSource) {
      const entry = {
        originalText: prepared.originalText,
        translatedText: prepared.originalText,
        mode: prepared.mode,
      };
      state.translations.set(page, entry);
      if (state.pageDisplay) {
        state.pageDisplay.translation = entry;
      }
      renderActiveContent();
      $("#translationStatus").textContent = "La página contiene código o contenido que se conserva sin traducir.";
      return;
    }

    $("#translatePageButton").disabled = true;
    $("#retranslateButton").disabled = true;
    $("#translationStatus").textContent = force ? "Solicitando una nueva traducción…" : "Traduciendo página…";
    renderEmptyPage(elements.translation, "Traduciendo", "Enviando solo el texto de la página actual a LibreTranslate local.");
    try {
      const result = await requestPageTranslation(
        state.document.id,
        page,
        prepared.translationSource,
        force,
      );
      const translatedText = correctTranslation(
        prepared.originalText,
        prepared.restoreTranslation(result.translatedText),
      );
      const entry = {
        originalText: prepared.originalText,
        translatedText,
        mode: prepared.mode,
        cached: result.cached,
      };
      state.translations.set(page, entry);
      if (state.pageDisplay?.page === page) {
        state.pageDisplay.translation = entry;
      }
      state.selectionDisplay = null;
      renderActiveContent();
      $("#translationStatus").textContent = result.cached
        ? "Traducción recuperada de la caché local."
        : "Traducción guardada en caché local.";
    } catch (error) {
      $("#translationStatus").textContent = "No se pudo traducir la página.";
      renderEmptyPage(elements.translation, "Traducción no disponible", error.message);
    } finally {
      $("#translatePageButton").disabled = false;
      $("#retranslateButton").disabled = false;
    }
  }

  async function recognizeCurrentPage(page, button) {
    button.disabled = true;
    $("#translationStatus").textContent = "Reconociendo la página con OCR…";
    button.textContent = "OCR: preparando página…";
    try {
      const { recognizePage } = await import("./ocr/ocrClient.js");
      const text = await recognizePage(reader.document, page, (progress) => {
        button.textContent = `OCR: ${Math.round(progress * 100)} %`;
      });
      await saveOcr(state.document.id, page, text);
      state.ocr.set(page, text);
      state.translations.delete(page);
      state.currentPageContent = null;
      showToast("Texto reconocido y guardado para esta página.");
      await handlePageChange(page);
    } catch (error) {
      button.disabled = false;
      button.textContent = "Reintentar OCR";
      $("#translationStatus").textContent = "No se pudo reconocer la página.";
      showToast(error.message);
    }
  }

  function wireDocumentControls() {
    $("#openDocumentButton").addEventListener("click", () => $("#fileInput").click());
    $("#emptyOpenButton").addEventListener("click", () => void openLibrary());
    $("#fileInput").addEventListener("change", (event) => {
      const [file] = event.target.files ?? [];
      void chooseDocument(file);
      event.target.value = "";
    });
    $("#translatePageButton").addEventListener("click", () => void translateCurrentPage());
    $("#retranslateButton").addEventListener("click", () => void translateCurrentPage(true));
  }

  function wireViewerControls() {
    $("#previousPageButton").addEventListener("click", () => reader.goToPage(reader.currentPage - 1));
    $("#nextPageButton").addEventListener("click", () => reader.goToPage(reader.currentPage + 1));
    $("#pageInput").addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        reader.goToPage(Number(event.currentTarget.value));
        event.currentTarget.blur();
      }
    });
    const resetPdfZoom = (scaleMode = "page-width") => {
      state.pdfZoomFactor = 1;
      state.pdfZoomBaseScale = 0;
      reader.setScale(scaleMode);
      $("#zoomValueButton").textContent = "100%";
    };
    const adjustPdfZoom = (step) => {
      if (reader.scaleMode === "page-fit" || reader.scaleMode === "page-width") {
        state.pdfZoomBaseScale = reader.scale;
        state.pdfZoomFactor = 1;
      }
      if (!state.pdfZoomBaseScale) {
        state.pdfZoomBaseScale = reader.scale;
      }
      const targetScale = Math.min(
        5,
        Math.max(0.25, state.pdfZoomBaseScale * (state.pdfZoomFactor + step)),
      );
      state.pdfZoomFactor = targetScale / state.pdfZoomBaseScale;
      reader.setScale(targetScale.toFixed(3));
      $("#zoomValueButton").textContent = `${Math.round(state.pdfZoomFactor * 100)}%`;
    };
    $("#zoomOutButton").addEventListener("click", () => adjustPdfZoom(-0.1));
    $("#zoomInButton").addEventListener("click", () => adjustPdfZoom(0.1));
    $("#zoomValueButton").addEventListener("click", () => resetPdfZoom());
    $("#fitPageButton").addEventListener("click", () => resetPdfZoom("page-fit"));
    $("#rotateButton").addEventListener("click", () => reader.setRotation((reader.rotation + 90) % 360));
    $("#downloadButton").addEventListener("click", () =>
      reader.download(state.document?.name ?? "document.pdf"),
    );
    $("#printButton").addEventListener("click", () => {
      if (state.document) {
        void reader.print(state.document.fileUrl);
      }
    });
    $("#fullscreenButton").addEventListener("click", async () => {
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else {
          await $("#pdfPanel").requestFullscreen();
        }
      } catch (error) {
        showToast(`No se pudo activar pantalla completa: ${error.message}`);
      }
    });
    $("#toggleSearchButton").addEventListener("click", openSearch);
    $("#closeSearchButton").addEventListener("click", closeSearch);
    $("#searchPreviousButton").addEventListener("click", () => reader.searchAgain(true));
    $("#searchNextButton").addEventListener("click", () => reader.searchAgain(false));
    const scheduleSearch = debounce((query) => {
      if (query.trim()) {
        reader.startSearch(query);
      } else {
        reader.startSearch("");
        $("#searchCount").textContent = "0 / 0";
      }
    }, 150);
    $("#searchInput").addEventListener("input", (event) => {
      scheduleSearch(event.currentTarget.value);
    });
    $("#searchInput").addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        reader.searchAgain(event.shiftKey);
      }
      if (event.key === "Escape") {
        closeSearch();
      }
    });
    document.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f" && state.document) {
        event.preventDefault();
        openSearch();
      } else if (event.key === "Escape" && !$("#searchBar").classList.contains("hidden")) {
        closeSearch();
      } else if (
        state.document &&
        !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName) &&
        (event.key === "PageDown" || event.key === "PageUp")
      ) {
        event.preventDefault();
        reader.goToPage(reader.currentPage + (event.key === "PageDown" ? 1 : -1));
      }
    });
  }

  function openSearch() {
    $("#searchBar").classList.remove("hidden");
    $("#searchBar").classList.add("flex");
    $("#searchInput").focus();
    $("#searchInput").select();
  }

  function closeSearch() {
    $("#searchBar").classList.add("hidden");
    $("#searchBar").classList.remove("flex");
    $("#searchCount").textContent = "0 / 0";
    $("#searchInput").value = "";
    reader.startSearch("");
  }

  function updateFindCount(count) {
    $("#searchCount").textContent = `${count.current} / ${count.total}`;
  }

  function wireSelectionMenu() {
    const menu = $("#selectionMenu");
    const update = () => {
      const selection = window.getSelection();
      const text = selection?.toString().trim() ?? "";
      const selectedInPdf = $("#readerContainer").contains(selection?.anchorNode);
      const selectedInTranslation = $("#translationContent").contains(selection?.anchorNode);
      const selectionWithinTranslation =
        selectedInTranslation &&
        $("#translationContent").contains(selection?.focusNode);
      if (!text || (!selectedInPdf && !selectedInTranslation)) {
        state.selectionRange = null;
        state.selectionInTranslation = false;
        menu.classList.add("hidden");
        return;
      }
      state.selection = text;
      state.selectionPage = reader.currentPage;
      state.selectionVariant = selectedInPdf ? "original" : "spanish";
      state.selectionPrefix = getSelectionPrefix(
        selection.getRangeAt(0),
        selectedInPdf,
      );
      state.selectionInTranslation =
        selectionWithinTranslation &&
        !state.selectionDisplay &&
        state.pageDisplay?.page === reader.currentPage &&
        Boolean(state.pageDisplay.translation);
      state.selectionRange = state.selectionInTranslation ? selection.getRangeAt(0).cloneRange() : null;
      const selectionRange = selection.getRangeAt(0);
      const bounds = selectionRange.getBoundingClientRect();
      const inViewport =
        bounds.width > 0 &&
        bounds.height > 0 &&
        bounds.bottom >= 0 &&
        bounds.top <= window.innerHeight &&
        bounds.right >= 0 &&
        bounds.left <= window.innerWidth;
      if (!inViewport) {
        menu.classList.add("hidden");
        return;
      }
      menu.classList.remove("hidden");
      const left = Math.min(
        Math.max(8, bounds.left + bounds.width / 2 - menu.offsetWidth / 2),
        Math.max(8, window.innerWidth - menu.offsetWidth - 8),
      );
      const above = bounds.top - menu.offsetHeight - 8;
      const top = Math.min(
        Math.max(8, above >= 8 ? above : bounds.bottom + 8),
        Math.max(8, window.innerHeight - menu.offsetHeight - 8),
      );
      menu.style.left = `${left}px`;
      menu.style.top = `${top}px`;
      menu.querySelector('[data-selection-action="translate"]').classList.toggle(
        "hidden",
        state.selectionInTranslation,
      );
      menu.querySelector('[data-selection-action="translate"]').textContent =
        getOriginalLanguageLabel(state.document?.name ?? "") === "Español"
          ? "Traducir al inglés"
          : "Traducir al español";
      menu.querySelector('[data-selection-action="translateToEnglish"]').classList.toggle(
        "hidden",
        !state.selectionInTranslation,
      );
      const vocabularyButton = menu.querySelector('[data-selection-action="vocabulary"]');
      vocabularyButton.disabled = /\s/.test(text);
      vocabularyButton.title = vocabularyButton.disabled ? "Selecciona una sola palabra" : "";
    };
    document.addEventListener("pointerup", () => window.setTimeout(update, 0));
    document.addEventListener("selectionchange", () => requestAnimationFrame(update));
    document.addEventListener("keyup", update);
    document.addEventListener("scroll", () => menu.classList.add("hidden"), true);
    menu.addEventListener("pointerdown", (event) => event.preventDefault());
    menu.addEventListener("click", (event) => {
      const action = event.target.closest("[data-selection-action]")?.dataset.selectionAction;
      if (action) {
        void handleSelectionAction(action);
      }
    });
  }

  function getSelectionPrefix(selectionRange, fromPdf) {
    const node = selectionRange.startContainer;
    const root = (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement)?.closest(
      fromPdf ? ".textLayer" : ".translation-page",
    );
    if (!root) {
      return "";
    }
    const prefix = document.createRange();
    prefix.selectNodeContents(root);
    try {
      prefix.setEnd(selectionRange.startContainer, selectionRange.startOffset);
      return prefix.toString();
    } catch {
      return "";
    }
  }

  async function handleSelectionAction(action) {
    const text = state.selection;
    const page = state.selectionPage;
    $("#selectionMenu").classList.add("hidden");
    if (action === "copy") {
      try {
        await navigator.clipboard.writeText(text);
        showToast("Texto copiado.");
      } catch (error) {
        showToast(`No se pudo copiar el texto: ${error.message}`);
      }
      return;
    }
    if (action === "translateToEnglish") {
      const selectedRange = state.selectionRange;
      const pageRequest = state.pageRequest;
      const documentId = state.document.id;
      const precedingText = state.selectionPrefix;
      const baseText = state.pageDisplay?.translation?.translatedText;
      if (
        !selectedRange ||
        !baseText ||
        !$("#translationContent").contains(selectedRange.commonAncestorContainer) ||
        !state.selectionInTranslation
      ) {
        showToast("Selecciona un fragmento de la traducción para traducirlo al inglés.");
        return;
      }
      try {
        $("#translationStatus").textContent = "Traduciendo selección al inglés…";
        const { translatedText } = await translateSelection(text, "en", "es");
        if (
          pageRequest !== state.pageRequest ||
          state.document?.id !== documentId ||
          state.pageDisplay?.page !== page ||
          !$("#translationContent").contains(selectedRange.commonAncestorContainer)
        ) {
          showToast("La página cambió; no se ha procesado la selección.");
          return;
        }
        const pendingEdit = {
          documentId,
          page,
          variant: "spanish",
          sourceText: text,
          precedingText,
          baseText,
          translatedText,
        };
        const applied = await applyPendingSelectionEdit(pendingEdit);
        $("#translationStatus").textContent = applied
          ? `Selección traducida al inglés · página ${page}.`
          : "No se aplicó la traducción seleccionada.";
      } catch (error) {
        $("#translationStatus").textContent = "No se pudo traducir la selección al inglés.";
        showToast(error.message);
      } finally {
        state.selectionRange = null;
        state.selectionInTranslation = false;
      }
      return;
    }
    if (action === "vocabulary") {
      if (/\s/.test(text)) {
        showToast("Selecciona una sola palabra para añadirla al vocabulario.");
        return;
      }
      try {
        const direction = getVocabularyTranslationDirection();
        const { translatedText } = await translateSelection(
          text,
          direction.target,
          direction.source,
        );
        addVocabulary({
          word: text,
          translation: translatedText,
          sourceLanguage: direction.sourceLabel,
          targetLanguage: direction.targetLabel,
          context: getPageContext(page),
          page,
          documentId: state.document.id,
          document: state.document.name,
        });
        showToast("Palabra añadida al vocabulario.");
      } catch (error) {
        showToast(error.message);
      }
      return;
    }
    try {
      $("#translationStatus").textContent =
        action === "explain" ? "Preparando una explicación…" : "Traduciendo selección…";
      if (action === "explain") {
        const { translatedText, explanation } = await explainSelection(
          text,
          getPageContext(page),
        );
        state.selectionDisplay = {
          originalText: text,
          translatedText: explanation,
          mode: "lesson",
        };
        renderActiveContent();
        $("#translationStatus").textContent = `Explicación de la selección · página ${page}.`;
      } else {
        const documentId = state.document.id;
        const pageRequest = state.pageRequest;
        const sourceLanguage = getOriginalLanguageLabel(state.document.name);
        const targetLanguage = sourceLanguage === "Español" ? "en" : "es";
        const sourceCode =
          sourceLanguage === "Inglés" ? "en" : sourceLanguage === "Español" ? "es" : "auto";
        const baseText = state.pageDisplay?.prepared?.originalText;
        const precedingText = state.selectionPrefix;
        if (!baseText) {
          throw new Error("No se encontró el texto base de la página.");
        }
        const { translatedText } = await translateSelection(
          text,
          targetLanguage,
          sourceCode,
        );
        if (
          pageRequest !== state.pageRequest ||
          state.document?.id !== documentId ||
          state.pageDisplay?.page !== page
        ) {
          showToast("La página cambió; no se ha procesado la selección.");
          return;
        }
        const applied = await applyPendingSelectionEdit({
          documentId,
          page,
          variant: "original",
          sourceText: text,
          precedingText,
          baseText,
          translatedText,
        });
        $("#translationStatus").textContent = applied
          ? `Selección traducida al ${targetLanguage === "es" ? "español" : "inglés"} · página ${page}.`
          : "No se aplicó la traducción seleccionada.";
      }
    } catch (error) {
      $("#translationStatus").textContent = "No se pudo procesar la selección.";
      showToast(error.message);
    }
  }

  function getVocabularyTranslationDirection() {
    if (state.selectionVariant === "spanish") {
      return {
        source: "es",
        target: "en",
        sourceLabel: "Español",
        targetLabel: "Inglés",
      };
    }

    const sourceLabel = getOriginalLanguageLabel(state.document.name);
    if (sourceLabel === "Español") {
      return {
        source: "es",
        target: "en",
        sourceLabel: "Español",
        targetLabel: "Inglés",
      };
    }
    return {
      source: sourceLabel === "Inglés" ? "en" : "auto",
      target: "es",
      sourceLabel,
      targetLabel: "Español",
    };
  }

  function getPageContext(page) {
    const content =
      state.translations.get(page)?.originalText ??
      state.ocr.get(page) ??
      state.pageSources.get(page) ??
      "";
    return content.slice(0, 1200);
  }

  function wireVocabulary() {
    $("#vocabularyButton").addEventListener("click", openVocabulary);
    $("#closeVocabularyButton").addEventListener("click", () => $("#vocabularyDialog").close());
    $("#vocabularyDialog").addEventListener("click", (event) => {
      const removeButton = event.target.closest("[data-remove-vocabulary]");
      if (removeButton) {
        removeVocabulary(removeButton.dataset.removeVocabulary);
        renderVocabularyList();
      }
    });
  }

  function openVocabulary() {
    renderVocabularyList();
    openBlockingDialog($("#vocabularyDialog"));
  }

  function renderVocabularyList() {
    const list = $("#vocabularyList");
    list.replaceChildren();
    const entries = listVocabulary();
    if (!entries.length) {
      const empty = document.createElement("p");
      empty.className = "vocabulary-empty";
      empty.textContent = "Todavía no has guardado palabras.";
      list.append(empty);
      return;
    }
    for (const entry of entries) {
      const card = document.createElement("article");
      card.className = "vocabulary-card";
      const header = document.createElement("div");
      header.className = "flex items-start justify-between gap-3";
      const title = document.createElement("div");
      const word = document.createElement("h3");
      word.className = "vocabulary-word";
      word.textContent = entry.word;
      const sourceLanguage = document.createElement("span");
      sourceLanguage.className = "vocabulary-language";
      sourceLanguage.textContent = entry.sourceLanguage ?? "Palabra";
      const translation = document.createElement("p");
      translation.className = "vocabulary-translation";
      translation.textContent = entry.translation;
      const translationLanguage = document.createElement("span");
      translationLanguage.className = "vocabulary-language";
      translationLanguage.textContent = entry.targetLanguage ?? "Traducción";
      title.append(sourceLanguage, word, translationLanguage, translation);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "shrink-0 rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100";
      remove.textContent = "Eliminar";
      remove.dataset.removeVocabulary = entry.id;
      header.append(title, remove);
      const detail = document.createElement("p");
      detail.className = "vocabulary-context";
      detail.textContent = `${entry.document} · página ${entry.page} · ${entry.context}`;
      card.append(header, detail);
      list.append(card);
    }
  }

  function wireResponsiveTabs() {
    const translation = $("#translationPanel");
    const pdf = $("#pdfPanel");
    const setTab = (panel) => {
      const showTranslation = panel === "translation";
      translation.classList.toggle("mobile-panel-hidden", !showTranslation);
      pdf.classList.toggle("mobile-panel-hidden", showTranslation);
      $("#mobileTranslationTab").className = showTranslation
        ? "rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700"
        : "rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500";
      $("#mobilePdfTab").className = showTranslation
        ? "rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500"
        : "rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700";
      if (!showTranslation && reader && ["page-width", "page-fit"].includes(reader.scaleMode)) {
        requestAnimationFrame(() => reader.setScale(reader.scaleMode));
      }
    };
    $("#mobileTranslationTab").addEventListener("click", () => setTab("translation"));
    $("#mobilePdfTab").addEventListener("click", () => setTab("pdf"));
    setTab("translation");
    window.addEventListener("resize", () => {
      if (reader && ["page-width", "page-fit"].includes(reader.scaleMode)) {
        requestAnimationFrame(() => reader.setScale(reader.scaleMode));
      }
    });
  }
}

function debounce(callback, delay) {
  let timer;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => callback(...args), delay);
  };
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.add("hidden"), 4200);
}

function isSparseText(text) {
  const words = text.match(/[\p{L}\p{N}]{2,}/gu) ?? [];
  const usefulCharacters = (text.match(/[\p{L}\p{N}]/gu) ?? []).length;
  return words.length < 3 && usefulCharacters < 24;
}

function combinePageText(digitalText, ocrText) {
  if (!digitalText.trim()) {
    return ocrText.trim();
  }
  if (!ocrText.trim()) {
    return digitalText;
  }
  const normalize = (text) => text.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const digital = normalize(digitalText);
  const recognized = normalize(ocrText);
  if (recognized.includes(digital)) {
    return ocrText;
  }
  if (digital.includes(recognized)) {
    return digitalText;
  }
  return `${digitalText.trim()}\n\n${ocrText.trim()}`;
}
