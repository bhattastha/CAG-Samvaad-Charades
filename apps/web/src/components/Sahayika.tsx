import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { lineText, t } from "../lib/strings";
import { announce, stop, toggle, useVoice, type Line } from "../lib/voice";
import { SahayikaAvatar } from "./SahayikaAvatar";
import { Icon } from "./Icon";

/** Listen / Pause / Resume for one line; Stop while it's active. Player is always in control. */
export function VoiceControl({ line, dark = false, compact = false }: { line: Line; dark?: boolean; compact?: boolean }) {
  const st = useVoice();
  if (line.spoken === false || !line.en) return null;
  const mine = st.line?.id === line.id && st.line.en === line.en;
  const state = mine ? st.status : "idle";
  const label = state === "playing" ? t("common.pause") : state === "paused" ? t("common.resume") : state === "loading" ? "…" : t("common.listen");
  const icon = state === "playing" ? "pause" : "volume";
  const cls = dark ? "bg-white/10 text-white border border-white/15 hover:bg-white/20" : "bg-navy-50 text-navy border border-slate-200 hover:bg-slate-100";
  return (
    <span className="inline-flex items-center gap-1 shrink-0">
      <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={() => toggle(line)} aria-pressed={state === "playing"}
        className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] font-semibold transition ${cls}`}>
        <Icon name={icon} size={14} />{!compact && label}
        {state === "playing" && <Bars />}
      </motion.button>
      {mine && state !== "idle" && (
        <motion.button type="button" initial={{ scale: 0 }} animate={{ scale: 1 }} whileTap={{ scale: 0.9 }} onClick={stop} aria-label={t("common.stop")}
          className={`rounded-md w-7 h-7 grid place-items-center ${cls}`}><Icon name="stop" size={12} fill /></motion.button>
      )}
    </span>
  );
}

function Bars() {
  return (
    <span className="inline-flex items-end gap-[2px] h-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span key={i} className="w-[3px] rounded bg-current" animate={{ height: ["30%", "100%", "45%", "80%", "30%"] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
      ))}
    </span>
  );
}

/** Announce a line when it appears (only if the player chose auto voice). */
export function useAutoSpeak(line: Line | null | undefined, enabled = true) {
  useEffect(() => { if (line && enabled) announce(line); }, [line?.id, line?.en, enabled]);
}

/** Sahayak briefing panel (navy, mission-control style). */
export function SahayikaPanel({ lines, children, autoSpeak = true, title }: { lines: (Line | null | undefined)[]; children?: React.ReactNode; autoSpeak?: boolean; title?: string }) {
  const shown = lines.filter(Boolean) as Line[];
  const combined = shown[0] ? { ...shown[0], id: shown.map((l) => l.id).join("+"), en: shown.map((l) => l.en).join(" ") } : null;
  useAutoSpeak(combined, autoSpeak);
  return (
    <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 160, damping: 20 }}
      className="sahayika-panel hud-grid p-5 sm:p-6 flex flex-col gap-4 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-primary via-gold to-transparent" aria-hidden />
      <div className="flex items-center gap-3 relative">
        <SahayikaAvatar size={48} />
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg font-bold">{t("common.guide")}</span>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.18em] text-gold-light"><span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />{t("sahayikaExtra.online")}</span>
            {combined && <span className="ml-auto"><VoiceControl line={combined} dark /></span>}
          </div>
          <div className="text-[12px] uppercase tracking-[0.14em] text-blue-200/80">{title ?? t("sahayikaExtra.sahayikaSays")}</div>
        </div>
      </div>
      {shown.map((l, i) => (
        <motion.p key={l.id + i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.12 }} className="text-[1.02rem] leading-relaxed text-white/90 relative border-l-2 border-gold/60 pl-3">
          {lineText(l)}
        </motion.p>
      ))}
      {children}
    </motion.section>
  );
}

/** Inline Sahayika speech bubble. */
export function SahayikaLine({ line, autoSpeak = true, tone = "cream", onClose, clamp = false }: { line: Line | null | undefined; autoSpeak?: boolean; tone?: "cream" | "blue" | "white"; onClose?: () => void; clamp?: boolean }) {
  useAutoSpeak(line, autoSpeak);
  const bg = tone === "blue" ? "sahayika-panel" : tone === "white" ? "bg-white border border-slate-200 shadow-card" : "bg-navy-50 border border-slate-200";
  return (
    <AnimatePresence>
      {line && (
        <motion.div key={line.id + line.en} initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }}
          className={`${bg} rounded-card px-3.5 py-2.5 flex items-start gap-3`} role="status">
          <SahayikaAvatar size={32} className="shrink-0 mt-0.5" />
          <p className={`flex-1 leading-relaxed ${clamp ? "line-clamp-2 sm:line-clamp-none text-[0.95rem]" : "text-[1rem]"} ${tone === "blue" ? "text-white" : "text-navy"}`}>
            <span className={`font-bold ${tone === "blue" ? "text-gold-light" : "text-navy"}`}>{t("common.guide")} · </span>
            {lineText(line)}
          </p>
          <VoiceControl line={line} dark={tone === "blue"} compact={clamp} />
          {onClose && <button onClick={onClose} className="text-muted hover:text-navy px-1" aria-label={t("common.close")}><Icon name="x" size={16} /></button>}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
