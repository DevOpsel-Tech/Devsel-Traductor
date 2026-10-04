import { parseTranslationStructure } from "./translationStructure.js";
import { findSelectionRange, textFingerprint } from "../reading/readingEdits.js";

export function renderTranslation(
  container,
  { originalText, translatedText, mode },
  view = "translated",
  readingEdits = [],
) {
  container.replaceChildren();

  const page = document.createElement("article");
  page.className = "translation-page";
  container.append(page);

  let text;
  if (view === "original") {
    text = originalText;
  } else if (mode === "ocr") {
    return;
  } else {
    text = translatedText;
  }

  const applicableEdits = readingEdits.filter(
    (edit) => edit.baseHash === textFingerprint(text),
  );
  appendStructuredText(page, text, applicableEdits.length > 0);
  applyReadingEditsToPage(page, text, applicableEdits, view);
}

function appendStructuredText(container, text, showPageLanguageLabels = false) {
  const fragments = text.split(/(```[\s\S]*?```)/g);
  for (const fragment of fragments) {
    if (!fragment) {
      continue;
    }
    if (fragment.startsWith("```") && fragment.endsWith("```")) {
      const code = document.createElement("pre");
      code.textContent = fragment.slice(3, -3).replace(/^\w+\n/, "");
      container.append(code);
      continue;
    }
    for (const block of parseTranslationStructure(fragment)) {
      if (block.type === "heading") {
        if (!showPageLanguageLabels && isPageLanguageLabel(block.text)) {
          continue;
        }
        const heading = document.createElement("h3");
        heading.className = "translation-heading";
        heading.textContent = block.text;
        container.append(heading);
      } else if (block.type === "list") {
        const list = document.createElement(block.ordered ? "ol" : "ul");
        list.className = block.ordered ? "translation-list translation-list-ordered" : "translation-list";
        for (const item of block.items) {
          const listItem = document.createElement("li");
          listItem.textContent = item;
          list.append(listItem);
        }
        container.append(list);
      } else if (block.type === "table") {
        const wrapper = document.createElement("div");
        wrapper.className = "translation-table-wrapper";
        const table = document.createElement("table");
        table.className = "translation-table";
        const [header, ...rows] = block.rows;
        const tableHead = document.createElement("thead");
        const headerRow = document.createElement("tr");
        for (const value of header) {
          const cell = document.createElement("th");
          cell.scope = "col";
          cell.textContent = value;
          headerRow.append(cell);
        }
        tableHead.append(headerRow);
        table.append(tableHead);
        if (rows.length) {
          const body = document.createElement("tbody");
          for (const values of rows) {
            const row = document.createElement("tr");
            for (let index = 0; index < header.length; index += 1) {
              const cell = document.createElement("td");
              cell.textContent = values[index] ?? "";
              row.append(cell);
            }
            body.append(row);
          }
          table.append(body);
        }
        wrapper.append(table);
        container.append(wrapper);
      } else {
        if (!showPageLanguageLabels && isPageLanguageLabel(block.text)) {
          continue;
        }
        const paragraph = document.createElement("p");
        paragraph.className = "whitespace-pre-wrap text-[14px] text-slate-700";
        paragraph.textContent = block.text;
        container.append(paragraph);
      }
    }
  }
}

function applyReadingEditsToPage(page, baseText, edits, view) {
  const indexedText = indexRenderedText(page);
  const matches = [];

  for (const edit of edits) {
    const precedingText =
      typeof edit.occurrence === "number"
        ? ""
        : baseText.slice(0, edit.start);
    const match = findSelectionRange(
      indexedText.text,
      edit.sourceText,
      precedingText,
      edit.occurrence,
    );
    if (!match) {
      continue;
    }
    const range = createDomRange(indexedText.nodes, match.start, match.end);
    if (range) {
      matches.push({ edit, range, start: match.start });
    }
  }

  matches.sort((left, right) => right.start - left.start);
  for (const { edit, range } of matches) {
    const marker = createReadingEditMarker(edit, view);
    if (edit.mode === "replace") {
      range.deleteContents();
      range.insertNode(marker);
    } else {
      range.collapse(false);
      range.insertNode(marker);
    }
  }
}

function createReadingEditMarker(edit, view) {
  const marker = document.createElement("span");
  marker.className = "reading-edit-applied";
  if (edit.mode === "below") {
    marker.classList.add("reading-edit-inserted");
  }
  marker.dataset.readingEditRendered = "";
  marker.textContent = edit.translatedText;

  const undo = document.createElement("button");
  undo.type = "button";
  undo.className = "reading-edit-revert";
  undo.dataset.undoReadingEdit = edit.id;
  undo.dataset.readingEditVariant = view === "original" ? "original" : "spanish";
  undo.setAttribute("aria-label", "Revertir este cambio");
  undo.title = "Revertir este cambio";
  marker.append(undo);
  return marker;
}

function indexRenderedText(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let text = "";
  let previousBlock = null;
  let node = walker.nextNode();
  while (node) {
    const block =
      node.parentElement?.closest("p, h3, li, th, td, pre") ??
      node.parentElement;
    if (previousBlock && block !== previousBlock) {
      const previousCell = previousBlock.closest("th, td");
      const currentCell = block?.closest("th, td");
      text += previousCell && previousCell.parentElement === currentCell?.parentElement
        ? "\t"
        : "\n";
    }
    const start = text.length;
    text += node.textContent;
    nodes.push({ node, start, end: text.length });
    previousBlock = block;
    node = walker.nextNode();
  }
  return { text, nodes };
}

function createDomRange(nodes, start, end) {
  const startEntry =
    nodes.find((entry) => start >= entry.start && start < entry.end) ??
    nodes.find((entry) => entry.start >= start);
  const endEntry =
    nodes.find((entry) => end > entry.start && end <= entry.end) ??
    [...nodes].reverse().find((entry) => entry.end <= end);
  if (!startEntry || !endEntry) {
    return null;
  }

  const range = document.createRange();
  range.setStart(startEntry.node, Math.max(0, start - startEntry.start));
  range.setEnd(endEntry.node, Math.min(endEntry.node.textContent.length, end - endEntry.start));
  return range;
}

function isPageLanguageLabel(text) {
  return /^(?:english|inglés)\s+gs$/i.test(text.trim());
}

export function renderScannedPrompt(container, page, onOcr) {
  container.replaceChildren();
  const card = document.createElement("section");
  card.className = "rounded-xl border border-amber-200 bg-amber-50 p-5";
  const heading = document.createElement("h2");
  heading.className = "text-sm font-semibold text-amber-950";
  heading.textContent = "Esta página parece escaneada";
  const explanation = document.createElement("p");
  explanation.className = "mt-2 text-sm leading-6 text-amber-900/75";
  explanation.textContent =
    "PDF.js no encontró texto seleccionable. Puedes reconocer únicamente esta página con OCR; el resultado se guardará en la caché del documento.";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "icon-button mt-4 bg-amber-900 text-white hover:bg-amber-950";
  button.textContent = "Reconocer texto con OCR";
  button.addEventListener("click", () => onOcr(page, button));
  card.append(heading, explanation, button);
  container.append(card);
}

export function renderOcrSuggestion(container, text, page, onOcr) {
  container.replaceChildren();
  const card = document.createElement("section");
  card.className = "mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4";
  const heading = document.createElement("h2");
  heading.className = "text-sm font-semibold text-amber-950";
  heading.textContent = "La página contiene una imagen y poco texto";
  const message = document.createElement("p");
  message.className = "mt-2 text-sm leading-6 text-amber-900/75";
  message.textContent =
    "El texto digital encontrado seguirá siendo la base. Si falta contenido dentro de la imagen, puedes añadir su reconocimiento con OCR bajo demanda.";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "icon-button mt-3 bg-amber-900 text-white hover:bg-amber-950";
  button.textContent = "Reconocer texto de la imagen";
  button.addEventListener("click", () => onOcr(page, button));
  const extracted = document.createElement("p");
  extracted.className = "mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700";
  extracted.textContent = text;
  card.append(heading, message, button);
  container.append(card, extracted);
}

export function renderEmptyPage(container, title, description) {
  container.replaceChildren();
  const wrapper = document.createElement("div");
  wrapper.className = "mx-auto mt-10 max-w-sm rounded-xl border border-slate-200 bg-slate-50 p-5 text-center";
  const heading = document.createElement("h2");
  heading.className = "text-sm font-semibold text-slate-700";
  heading.textContent = title;
  const message = document.createElement("p");
  message.className = "mt-2 text-sm leading-6 text-slate-500";
  message.textContent = description;
  wrapper.append(heading, message);
  container.append(wrapper);
}
