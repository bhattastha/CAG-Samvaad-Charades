import { useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import cagLogo from "@assets/brand/cag-logo.png";
import bhashiniLogo from "@assets/brand/bhashini-logo.png";
import { useConfig, useProgress } from "../lib/queries";
import { sfx } from "../lib/sfx";
import { usePrefs } from "../lib/store";
import { t } from "../lib/strings";
import { Ambient, GameButton, Medal } from "../components/Juice";
import { BrandName } from "../components/Layout";
import { useSettingsOpen } from "../components/Settings";
import { routeFor } from "./flow";

/** Landing: Sahayak voice guide on/off, right where the player starts. */
function VoiceToggle() {
  const voice = usePrefs((s) => s.voice);
  const set = usePrefs((s) => s.set);
  const unlock = usePrefs((s) => s.unlockAudio);
  const on = voice === "auto";
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} className="mt-6 flex items-center gap-3 rounded-2xl bg-white/90 border border-blue-100 shadow-card px-4 py-3 max-w-md">
      <span className="text-2xl" aria-hidden>🎙</span>
      <div className="flex-1">
        <div className="font-bold">{t("title.voiceToggle")}</div>
        <div className="text-xs text-muted">{t("title.voiceHelp")}</div>
      </div>
      <button role="switch" aria-checked={on} aria-label={t("title.voiceToggle")}
        onClick={() => { unlock(); set("voice", on ? "tap" : "auto"); }}
        className={`relative w-16 h-8 rounded-full transition ${on ? "bg-success" : "bg-gray-300"}`}>
        <motion.span layout className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow ${on ? "right-1" : "left-1"}`} />
        <span className={`absolute inset-y-0 grid place-items-center text-[10px] font-extrabold text-white ${on ? "left-2" : "right-2 text-gray-600"}`}>{on ? t("title.voiceOn") : t("title.voiceOff")}</span>
      </button>
    </motion.div>
  );
}

/** §7.1 Title — design 01, as a game start screen. */
export function Title() {
  const nav = useNavigate();
  const { data } = useProgress();
  const { data: cfg } = useConfig();
  const unlock = usePrefs((s) => s.unlockAudio);
  const openSettings = useSettingsOpen((s) => s.set);
  const start = () => {
    unlock(); // first tap: sound may play from now on (§15.9)
    setTimeout(() => sfx("go"), 30);
    nav(data?.registered ? routeFor(data) : "/register");
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Enter") start(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });
  return (
    <div className="min-h-screen grid lg:grid-cols-2 relative overflow-hidden">
      <Ambient density={18} />
      <section className="relative flex flex-col px-6 sm:px-12 lg:px-16 py-8">
        <div className="flex items-center justify-between">
          <img src={cagLogo} alt="CAG" className="h-14 w-auto rounded-lg border border-gray-100 bg-white p-1 shadow-sm" />
          <motion.button whileTap={{ scale: 0.88, rotate: 45 }} onClick={() => { unlock(); openSettings(true); }} aria-label={t("common.settings")}
            className="rounded-full border border-gray-200 bg-white w-11 h-11 grid place-items-center text-lg shadow-sm">⚙️</motion.button>
        </div>
        <div className="my-auto py-10">
          <motion.span initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="chip bg-primary-soft border-orange-200 text-primary-strong tracking-[0.2em] text-xs uppercase">
            {t("common.brandLine")} · {t("title.kicker")}
          </motion.span>
          <motion.h1 initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 140, damping: 14, delay: 0.1 }}
            className="mt-5 font-extrabold leading-[1.02] text-6xl sm:text-8xl [&_span]:block">
            <BrandName split />
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="mt-5 text-xl text-navy/85 leading-relaxed max-w-lg">
            {t("title.subheading")}
          </motion.p>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.75 }} className="mt-6 flex items-center gap-3">
            {cfg?.rounds.map((r, i) => (
              <motion.div key={r.key} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.8 + i * 0.1 }} title={r.titleEn}>
                <Medal k={r.key} size={48} locked={!data?.summary?.rounds[i]?.titleEarned && !!data?.registered} />
              </motion.div>
            ))}
            <span className="text-sm font-semibold text-muted ml-1">{t("title.levelsLabel")}</span>
          </motion.div>
          <VoiceToggle />
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1, type: "spring" }} className="mt-6 flex items-center gap-4">
            <GameButton sound={null} onClick={start} className="px-10 py-4 text-xl animate-breathe hover:animate-none">
              {data?.registered ? t("title.resume") : t("title.start")} <span aria-hidden>▶</span>
            </GameButton>
            <span className="hidden sm:inline text-sm text-muted">{t("title.pressAnyKey")}</span>
          </motion.div>
        </div>
      </section>
      <section className="relative overflow-hidden bg-gradient-to-br from-cream via-[#FFF7F0] to-royal-soft flex flex-col items-center justify-center py-16">
        <img src={bhashiniLogo} alt="BHASHINI" className="absolute top-8 right-8 h-14 w-auto rounded-lg border border-gray-100 bg-white p-1 shadow-sm" />
        {[540, 430, 320, 210].map((d, i) => (
          <motion.div key={d} className="absolute rounded-full border-2 border-orange-200/70" style={{ width: d, height: d }}
            animate={{ scale: [1, 1.05, 1], opacity: [0.35 + i * 0.12, 0.6, 0.35 + i * 0.12] }} transition={{ duration: 4, delay: i * 0.4, repeat: Infinity }} />
        ))}
        <div className="relative flex items-center">
          <motion.div initial={{ x: -120, opacity: 0, rotate: -20 }} animate={{ x: 0, opacity: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 90, damping: 12, delay: 0.2 }}
            whileHover={{ rotate: -8, scale: 1.05 }}
            className="w-40 h-40 sm:w-48 sm:h-48 rounded-full bg-navy text-white grid place-items-center en text-7xl sm:text-8xl font-bold shadow-pop ring-8 ring-white">A</motion.div>
          <motion.div initial={{ x: 120, opacity: 0, rotate: 20 }} animate={{ x: 0, opacity: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 90, damping: 12, delay: 0.35 }}
            whileHover={{ rotate: 8, scale: 1.05 }}
            className="-ml-10 mt-16 w-40 h-40 sm:w-48 sm:h-48 rounded-full bg-primary text-white grid place-items-center text-7xl sm:text-8xl font-bold shadow-glow ring-8 ring-white">अ</motion.div>
          <motion.div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-4xl" animate={{ scale: [1, 1.25, 1], rotate: [0, 10, 0] }} transition={{ duration: 2.2, repeat: Infinity }} aria-hidden>✨</motion.div>
        </div>
        <div className="relative mt-8 text-xl font-bold text-navy">{t("title.artCaption")}</div>
      </section>
    </div>
  );
}
