import { findSelectionRange, textFingerprint } from "../reading/readingEdits.js";

export function renderPdfTextEdits(pageElement, baseText, edits) {
  const textLayer = pageElement.querySelector(".textLayer");
  if (!textLayer) {
    return { applied: 0, missing: edits.length };
  }

  pageElement.querySelector(".pdf-reading-edits-layer")?.remove();
  const applicableEdits = edits.filter(
    (edit) => edit.baseHash === textFingerprint(baseText),
  );
  if (!applicableEdits.length) {
    return { applied: 0, missing: 0 };
  }

  const indexedText = indexPdfTextLayer(textLayer);
  const pageBounds = pageElement.getBoundingClientRect();
  const overlay = document.createElement("div");
  overlay.className = "pdf-reading-edits-layer";
  let applied = 0;

  for (const edit of applicableEdits) {
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
    const rects = range
      ? [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0)
      : [];
    const firstRect = rects[0];
    if (!firstRect) {
      continue;
    }

    if (edit.mode === "replace") {
      for (const rect of rects) {
        const cover = document.createElement("span");
        cover.className = "pdf-reading-edit-cover";
        cover.style.left = `${rect.left - pageBounds.left}px`;
        cover.style.top = `${rect.top - pageBounds.top}px`;
        cover.style.width = `${rect.width}px`;
        cover.style.height = `${rect.height}px`;
        overlay.append(cover);
      }
    }

    const marker = document.createElement("span");
    marker.className = "pdf-reading-edit-mark";
    marker.style.left = `${firstRect.left - pageBounds.left}px`;
    marker.style.top = `${(
      (edit.mode === "below" ? rects.at(-1).bottom : firstRect.top) -
      pageBounds.top
    )}px`;
    marker.style.minWidth = `${firstRect.width}px`;
    marker.style.maxWidth = `${Math.max(80, pageBounds.right - firstRect.left - 8)}px`;
    marker.textContent = edit.translatedText;
    marker.dataset.readingEditRendered = "";

    const undo = document.createElement("button");
    undo.type = "button";
    undo.className = "reading-edit-revert";
    undo.dataset.undoReadingEdit = edit.id;
    undo.dataset.readingEditVariant = "original";
    undo.dataset.readingEditPage = pageElement.dataset.pageNumber ?? "";
    undo.setAttribute("aria-label", "Revertir este cambio");
    undo.title = "Revertir este cambio";
    marker.append(undo);
    overlay.append(marker);
    applied += 1;
  }

  if (overlay.childElementCount) {
    pageElement.append(overlay);
  }
  return { applied, missing: applicableEdits.length - applied };
}

function indexPdfTextLayer(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let text = "";
  let previous = null;
  let node = walker.nextNode();

  while (node) {
    const bounds = node.parentElement?.getBoundingClientRect();
    const nodeText = node.textContent;
    if (previous && bounds) {
      const verticalGap = Math.abs(bounds.top - previous.bounds.top);
      if (verticalGap > Math.max(2, bounds.height * 0.5)) {
        text += "\n";
      } else {
        const horizontalGap = bounds.left - previous.bounds.right;
        const characterWidth =
          previous.bounds.width / Math.max(previous.text.trimEnd().length, 1);
        if (
          horizontalGap > Math.max(1, characterWidth * 0.35) &&
          !/\s$/.test(previous.text) &&
          !/^\s/.test(nodeText)
        ) {
          text += " ";
        }
      }
    }
    const start = text.length;
    text += nodeText;
    nodes.push({ node, start, end: text.length });
    if (bounds) {
      previous = { bounds, text: nodeText };
    }
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
