export function explainSelection(text, context, translatedText) {
  const subject = `${text}\n${context}`.toLocaleLowerCase();

  if (/\b(?:present simple|simple present)\b/.test(subject)) {
    return "El presente simple se usa principalmente para rutinas, hechos generales y situaciones habituales.";
  }
  if (/\b(?:past simple|simple past)\b/.test(subject)) {
    return "El pasado simple expresa acciones o situaciones que comenzaron y terminaron en el pasado.";
  }
  if (/\b(?:present continuous|present progressive)\b/.test(subject)) {
    return "El presente continuo suele describir acciones en curso o situaciones temporales.";
  }
  if (/\b(?:third[- ]person singular|3rd person singular)\b/.test(subject)) {
    return "En inglés, la tercera persona del singular usa una forma verbal específica en presente; la regla exacta depende de la terminación del verbo.";
  }
  if (/\bbecause\b/i.test(text)) {
    return `La frase presenta una causa o razón. En español, la idea es: ${translatedText}`;
  }
  if (/\b(?:although|even though)\b/i.test(text)) {
    return `La frase expresa un contraste o una concesión. En español, la idea es: ${translatedText}`;
  }
  if (/\bunless\b/i.test(text)) {
    return `La frase plantea una condición negativa, equivalente a «a menos que». En español, la idea es: ${translatedText}`;
  }
  if (/\bif\b/i.test(text)) {
    return `La frase plantea una condición. En español, la idea es: ${translatedText}`;
  }
  return `En este contexto, la idea en español es: ${translatedText}`;
}
