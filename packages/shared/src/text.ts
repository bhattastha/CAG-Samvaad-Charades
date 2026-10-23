/** Text helpers shared by the scorer, the editor and the API. */

const ZW = /[‌‍]/g;

/** §11 normalisation: NFC; strip ZWJ/ZWNJ; `|` → `।`; collapse whitespace. */
export function normalise(s: string | null | undefined): string {
  if (!s) return "";
  return s.normalize("NFC").replace(ZW, "").replace(/\|/g, "।").replace(/\s+/g, " ").trim();
}

export const DEVANAGARI = /[ऀ-ॿ]/;
export const hasDevanagari = (s: string) => DEVANAGARI.test(s);
export const LATIN_WORD = /[A-Za-z]/;

/** Words split on whitespace and punctuation; keeps Devanagari combining marks inside words. */
export function words(s: string): string[] {
  return normalise(s)
    .split(/[\s।?!,;:()[\]{}"“”‘’'—–\-\/]+/u)
    .filter(Boolean);
}

export const SENTENCE_END = /[।?!]/;

/** Split into sentences; each keeps its terminator if it has one. */
export function sentences(s: string): { text: string; terminated: boolean }[] {
  const out: { text: string; terminated: boolean }[] = [];
  const t = normalise(s);
  let cur = "";
  for (const ch of t) {
    cur += ch;
    if (SENTENCE_END.test(ch)) {
      // "." inside numbers is not a terminator, and only ।?! count (never ".")
      out.push({ text: cur.trim(), terminated: true });
      cur = "";
    }
  }
  if (cur.trim()) out.push({ text: cur.trim(), terminated: false });
  return out;
}

/**
 * Numbers as printed: Indian-grouped (1,23,456), decimals, years like 2017-18,
 * ₹ amounts, (-) negatives and percentages.
 */
export const NUMBER_TOKEN = /(?:₹\s?)?(?:\(-\)\s?)?\d+(?:,\d{2,3})*(?:\.\d+)?(?:-\d{2,4})?(?:\s?(?:%|per cent))?/g;

export function numberTokens(s: string): string[] {
  return (s.match(NUMBER_TOKEN) ?? []).map((x) => x.trim());
}

/** Bare numeric core, used to compare numbers across languages (“20 per cent” vs “20 प्रतिशत”). */
export function numericCore(tok: string): string {
  return tok.replace(/₹|\(-\)|%|per cent|\s/g, "");
}

export function isNumericOnly(s: string): boolean {
  const t = s.trim();
  return t.length > 0 && /^[\d.,\-–()%₹\s]+$/.test(t);
}

/** Vowel signs, virama and nukta that cannot start a word. */
export const DEPENDENT_SIGN = /^[ऺ-ॏ॑-ॗॢॣऀ-ः]/;

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** mm:ss under one hour, h:mm:ss at or above (§15.10). */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/** "20 min", "1 hr", "1.5 hr", "2 hr" as in the designs. */
export function formatLimit(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = minutes / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(1)} hr`;
}

/** Fill `{name}`-style placeholders; unknown ones stay visible so gaps are noticed in review. */
export function fill(template: string, vars: Record<string, string | number | null | undefined>): string {
  return template.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined || vars[k] === null ? m : String(vars[k])));
}
