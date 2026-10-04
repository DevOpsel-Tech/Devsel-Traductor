export function textFingerprint(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function findSelectionStart(baseText, selectedText, precedingText = "") {
  return findSelectionRange(baseText, selectedText, precedingText)?.start ?? -1;
}

export function findSelectionRange(
  baseText,
  selectedText,
  precedingText = "",
  preferredOccurrence,
) {
  const needle = normalizeForSearch(selectedText);
  if (!needle) {
    return null;
  }
  const normalized = normalizeWithOffsets(baseText);
  const positions = [];
  let offset = 0;
  while ((offset = normalized.text.indexOf(needle, offset)) >= 0) {
    positions.push(offset);
    offset += needle.length;
  }
  if (!positions.length) {
    return null;
  }

  const preceding = normalizeForSearch(precedingText);
  const occurrence = Number.isSafeInteger(preferredOccurrence)
    ? Math.max(0, preferredOccurrence)
    : countSelectionOccurrences(preceding, needle);
  const normalizedStart = positions[Math.min(occurrence, positions.length - 1)];
  const start = normalized.offsets[normalizedStart];
  const lastOffset = normalized.offsets[normalizedStart + needle.length - 1];
  const end =
    normalized.offsets[normalizedStart + needle.length] ??
    lastOffset + (baseText.codePointAt(lastOffset) > 0xffff ? 2 : 1);
  return { start, end };
}

export function countSelectionOccurrences(precedingText, selectedText) {
  const needle = normalizeForSearch(selectedText);
  if (!needle) {
    return 0;
  }
  let count = 0;
  let index = 0;
  const preceding = normalizeForSearch(precedingText);
  while ((index = preceding.indexOf(needle, index)) >= 0) {
    count += 1;
    index += needle.length;
  }
  return count;
}

export function applyReadingEdits(text, edits) {
  const applicable = edits
    .filter((edit) => edit.baseHash === textFingerprint(text))
    .slice()
    .sort((left, right) => right.start - left.start);
  let result = text;
  for (const edit of applicable) {
    const selected = result.slice(edit.start, edit.end);
    if (normalizeForSearch(selected) !== normalizeForSearch(edit.sourceText)) {
      continue;
    }
    const inserted =
      edit.mode === "replace"
        ? edit.translatedText
        : `${selected}\n${edit.translatedText}`;
    result = `${result.slice(0, edit.start)}${inserted}${result.slice(edit.end)}`;
  }
  return result;
}

export function hasOverlappingEdit(edits, start, end) {
  return edits.some((edit) => start < edit.end && end > edit.start);
}

function normalizeForSearch(text) {
  return text.replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

function normalizeWithOffsets(text) {
  let normalized = "";
  const offsets = [];
  let pendingSpace = false;
  let pendingSpaceOffset = -1;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (/\s/.test(character)) {
      if (normalized && !pendingSpace) {
        pendingSpace = true;
        pendingSpaceOffset = index;
      }
      continue;
    }
    if (pendingSpace) {
      normalized += " ";
      offsets.push(pendingSpaceOffset);
      pendingSpace = false;
    }
    const lowerCharacter = character.toLocaleLowerCase();
    normalized += lowerCharacter;
    offsets.push(index);
    for (let expansion = 1; expansion < lowerCharacter.length; expansion += 1) {
      offsets.push(index);
    }
  }
  return { text: normalized, offsets };
}
