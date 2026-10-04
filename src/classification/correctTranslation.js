const GRAMMAR_EXAMPLES = [
  {
    source: /\bKiss\s*(?:→|->)\s*kisses\b/i,
    translated: /\bBeso\s*→\s*besos\b/i,
    correction: "besar → besa",
  },
  {
    source: /\bWatch\s*(?:→|->)\s*watches\b/i,
    translated: /\bVer\s*→\s*relojes\b/i,
    correction: "mirar → mira",
  },
  {
    source: /\bCrash\s*(?:→|->)\s*crashes\b/i,
    translated: /\bCrash\s*→\s*se bloquea\b/i,
    correction: "chocar → choca",
  },
  {
    source: /\bGo\s*(?:→|->)\s*goes\b/i,
    translated: /\bGo\s*→\s*va\b/i,
    correction: "ir → va",
  },
  {
    source: /\bCarry\s*(?:→|->)\s*carries\b/i,
    translated: /\bCarry\s*→\s*lleva\b/i,
    correction: "llevar → lleva",
  },
  {
    source: /\bStudy\s*(?:→|->)\s*studies\b/i,
    translated: /\bEstudio\s*→\s*estudios\b/i,
    correction: "estudiar → estudia",
  },
];

export function correctTranslation(sourceText, translatedText) {
  let corrected = translatedText;

  if (/\bspelling rules\b/i.test(sourceText)) {
    corrected = corrected.replace(/\breglas (?:de ortografía|de expulsión)\b/gi, (phrase) =>
      phrase[0] === phrase[0].toLocaleUpperCase() ? "Reglas ortográficas" : "reglas ortográficas",
    );
  }
  if (/\bsubject\b/i.test(sourceText) && /\b(?:grammar|affirmative|negative|interrogative|question word)\b/i.test(sourceText)) {
    corrected = corrected.replace(/\b(?:asunto|subject)\b/gi, "sujeto");
  }
  if (/\bquestion word\b/i.test(sourceText)) {
    corrected = corrected.replace(/\bpalabras? de pregunta\b/gi, "palabras interrogativas");
    corrected = corrected.replace(/\bQuestion word\b/gi, "palabra interrogativa");
  }
  if (/\b(?:auxiliary|infinitive)\b/i.test(sourceText)) {
    corrected = corrected.replace(/\bAuxiliary\b/gi, "auxiliar");
    corrected = corrected.replace(/\bInfinitive\b/gi, "infinitivo");
  }
  if (/\bUse ASI\b/i.test(sourceText)) {
    corrected = corrected.replace(/\bUse ASI\b/gi, "Usa ASI");
  }
  if (/\bword order\b/i.test(sourceText)) {
    corrected = corrected.replace(/\bword order\b/gi, "orden de las palabras");
  }
  if (/\bafter be\b/i.test(sourceText)) {
    corrected = corrected.replace(/\bdespués de ser\b|\bdespués ser\b/gi, "después del verbo be");
  }
  if (/\bfrequency expressions?\b/i.test(sourceText) && /\bsentence\b/i.test(sourceText)) {
    corrected = corrected.replace(/\bal final del oración\b|\bal final de la oración\b/gi, "al final de la oración");
  }
  if (/\bthird person singular\b|\b3\s*rd person singular\b/i.test(sourceText)) {
    corrected = corrected.replace(
      /\b(?:(?:3\s*)?rd|3(?:\s*rd)?)\s+(?:person|persona)(?:\s+(?:del\s+)?singular)?\b/gi,
      "tercera persona del singular",
    );
    corrected = corrected.replace(
      /(?:él|el),\s*ella,\s*ella\b/gi,
      "él, ella, ello",
    );
    corrected = corrected.replace(
      /(?:él|el),\s*ella,\s*(?:ello|it)\b/gi,
      "él, ella, ello",
    );
  }
  if (/\bdo not\/does not\b/i.test(sourceText)) {
    corrected = corrected.replace(/\bno\/does no\b/gi, "do not/does not");
  }
  if (/\bstatements\b/i.test(sourceText)) {
    corrected = corrected.replace(/\bdeclaraciones\b/gi, "oraciones");
  }
  if (/\bauxiliary do\/does\b/i.test(sourceText)) {
    corrected = corrected.replace(/\bdo\/does auxiliar\b/gi, "auxiliar do/does");
    corrected = corrected.replace(/\bdeclaraciones negativas e interrogativas\b/gi, "oraciones negativas e interrogativas");
  }
  if (/\bbase form of verb\b/i.test(sourceText)) {
    corrected = corrected.replace(/\bforma base de verbo\b/gi, "forma base del verbo");
  }
  if (/\bconsonant\s*\+\s*-y\b/i.test(sourceText)) {
    corrected = corrected.replace(
      /\b(?:un|una)\s+consonant(?:e)?\s*\+\s*-y\b/gi,
      "una consonante + -y",
    );
    corrected = corrected.replace(
      /\bquitamos\s+(?:(?:la|el)\s+)?y\s+y\s+y\s+(?:añadimos|agregamos|agregar)\b/gi,
      "quitamos la y y agregamos",
    );
    corrected = corrected.replace(
      /\bquitamos\s+(?:la\s+)?y\s+y\s+agregamos\b/gi,
      "quitamos la y y agregamos",
    );
    corrected = corrected.replace(
      /\bquitamos\s+(?:la\s+)?y\s+y\s+(?:añadimos|agregamos|agregar)\b/gi,
      "quitamos la y y agregamos",
    );
    corrected = corrected.replace(
      /\by\s+quitamos\s+la\s+y\s+y\s+(?:añadimos|agregamos|agregar)\b/gi,
      "quitamos la y y agregamos",
    );
  }
  if (/\bstructure\b/i.test(sourceText)) {
    corrected = corrected.replace(/\bSTRUCTURE\b/g, "ESTRUCTURA");
  }
  if (/\bpresent simple\b/i.test(sourceText)) {
    corrected = corrected.replace(/\bpresent simple\b/gi, "presente simple");
  }
  if (/\bpresent continuous\b/i.test(sourceText)) {
    corrected = corrected.replace(/\bpresent continuous\b/gi, "presente continuo");
  }
  if (/\baffirmative\b/i.test(sourceText)) {
    corrected = corrected.replace(/\bAfirmativo:\s*Sujeto\b/gi, "Afirmativa: sujeto");
  }
  if (/\bnegative\b/i.test(sourceText)) {
    corrected = corrected.replace(/\bNegativo:\s*Sujeto\b/gi, "Negativa: sujeto");
  }
  if (/\binterrogative\b/i.test(sourceText)) {
    corrected = corrected.replace(/\bInterrogante:\s*Do\/Does\b/gi, "Interrogativa: Do/Does");
  }

  for (const example of GRAMMAR_EXAMPLES) {
    if (example.source.test(sourceText) && example.translated.test(corrected)) {
      corrected = corrected.replace(example.translated, example.correction);
    }
  }

  return corrected;
}
