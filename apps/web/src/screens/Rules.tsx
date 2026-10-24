import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useConfig } from "../lib/queries";
import { sfx } from "../lib/sfx";
import { t, tList } from "../lib/strings";
import { Header, Page, PageTitle } from "../components/Layout";
import { GameButton, Medal } from "../components/Juice";
import { ObBackdrop, ladderOf } from "../components/Onboarding";
import { Icon } from "../components/Icon";

interface RuleCard { icon: string; title: string; points: string[] }

/** Rules: four compact cards, an agreement checkbox that gates the way into the challenge. */
export function Rules() {
  const nav = useNavigate();
  const { data: cfg } = useConfig();
  const [agreed, setAgreed] = useState(false);
  const cards = tList<RuleCard>("ob.rules.cards");
  const ladder = ladderOf(cfg);
  const vars = { max: cfg?.scoreOutOf ?? 100, pass: cfg?.titlePassMark ?? 33 };
  return (
    <ObBackdrop>
      <Header />
      <Page>
        <PageTitle kicker={t("ob.rules.kicker")} hi={t("ob.rules.heading")} en={t("ob.rules.sub")} />
        <div className="grid sm:grid-cols-2 gap-4 sm:gap-5">
          {cards.map((c, i) => (
            <motion.section key={c.title} initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 220, damping: 26, delay: 0.08 + i * 0.08 }} whileHover={{ y: -2 }}
              className={`card p-5 border-t-4 ${["border-t-primary", "border-t-navy-600", "border-t-success", "border-t-gold"][i]}`} aria-labelledby={`rule-${i}`}>
              <h2 id={`rule-${i}`} className="flex items-center gap-3 text-xl font-extrabold text-navy">
                <span className="w-10 h-10 rounded-ui bg-navy-50 border border-slate-200 grid place-items-center"><Icon name={c.icon as any} size={20} /></span>{c.title}
              </h2>
              {i < 3 ? (
                <ul className="mt-3 space-y-1.5">
                  {c.points.map((p) => (
                    <li key={p} className="flex gap-2.5 text-[15px] leading-snug text-ink/90"><Icon name="check" size={16} stroke={2.4} className="mt-0.5 shrink-0 text-success" />{p.replace("{max}", String(vars.max)).replace("{pass}", String(vars.pass))}</li>
                  ))}
                </ul>
              ) : (
                <div className="mt-3">
                  <ol className="flex items-start justify-between gap-1" aria-label={c.title}>
                    {ladder.map((r, n) => (
                      <li key={r.key} className="flex-1 min-w-0 flex flex-col items-center text-center relative">
                        {n > 0 && <span className="absolute top-5 -left-1/2 w-full h-0.5 bg-slate-200 -z-0" aria-hidden />}
                        <span className="relative z-[1]"><Medal k={r.key} size={44} /></span>
                        <span className="mt-1 text-[11px] font-bold text-navy leading-tight">{r.name}</span>
                        {r.phase2 && <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-purple-700">{t("ob.train.score.phase2")}</span>}
                      </li>
                    ))}
                  </ol>
                  <p className="mt-3 text-[13px] text-muted flex items-center gap-1.5"><Icon name="sparkle" size={14} className="text-purple-600" />{t("ob.rules.ladderNote")}</p>
                </div>
              )}
            </motion.section>
          ))}
        </div>

        <p className="mt-4 flex items-start gap-2 text-sm text-muted"><Icon name="lock" size={16} className="mt-0.5 shrink-0 text-navy-600" />{t("ob.rules.fairPlay")}</p>

        <div className="mt-5 card p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
          <label className="flex items-start gap-3 cursor-pointer max-w-xl">
            <input id="agree" type="checkbox" checked={agreed} onChange={(e) => { setAgreed(e.target.checked); sfx(e.target.checked ? "success" : "toggle"); }} className="mt-1 w-5 h-5 accent-[#15803D] shrink-0" />
            <span className="text-[1rem] font-semibold text-navy">{t("ob.rules.agree")}</span>
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <GameButton variant="ghost" onClick={() => nav("/how-to-play")}><Icon name="chevronLeft" size={18} /> {t("ob.rules.backToTraining")}</GameButton>
            <GameButton sound="whoosh" disabled={!agreed} aria-describedby={agreed ? undefined : "agree-hint"} onClick={() => nav("/journey")} className="px-7 py-3.5 text-lg">
              {t("ob.rules.enter")} <Icon name="arrowRight" size={18} />
            </GameButton>
          </div>
          {!agreed && <span id="agree-hint" className="sr-only">{t("ob.rules.agreeHint")}</span>}
        </div>
      </Page>
    </ObBackdrop>
  );
}
