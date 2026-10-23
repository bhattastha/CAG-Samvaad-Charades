/**
 * Local rule-based Roman → Devanagari guess (ITRANS-style, lenient). Used only as the
 * fallback when the BHASHINI transliteration service is slow or down (§9.2), so typing
 * never stalls. It suggests spellings; it never translates.
 */

const CONS: [string, string][] = [
  ["chh", "छ"], ["ksh", "क्ष"], ["gya", "ज्ञ"], ["shr", "श्र"], ["tr", "त्र"],
  ["kh", "ख"], ["gh", "घ"], ["ch", "च"], ["jh", "झ"], ["th", "थ"], ["dh", "ध"], ["ph", "फ"], ["bh", "भ"],
  ["sh", "श"], ["Sh", "ष"], ["Th", "ठ"], ["Dh", "ढ"], ["ng", "ङ"],
  ["k", "क"], ["g", "ग"], ["c", "क"], ["j", "ज"], ["T", "ट"], ["D", "ड"], ["N", "ण"],
  ["t", "त"], ["d", "द"], ["n", "न"], ["p", "प"], ["b", "ब"], ["m", "म"], ["y", "य"], ["r", "र"],
  ["l", "ल"], ["v", "व"], ["w", "व"], ["s", "स"], ["h", "ह"], ["f", "फ़"], ["z", "ज़"], ["q", "क़"], ["x", "क्स"],
];
// [roman, independent vowel, vowel sign]
const VOW: [string, string, string][] = [
  ["aa", "आ", "ा"], ["ai", "ऐ", "ै"], ["au", "औ", "ौ"], ["ee", "ई", "ी"], ["ii", "ई", "ी"], ["oo", "ऊ", "ू"],
  ["uu", "ऊ", "ू"], ["ri", "ऋ", "ृ"], ["A", "आ", "ा"], ["I", "ई", "ी"], ["U", "ऊ", "ू"],
  ["a", "अ", ""], ["i", "इ", "ि"], ["u", "उ", "ु"], ["e", "ए", "े"], ["o", "ओ", "ो"],
];

function match<T extends [string, ...string[]]>(list: T[], s: string, i: number): T | null {
  for (const e of list) if (s.startsWith(e[0], i)) return e;
  // case-insensitive second pass for lowercase-only rules
  const lower = s.toLowerCase();
  for (const e of list) if (e[0] === e[0].toLowerCase() && lower.startsWith(e[0], i)) return e;
  return null;
}

// A consonant joins the next one (virama) only for common clusters; otherwise the
// casual-typing reading keeps the inherent "a" (sarkar → सरकार, not सर्कार).
const JOINS_NEXT = /^(r|y|v|w)/;
const JOINS_AFTER = new Set(["स", "श", "ष"]);

export function romanToDevanagari(word: string): string {
  let out = "";
  let i = 0;
  let pendingConsonant = false;
  let lastCons = "";
  while (i < word.length) {
    // "ri" only acts as a vowel at the start of a word
    const v = match(VOW.filter((x) => x[0] !== "ri" || i === 0), word, i);
    if (v) {
      const atEnd = i + v[0].length === word.length;
      // word-final a / i in casual typing usually mean ा / ी (mera → मेरा, hindi → हिंदी)
      const sign = pendingConsonant && atEnd && v[0] === "a" && i > 1 ? "ा" : pendingConsonant && atEnd && v[0] === "i" ? "ी" : v[2];
      out += pendingConsonant ? sign : v[1];
      pendingConsonant = false;
      i += v[0].length;
      continue;
    }
    // "n"/"m" before a consonant at mid-word → anusvara (हिंदी, संबंध)
    if ((word[i] === "n" || word[i] === "m") && !pendingConsonant && i > 0 && i + 1 < word.length && match(CONS, word, i + 1) && !match(VOW, word, i + 1)) {
      out += "ं";
      i += 1;
      continue;
    }
    const c = match(CONS, word, i);
    if (c) {
      if (pendingConsonant && (JOINS_NEXT.test(c[0]) || JOINS_AFTER.has(lastCons) || c[1] === lastCons)) out += "्";
      out += c[1];
      lastCons = c[1];
      pendingConsonant = true;
      i += c[0].length;
      continue;
    }
    out += word[i];
    pendingConsonant = false;
    i++;
  }
  return out;
}

/** Standard Hindi InScript layout (physical key → character). Digits stay Latin: numbers are never changed. */
export const INSCRIPT: Record<string, string> = {
  q: "ौ", w: "ै", e: "ा", r: "ी", t: "ू", y: "ब", u: "ह", i: "ग", o: "द", p: "ज", "[": "ड", "]": "़", "\\": "ॉ",
  a: "ो", s: "े", d: "्", f: "ि", g: "ु", h: "प", j: "र", k: "क", l: "त", ";": "च", "'": "ट",
  z: "ॆ", x: "ं", c: "म", v: "न", b: "व", n: "ल", m: "स", ",": ",", ".": "।", "/": "य",
  Q: "औ", W: "ऐ", E: "आ", R: "ई", T: "ऊ", Y: "भ", U: "ङ", I: "घ", O: "ध", P: "झ", "{": "ढ", "}": "ञ", "|": "ऑ",
  A: "ओ", S: "ए", D: "अ", F: "इ", G: "उ", H: "फ", J: "ऱ", K: "ख", L: "थ", ":": "छ", '"': "ठ",
  Z: "ऎ", X: "ँ", C: "ण", V: "ऩ", B: "ऴ", N: "ळ", M: "श", "<": "ष", ">": ".", "?": "य़",
  _: "ः", "=": "ृ", "+": "ऋ", "%": "ज्ञ", "^": "त्र", "&": "क्ष", "*": "श्र",
};

/** Rows for the on-screen InScript keyboard: [unshifted keys, shifted keys]. */
export const INSCRIPT_ROWS: string[][] = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "[", "]"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";", "'"],
  ["z", "x", "c", "v", "b", "n", "m", ".", "/", "="],
];
export const INSCRIPT_SHIFT: Record<string, string> = {
  q: "Q", w: "W", e: "E", r: "R", t: "T", y: "Y", u: "U", i: "I", o: "O", p: "P", "[": "{", "]": "}",
  a: "A", s: "S", d: "D", f: "F", g: "G", h: "H", j: "J", k: "K", l: "L", ";": ":", "'": '"',
  z: "Z", x: "X", c: "C", v: "V", b: "B", n: "N", m: "M", ".": ">", "/": "?", "=": "+",
};
