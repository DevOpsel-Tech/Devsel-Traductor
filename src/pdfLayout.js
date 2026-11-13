// Group text by baseline, then split large horizontal gaps (columns/table cells).
export function groupTextLines(parts, pageWidth) {
  const rows = [];
  for (const part of parts) {
    if (!part.text.trim() || part.width <= 0 || part.height <= 0) continue;
    const center = part.top + part.height / 2;
    let row = rows.find((item) => Math.abs(item.center - center) < Math.max(3, Math.min(item.height, part.height) * .4));
    if (!row) { row = { center, height: part.height, parts: [] }; rows.push(row); }
    row.parts.push(part);
  }
  const lines = [];
  for (const row of rows) {
    row.parts.sort((a, b) => a.left - b.left);
    let group = [];
    let right = -Infinity;
    for (const part of row.parts) {
      const gapLimit = Math.max(32, row.height * 3, pageWidth * .04);
      if (group.length && part.left - right > gapLimit) {
        lines.push(makeLine(group)); group = [];
      }
      group.push(part); right = group.length === 1 ? part.right : Math.max(right, part.right);
    }
    if (group.length) lines.push(makeLine(group));
  }
  return lines.sort((a, b) => a.top - b.top || a.left - b.left);
}

function makeLine(parts) {
  const left = Math.min(...parts.map((part) => part.left));
  const right = Math.max(...parts.map((part) => part.right));
  const top = Math.min(...parts.map((part) => part.top));
  const bottom = Math.max(...parts.map((part) => part.bottom));
  let text = "";
  let previous = null;
  for (const part of parts) {
    if (previous && part.left - previous.right > Math.max(1, part.height * .12) && !/\s$/.test(text) && !/^\s/.test(part.text)) text += " ";
    text += part.text;
    previous = part;
  }
  return { text: text.replace(/\s+/g, " ").trim(), left, right, top, bottom };
}

export function fittingFontSize(textWidth, availableWidth, initialSize, minimumSize = 7) {
  if (textWidth <= 0 || availableWidth <= 0) return minimumSize;
  return Math.max(minimumSize, Math.min(initialSize, initialSize * availableWidth / textWidth));
}
