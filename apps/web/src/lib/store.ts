import { create } from "zustand";

export type KeyboardMode = "roman" | "inscript" | "device";
const read = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

interface Prefs {
  muted: boolean;
  unlocked: boolean; // audio may auto-play only after the first tap (§15.9)
  keyboard: KeyboardMode;
  setMuted(m: boolean): void;
  unlockAudio(): void;
  setKeyboard(k: KeyboardMode): void;
}
export const usePrefs = create<Prefs>((set) => ({
  muted: read("hc.muted", "0") === "1",
  unlocked: false,
  keyboard: (read("hc.keyboard", "roman") as KeyboardMode),
  setMuted: (m) => { write("hc.muted", m ? "1" : "0"); if (m) window.speechSynthesis?.cancel(); set({ muted: m }); },
  unlockAudio: () => set({ unlocked: true }),
  setKeyboard: (k) => { write("hc.keyboard", k); set({ keyboard: k }); },
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
