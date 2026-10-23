import { AnimatePresence, motion } from "framer-motion";
import { create } from "zustand";
import { sfx } from "../lib/sfx";
import { usePrefs, type TextSize, type VoiceMode } from "../lib/store";
import { t } from "../lib/strings";
import { stop } from "../lib/voice";

export const useSettingsOpen = create<{ open: boolean; set(o: boolean): void }>((s) => ({ open: false, set: (o) => s({ open: o }) }));

function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange(v: T): void }) {
  return (
    <div className="grid rounded-xl bg-gray-100 p-1 gap-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
      {options.map(([v, l]) => (
        <button key={v} onClick={() => { onChange(v); sfx("toggle"); }} aria-pressed={value === v}
          className={`rounded-lg px-2 py-2 text-sm font-semibold transition ${value === v ? "bg-white shadow text-primary-strong" : "text-muted hover:text-navy"}`}>{l}</button>
      ))}
    </div>
  );
}
function Switch({ on, onChange, label }: { on: boolean; onChange(v: boolean): void; label: string }) {
  return (
    <button role="switch" aria-checked={on} onClick={() => { onChange(!on); sfx("toggle"); }} className="w-full flex items-center justify-between py-2">
      <span className="font-semibold">{label}</span>
      <span className={`w-12 h-7 rounded-full p-1 transition ${on ? "bg-success" : "bg-gray-300"}`}>
        <motion.span layout className={`block w-5 h-5 rounded-full bg-white shadow ${on ? "ml-auto" : ""}`} />
      </span>
    </button>
  );
}

/** Settings: voice control, sound, haptics, text/HUD size, contrast, motion (game accessibility). */
export function SettingsPanel() {
  const { open, set: setOpen } = useSettingsOpen();
  const p = usePrefs();
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[98] flex justify-end" role="dialog" aria-modal="true" aria-label={t("settings.heading")}>
          <motion.div className="absolute inset-0 bg-navy/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
          <motion.aside initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 280, damping: 30 }}
            className="relative w-full max-w-sm h-full bg-white shadow-pop flex flex-col">
            <div className="p-5 border-b border-orange-100 bg-cream flex items-center gap-3">
              <span className="text-2xl" aria-hidden>⚙️</span>
              <h2 className="text-xl font-bold flex-1">{t("settings.heading")}</h2>
              <button onClick={() => setOpen(false)} className="text-2xl text-muted" aria-label={t("common.close")}>✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              <section>
                <h3 className="font-bold mb-2">🎙 {t("settings.voice")}</h3>
                <Seg<VoiceMode> value={p.voice} onChange={(v) => { p.set("voice", v); if (v === "off") stop(); }}
                  options={[["off", t("settings.voiceOff")], ["tap", t("settings.voiceTap")], ["auto", t("settings.voiceAuto")]]} />
                <p className="text-sm text-muted mt-2">{t("settings.voiceHint")}</p>
              </section>
              <section className="space-y-1">
                <Switch label={`🔊 ${t("settings.sound")}`} on={p.sound} onChange={(v) => p.set("sound", v)} />
                <label className="flex items-center gap-3 text-sm">
                  <span className="w-16 text-muted">{t("settings.volume")}</span>
                  <input type="range" min={0} max={1} step={0.05} value={p.volume} onChange={(e) => p.set("volume", Number(e.target.value))} onMouseUp={() => sfx("coin")} className="flex-1 accent-primary" />
                </label>
                <Switch label={`📳 ${t("settings.haptics")}`} on={p.haptics} onChange={(v) => p.set("haptics", v)} />
              </section>
              <section>
                <h3 className="font-bold mb-2">🔠 {t("settings.textSize")}</h3>
                <Seg<TextSize> value={p.textSize} onChange={(v) => p.set("textSize", v)} options={[["s", t("settings.sizeS")], ["m", t("settings.sizeM")], ["l", t("settings.sizeL")], ["xl", t("settings.sizeXL")]]} />
              </section>
              <section className="space-y-1">
                <Switch label={`◐ ${t("settings.contrast")}`} on={p.contrast} onChange={(v) => p.set("contrast", v)} />
                <Switch label={`🐢 ${t("settings.motion")}`} on={p.reduceMotion} onChange={(v) => p.set("reduceMotion", v)} />
              </section>
            </div>
            <div className="p-5 border-t"><button className="btn-primary w-full" onClick={() => setOpen(false)}>{t("settings.done")}</button></div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
