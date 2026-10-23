/** Words that must never reach a player (CLAUDE.md §0.5). */
export const FORBIDDEN_TERMS = [
  "तरकश", "Tarkash", "अनुवाद समर", "Anuvad Samar", "गुरु", "Guru",
  "ट्रायल राउंड", "प्रो राउंड", "अनुवाद प्रवीण", "अनुवाद आचार्य",
  "Anuvad Praveen", "Anuvad Acharya",
];
export const FORBIDDEN_IMAGERY = ["🏹", "archery", "quiver", "bow-and-arrow", "bow_and_arrow"];

export function findForbidden(text: string): string[] {
  const hits = new Set<string>();
  const lower = text.toLowerCase();
  for (const t of [...FORBIDDEN_TERMS, ...FORBIDDEN_IMAGERY]) {
    if (/[A-Za-z]/.test(t)) {
      if (new RegExp(`(^|[^a-z])${t.toLowerCase().replace(/[-_]/g, "[-_ ]")}([^a-z]|$)`).test(lower)) hits.add(t);
    } else if (text.includes(t)) hits.add(t);
  }
  return [...hits];
}
