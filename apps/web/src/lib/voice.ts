import { usePrefs } from "./store";

export interface Line { id: string; en: string; hi: string; spoken?: boolean }

let current: HTMLAudioElement | null = null;
const blobCache = new Map<string, string>();

function stop() {
  current?.pause();
  current = null;
  window.speechSynthesis?.cancel();
}

function speakBrowser(text: string) {
  const s = window.speechSynthesis;
  if (!s) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-IN";
  u.rate = 1;
  u.pitch = 1.15;
  const voices = s.getVoices();
  // prefer an Indian-English female voice, then any female English voice
  const pick = voices.find((v) => v.lang === "en-IN" && /female|veena|heera|neerja|isha|raveena/i.test(v.name))
    ?? voices.find((v) => v.lang === "en-IN")
    ?? voices.find((v) => v.lang.startsWith("en") && /female|samantha|karen|moira|tessa|zira|susan/i.test(v.name));
  if (pick) u.voice = pick;
  s.speak(u);
}

async function playUrl(url: string) {
  stop();
  current = new Audio(url);
  await current.play();
}

/**
 * Sahayika speaks English (female): pre-generated BHASHINI audio for fixed lines,
 * live BHASHINI TTS for filled lines, else the browser's speechSynthesis (§10.5).
 */
export async function speak(line: Line, opts: { auto?: boolean } = {}) {
  const { muted, unlocked } = usePrefs.getState();
  if (line.spoken === false || !line.en) return;
  if (opts.auto && (muted || !unlocked)) return;
  try {
    const fixed = !/\{\w+\}/.test(line.en) && line.id && !["llm", "faq", "refuse"].includes(line.id);
    if (fixed) {
      const r = await fetch(`/api/sahayika/audio/${encodeURIComponent(line.id)}`);
      if (r.ok) return playUrl(URL.createObjectURL(await r.blob()));
    }
    let url = blobCache.get(line.en);
    if (!url) {
      const r = await fetch("/api/sahayika/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: line.en }) });
      if (r.ok) { url = URL.createObjectURL(await r.blob()); blobCache.set(line.en, url); }
    }
    if (url) return playUrl(url);
  } catch { /* fall through */ }
  stop();
  speakBrowser(line.en);
}
export const stopSpeaking = stop;
