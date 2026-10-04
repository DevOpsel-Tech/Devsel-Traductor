import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";

const PAGE_MARGIN = 42;
const HEADER_HEIGHT = 36;
const MIN_FONT_SIZE = 6;

export async function createModifiedReadingPdf(sourceBytes, modifiedPages, fontBytes) {
  const source = await PDFDocument.load(sourceBytes);
  const output = await PDFDocument.create();
  output.registerFontkit(fontkit);
  const [basicBytes, extendedBytes] = fontBytes;
  const basicFont = await output.embedFont(basicBytes, { subset: true });
  const extendedFont = await output.embedFont(extendedBytes, { subset: true });
  const changedPages = new Map(modifiedPages.map((page) => [page.page, page]));

  for (let index = 0; index < source.getPageCount(); index += 1) {
    const pageNumber = index + 1;
    const sourcePage = source.getPage(index);
    const changedPage = changedPages.get(pageNumber);
    if (!changedPage) {
      const [copy] = await output.copyPages(source, [index]);
      output.addPage(copy);
      continue;
    }

    const { width, height } = sourcePage.getSize();
    drawReflowedPages(
      output,
      changedPage.text,
      [basicFont, extendedFont],
      width,
      height,
      changedPage.variantLabel,
      pageNumber,
    );
  }

  output.setTitle("Lectura modificada");
  output.setSubject("Edición de lectura guardada desde traductor pdf: << $elu >>");
  return output.save();
}

function drawReflowedPages(output, text, fonts, pageWidth, pageHeight, variantLabel, pageNumber) {
  const contentWidth = pageWidth - PAGE_MARGIN * 2;
  const normalizedText = normalizePdfCharacters(text, fonts);
  const fontSize = chooseFontSize(normalizedText, fonts, contentWidth, pageHeight);
  const lineHeight = fontSize * 1.45;
  const lines = wrapText(normalizedText, fonts, fontSize, contentWidth);
  const availableHeight = pageHeight - PAGE_MARGIN * 2 - HEADER_HEIGHT;
  const linesPerPage = Math.max(1, Math.floor(availableHeight / lineHeight));
  for (let offset = 0; offset < lines.length; offset += linesPerPage) {
    const page = output.addPage([pageWidth, pageHeight]);
    const continuation = offset ? " · continuación" : "";
    page.drawText(
      `Lectura modificada · ${variantLabel} · página ${pageNumber}${continuation}`,
      {
        x: PAGE_MARGIN,
        y: pageHeight - PAGE_MARGIN,
        size: 9,
        font: fonts[0],
        color: rgb(0.22, 0.25, 0.36),
      },
    );
    let y = pageHeight - PAGE_MARGIN - HEADER_HEIGHT;
    for (const line of lines.slice(offset, offset + linesPerPage)) {
      drawFontRuns(page, line, fonts, PAGE_MARGIN, y, fontSize);
      y -= lineHeight;
    }
  }
}

function chooseFontSize(text, fonts, contentWidth, pageHeight) {
  const availableLines =
    Math.floor((pageHeight - PAGE_MARGIN * 2 - HEADER_HEIGHT) / (MIN_FONT_SIZE * 1.45));
  for (let size = 10; size >= MIN_FONT_SIZE; size -= 0.5) {
    if (wrapText(text, fonts, size, contentWidth).length <= availableLines) {
      return size;
    }
  }
  return MIN_FONT_SIZE;
}

function wrapText(text, fonts, fontSize, maxWidth) {
  const lines = [];
  for (const paragraph of text.replace(/\r\n?/g, "\n").split("\n")) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }
    const words = paragraph.trim().split(/\s+/);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (measureText(candidate, fonts, fontSize) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) {
        lines.push(line);
      }
      line = splitLongWord(word, fonts, fontSize, maxWidth, lines);
    }
    if (line) {
      lines.push(line);
    }
  }
  return lines;
}

function splitLongWord(word, fonts, fontSize, maxWidth, lines) {
  let segment = "";
  for (const character of word) {
    const candidate = segment + character;
    if (segment && measureText(candidate, fonts, fontSize) > maxWidth) {
      lines.push(segment);
      segment = character;
    } else {
      segment = candidate;
    }
  }
  return segment;
}

export async function loadFont(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`No se pudo cargar la fuente Unicode para el PDF (HTTP ${response.status}).`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

function normalizePdfCharacters(text, fonts) {
  const replacements = new Map([
    ["→", "->"],
    ["←", "<-"],
    ["↔", "<->"],
    ["•", "*"],
    ["●", "*"],
    ["–", "-"],
    ["—", "-"],
    ["‘", "'"],
    ["’", "'"],
    ["“", '"'],
    ["”", '"'],
    ["…", "..."],
    ["\u00a0", " "],
  ]);
  let normalized = "";
  for (const character of text.replace(/\r\n?/g, "\n")) {
    if (character === "\n") {
      normalized += character;
      continue;
    }
    if (character === "\t") {
      normalized += " ";
      continue;
    }
    const replacement = replacements.get(character);
    if (replacement !== undefined) {
      normalized += replacement;
      continue;
    }
    if (!selectFont(character, fonts)) {
      throw new Error(
        `El PDF modificado contiene un carácter no disponible en la fuente: ${character}`,
      );
    }
    normalized += character;
  }
  return normalized;
}

function selectFont(character, fonts) {
  const codePoint = character.codePointAt(0);
  return fonts.find((font) => font.getCharacterSet().includes(codePoint)) ?? null;
}

function measureText(text, fonts, fontSize) {
  let width = 0;
  for (const character of text) {
    const font = selectFont(character, fonts);
    if (!font) {
      throw new Error(`No se puede medir este carácter en el PDF: ${character}`);
    }
    width += font.widthOfTextAtSize(character, fontSize);
  }
  return width;
}

function drawFontRuns(page, text, fonts, x, y, fontSize) {
  let run = "";
  let runFont = null;
  let cursor = x;
  const flush = () => {
    if (!run) {
      return;
    }
    page.drawText(run, {
      x: cursor,
      y,
      size: fontSize,
      font: runFont,
      color: rgb(0.12, 0.16, 0.23),
    });
    cursor += runFont.widthOfTextAtSize(run, fontSize);
    run = "";
  };

  for (const character of text) {
    const font = selectFont(character, fonts);
    if (font !== runFont) {
      flush();
      runFont = font;
    }
    run += character;
  }
  flush();
}
