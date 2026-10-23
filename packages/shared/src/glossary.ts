import { escapeRegExp, normalise } from "./text.js";
import type { GlossaryEntry } from "./types.js";

/**
 * Surface forms accepted for a Hindi term (§11): the form itself plus simple
 * inflections of its last word — `ा`→`े/ों/ाओं`, `ी`→`ियों/ियाँ/ियां`, else `+ों/ें`.
 */
export function inflections(term: string): string[] {
  const t = normalise(term);
  if (!t) return [];
  const parts = t.split(" ");
  const last = parts.pop()!;
  const head = parts.length ? parts.join(" ") + " " : "";
  const forms = new Set([last]);
  if (last.endsWith("ा")) {
    const b = last.slice(0, -1);
    ["े", "ों", "ाओं"].forEach((s) => forms.add(b + s));
  } else if (last.endsWith("ी")) {
    const b = last.slice(0, -1);
    ["ियों", "ियाँ", "ियां"].forEach((s) => forms.add(b + s));
  } else {
    ["ों", "ें"].forEach((s) => forms.add(last + s));
  }
  return [...forms].map((f) => head + f);
}

export function containsHindi(text: string, form: string): boolean {
  const f = normalise(form);
  return !!f && normalise(text).includes(f);
}

export function containsLatinWord(text: string, en: string): boolean {
  const e = normalise(en);
  if (!e || !/[A-Za-z]/.test(e)) return false;
  return new RegExp(`(^|[^A-Za-z])${escapeRegExp(e)}([^A-Za-z]|$)`, "i").test(text);
}

export interface TermCheck {
  term: GlossaryEntry;
  correct: boolean;
  present: boolean;
  avoidFound: string | null;
  latinFound: boolean;
}

/** §11 शब्दावली: right Hindi present, no avoid form, and not the English word in Latin. */
export function checkTerm(text: string, term: GlossaryEntry): TermCheck {
  const forms = [term.hi, ...term.variants].flatMap(inflections);
  const present = forms.some((f) => containsHindi(text, f));
  const avoidFound = term.avoid.find((a) => containsHindi(text, a)) ?? null;
  const latinFound = containsLatinWord(text, term.en);
  return { term, present, avoidFound, latinFound, correct: present && !avoidFound && !latinFound };
}

/** Apply manager overrides (D3) to a list of page terms, matching by English (case-insensitive). */
export function applyOverrides(terms: GlossaryEntry[], overrides: GlossaryEntry[]): GlossaryEntry[] {
  const byEn = new Map(overrides.map((o) => [o.en.toLowerCase(), o]));
  return terms.map((t) => byEn.get(t.en.toLowerCase()) ?? t);
}

/**
 * Glossary matching, as in CAG Anuvaad's `GlossaryService.match_document` (reference/glossary-matching-algorithm.md):
 * ONE normaliser for both the glossary's source terms and the document text — lowercase, every character that is
 * not a (Unicode) word character becomes a space, whitespace collapsed. Punctuation separates, it is not deleted,
 * so "F.E.-R.A." → "f e r a". Index keys MUST be built with this function or lookups silently miss.
 */
export const glossaryKey = (s: string) =>
  s.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{M}\p{N}_\s]/gu, " ").replace(/\s+/g, " ").trim();

const WORD = /[\p{L}\p{M}\p{N}_]+/gu;

/**
 * Find glossary terms in a source text. N-gram matching, longest phrase first across the WHOLE text, and no token
 * matched twice (Phases 4–5): "foreign exchange regulation act" beats "foreign exchange", which beats "exchange".
 * Unlike Anuvaad's Phase 7, character offsets are kept so the workbench can underline terms in place.
 * `index` maps glossaryKey(english) → entry (detection index: one entry per key).
 */
export function matchSourceTerms(
  text: string,
  index: Map<string, GlossaryEntry>,
  maxWords = 6,
): { start: number; end: number; entry: GlossaryEntry }[] {
  const tokens: { w: string; start: number; end: number }[] = [];
  for (const m of text.normalize("NFC").matchAll(WORD)) tokens.push({ w: m[0].toLowerCase(), start: m.index!, end: m.index! + m[0].length });
  const claimed = new Uint8Array(tokens.length);
  const out: { start: number; end: number; entry: GlossaryEntry }[] = [];
  for (let size = Math.min(maxWords, tokens.length); size >= 1; size--) {
    for (let i = 0; i + size <= tokens.length; i++) {
      let free = true;
      for (let k = i; k < i + size; k++) if (claimed[k]) { free = false; break; }
      if (!free) continue;
      const key = tokens.slice(i, i + size).map((t) => t.w).join(" ");
      const e = index.get(key);
      if (!e) continue;
      claimed.fill(1, i, i + size);
      out.push({ start: tokens[i].start, end: tokens[i + size - 1].end, entry: e });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/** Phase 6–7: all entries for one detected term, sector-specific before general; sector widens, never narrows. */
export function entriesForSector(all: GlossaryEntry[] | undefined, sector: string | null | undefined): GlossaryEntry[] {
  if (!all?.length) return [];
  const s = (sector ?? "").toLowerCase();
  return all.filter((e) => !e.sector || e.sector.toLowerCase() === s).sort((a, b) => Number(!a.sector) - Number(!b.sector));
}
