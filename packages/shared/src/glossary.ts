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
 * Find glossary entries whose English occurs in a source text, longest match first,
 * non-overlapping. `index` maps lower-cased English → entry.
 */
export function matchSourceTerms(
  text: string,
  index: Map<string, GlossaryEntry>,
  maxWords = 6,
): { start: number; end: number; entry: GlossaryEntry }[] {
  const tokens: { w: string; start: number; end: number }[] = [];
  const re = /[A-Za-z][A-Za-z'’-]*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) tokens.push({ w: m[0].toLowerCase().replace(/’/g, "'"), start: m.index, end: m.index + m[0].length });
  const out: { start: number; end: number; entry: GlossaryEntry }[] = [];
  for (let i = 0; i < tokens.length; ) {
    let hit: { n: number; entry: GlossaryEntry } | null = null;
    for (let n = Math.min(maxWords, tokens.length - i); n >= 1; n--) {
      // the source must be contiguous: only spaces between tokens
      const span = text.slice(tokens[i].start, tokens[i + n - 1].end);
      const key = span.toLowerCase().replace(/’/g, "'").replace(/\s+/g, " ");
      const e = index.get(key);
      if (e) { hit = { n, entry: e }; break; }
    }
    if (hit) {
      out.push({ start: tokens[i].start, end: tokens[i + hit.n - 1].end, entry: hit.entry });
      i += hit.n;
    } else i++;
  }
  return out;
}
