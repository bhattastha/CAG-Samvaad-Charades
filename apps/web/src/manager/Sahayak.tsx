import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { Card, Empty, Kpi, Notice, PageHeader, Pill, Tabs, btn, fmtDate, input, th, td, tr, useIsManager } from "./ui";

export function Sahayak() {
  const [tab, setTab] = useState<"lines" | "chat">("lines");
  return (
    <div>
      <PageHeader title="Sahayak" subtitle="The guide's scripted lines (shown in text, spoken in English) and the chat log with blocked answers first." />
      <Tabs value={tab} onChange={setTab} items={[{ key: "lines", label: "Script lines" }, { key: "chat", label: "Chat log" }]} />
      {tab === "lines" ? <Lines /> : <ChatLog />}
    </div>
  );
}

function Lines() {
  const isManager = useIsManager();
  const { data: lines = [] } = useQuery({ queryKey: ["alines"], queryFn: () => api<any[]>("/admin/sahayika/lines") });
  const sections = useMemo(() => [...new Set(lines.map((l) => l.section))], [lines]);
  const [sec, setSec] = useState("before_game");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const shown = lines.filter((l) => l.section === sec && (!q || `${l.id} ${l.en} ${l.hi}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <Card pad={false}>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
        <div className="flex flex-wrap gap-1">{sections.map((s) => (
          <button key={s} onClick={() => setSec(s)} className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${s === sec ? "border-[#0B2545] bg-[#0B2545] text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}>{s} <span className="opacity-70">{lines.filter((l) => l.section === s).length}</span></button>
        ))}</div>
        <input className={`${input} ml-auto max-w-xs`} placeholder="Search lines" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search lines" />
        {isManager && <button className={btn.navy} onClick={async () => { try { const r = await api<any>("/admin/sahayika/audio", { body: {} }); setMsg(`Audio: ${r.ok} generated, ${r.failed} failed.`); } catch (e) { setMsg((e as ApiError).code === "tts_not_configured" ? "BHASHINI TTS key is not configured on the server." : (e as ApiError).code); } }}>Regenerate audio (BHASHINI TTS)</button>}
      </div>
      {msg && <div className="p-3"><Notice>{msg}</Notice></div>}
      <div className="divide-y divide-slate-100">{shown.map((l) => <LineRow key={l.id} l={l} ro={!isManager} />)}</div>
      {shown.length === 0 && <div className="p-4"><Empty>No lines.</Empty></div>}
    </Card>
  );
}

function LineRow({ l, ro }: { l: any; ro: boolean }) {
  const [en, setEn] = useState(l.en);
  const [hi, setHi] = useState(l.hi);
  const [ok, setOk] = useState(false);
  const dirty = en !== l.en || hi !== l.hi;
  return (
    <div className="grid grid-cols-[15rem_1fr_1fr_auto] items-start gap-3 px-4 py-3">
      <div className="text-xs"><div className="break-all font-mono font-semibold text-slate-800">{l.id}</div><div className="mt-1 text-slate-500">{l.when}</div><div className="mt-1">{l.spoken ? <Pill tone="navy">spoken</Pill> : <Pill>shown only</Pill>}</div></div>
      <textarea className={input} disabled={ro} rows={3} value={en} aria-label="English line" onChange={(e) => { setEn(e.target.value); setOk(false); }} />
      <textarea lang="hi" className={`${input} text-[15px]`} disabled={ro} rows={3} value={hi} aria-label="Hindi line" onChange={(e) => { setHi(e.target.value); setOk(false); }} />
      <div className="flex flex-col gap-1">
        <button className={btn.ghost} title="Play (browser voice)" onClick={() => { const u = new SpeechSynthesisUtterance(en); u.lang = "en-IN"; speechSynthesis.cancel(); speechSynthesis.speak(u); }}>▶ Play</button>
        {dirty && !ro && <button className={btn.primary} onClick={async () => { await api(`/admin/sahayika/lines/${l.id}`, { method: "PUT", body: { en, hi } }); setOk(true); l.en = en; l.hi = hi; }}>Save</button>}
        {ok && !dirty && <span className="text-center text-xs text-emerald-700">✓ saved</span>}
      </div>
    </div>
  );
}

function ChatLog() {
  const { data: chat = [] } = useQuery({ queryKey: ["chatlog"], queryFn: () => api<any[]>("/admin/chatlog"), refetchInterval: 30_000 });
  const [only, setOnly] = useState(false);
  const rows = chat.filter((c) => !only || c.blocked);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3"><Kpi label="Questions (latest 300)" value={chat.length} /><Kpi label="Blocked answers" value={chat.filter((c) => c.blocked).length} warn={chat.some((c) => c.blocked)} /><Kpi label="Players" value={new Set(chat.map((c) => c.player_id)).size} /></div>
      <Card pad={false}>
        <div className="flex items-center gap-3 border-b border-slate-100 p-3"><label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} /> Blocked only</label></div>
        {rows.length === 0 ? <div className="p-4"><Empty>No chat yet.</Empty></div> : (
          <table className="w-full text-sm"><thead className="bg-slate-50"><tr><th className={th}>When · player</th><th className={th}>Question</th><th className={th}>Answer</th><th className={th}>Source</th></tr></thead>
            <tbody>{rows.map((c) => (
              <tr key={c.id} className={`${tr} ${c.blocked ? "bg-red-50/60" : ""}`}>
                <td className={`${td} w-48 text-xs text-slate-500`}>{fmtDate(c.at)}<div className="truncate">{c.email}</div></td>
                <td className={`${td} w-1/4`}>{c.question}</td>
                <td className={td}><div lang="hi">{c.hi}</div><div className="text-xs text-slate-500">{c.en}</div></td>
                <td className={`${td} text-xs`}>{c.source}{c.blocked && <div className="mt-1"><Pill tone="red">blocked</Pill></div>}</td>
              </tr>
            ))}</tbody></table>
        )}
      </Card>
    </div>
  );
}
