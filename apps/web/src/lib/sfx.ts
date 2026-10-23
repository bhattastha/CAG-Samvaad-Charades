import { usePrefs } from "./store";

/**
 * Small synthesized sound effects (no audio files to download) and haptics.
 * Every major visual reward is paired with a sound and, on phones, a vibration.
 */
let ctx: AudioContext | null = null;
const ac = () => (ctx ??= new (window.AudioContext || (window as any).webkitAudioContext)());

function tone(freq: number, dur: number, opts: { type?: OscillatorType; at?: number; gain?: number; slideTo?: number } = {}) {
  const c = ac();
  const t0 = c.currentTime + (opts.at ?? 0);
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = opts.type ?? "sine";
  o.frequency.setValueAtTime(freq, t0);
  if (opts.slideTo) o.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + dur);
  const vol = (opts.gain ?? 0.18) * usePrefs.getState().volume;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

const SOUNDS = {
  tap: () => tone(660, 0.06, { type: "triangle", gain: 0.12 }),
  toggle: () => { tone(520, 0.05, { type: "triangle" }); tone(780, 0.07, { type: "triangle", at: 0.05 }); },
  pop: () => tone(420, 0.12, { type: "sine", slideTo: 880, gain: 0.16 }),
  whoosh: () => tone(220, 0.25, { type: "sawtooth", slideTo: 900, gain: 0.05 }),
  tick: () => tone(1200, 0.04, { type: "square", gain: 0.06 }),
  go: () => { tone(523, 0.12); tone(784, 0.18, { at: 0.1 }); tone(1047, 0.3, { at: 0.22, gain: 0.2 }); },
  coin: () => { tone(988, 0.07, { type: "square", gain: 0.08 }); tone(1319, 0.2, { type: "square", gain: 0.08, at: 0.07 }); },
  success: () => { [523, 659, 784].forEach((f, i) => tone(f, 0.16, { type: "triangle", at: i * 0.08 })); },
  star: () => tone(1568, 0.25, { type: "sine", slideTo: 2093, gain: 0.12 }),
  fanfare: () => { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i === 5 ? 0.5 : 0.14, { type: "triangle", at: i * 0.11, gain: 0.2 })); },
  error: () => { tone(200, 0.12, { type: "square", gain: 0.08 }); tone(150, 0.18, { type: "square", gain: 0.08, at: 0.1 }); },
  warn: () => { tone(880, 0.1, { type: "square", gain: 0.07 }); tone(880, 0.1, { type: "square", gain: 0.07, at: 0.18 }); },
};
export type Sfx = keyof typeof SOUNDS;

const HAPTIC: Partial<Record<Sfx, number | number[]>> = { tap: 8, toggle: 12, pop: 15, error: [30, 40, 30], warn: [20, 60, 20], success: [15, 30, 25], fanfare: [20, 40, 20, 40, 60], coin: 10, go: 40 };

export function sfx(name: Sfx) {
  const p = usePrefs.getState();
  if (p.haptics && HAPTIC[name] && navigator.vibrate) { try { navigator.vibrate(HAPTIC[name]!); } catch { /* ignore */ } }
  if (!p.sound || !p.unlocked) return;
  try { SOUNDS[name](); } catch { /* audio blocked */ }
}
