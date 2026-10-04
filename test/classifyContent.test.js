import assert from "node:assert/strict";
import test from "node:test";
import { classifyPage } from "../src/classification/classifyContent.js";
import { correctTranslation } from "../src/classification/correctTranslation.js";
import { extractPageText } from "../src/pdf/extractPageText.js";
import { parseTranslationStructure } from "../src/ui/translationStructure.js";

test("preserves a multiline Java code block while translating its prose", () => {
  const source = [
    "The database stores user information.",
    "public class UserService {",
    '  String databaseName = "users";',
    "  public void saveUser() {",
    "    database.save();",
    "  }",
    "}",
  ].join("\n");
  const page = classifyPage(source);

  assert.match(page.translationSource, /The database stores user information\./);
  assert.doesNotMatch(page.translationSource, /UserService|database\.save/);

  const translated = page.translationSource.replace(
    "The database stores user information.",
    "La base de datos almacena información de usuarios.",
  );
  assert.equal(
    page.restoreTranslation(translated),
    [
      "La base de datos almacena información de usuarios.",
      "public class UserService {",
      '  String databaseName = "users";',
      "  public void saveUser() {",
      "    database.save();",
      "  }",
      "}",
    ].join("\n"),
  );
});

test("classifies grammar material without special-casing example words", () => {
  const source = "Present Simple — 3rd person singular\nKiss → kisses\nWatch → watches";
  const page = classifyPage(source);

  assert.equal(page.mode, "lesson");
  assert.match(page.translationSource, /Kiss/);
  assert.match(page.translationSource, /Watch/);
  assert.equal(page.restoreTranslation(page.translationSource), page.translationSource);
});

test("rejects a translation that drops a protected code token", () => {
  const page = classifyPage("Use `database.query()` to search.");

  assert.throws(() => page.restoreTranslation("Usa la función para buscar."), /alteró un fragmento de código/);
});

test("keeps PDF rows readable and marks wide table-cell gaps", () => {
  const text = extractPageText([
    { str: "Name", transform: [10, 0, 0, 10, 72, 700], width: 22, hasEOL: false },
    { str: "Age", transform: [10, 0, 0, 10, 300, 700], width: 16, hasEOL: true },
    { str: "Ada", transform: [10, 0, 0, 10, 72, 680], width: 18, hasEOL: false },
    { str: "36", transform: [10, 0, 0, 10, 300, 680], width: 10, hasEOL: true },
  ]);

  assert.equal(text, "Name\tAge\nAda\t36");
});

test("preserves translated headings, lists, and tabular rows as separate blocks", () => {
  assert.deepEqual(
    parseTranslationStructure(
      [
        "1.2. Presente simple y continuo",
        "",
        "ESTRUCTURA",
        "Subject\tVerb",
        "She\tworks",
        "",
        "• Afirmativo: sujeto + verbo.",
        "• Negativo: sujeto + auxiliar + verbo.",
      ].join("\n"),
    ),
    [
      { type: "heading", text: "1.2. Presente simple y continuo" },
      { type: "heading", text: "ESTRUCTURA" },
      { type: "table", rows: [["Subject", "Verb"], ["She", "works"]] },
      {
        type: "list",
        ordered: false,
        items: ["Afirmativo: sujeto + verbo.", "Negativo: sujeto + auxiliar + verbo."],
      },
    ],
  );
});

test("corrects common grammar terminology and translated spelling examples", () => {
  const source = [
    "Use ASI (Auxiliary + Subject + Infinitive) or QUASI (Question word + Auxiliary + Subject + Infinitive) to help with word order.",
    "Spelling rules",
    "Use do not/does not in statements. We use the auxiliary do/does in negative and interrogative statements.",
    "STRUCTURE: base form of verb",
    "3 rd person singular",
    "In the 3 rd person singular (he, she, it), add -s.",
    "Present simple vs. present Continuous",
    "Affirmative: Subject + infinitive verb.",
    "Negative: Subject + do not/does not + infinitive verb.",
    "Interrogative: Do/Does + subject + infinitive verb.",
    "Kiss → kisses",
    "Watch → watches",
    "Crash → crashes",
    "Go → goes",
    "Carry → carries",
    "Study → studies",
    "If the verb ends in a consonant + -y, we remove the y and add -ies, e.g.",
  ].join("\n");
  const translation = [
    "Use ASI (Auxiliary + Subject + Infinitive) or QUASI (Question word + Auxiliary + Subject + Infinitive) to help with word order.",
    "Reglas de expulsión",
    "Utilizamos no/does no en declaraciones. Utilizamos el do/does auxiliar en declaraciones negativas e interrogativas.",
    "STRUCTURE: forma base de verbo",
    "3 persona singular",
    "En la 3 persona singular (él, ella, ella), añade -s.",
    "present simple vs. present Continuous",
    "Afirmativo: sujeto + verbo infinitivo.",
    "Negativo: sujeto + do not/does not + verbo infinitivo.",
    "Interrogante: Do/Does + sujeto + verbo infinitivo.",
    "Beso → besos",
    "Ver → relojes",
    "Crash → se bloquea",
    "Go → va",
    "Carry → lleva",
    "Estudio → estudios",
    "Si el verbo termina en un consonant + -y, quitamos el y y y agregamos -ies, por ejemplo.",
  ].join("\n");

  assert.equal(
    correctTranslation(source, translation),
    [
      "Usa ASI (auxiliar + sujeto + infinitivo) or QUASI (palabra interrogativa + auxiliar + sujeto + infinitivo) to help with orden de las palabras.",
      "Reglas ortográficas",
      "Utilizamos do not/does not en oraciones. Utilizamos el auxiliar do/does en oraciones negativas e interrogativas.",
      "ESTRUCTURA: forma base del verbo",
      "tercera persona del singular",
      "En la tercera persona del singular (él, ella, ello), añade -s.",
      "presente simple vs. presente continuo",
      "Afirmativa: sujeto + verbo infinitivo.",
      "Negativa: sujeto + do not/does not + verbo infinitivo.",
      "Interrogativa: Do/Does + sujeto + verbo infinitivo.",
      "besar → besa",
      "mirar → mira",
      "chocar → choca",
      "ir → va",
      "llevar → lleva",
      "estudiar → estudia",
      "Si el verbo termina en una consonante + -y, quitamos la y y agregamos -ies, por ejemplo.",
    ].join("\n"),
  );
});

test("repairs words and ordinal suffixes split across PDF lines", () => {
  const text = extractPageText([
    { str: "happen re-", hasEOL: true },
    { str: "gularly.", hasEOL: true },
    { str: "the", hasEOL: true },
    { str: "3", hasEOL: true },
    { str: "rd", hasEOL: true },
    { str: "person singular.", hasEOL: true },
  ]);

  assert.equal(text, "happen regularly.\nthe 3rd person singular.");
});

test("removes orphaned ordinal suffixes and repairs third-person phrases from superscript PDF text", () => {
  const text = extractPageText([
    { str: "STRUCTURE", hasEOL: true },
    { str: "rd", hasEOL: true },
    { str: "base form of verb + -s in 3 person singular", hasEOL: true },
    { str: "In the rd", hasEOL: true },
    { str: "person singular, add -s.", hasEOL: true },
  ]);

  assert.match(text, /STRUCTURE\s+base form of verb \+ -s in 3rd person singular/);
  assert.match(text, /in the third person singular, add -s\./i);
  assert.doesNotMatch(text, /(?:^|\s)rd(?:\s|$)/);
  assert.doesNotMatch(text, /\n\n/);
});
