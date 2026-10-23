import { fill } from "@hc/shared";
import raw from "@content/strings.hi.json";

const S: any = raw;
/** All player-facing text comes from content/strings.hi.json (CLAUDE.md §0.4). */
export function t(key: string, vars?: Record<string, string | number | null | undefined>): string {
  const v = key.split(".").reduce<any>((o, k) => (o == null ? undefined : o[k]), S);
  if (typeof v !== "string") return key;
  return vars ? fill(v, vars) : v;
}
export const tList = (key: string): string[] => key.split(".").reduce<any>((o, k) => (o == null ? undefined : o[k]), S) ?? [];
export const tObj = (key: string): any => key.split(".").reduce<any>((o, k) => (o == null ? undefined : o[k]), S);
