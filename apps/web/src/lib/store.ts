import { create } from "zustand";

/** Typing is always Roman → Hindi suggestions plus direct Devanagari; "device" only switches suggestions off (practice box). */
export type KeyboardMode = "roman" | "device";
export type VoiceMode = "off" | "tap" | "auto";
export type TextSize = "s" | "m" | "l" | "xl";

const read = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };
const SCALE: Record<TextSize, string> = { s: "93.75%", m: "100%", l: "112.5%", xl: "125%" };

export function applyPrefs(p: { textSize: TextSize; contrast: boolean; reduceMotion: boolean }) {
  const h = document.documentElement;
  h.style.fontSize = SCALE[p.textSize];
  h.classList.toggle("hc-contrast", p.contrast);
  h.classList.toggle("hc-reduce-motion", p.reduceMotion);
}

interface Prefs {
  voice: VoiceMode;
  sound: boolean;
  volume: number;
  haptics: boolean;
  textSize: TextSize;
  contrast: boolean;
  reduceMotion: boolean;
  unlocked: boolean; // audio may only start after the first tap (§15.9)
  set<K extends keyof Omit<Prefs, "set" | "unlockAudio">>(k: K, v: Prefs[K]): void;
  unlockAudio(): void;
}

const sysReduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export const usePrefs = create<Prefs>((setState, getState) => ({
  voice: read("hc.voice", "tap") as VoiceMode,
  sound: read("hc.sound", "1") === "1",
  volume: Number(read("hc.volume", "0.6")),
  haptics: read("hc.haptics", "1") === "1",
  textSize: read("hc.textSize", "m") as TextSize,
  contrast: read("hc.contrast", "0") === "1",
  reduceMotion: read("hc.reduceMotion", sysReduce ? "1" : "0") === "1",
  unlocked: false,
  set: (k, v) => {
    write(`hc.${k}`, typeof v === "boolean" ? (v ? "1" : "0") : String(v));
    setState({ [k]: v } as any);
    applyPrefs(getState());
  },
  unlockAudio: () => setState({ unlocked: true }),
}));

/** Toasts */
interface Toast { id: number; text: string; tone: "info" | "warn" | "good" }
interface Toasts { items: Toast[]; push(text: string, tone?: Toast["tone"]): void }
let tid = 0;
export const useToasts = create<Toasts>((set) => ({
  items: [],
  push: (text, tone = "info") => {
    const id = ++tid;
    set((s) => ({ items: [...s.items.slice(-2), { id, text, tone }] }));
    setTimeout(() => set((s) => ({ items: s.items.filter((x) => x.id !== id) })), 3500);
  },
}));
