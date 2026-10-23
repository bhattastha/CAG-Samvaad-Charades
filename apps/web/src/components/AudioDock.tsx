import { AnimatePresence, motion } from "framer-motion";
import { lineText, t } from "../lib/strings";
import { pause, resume, stop, useVoice } from "../lib/voice";
import { SahayikaAvatar } from "./SahayikaAvatar";
import { Icon } from "./Icon";

/** Mini player shown whenever Sahayika is speaking: pause, resume or stop from anywhere. */
export function AudioDock() {
  const { status, line } = useVoice();
  return (
    <AnimatePresence>
      {line && status !== "idle" && (
        <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} transition={{ type: "spring", stiffness: 300, damping: 26 }}
          className="fixed z-[94] left-3 bottom-3 sm:left-5 sm:bottom-5 max-w-[min(92vw,26rem)] sahayika-panel !rounded-card pl-1.5 pr-2 py-1.5 flex items-center gap-2" role="region" aria-label={t("common.guide")}>
          <SahayikaAvatar size={36} />
          <div className="min-w-0 flex-1 text-sm leading-tight">
            <div className="font-bold flex items-center gap-1.5">{t("common.guide")}{status === "playing" && <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" aria-hidden />}</div>
            <div className="truncate text-blue-100/80">{lineText(line)}</div>
          </div>
          <button onClick={() => (status === "playing" ? pause() : resume())} className="w-9 h-9 rounded-ui bg-white text-navy font-bold grid place-items-center hover:bg-navy-50" aria-label={status === "playing" ? t("common.pause") : t("common.resume")}>
            {status === "playing" ? <Icon name="pause" size={16} stroke={2.4} /> : <Icon name="play" size={15} fill />}
          </button>
          <button onClick={stop} className="w-9 h-9 rounded-ui bg-white/10 border border-white/15 text-white grid place-items-center hover:bg-white/20" aria-label={t("common.stop")}><Icon name="stop" size={13} fill /></button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
