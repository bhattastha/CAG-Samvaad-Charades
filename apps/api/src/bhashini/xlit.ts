import { hasDevanagari, romanToDevanagari } from "@hc/shared";
import { config } from "../content.js";
import { callService } from "./client.js";

const MAX = 50_000;
const TTL = 7 * 24 * 3600_000;
const cache = new Map<string, { at: number; s: string[] }>();

function cacheGet(w: string) {
  const e = cache.get(w);
  if (!e) return null;
  if (Date.now() - e.at > TTL) { cache.delete(w); return null; }
  cache.delete(w); // refresh LRU position
  cache.set(w, e);
  return e.s;
}
function cacheSet(w: string, s: string[]) {
  cache.set(w, { at: Date.now(), s });
  if (cache.size > MAX) cache.delete(cache.keys().next().value!);
}

/** 20 requests/s per player (sliding one-second window). */
const buckets = new Map<string, number[]>();
export function rateOk(player: string, perSecond = 20): boolean {
  const now = Date.now();
  const ts = (buckets.get(player) ?? []).filter((t) => now - t < 1000);
  if (ts.length >= perSecond) { buckets.set(player, ts); return false; }
  ts.push(now);
  buckets.set(player, ts);
  return true;
}

export const WORD = /^[A-Za-z]{1,30}$/;

/** Keep only Devanagari suggestions, de-duplicated, capped (D6 guard). */
export function cleanSuggestions(target: unknown, cap: number): string[] {
  const list = Array.isArray(target) ? target : typeof target === "string" ? [target] : [];
  const out: string[] = [];
  for (const s of list) {
    const t = String(s).trim().normalize("NFC");
    if (t && hasDevanagari(t) && !out.includes(t)) out.push(t);
    if (out.length >= cap) break;
  }
  return out;
}

export async function transliterate(word: string, signal?: AbortSignal): Promise<{ suggestions: string[]; fallback?: string }> {
  const w = `${config().transliteration.serviceId}|${word.toLowerCase()}`;
  const hit = cacheGet(w);
  if (hit) return { suggestions: hit };
  const x = config().transliteration;
  try {
    const res = await callService<any>("transliteration", x.endpoint, {
      pipelineTasks: [{
        taskType: "transliteration",
        config: {
          language: config().bhashiniServices.transliterationProvider === "anuvaad"
            ? { sourceLanguage: x.sourceLanguage, targetLanguage: x.targetLanguage, targetLanguageScriptCode: x.targetLanguageScriptCode }
            : { sourceLanguage: x.sourceLanguage, targetLanguage: x.targetLanguage },
          serviceId: x.serviceId,
          isSentence: x.isSentence,
          numSuggestions: x.numSuggestions,
        },
      }],
      inputData: { input: [{ source: word }] },
    }, { timeoutMs: x.timeoutMs, signal });
    const s = cleanSuggestions(res?.pipelineResponse?.[0]?.output?.[0]?.target, x.numSuggestions);
    if (s.length) {
      cacheSet(w, s);
      return { suggestions: s };
    }
    return { suggestions: [], fallback: romanToDevanagari(word) };
  } catch {
    return { suggestions: [], fallback: romanToDevanagari(word) };
  }
}
