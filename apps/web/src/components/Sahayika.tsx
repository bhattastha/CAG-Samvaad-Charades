import { useEffect } from "react";
import { t } from "../lib/strings";
import { speak, type Line } from "../lib/voice";
import { SahayikaAvatar } from "./SahayikaAvatar";

export function ListenButton({ line, dark = false }: { line: Line; dark?: boolean }) {
  if (line.spoken === false) return null;
  return (
    <button
      type="button"
      onClick={() => speak(line)}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold transition ${dark ? "bg-white/15 text-white hover:bg-white/25" : "bg-royal-soft text-royal hover:bg-blue-100"}`}
    >
      {t("common.listen")}
    </button>
  );
}

/** Speaks a line once when it appears (only after the first tap, and never when muted). */
export function useAutoSpeak(line: Line | null | undefined, enabled = true) {
  useEffect(() => {
    if (line && enabled) speak(line, { auto: true });
  }, [line?.id, line?.en, enabled]);
}

/** Big blue Sahayika panel (report card, registration, total score). */
export function SahayikaPanel({ lines, children, autoSpeak = true, title }: { lines: (Line | null | undefined)[]; children?: React.ReactNode; autoSpeak?: boolean; title?: string }) {
  const shown = lines.filter(Boolean) as Line[];
  useAutoSpeak(shown[0], autoSpeak);
  return (
    <section className="sahayika-panel p-5 sm:p-6 flex flex-col gap-4 animate-rise">
      <div className="flex items-center gap-3">
        <SahayikaAvatar size={58} className="drop-shadow-lg animate-float" />
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xl font-bold">{t("common.sahayikaButton")}</span>
            {shown[0] && <ListenButton line={{ ...shown[0], en: shown.map((l) => l.en).join(" ") }} dark />}
          </div>
          <div className="text-sm text-blue-100">{title ?? t("sahayikaExtra.sahayikaSays")}</div>
        </div>
      </div>
      {shown.map((l, i) => (
        <p key={l.id + i} className="text-[17px] leading-relaxed text-white/95">“{l.hi}”</p>
      ))}
      {children}
    </section>
  );
}

/** Inline Sahayika line (pop-ups, in-round slim card, how-to-play). */
export function SahayikaLine({ line, autoSpeak = true, tone = "cream", onClose, clamp = false }: { line: Line | null | undefined; autoSpeak?: boolean; tone?: "cream" | "blue" | "white"; onClose?: () => void; clamp?: boolean }) {
  useAutoSpeak(line, autoSpeak);
  if (!line) return null;
  const bg = tone === "blue" ? "sahayika-panel" : tone === "white" ? "bg-white border border-blue-100 shadow-card" : "bg-cream border border-orange-100";
  return (
    <div className={`${bg} rounded-card px-3.5 py-2.5 flex items-start gap-3 animate-rise`} role="status">
      <SahayikaAvatar size={36} className="shrink-0 mt-0.5" />
      <p className={`flex-1 text-[16px] leading-relaxed ${clamp ? "line-clamp-2 sm:line-clamp-none text-[15px] sm:text-[16px]" : ""} ${tone === "blue" ? "text-white" : "text-navy"}`}>
        <span className={`font-bold ${tone === "blue" ? "text-blue-100" : "text-primary-strong"}`}>{t("common.sahayikaButton")}: </span>
        {line.hi}
      </p>
      <ListenButton line={line} dark={tone === "blue"} />
      {onClose && <button onClick={onClose} className="text-muted hover:text-navy px-1" aria-label={t("ui.close")}>✕</button>}
    </div>
  );
}
