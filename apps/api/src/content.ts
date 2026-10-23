import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseGameConfig, type GameConfig } from "@hc/shared";
import { ROOT } from "./env.js";
import type { Db } from "./db.js";

const readJson = (p: string) => JSON.parse(readFileSync(resolve(ROOT, p), "utf8"));

export interface ScriptLine { id: string; section: string; part: string; moment: string; when?: string; spoken: boolean; en: string; hi: string }
export interface Script {
  placeholders: string[];
  lines: ScriptLine[];
  knowledge: Record<string, string[]>;
  faq: Record<string, { q: string; en: string; hi: string }[]>;
  chatbotRules: string[];
}

/** Boot-time load. Throws (and the server refuses to start) if the config is invalid (§5). */
export const baseConfig: GameConfig = parseGameConfig(readJson("config/game.config.json"));
export const strings: Record<string, any> = readJson("content/strings.hi.json");
export const script: Script = readJson("content/sahayika.script.json");

/** Effective config = file + audited credit-cap overrides from the console. */
let effective: GameConfig = baseConfig;
export const config = () => effective;

export async function loadOverrides(db: Db) {
  const rows = await db.query<{ key: string; value: any }>("SELECT key, value FROM config_overrides");
  const caps = rows.find((r) => r.key === "creditCaps")?.value as Record<string, number> | undefined;
  const regCredits = rows.find((r) => r.key === "registrationCredits")?.value as number | undefined;
  const next = structuredClone(baseConfig);
  if (caps) next.rounds = next.rounds.map((r) => ({ ...r, creditCap: caps[r.key] ?? r.creditCap }));
  if (typeof regCredits === "number") next.registration.credits = regCredits;
  effective = parseGameConfig(next); // the 50-credit invariant still holds
}

/** Lines as edited in the console (DB) fall back to the script file. */
const lineCache = new Map<string, ScriptLine>();
export async function loadLines(db: Db) {
  lineCache.clear();
  for (const l of script.lines) lineCache.set(l.id, l);
  const rows = await db.query<ScriptLine>("SELECT id, section, part, moment, spoken, en, hi FROM sahayika_lines");
  for (const r of rows) lineCache.set(r.id, { ...lineCache.get(r.id), ...r });
}
export const line = (id: string) => lineCache.get(id) ?? null;
export const allLines = () => [...lineCache.values()];

/** Look up a nested strings key like "reportCard.tipTerm". */
export function str(key: string): string {
  const v = key.split(".").reduce<any>((o, k) => (o ? o[k] : undefined), strings);
  return typeof v === "string" ? v : key;
}
