import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { lineById, useLines } from "../lib/queries";
import { t } from "../lib/strings";
import { Header, Page, PageTitle } from "../components/Layout";
import { SahayikaLine } from "../components/Sahayika";
import { GameButton } from "../components/Juice";
import { CreditPills } from "./HowToPlay";
import { Icon } from "../components/Icon";

/** §7.4 Rules — three cards that flip in, then on to the journey map. */
export function Rules() {
  const nav = useNavigate();
  const { data: lines } = useLines("before_game");
  const cards: [string, string, string, string][] = [
    ["lock", "rules.rule1", "rules.rule1Body", "border-t-primary"],
    ["replay", "rules.rule2", "rules.rule2Body", "border-t-navy-600"],
    ["keyboard", "rules.rule3", "rules.rule3Body", "border-t-gold"],
  ];
  return (
    <>
      <Header />
      <Page>
        <PageTitle hi={t("rules.heading")} en={t("rules.headingEn")} right={<GameButton sound="whoosh" onClick={() => nav("/journey")}><Icon name="map" size={18} /> {t("rules.start")} <Icon name="arrowRight" size={18} /></GameButton>} />
        <div className="grid md:grid-cols-3 gap-5">
          {cards.map(([ic, h, b, bg], i) => (
            <motion.div key={h} initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 220, damping: 26, delay: 0.1 + i * 0.1 }}
              whileHover={{ y: -2 }}
              className={`card border-t-4 ${bg} p-6`}>
              <div className="kicker">{t("rules.ruleLabel", { n: String(i + 1).padStart(2, "0") })}</div>
              <div className="mt-2 flex items-center gap-3 text-xl font-extrabold text-navy"><span className="w-11 h-11 rounded-ui bg-navy-50 border border-slate-200 text-navy grid place-items-center"><Icon name={ic} size={22} /></span>{t(h)}</div>
              <p className="mt-3 text-[1.02rem] leading-relaxed text-ink/85">{t(b)}</p>
            </motion.div>
          ))}
        </div>
        <div className="mt-6 grid md:grid-cols-[1fr_auto] gap-4 items-center">
          <SahayikaLine line={lineById(lines, "before_game.screen.rules_open")} tone="white" />
          <div className="card px-4 py-3"><CreditPills /></div>
        </div>
      </Page>
    </>
  );
}
