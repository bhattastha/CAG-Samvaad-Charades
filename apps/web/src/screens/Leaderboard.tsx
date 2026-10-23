import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useConfig } from "../lib/queries";
import { t } from "../lib/strings";
import { Avatar, Coin, Header, Page, PageTitle, Spinner, Stars } from "../components/Layout";
import { Medal } from "../components/Juice";
import { Icon } from "../components/Icon";
import { RankBadge } from "./Journey";

interface Row { rank: number; name: string; office: string; credits: number; stars: number; titles: number; bestSum: number; tier: string | null; levelsPlayed: number; me: boolean }
interface Board { scope: string; top: Row[]; me: (Row & { of: number; gap: number }) | null }
type Scope = "all" | "state" | "office";

/** Leaderboard: overall / my state / my office, podium on top, your own row pinned. */
export function Leaderboard() {
  const [scope, setScope] = useState<Scope>("all");
  const { data: cfg } = useConfig();
  const { data, isLoading } = useQuery({ queryKey: ["leaderboard", scope], queryFn: () => api<Board>(`/leaderboard?scope=${scope}&limit=50`), staleTime: 20_000 });
  const tierName = (k: string | null) => (k ? cfg?.rounds.find((r) => r.key === k)?.titleEn ?? "" : t("leaderboard.recruit"));
  const podium = data?.top.slice(0, 3) ?? [];
  const meVisible = data?.top.some((r) => r.me);
  return (
    <>
      <Header />
      <Page>
        <PageTitle kicker={t("leaderboard.kicker")} hi={t("leaderboard.heading")} en={t("leaderboard.sub")}
          right={
            <div role="tablist" className="inline-flex rounded-ui border border-slate-300 bg-white p-1">
              {(["all", "state", "office"] as Scope[]).map((k) => (
                <button key={k} role="tab" aria-selected={scope === k} onClick={() => setScope(k)}
                  className={`px-3.5 py-1.5 rounded-md text-sm font-bold transition ${scope === k ? "bg-navy text-white" : "text-muted hover:text-navy"}`}>
                  {t(`leaderboard.scope.${k}`)}
                </button>
              ))}
            </div>
          } />

        {data?.me && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="card-dark hud-grid p-4 sm:p-5 mb-5 flex flex-wrap items-center gap-4">
            <RankBadge rank={data.me.rank} size={44} />
            <div className="flex-1 min-w-[12rem]">
              <div className="kicker !text-gold-light">{t("leaderboard.yourStanding")}</div>
              <div className="text-xl font-extrabold">{t("leaderboard.rankOf", { rank: data.me.rank, of: data.me.of })}</div>
              <div className="text-sm text-blue-100/80">{data.me.rank === 1 ? t("leaderboard.leading") : t("leaderboard.gap", { n: data.me.gap })}</div>
            </div>
            <div className="flex items-center gap-6 text-center">
              <div><div className="text-2xl font-extrabold tnum text-gold-light inline-flex items-center gap-1"><Coin size={20} />{data.me.credits}</div><div className="text-[11px] uppercase tracking-[0.14em] text-blue-100/70">{t("common.credits")}</div></div>
              <div><div className="text-2xl font-extrabold tnum">{data.me.titles}</div><div className="text-[11px] uppercase tracking-[0.14em] text-blue-100/70">{t("leaderboard.titles")}</div></div>
            </div>
          </motion.div>
        )}

        {isLoading ? <Spinner /> : !data?.top.length ? (
          <div className="card p-10 text-center text-muted">{t("journey.leaderEmpty")}</div>
        ) : (
          <>
            {/* podium */}
            <div className="grid sm:grid-cols-3 gap-4 mb-5 items-end">
              {[1, 0, 2].map((i) => podium[i] && (
                <motion.div key={podium[i].rank} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * i }}
                  className={`card p-4 text-center ${i === 0 ? "sm:pb-7 border-gold-light shadow-gold" : ""} ${podium[i].me ? "ring-2 ring-primary/40" : ""}`}>
                  <div className="flex justify-center"><RankBadge rank={podium[i].rank} size={34} /></div>
                  <div className="mt-2 flex justify-center"><Avatar name={podium[i].name} size={i === 0 ? 60 : 48} ring={i === 0 ? "#C49B3D" : i === 1 ? "#94A3B8" : "#B87333"} /></div>
                  <div className="mt-2 font-bold text-navy truncate">{podium[i].name}</div>
                  <div className="text-xs text-muted truncate">{podium[i].office}</div>
                  <div className="mt-2 text-2xl font-extrabold text-gold-deep tnum inline-flex items-center gap-1"><Coin size={18} />{podium[i].credits}</div>
                </motion.div>
              ))}
            </div>
            {/* table */}
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.12em] text-muted">
                  <tr>
                    <th className="text-left px-4 py-2.5 w-14">#</th>
                    <th className="text-left px-2 py-2.5">{t("leaderboard.colPlayer")}</th>
                    <th className="text-left px-2 py-2.5 hidden md:table-cell">{t("leaderboard.colTier")}</th>
                    <th className="text-center px-2 py-2.5 hidden sm:table-cell">{t("leaderboard.colLevels")}</th>
                    <th className="text-center px-2 py-2.5 hidden sm:table-cell">{t("leaderboard.colStars")}</th>
                    <th className="text-right px-4 py-2.5">{t("leaderboard.colCredits")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top.map((r) => <BoardRow key={r.rank} r={r} tier={tierName(r.tier)} />)}
                  {!meVisible && data.me && (
                    <>
                      <tr><td colSpan={6} className="text-center text-muted py-1">⋯</td></tr>
                      <BoardRow r={{ ...data.me, me: true }} tier={tierName(data.me.tier)} />
                    </>
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted flex items-center gap-1.5"><Icon name="info" size={14} />{t("leaderboard.rule")}</p>
          </>
        )}
      </Page>
    </>
  );
}

function BoardRow({ r, tier }: { r: Row; tier: string }) {
  return (
    <tr className={`border-t border-slate-100 ${r.me ? "bg-navy-50 font-semibold" : "hover:bg-slate-50/70"}`}>
      <td className="px-4 py-2.5"><RankBadge rank={r.rank} /></td>
      <td className="px-2 py-2.5">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar name={r.name} size={30} ring={r.me ? "#E85A1A" : "#E2E8F0"} />
          <div className="min-w-0"><div className="font-semibold text-navy truncate">{r.name}{r.me && <span className="ml-2 text-[10px] uppercase tracking-wider text-primary-strong font-bold">{t("leaderboard.you")}</span>}</div>
            <div className="text-xs text-muted truncate">{r.office}</div></div>
        </div>
      </td>
      <td className="px-2 py-2.5 hidden md:table-cell"><span className="inline-flex items-center gap-2">{r.tier && <Medal k={r.tier} size={24} />}<span className="text-navy">{tier}</span></span></td>
      <td className="px-2 py-2.5 text-center tnum hidden sm:table-cell">{r.levelsPlayed}</td>
      <td className="px-2 py-2.5 hidden sm:table-cell"><div className="flex justify-center"><Stars n={r.stars} size={13} /></div></td>
      <td className="px-4 py-2.5 text-right font-extrabold text-gold-deep tnum">{r.credits}</td>
    </tr>
  );
}
