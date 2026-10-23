import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { lineText, t } from "../lib/strings";
import { announce, stop, toggle, useVoice, type Line } from "../lib/voice";
import { SahayikaAvatar } from "./SahayikaAvatar";

/** Listen / Pause / Resume for one line; Stop while it's active. Player is always in control. */
export function VoiceControl({ line, dark = false, compact = false }: { line: Line; dark?: boolean; compact?: boolean }) {
  const st = useVoice();
  if (line.spoken === false || !line.en) return null;
  const mine = st.line?.id === line.id && st.line.en === line.en;
  const state = mine ? st.status : "idle";
  const label = state === "playing" ? t("common.pause") : state === "paused" ? t("common.resume") : state === "loading" ? "…" : t("common.listen");
  const icon = state === "playing" ? "❚❚" : "▶";
  const cls = dark ? "bg-white/15 text-white hover:bg-white/25" : "bg-royal-soft text-royal hover:bg-blue-100";
  return (
    <span className="inline-flex items-center gap-1 shrink-0">
      <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={() => toggle(line)} aria-pressed={state === "playing"}
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold transition ${cls}`}>
        <span className="text-[11px]" aria-hidden>{icon}</span>{!compact && label}
        {state === "playing" && <Bars />}
      </motion.button>
      {mine && state !== "idle" && (
        <motion.button type="button" initial={{ scale: 0 }} animate={{ scale: 1 }} whileTap={{ scale: 0.9 }} onClick={stop} aria-label={t("common.stop")}
          className={`rounded-full w-7 h-7 grid place-items-center text-xs ${cls}`}>■</motion.button>
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

/** Big blue Sahayika panel. */
export function SahayikaPanel({ lines, children, autoSpeak = true, title }: { lines: (Line | null | undefined)[]; children?: React.ReactNode; autoSpeak?: boolean; title?: string }) {
  const shown = lines.filter(Boolean) as Line[];
  const combined = shown[0] ? { ...shown[0], id: shown.map((l) => l.id).join("+"), en: shown.map((l) => l.en).join(" ") } : null;
  useAutoSpeak(combined, autoSpeak);
  return (
    <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 160, damping: 20 }}
      className="sahayika-panel p-5 sm:p-6 flex flex-col gap-4 relative overflow-hidden">
      <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/10" aria-hidden />
      <div className="absolute right-10 -bottom-12 w-28 h-28 rounded-full bg-orange-300/20" aria-hidden />
      <div className="flex items-center gap-3 relative">
        <SahayikaAvatar size={58} className="drop-shadow-lg animate-float" />
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xl font-bold">{t("common.guide")}</span>
            {combined && <VoiceControl line={combined} dark />}
          </div>
          <div className="text-sm text-blue-100">{title ?? t("sahayikaExtra.sahayikaSays")}</div>
        </div>
      </div>
      {shown.map((l, i) => (
        <motion.p key={l.id + i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.12 }} className="text-[1.06rem] leading-relaxed text-white/95 relative">
          “{lineText(l)}”
        </motion.p>
      ))}
      {children}
    </motion.section>
  );
}

/** Inline Sahayika speech bubble. */
export function SahayikaLine({ line, autoSpeak = true, tone = "cream", onClose, clamp = false }: { line: Line | null | undefined; autoSpeak?: boolean; tone?: "cream" | "blue" | "white"; onClose?: () => void; clamp?: boolean }) {
  useAutoSpeak(line, autoSpeak);
  const bg = tone === "blue" ? "sahayika-panel" : tone === "white" ? "bg-white border border-blue-100 shadow-card" : "bg-cream border border-orange-100";
  return (
    <AnimatePresence>
      {line && (
        <motion.div key={line.id + line.en} initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }}
          className={`${bg} rounded-card px-3.5 py-2.5 flex items-start gap-3`} role="status">
          <SahayikaAvatar size={36} className="shrink-0 mt-0.5" />
          <p className={`flex-1 leading-relaxed ${clamp ? "line-clamp-2 sm:line-clamp-none text-[0.95rem]" : "text-[1rem]"} ${tone === "blue" ? "text-white" : "text-navy"}`}>
            <span className={`font-bold ${tone === "blue" ? "text-blue-100" : "text-primary-strong"}`}>{t("common.guide")}: </span>
            {lineText(line)}
          </p>
          <VoiceControl line={line} dark={tone === "blue"} compact={clamp} />
          {onClose && <button onClick={onClose} className="text-muted hover:text-navy px-1" aria-label={t("common.close")}>✕</button>}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
