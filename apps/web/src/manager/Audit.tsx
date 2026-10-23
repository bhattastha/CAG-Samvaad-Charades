import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Card, Empty, PageHeader, Pill, fmtDate, input, th, td, tr, select } from "./ui";

const GROUPS = [
  { k: "", label: "All actions" }, { k: "page.", label: "Content" }, { k: "part.", label: "Verification" }, { k: "player.", label: "Players" },
  { k: "config.", label: "Settings" }, { k: "danger.", label: "Danger zone" }, { k: "glossary.", label: "Glossary" }, { k: "office.", label: "Offices" },
  { k: "sahayika.", label: "Sahayak" }, { k: "export.", label: "Exports" },
];
const tone = (a: string) => (a.startsWith("danger") || a === "player.delete" ? "red" : a.startsWith("player") ? "amber" : a.startsWith("config") ? "gold" : a.startsWith("page.publish") ? "green" : "slate");

export function Audit() {
  const [q, setQ] = useState("");
  const [action, setAction] = useState("");
  const { data = [], isFetching } = useQuery({ queryKey: ["audit", q, action], queryFn: () => api<any[]>(`/admin/audit?${new URLSearchParams({ ...(q ? { q } : {}), ...(action ? { action } : {}) })}`) });
  return (
    <div>
      <PageHeader title="Audit log" subtitle="Every console action, newest first (latest 500 matching)." />
      <Card pad={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <input className={`${input} max-w-sm`} placeholder="Search actor, action or target" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search audit log" />
          <select className={select} value={action} onChange={(e) => setAction(e.target.value)} aria-label="Filter by action">{GROUPS.map((g) => <option key={g.k} value={g.k}>{g.label}</option>)}</select>
          <span className="ml-auto text-xs text-slate-500">{isFetching ? "Loading…" : `${data.length} entries`}</span>
        </div>
        {data.length === 0 ? <div className="p-4"><Empty>No entries.</Empty></div> : (
          <table className="w-full text-sm"><thead className="bg-slate-50"><tr><th className={th}>When</th><th className={th}>Actor</th><th className={th}>Action</th><th className={th}>Target</th><th className={th}>Detail</th></tr></thead>
            <tbody>{data.map((a) => (
              <tr key={a.id} className={tr}>
                <td className={`${td} whitespace-nowrap text-xs text-slate-500`}>{fmtDate(a.at)}</td><td className={`${td} text-xs`}>{a.actor}</td>
                <td className={td}><Pill tone={tone(a.action) as any}>{a.action}</Pill></td><td className={`${td} text-xs`}>{a.target}</td>
                <td className={`${td} max-w-md truncate font-mono text-[11px] text-slate-500`} title={a.meta ? JSON.stringify(a.meta) : ""}>{a.meta ? JSON.stringify(a.meta) : ""}</td>
              </tr>
            ))}</tbody></table>
        )}
      </Card>
    </div>
  );
}
