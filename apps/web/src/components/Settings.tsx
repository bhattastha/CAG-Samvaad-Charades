import { AnimatePresence, motion } from "framer-motion";
import { create } from "zustand";
import { sfx } from "../lib/sfx";
import { usePrefs, type TextSize, type VoiceMode } from "../lib/store";
import { t } from "../lib/strings";
import { stop } from "../lib/voice";
import { Icon } from "./Icon";

export const useSettingsOpen = create<{ open: boolean; set(o: boolean): void }>((s) => ({ open: false, set: (o) => s({ open: o }) }));

function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange(v: T): void }) {
  return (
    <div className="grid rounded-ui bg-slate-100 border border-slate-200 p-1 gap-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
      {options.map(([v, l]) => (
        <button key={v} onClick={() => { onChange(v); sfx("toggle"); }} aria-pressed={value === v}
          className={`rounded-md px-2 py-2 text-sm font-semibold transition ${value === v ? "bg-navy text-white shadow-sm" : "text-muted hover:text-navy hover:bg-white"}`}>{l}</button>
      ))}
    </div>
  );
}
function Switch({ on, onChange, label, icon }: { on: boolean; onChange(v: boolean): void; label: string; icon?: string }) {
  return (
    <button role="switch" aria-checked={on} onClick={() => { onChange(!on); sfx("toggle"); }} className="w-full flex items-center justify-between py-2">
      <span className="font-semibold text-navy inline-flex items-center gap-2">{icon && <Icon name={icon} size={17} className="text-navy-600" />}{label}</span>
      <span className={`w-11 h-6 rounded-full p-0.5 transition ${on ? "bg-navy-600" : "bg-slate-300"}`}>
        <motion.span layout transition={{ type: "spring", stiffness: 500, damping: 35 }} className={`block w-5 h-5 rounded-full bg-white shadow ${on ? "ml-auto" : ""}`} />
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
          <motion.div className="absolute inset-0 bg-navy-900/50 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
          <motion.aside initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 280, damping: 30 }}
            className="relative w-full max-w-sm h-full bg-white shadow-pop flex flex-col">
            <div className="p-5 card-dark hud-grid !rounded-none !border-0 !shadow-none flex items-center gap-3">
              <span className="w-9 h-9 rounded-ui bg-white/10 border border-white/15 grid place-items-center text-gold-light" aria-hidden><Icon name="settings" size={19} /></span>
              <h2 className="text-xl font-bold flex-1">{t("settings.heading")}</h2>
              <button onClick={() => setOpen(false)} className="w-9 h-9 rounded-ui grid place-items-center text-white/80 hover:text-white hover:bg-white/10" aria-label={t("common.close")}><Icon name="x" size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              <section>
                <h3 className="kicker mb-2 flex items-center gap-1.5"><Icon name="mic" size={14} /> {t("settings.voice")}</h3>
                <Seg<VoiceMode> value={p.voice} onChange={(v) => { p.set("voice", v); if (v === "off") stop(); }}
                  options={[["off", t("settings.voiceOff")], ["tap", t("settings.voiceTap")], ["auto", t("settings.voiceAuto")]]} />
                <p className="text-sm text-muted mt-2">{t("settings.voiceHint")}</p>
              </section>
              <section className="space-y-1 border-t border-slate-200 pt-4">
                <Switch icon="volume" label={t("settings.sound")} on={p.sound} onChange={(v) => p.set("sound", v)} />
                <label className="flex items-center gap-3 text-sm">
                  <span className="w-16 text-muted">{t("settings.volume")}</span>
                  <input type="range" min={0} max={1} step={0.05} value={p.volume} onChange={(e) => p.set("volume", Number(e.target.value))} onMouseUp={() => sfx("coin")} className="flex-1 accent-navy-600" style={{ accentColor: "#1D4E89" }} />
                </label>
                <Switch icon="phone" label={t("settings.haptics")} on={p.haptics} onChange={(v) => p.set("haptics", v)} />
              </section>
              <section>
                <h3 className="kicker mb-2 flex items-center gap-1.5"><Icon name="type" size={14} /> {t("settings.textSize")}</h3>
                <Seg<TextSize> value={p.textSize} onChange={(v) => p.set("textSize", v)} options={[["s", t("settings.sizeS")], ["m", t("settings.sizeM")], ["l", t("settings.sizeL")], ["xl", t("settings.sizeXL")]]} />
              </section>
              <section className="space-y-1 border-t border-slate-200 pt-4">
                <Switch icon="contrast" label={t("settings.contrast")} on={p.contrast} onChange={(v) => p.set("contrast", v)} />
                <Switch icon="pause" label={t("settings.motion")} on={p.reduceMotion} onChange={(v) => p.set("reduceMotion", v)} />
              </section>
            </div>
            <div className="p-5 border-t border-slate-200"><button className="btn-primary w-full" onClick={() => setOpen(false)}>{t("settings.done")}</button></div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
