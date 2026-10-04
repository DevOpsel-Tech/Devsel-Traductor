const CODE_LINE =
  /^\s*(?:(?:public|private|protected|static|final|async|export|import)\s+)*(?:class|interface|enum|function|const|let|var|return|package|SELECT\b|INSERT\b|UPDATE\b|DELETE\b|<[/!?]?[A-Za-z][^>]*>|(?:npm|node|git|python|java)\s+|(?:if|for|while|switch|catch)\s*\(|[\w.$]+\([^)]*\)\s*[{;]|[A-Z_]{2,}\s*=|[$>]\s+.+|[.#]?[\w-]+\s*\{.*|[\w-]+\s*:\s*[^;{}]+;|"(?:[^"]+)"\s*:|[\w$.-]+\s*=\s*[^=].*)/i;

const PROTECTED_FRAGMENT =
  /```[\s\S]*?```|`[^`\n]+`|(?:[Hh][Tt][Tt][Pp][Ss]?:\/\/|www\.)[^\s<>()]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|(?:[A-Za-z]:\\|\/)[\w./\\-]+|\b[\w-]+\.(?:m?js|cjs|ts|java|py|html?|css|scss|json|xml|sql|md|pdf|png|jpe?g|csv)\b|\b[a-z]+[A-Z]\w*\b|\b[A-Z][a-z]+(?:[A-Z][a-z0-9]*)+\b|\b[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\([^()\n]*\)\s*;?/gm;

export function classifyPage(text) {
  const exercise = /\b(?:exercise|practice|complete the|fill in|choose the|answer the following|worksheet|activity|activities)\b/i.test(text);
  const lesson =
    /\b(?:grammar|present simple|past simple|present continuous|past continuous|future tense|third[- ]person singular|[1-9](?:st|nd|rd|th) person)\b/i.test(
      text,
    );
  const mode = exercise ? "exercise" : lesson ? "lesson" : "prose";
  const protectedParts = [];
  const preserve = (value) => {
    const token = `ZXQFOLIOCODE${protectedParts.length}QXZ`;
    protectedParts.push([token, value]);
    return token;
  };

  let codeDepth = 0;
  const translationSource = text
    .split("\n")
    .map((line) => {
      const startsCode = CODE_LINE.test(line);
      const isCode = startsCode || codeDepth > 0;
      if (isCode) {
        const structural = line.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, "");
        for (const character of structural) {
          if (character === "{") {
            codeDepth += 1;
          } else if (character === "}") {
            codeDepth = Math.max(0, codeDepth - 1);
          }
        }
        return preserve(line);
      }
      return line.replace(PROTECTED_FRAGMENT, preserve);
    })
    .join("\n")
    .trim();

  return {
    mode,
    originalText: text,
    translationSource,
    restoreTranslation(translatedText) {
      let restored = translatedText;
      for (const [token, original] of protectedParts) {
        if (!restored.includes(token)) {
          throw new Error("El traductor alteró un fragmento de código; no se ha mostrado una versión modificada.");
        }
        restored = restored.replaceAll(token, original);
      }
      return restored;
    },
  };
}
