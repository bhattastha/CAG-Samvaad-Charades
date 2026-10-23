import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { lineById, useLines } from "../lib/queries";
import { t } from "../lib/strings";
import { Header, Page, PageTitle } from "../components/Layout";
import { SahayikaLine } from "../components/Sahayika";
import { GameButton } from "../components/Juice";
import { CreditPills } from "./HowToPlay";

/** §7.4 Rules — three cards that flip in, then on to the journey map. */
export function Rules() {
  const nav = useNavigate();
  const { data: lines } = useLines("before_game");
  const cards: [string, string, string, string][] = [
    ["🔒", "rules.rule1", "rules.rule1Body", "from-orange-100 to-cream"],
    ["🔁", "rules.rule2", "rules.rule2Body", "from-blue-100 to-royal-soft"],
    ["⌨️", "rules.rule3", "rules.rule3Body", "from-green-100 to-success-soft"],
  ];
  return (
    <>
      <Header />
      <Page>
        <PageTitle hi={t("rules.heading")} en={t("rules.headingEn")} right={<GameButton sound="whoosh" onClick={() => nav("/journey")}>🗺 {t("rules.start")} →</GameButton>} />
        <div className="grid md:grid-cols-3 gap-5" style={{ perspective: 1200 }}>
          {cards.map(([ic, h, b, bg], i) => (
            <motion.div key={h} initial={{ rotateY: 90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 120, damping: 14, delay: 0.15 + i * 0.18 }}
              whileHover={{ y: -6, rotate: i === 1 ? 0 : i === 0 ? -1 : 1 }}
              className={`rounded-card bg-gradient-to-br ${bg} border border-white shadow-card p-6`}>
              <div className="text-xs font-extrabold text-muted tracking-widest">RULE {i + 1}</div>
              <div className="mt-2 flex items-center gap-3 text-xl font-extrabold"><span className="w-12 h-12 rounded-2xl bg-white shadow grid place-items-center text-2xl">{ic}</span>{t(h)}</div>
              <p className="mt-3 text-[1.02rem] leading-relaxed">{t(b)}</p>
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
