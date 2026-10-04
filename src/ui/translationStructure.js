const LIST_ITEM = /^\s*([•●▪◦*-–—]|\d+[.)])\s+(.+)$/;
const TABLE_ROW = /^\s*\|(.+)\|\s*$/;
const HEADING_WORDS =
  /^(?:structure|spelling rules|rules|examples?|present simple(?:\s+vs\.?\s+present continuous)?|past simple|present continuous|past continuous|future(?: simple| tense)?|presente simple|reglas de ortografía|reglas|ejemplos?|estructura|affirmative|negative|interrogative|affirmativo|negativo|interrogativo)$/i;

function parseTableRow(line) {
  const markdownRow = line.match(TABLE_ROW);
  const cells = markdownRow
    ? markdownRow[1].split("|").map((cell) => cell.trim())
    : line.split("\t").map((cell) => cell.trim());

  if (cells.length < 2 || !cells.some(Boolean) || cells.every((cell) => /^:?-{3,}:?$/.test(cell))) {
    return null;
  }
  return cells;
}

function isHeading(line) {
  const normalized = line.replace(/^#{1,6}\s+/, "").trim();
  if (!normalized || normalized.length > 110) {
    return false;
  }
  if (/^#{1,6}\s+/.test(line) || /^\d+(?:\.\d+)*\.?\s+\S/.test(normalized)) {
    return true;
  }
  if (/[.!?;:]$/.test(normalized) || LIST_ITEM.test(normalized)) {
    return false;
  }
  if (HEADING_WORDS.test(normalized)) {
    return true;
  }
  const letters = normalized.replace(/[^A-Za-zÀ-ÿ]/g, "");
  return letters.length >= 3 && normalized === normalized.toLocaleUpperCase() && normalized.length <= 64;
}

export function parseTranslationStructure(text) {
  const blocks = [];
  let paragraph = [];
  let list = null;
  let tableRows = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: "paragraph", text: paragraph.join("\n") });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      blocks.push({ type: "list", ordered: list.ordered, items: list.items });
      list = null;
    }
  };
  const flushTable = () => {
    if (tableRows.length) {
      blocks.push({ type: "table", rows: tableRows });
      tableRows = [];
    }
  };

  for (const line of text.split("\n")) {
    if (!line.trim()) {
      flushParagraph();
      flushList();
      flushTable();
      continue;
    }

    const tableRow = parseTableRow(line);
    if (tableRow) {
      flushParagraph();
      flushList();
      tableRows.push(tableRow);
      continue;
    }
    flushTable();

    const listItem = line.match(LIST_ITEM);
    if (listItem) {
      flushParagraph();
      const ordered = /^\d/.test(listItem[1]);
      if (list && list.ordered !== ordered) {
        flushList();
      }
      list ??= { ordered, items: [] };
      list.items.push(listItem[2]);
      continue;
    }
    flushList();

    if (isHeading(line)) {
      flushParagraph();
      blocks.push({ type: "heading", text: line.replace(/^#{1,6}\s+/, "").trim() });
    } else {
      paragraph.push(line);
    }
  }

  flushParagraph();
  flushList();
  flushTable();
  return blocks;
}
