export function extractPageText(items) {
  const textItems = items.filter((item) => item.str || item.hasEOL);
  if (!textItems.length) {
    return "";
  }
  if (textItems.some((item) => !Array.isArray(item.transform))) {
    return normalizeWrappedText(
      textItems
        .map((item) => `${item.str}${item.hasEOL ? "\n" : " "}`)
        .join("")
        .trim(),
    );
  }

  const rows = [];
  for (const item of textItems) {
    const baseline = item.transform[5];
    const fontSize = Math.max(1, Math.hypot(item.transform[2], item.transform[3]));
    let row = rows.find(
      (candidate) =>
        Math.abs(candidate.baseline - baseline) <= Math.max(2, Math.min(candidate.fontSize, fontSize) * 0.25),
    );
    if (!row) {
      row = { baseline, fontSize, items: [] };
      rows.push(row);
    }
    row.items.push(item);
  }

  rows.sort((left, right) => right.baseline - left.baseline);
  return normalizeWrappedText(rows
    .map((row, index) => {
      row.items.sort((left, right) => left.transform[4] - right.transform[4]);
      let line = "";
      let previous = null;
      for (const item of row.items) {
        if (previous) {
          const previousText = previous.str.trimEnd();
          const gap = item.transform[4] - previous.transform[4] - previous.width;
          const characterWidth = previous.width / Math.max(previousText.length, 1);
          if (gap > Math.max(12, characterWidth * 2.5)) {
            line += "\t";
          } else if (gap > characterWidth * 0.35 && !item.str.startsWith(" ")) {
            line += " ";
          }
        }
        line += item.str;
        previous = item;
      }
      const nextRow = rows[index + 1];
      const verticalGap = nextRow ? row.baseline - nextRow.baseline : 0;
      return `${line.trimEnd()}${verticalGap > row.fontSize * 2.2 ? "\n\n" : "\n"}`;
    })
    .join("")
    .trim());
}

function normalizeWrappedText(text) {
  const lines = text
    .replace(/([A-Za-z])-\s*\n\s*([a-z])/g, "$1$2")
    .replace(/(\d+)\s*(?:\n+\s*|\s+)(st|nd|rd|th)\b/gi, "$1$2")
    .replace(/\bin the\s+rd\s*\n+\s*person singular\b/gi, "in the third person singular")
    .replace(/\brd\s*\n+\s*person singular\b/gi, "third person singular")
    .replace(/\b3\s+person singular\b/gi, "3rd person singular")
    .replace(/(?<!\d)\b(?:st|nd|rd|th)\b[ \t]*\n/gi, "")
    .replace(/(?<!\d)\b(?:st|nd|rd|th)\b/gi, "")
    .split("\n");
  const normalized = [];

  for (const line of lines) {
    const current = line.trim();
    if (!current) {
      if (normalized.length && normalized.at(-1) !== "") {
        normalized.push("");
      }
      continue;
    }

    const previous = normalized.at(-1);
    const isWrappedContinuation =
      previous &&
      previous !== "" &&
      /^(?:[a-z]|\d+(?:st|nd|rd|th)\b|[+])/.test(current) &&
      !/[.!?:;]$/.test(previous);

    if (isWrappedContinuation) {
      normalized[normalized.length - 1] = `${previous} ${current}`;
    } else {
      normalized.push(current);
    }
  }

  return normalized.join("\n").trim();
}
