import { fill } from "@hc/shared";
import en from "@content/strings.en.json";
import hi from "@content/strings.hi.json";

/** Player-facing text comes only from content/ (CLAUDE.md §0.4). Locale follows config.ui.locale. */
let locale: "en" | "hi" = "en";
export const setLocale = (l: "en" | "hi") => {
  locale = l;
  document.documentElement.lang = l;
};
export const getLocale = () => locale;

const get = (src: any, key: string) => key.split(".").reduce<any>((o, k) => (o == null ? undefined : o[k]), src);
const lookup = (key: string) => get(locale === "en" ? en : hi, key) ?? get(locale === "en" ? hi : en, key);

export function t(key: string, vars?: Record<string, string | number | null | undefined>): string {
  const v = lookup(key);
  if (typeof v !== "string") return key;
  return vars ? fill(v, vars) : v;
}
export const tList = <T = string>(key: string): T[] => lookup(key) ?? [];
export const tObj = (key: string): any => lookup(key);

/** A Sahayika line in the player's language (lines carry both en and hi). */
export const lineText = (l: { en: string; hi: string } | null | undefined) => (l ? (locale === "en" ? l.en || l.hi : l.hi || l.en) : "");

/** Round display helpers (config carries both languages). */
export const roundName = (r: { name: string; nameEn: string }) => (locale === "en" ? `${r.nameEn} Round` : r.name);
export const roundTitle = (r: { title: string; titleEn?: string }) => (locale === "en" ? r.titleEn || r.title : r.title);
