import { useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import cagLogo from "@assets/brand/cag-logo.png";
import bhashiniLogo from "@assets/brand/bhashini-logo.png";
import { api } from "../lib/api";
import { useConfig, useProgress } from "../lib/queries";
import { sfx } from "../lib/sfx";
import { usePrefs } from "../lib/store";
import { t, tList } from "../lib/strings";
import { Ambient, CountUp, GameButton, Medal } from "../components/Juice";
import { BrandName, Coin } from "../components/Layout";
import { Icon } from "../components/Icon";
import { useSettingsOpen } from "../components/Settings";
import { routeFor } from "./flow";

/** Landing: Sahayak voice guide on/off, right where the player starts. */
function VoiceToggle() {
  const voice = usePrefs((s) => s.voice);
  const set = usePrefs((s) => s.set);
  const unlock = usePrefs((s) => s.unlockAudio);
  const on = voice === "auto";
  return (
    <div className="flex items-center gap-3 rounded-ui bg-white/[0.06] border border-white/15 px-3.5 py-2.5 max-w-md">
      <Icon name="mic" size={20} className="text-gold-light" />
      <div className="flex-1">
        <div className="font-semibold text-white text-[15px]">{t("title.voiceToggle")}</div>
        <div className="text-xs text-blue-100/70">{t("title.voiceHelp")}</div>
      </div>
      <button role="switch" aria-checked={on} aria-label={t("title.voiceToggle")}
        onClick={() => { unlock(); set("voice", on ? "tap" : "auto"); }}
        className={`relative w-14 h-7 rounded-full transition ${on ? "bg-success" : "bg-white/25"}`}>
        <motion.span layout className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow ${on ? "right-1" : "left-1"}`} />
        <span className={`absolute inset-y-0 grid place-items-center text-[10px] font-bold text-white ${on ? "left-1.5" : "right-1.5"}`}>{on ? t("title.voiceOn") : t("title.voiceOff")}</span>
      </button>
    </div>
  );
}

interface PublicStats { players: number; offices: number; credits: number; titles: number; bundles: number }

/** §7.1 Title — the front door: a recruitment screen that sells the challenge, then one button in. */
export function Title() {
  const nav = useNavigate();
  const { data } = useProgress();
  const { data: cfg } = useConfig();
  const { data: stats } = useQuery({ queryKey: ["stats"], queryFn: () => api<PublicStats>("/stats/public"), staleTime: 60_000 });
  const unlock = usePrefs((s) => s.unlockAudio);
  const openSettings = useSettingsOpen((s) => s.set);
  const start = () => {
    unlock(); // first tap: sound may play from now on (§15.9)
    setTimeout(() => sfx("go"), 30);
    nav(data?.registered ? routeFor(data) : "/register");
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Enter" && (e.target as HTMLElement)?.tagName !== "BUTTON") start(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });
  const rounds = cfg?.rounds ?? [];
  const perks = tList<{ icon: string; title: string; body: string }>("title.perks");
  const steps = tList<{ title: string; body: string }>("title.steps");
  return (
    <div className="min-h-screen relative">
      {/* ---------- hero ---------- */}
      <section className="relative overflow-hidden text-white" style={{ background: "radial-gradient(110% 120% at 85% 0%, #1D4E89 0%, #0B2545 42%, #071A33 100%)" }}>
        <div className="absolute inset-0 hud-grid opacity-70" aria-hidden />
        <Ambient />
        <div className="absolute -right-40 -top-40 w-[620px] h-[620px] rounded-full border border-white/[0.06]" aria-hidden />
        <div className="absolute -right-20 -top-20 w-[420px] h-[420px] rounded-full border border-gold/20" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
          <div className="flex items-center gap-3 py-4">
            <img src={cagLogo} alt="CAG" className="h-11 w-auto rounded bg-white p-0.5" />
            <span className="en text-[11px] tracking-[0.3em] text-blue-100/70 hidden sm:inline">{t("common.brandLine")}</span>
            <div className="ml-auto flex items-center gap-2">
              {!data?.registered && <Link to="/register?returning=1" className="text-sm font-semibold text-white/85 hover:text-white px-3 py-2">{t("title.signIn")}</Link>}
              <button onClick={() => { unlock(); openSettings(true); }} aria-label={t("common.settings")} className="rounded-md border border-white/15 w-9 h-9 grid place-items-center text-white/85 hover:bg-white/10">
                <Icon name="settings" size={18} />
              </button>
              <img src={bhashiniLogo} alt="BHASHINI" className="h-11 w-auto rounded bg-white p-0.5" />
            </div>
          </div>

          <div className="grid lg:grid-cols-[1.15fr_1fr] gap-10 items-center pt-8 pb-14 lg:pt-14 lg:pb-20">
            <div>
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 rounded-md border border-gold/40 bg-gold/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-gold-light">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />{t("title.kicker")}
              </motion.div>
              <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 140, damping: 18, delay: 0.05 }}
                className="mt-5 font-extrabold leading-[1.0] tracking-tight text-[3.4rem] sm:text-[5.2rem] [&_.text-navy]:text-white">
                <BrandName split />
              </motion.h1>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="mt-4 text-[1.35rem] sm:text-2xl font-semibold text-white leading-snug max-w-xl">
                {t("title.tagline")}
              </motion.p>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} className="mt-3 text-[1.05rem] text-blue-100/85 leading-relaxed max-w-xl">
                {t("title.subheading")}
              </motion.p>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="mt-7 flex flex-wrap items-center gap-3">
                <GameButton sound={null} onClick={start} className="px-7 py-3.5 text-[1.12rem]" data-testid="start">
                  {data?.registered ? t("title.resume") : t("title.start")} <Icon name="arrowRight" size={20} />
                </GameButton>
                {!data?.registered && (
                  <span className="inline-flex items-center gap-2 text-sm text-gold-light font-semibold"><Coin size={18} />{t("title.startBonus")}</span>
                )}
              </motion.div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-6"><VoiceToggle /></motion.div>
            </div>

            {/* the level ladder as a game "season card" */}
            <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ type: "spring", stiffness: 90, damping: 18, delay: 0.2 }}
              className="relative rounded-card border border-white/15 bg-white/[0.06] backdrop-blur p-5 sm:p-6 shadow-pop">
              <div className="flex items-center justify-between">
                <div className="kicker !text-gold-light">{t("title.seasonCard")}</div>
                <div className="flex items-center gap-1.5 text-sm font-bold text-gold-light"><Coin size={16} />{cfg?.maxCredits ?? 50} {t("common.credits")}</div>
              </div>
              <ol className="mt-4 space-y-2.5">
                {rounds.map((r, i) => (
                  <motion.li key={r.key} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 + i * 0.08 }}
                    className={`flex items-center gap-3 rounded-ui px-3 py-2.5 border ${r.playable === false ? "border-dashed border-white/20 bg-white/[0.02]" : "border-white/10 bg-white/[0.05]"}`}>
                    <Medal k={r.key} size={40} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-200/70">{r.levelLabel}</span>
                        <span className="font-bold text-white truncate">{r.nameEn}</span>
                      </div>
                      <div className="text-xs text-blue-100/70 truncate">
                        {r.playable === false ? t("journey.comingSoon") : r.key === "trial" ? t("title.trialLine") : t("journey.pagesLabel", { n: r.pages ?? 1 })} · {r.titleEn}
                      </div>
                    </div>
                    {r.playable === false
                      ? <span className="text-[11px] font-bold uppercase tracking-wider text-purple-200">{t("journey.phase2")}</span>
                      : <span className="text-sm font-bold text-gold-light tnum">+{r.creditCap}</span>}
                  </motion.li>
                ))}
              </ol>
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-sm">
                <span className="text-blue-100/80">{t("title.joinBonus")}</span>
                <span className="font-bold text-gold-light tnum">+{cfg?.registration?.credits ?? 2}</span>
              </div>
            </motion.div>
          </div>

          {/* live numbers (aggregate only) */}
          <div className="relative grid grid-cols-2 md:grid-cols-4 border-t border-white/10">
            {([["users", "players", t("title.statPlayers")], ["globe", "offices", t("title.statOffices")], ["coin", "credits", t("title.statCredits")], ["award", "titles", t("title.statTitles")]] as const).map(([icon, k, label]) => (
              <div key={k} className="py-5 px-2 flex items-center gap-3">
                <Icon name={icon} size={22} className="text-gold-light" />
                <div>
                  <div className="text-2xl font-extrabold tnum"><CountUp to={stats ? Number(stats[k]) : 0} decimals={k === "credits" ? 1 : 0} /></div>
                  <div className="text-xs uppercase tracking-[0.14em] text-blue-100/70">{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- why play ---------- */}
      <section className="mx-auto max-w-7xl px-5 sm:px-8 py-12">
        <div className="kicker flex items-center gap-2"><span className="w-5 h-[2px] bg-primary" />{t("title.perksKicker")}</div>
        <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold text-navy tracking-tight">{t("title.perksHeading")}</h2>
        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {perks.map((p, i) => (
            <motion.div key={p.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }} className="card p-5">
              <div className="w-10 h-10 rounded-ui bg-navy text-gold-light grid place-items-center"><Icon name={p.icon} size={20} /></div>
              <div className="mt-3 font-bold text-navy text-[1.05rem]">{p.title}</div>
              <p className="mt-1 text-[0.95rem] text-muted leading-relaxed">{p.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ---------- how it works ---------- */}
      <section className="mx-auto max-w-7xl px-5 sm:px-8 pb-14">
        <div className="card p-6 sm:p-8 grid lg:grid-cols-[1fr_2fr] gap-8 items-center">
          <div>
            <div className="kicker flex items-center gap-2"><span className="w-5 h-[2px] bg-primary" />{t("title.stepsKicker")}</div>
            <h2 className="mt-2 text-2xl font-extrabold text-navy tracking-tight">{t("title.stepsHeading")}</h2>
            <GameButton sound={null} onClick={start} className="mt-5">{data?.registered ? t("title.resume") : t("title.start")} <Icon name="arrowRight" size={18} /></GameButton>
          </div>
          <ol className="grid sm:grid-cols-3 gap-4">
            {steps.map((s, i) => (
              <li key={s.title} className="relative rounded-ui border border-slate-200 bg-slate-50/60 p-4">
                <div className="text-[2rem] font-extrabold text-primary/90 tnum leading-none">0{i + 1}</div>
                <div className="mt-2 font-bold text-navy">{s.title}</div>
                <p className="mt-1 text-sm text-muted leading-relaxed">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
        <p className="mt-6 text-center text-sm text-muted">{t("title.footer")}</p>
      </section>
    </div>
  );
}
