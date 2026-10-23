import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Card, Empty, PageHeader, Pill, btn, input, th, td, tr } from "./ui";

/** Results for the Hindi Pakhwada contest; the xlsx export is the official credits sheet (§8.7). */
export function Results() {
  const { data = [] } = useQuery({ queryKey: ["results"], queryFn: () => api<any[]>("/admin/results") });
  const { data: cfg } = useQuery({ queryKey: ["acfg"], queryFn: () => api<any>("/admin/config") });
  const [q, setQ] = useState("");
  const maxCh = cfg?.effective?.maxChancesPerRound ?? 3;
  const keys = (data[0]?.summary.rounds ?? []).filter((r: any) => r.playable !== false).map((r: any) => r.key);
  const rows = useMemo(() => data.filter((p) => !q || `${p.name} ${p.email} ${p.office}`.toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.summary.totalCredits - a.summary.totalCredits), [data, q]);
  return (
    <div>
      <PageHeader title="Results" subtitle="Best score per level (best of the chances counts), credits and titles. Ranked by total credits."
        actions={<a className={btn.primary} href="/api/admin/exports/credits">Export credits (xlsx)</a>} />
      <Card pad={false}>
        <div className="flex items-center gap-3 border-b border-slate-100 p-3">
          <input className={`${input} max-w-sm`} placeholder="Search player or office" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search results" />
          <span className="ml-auto text-xs text-slate-500">{rows.length} players</span>
        </div>
        {rows.length === 0 ? <div className="p-4"><Empty>No players yet.</Empty></div> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-slate-50"><tr><th className={th}>#</th><th className={th}>Player</th><th className={th}>Office</th>{keys.map((k: string) => <th key={k} className={th}>{cfg?.effective?.rounds?.find((r: any) => r.key === k)?.nameEn ?? k}</th>)}<th className={th}>Titles</th><th className={th}>Total</th></tr></thead>
            <tbody>{rows.map((p, i) => (
              <tr key={p.email} className={tr}>
                <td className={`${td} tabular-nums text-slate-500`}>{i + 1}</td>
                <td className={td}><b>{p.name}</b><div className="text-xs text-slate-500">{p.email} · {p.mobile}</div></td>
                <td className={`${td} max-w-[16rem] text-xs`}>{p.office}</td>
                {p.summary.rounds.filter((r: any) => keys.includes(r.key)).map((r: any) => (
                  <td key={r.key} className={`${td} tabular-nums`}><b className={r.titleEarned ? "text-emerald-700" : ""}>{r.best ?? "—"}</b><div className="text-[11px] text-slate-500">{r.chancesUsed}/{maxCh} · {r.credits} cr</div></td>
                ))}
                <td className={`${td} text-xs`}>{p.summary.rounds.filter((r: any) => r.titleEarned).map((r: any) => <Pill key={r.key} tone="gold">{r.title}</Pill>)}</td>
                <td className={`${td} font-bold tabular-nums`}>{p.summary.totalCredits}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
    </div>
  );
}
