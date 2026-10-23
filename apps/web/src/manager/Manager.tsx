import { useEffect, useMemo, useState } from "react";
import { NavLink, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { numberTokens, type ClientPart, type Field, type GlossaryEntry, type Part, type PlantedSlip } from "@hc/shared";
import { api, ApiError } from "../lib/api";
import { Header } from "../components/Layout";
import { DraftPanel, SourcePanel } from "../round/PageViews";

// The console is staff-facing (not player-facing), desktop-first, same design system (§8).

const ROUNDS = ["trial", "primary", "secondary", "pro", "varchaspati"] as const;
const PART_TYPES = ["passage", "header", "heading", "headnote", "body", "footnote", "footer", "page_number", "table", "chart", "annexure_ref"];
const card = "card p-5";
const btn = "rounded-lg px-3.5 py-2 text-sm font-semibold border";
const btnP = `${btn} bg-primary-strong text-white border-primary-strong hover:bg-primary`;
const btnB = `${btn} bg-royal text-white border-royal hover:bg-royal-bright`;
const btnG = `${btn} bg-white border-gray-300 hover:bg-gray-50`;
const ta = "w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-[15px] focus:border-royal-bright outline-none";

function useMe() {
  return useQuery({ queryKey: ["admin-me"], queryFn: () => api<{ email: string; role: "manager" | "viewer" }>("/admin/me"), retry: false });
}

function Login() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState<string | null | false>(false);
  const [err, setErr] = useState("");
  return (
    <div className="max-w-md mx-auto mt-16 card p-6">
      <h1 className="text-2xl font-bold text-primary">Game manager sign-in</h1>
      <p className="text-sm text-muted mt-1">Email OTP. Only addresses in the admin list can open the console.</p>
      <input className="input mt-4 en" placeholder="you@cag.gov.in" value={email} onChange={(e) => setEmail(e.target.value)} />
      {sent !== false && <input className="input mt-3 en tracking-[0.4em] text-center" placeholder="OTP" value={code} onChange={(e) => setCode(e.target.value)} />}
      {sent && <div className="text-xs text-muted mt-1">Development code: {sent}</div>}
      {err && <div className="err">{err}</div>}
      <button className="btn-blue mt-4 w-full" onClick={async () => {
        setErr("");
        try {
          if (sent === false) { const r = await api<{ devCode?: string }>("/auth/otp/request", { body: { email } }); setSent(r.devCode ?? null); }
          else { const v = await api<{ role: string | null }>("/auth/otp/verify", { body: { email, code } }); if (!v.role) setErr("This email is not a game manager."); qc.invalidateQueries({ queryKey: ["admin-me"] }); }
        } catch (e) { setErr((e as ApiError).code); }
      }}>{sent === false ? "Send code" : "Sign in"}</button>
    </div>
  );
}

export default function Manager() {
  const me = useMe();
  if (me.isLoading) return <div className="p-10">Loading…</div>;
  if (me.error) return <><Header compact /><Login /></>;
  const tab = ({ isActive }: { isActive: boolean }) => `block rounded-lg px-3 py-2 font-semibold ${isActive ? "bg-primary-soft text-primary-strong" : "hover:bg-gray-50"}`;
  return (
    <>
      <Header compact />
      <div className="mx-auto max-w-[1500px] px-4 py-5 grid grid-cols-[200px_1fr] gap-5">
        <nav className="space-y-1 text-[15px]">
          <div className="text-xs text-muted px-3 pb-2">{me.data!.email} · {me.data!.role}</div>
          <NavLink end to="/manager" className={tab}>Dashboard</NavLink>
          <NavLink to="/manager/pages" className={tab}>Pages</NavLink>
          <NavLink to="/manager/ingest" className={tab}>Ingest a page</NavLink>
          <NavLink to="/manager/glossary" className={tab}>Glossary</NavLink>
          <NavLink to="/manager/offices" className={tab}>Offices</NavLink>
          <NavLink to="/manager/sahayika" className={tab}>Sahayika</NavLink>
          <NavLink to="/manager/results" className={tab}>Results</NavLink>
          <NavLink to="/manager/settings" className={tab}>Settings</NavLink>
          <NavLink to="/manager/audit" className={tab}>Audit log</NavLink>
        </nav>
        <main className="min-w-0">
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="pages" element={<Pages />} />
            <Route path="pages/:id" element={<PageEditor />} />
            <Route path="ingest" element={<Ingest />} />
            <Route path="glossary" element={<Glossary />} />
            <Route path="offices" element={<Offices />} />
            <Route path="sahayika" element={<SahayikaAdmin />} />
            <Route path="results" element={<Results />} />
            <Route path="settings" element={<Settings />} />
            <Route path="audit" element={<Audit />} />
          </Routes>
        </main>
      </div>
    </>
  );
}

// ---------------- dashboard ----------------
function Dashboard() {
  const { data } = useQuery({ queryKey: ["dash"], queryFn: () => api<any>("/admin/dashboard"), refetchInterval: 15000 });
  if (!data) return null;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Players registered" v={data.players} />
        <Stat label="Attempts today" v={data.attemptsToday} />
        {data.rounds.slice(0, 2).map((r: any) => <Stat key={r.key} label={`${r.name} · avg best`} v={r.avgBest ?? "—"} />)}
      </div>
      <div className={card}>
        <h2 className="font-bold text-lg mb-3">Pages per round</h2>
        <table className="w-full text-[15px]"><thead><tr className="text-left text-muted text-sm"><th>Round</th><th>Published</th><th>Drafts</th><th>Players played</th><th>Avg best</th></tr></thead>
          <tbody>{data.rounds.map((r: any) => (
            <tr key={r.key} className="border-t border-gray-100"><td className="py-2 font-semibold">{r.name}</td>
              <td className={r.published < 3 ? "text-timer-text font-bold" : ""}>{r.published}{r.published < 3 && " ⚠ needs ≥ 3"}</td><td>{r.drafts}</td><td>{r.playersPlayed}</td><td>{r.avgBest ?? "—"}</td></tr>
          ))}</tbody></table>
      </div>
      <div className={card}>
        <h2 className="font-bold text-lg mb-3">BHASHINI service health</h2>
        <div className="flex flex-wrap gap-3">{data.services.map((s: any) => (
          <span key={s.task} className={`chip ${!s.configured ? "bg-gray-100 border-gray-200 text-muted" : s.open ? "bg-timer-bg border-red-200 text-timer-text" : "bg-success-soft border-green-200 text-green-800"}`}>
            {s.task}: {!s.configured ? "key not set" : s.open ? "circuit open" : "ok"}{s.recentFailures ? ` (${s.recentFailures} fails)` : ""}
          </span>
        ))}</div>
      </div>
    </div>
  );
}
const Stat = ({ label, v }: { label: string; v: React.ReactNode }) => <div className={card}><div className="text-sm text-muted">{label}</div><div className="text-3xl font-bold mt-1">{v}</div></div>;

// ---------------- pages ----------------
function Pages() {
  const nav = useNavigate();
  const [round, setRound] = useState("");
  const { data = [] } = useQuery({ queryKey: ["pages"], queryFn: () => api<any[]>("/admin/pages") });
  return (
    <div className={card}>
      <div className="flex items-center gap-3 mb-3">
        <h2 className="font-bold text-lg flex-1">Pages</h2>
        <select className={ta + " w-auto"} value={round} onChange={(e) => setRound(e.target.value)}><option value="">All rounds</option>{ROUNDS.map((r) => <option key={r}>{r}</option>)}</select>
        <button className={btnP} onClick={() => nav("/manager/ingest")}>+ Ingest a page</button>
      </div>
      <table className="w-full text-[15px]"><thead><tr className="text-left text-muted text-sm"><th>Round</th><th>Label</th><th>Status</th><th>Verified parts</th><th>Times used</th></tr></thead>
        <tbody>{data.filter((p) => !round || p.round_key === round).map((p) => (
          <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => nav(`/manager/pages/${p.id}`)}>
            <td className="py-2">{p.round_key}</td><td className="font-semibold">{p.label}{p.sample && <span className="ml-2 chip bg-amber-50 border-amber-200 text-amber-800 text-xs">sample</span>}</td>
            <td><StatusChip s={p.status} /></td><td className={p.verified < p.parts ? "text-timer-text" : "text-success"}>{p.verified} / {p.parts}</td><td>{p.times_used}</td>
          </tr>
        ))}</tbody></table>
    </div>
  );
}
const StatusChip = ({ s }: { s: string }) => <span className={`chip text-xs ${s === "published" ? "bg-success-soft border-green-200 text-green-800" : s === "retired" ? "bg-gray-100 border-gray-200 text-muted" : "bg-amber-50 border-amber-200 text-amber-800"}`}>{s}</span>;

interface AdminPage { id: string; roundKey: string; label: string; printedPageNo: string | null; parts: Part[]; terms: GlossaryEntry[]; slips: PlantedSlip[]; status: string; sample: boolean; sector: string; scope: string; verified: Record<string, boolean> }

function PageEditor() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["page", id], queryFn: () => api<AdminPage>(`/admin/pages/${id}`) });
  const [pg, setPg] = useState<AdminPage | null>(null);
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState<"parts" | "slips" | "terms" | "preview">("parts");
  useEffect(() => { if (data) setPg(structuredClone(data)); }, [data]);
  if (!pg) return null;
  const save = async () => {
    try {
      await api(`/admin/pages/${id}`, { method: "PUT", body: { id: pg.id, roundKey: pg.roundKey, label: pg.label, printedPageNo: pg.printedPageNo, parts: pg.parts, terms: pg.terms, slips: pg.slips, sector: pg.sector, scope: pg.scope } });
      setMsg("Saved."); qc.invalidateQueries({ queryKey: ["page", id] });
    } catch (e) { setMsg(`Save failed: ${(e as ApiError).code}`); }
  };
  const action = async (path: string, body: unknown = {}) => {
    try { const r = await api<any>(`/admin/pages/${id}/${path}`, { body }); setMsg(`${path}: ${JSON.stringify(r)}`); qc.invalidateQueries({ queryKey: ["page", id] }); }
    catch (e) { setMsg(`${path} failed: ${(e as ApiError).code} ${JSON.stringify((e as ApiError).body?.parts ?? "")}`); }
  };
  const setField = (pi: number, fi: number, patch: Partial<Field>) => setPg((p) => { const n = structuredClone(p!); Object.assign(n.parts[pi].fields[fi], patch); return n; });
  const setPart = (pi: number, patch: Partial<Part>) => setPg((p) => { const n = structuredClone(p!); Object.assign(n.parts[pi], patch); return n; });
  const verify = async (partId: string, v: boolean) => { await api(`/admin/pages/${id}/parts/${partId}/verify`, { method: "PUT", body: { verified: v } }); qc.invalidateQueries({ queryKey: ["page", id] }); };
  const allVerified = pg.parts.filter((p) => p.editable).every((p) => data?.verified[p.id]);

  return (
    <div className="space-y-4">
      <div className={`${card} flex flex-wrap items-center gap-3`}>
        <div className="flex-1 min-w-[16rem]">
          <input className={ta + " font-bold text-lg"} value={pg.label} onChange={(e) => setPg({ ...pg, label: e.target.value })} />
          <div className="text-xs text-muted mt-1 en">{pg.id} · round {pg.roundKey} · printed p. {pg.printedPageNo ?? "—"} · sector (never shown to players): {pg.sector || "—"}</div>
          <label className="text-xs text-muted mt-1 flex items-center gap-2">Report scope (office mapping)
            <input className={ta + " w-56 py-0.5"} value={pg.scope ?? "union"} onChange={(e) => setPg({ ...pg, scope: e.target.value })} placeholder="union, or a state name e.g. Bihar" list="scopes" />
            <datalist id="scopes"><option value="union" /></datalist>
            <span>· {new Set(pg.parts.map((x) => x.pageNo).filter(Boolean)).size || 1} report page(s) in this bundle</span>
          </label>
        </div>
        <StatusChip s={pg.status} />
        <button className={btnG} onClick={save}>Save</button>
        <button className={btnB} onClick={() => action("draft", { overwrite: false })}>Generate BHASHINI draft</button>
        <button className={btnP} disabled={!allVerified} title={allVerified ? "" : "Every part must be reference-verified"} onClick={() => action("publish")}>Publish</button>
        <button className={btnG} onClick={() => action("retire")}>Retire</button>
        {msg && <div className="w-full text-sm text-royal-deep break-all">{msg}</div>}
      </div>
      <div className="flex gap-2">{(["parts", "slips", "terms", "preview"] as const).map((x) => <button key={x} onClick={() => setTab(x)} className={tab === x ? btnP : btnG}>{x === "parts" ? `Parts & reference (${pg.parts.length})` : x === "slips" ? `Planted slips (${pg.slips.length})` : x === "terms" ? `Glossary terms (${pg.terms.length})` : "Player preview"}</button>)}</div>

      {tab === "parts" && pg.parts.map((p, pi) => (
        <div key={p.id} className={`${card} ${data?.verified[p.id] ? "border-green-300" : ""}`}>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="font-bold en">{p.id}</span>
            <select className={ta + " w-auto"} value={p.type} onChange={(e) => setPart(pi, { type: e.target.value as Part["type"] })}>{PART_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
            <label className="text-sm">tick group <input className={ta + " w-24 inline"} value={p.tickGroup ?? ""} onChange={(e) => setPart(pi, { tickGroup: e.target.value || null })} /></label>
            <label className="text-sm">report page <input type="number" min={1} className={ta + " w-20 inline"} value={p.pageNo ?? ""} onChange={(e) => setPart(pi, { pageNo: e.target.value ? Number(e.target.value) : undefined })} /></label>
            <label className="text-sm flex items-center gap-1"><input type="checkbox" checked={p.editable} onChange={(e) => setPart(pi, { editable: e.target.checked })} /> editable</label>
            <span className="flex-1" />
            {p.editable && <label className={`text-sm font-semibold flex items-center gap-1.5 ${data?.verified[p.id] ? "text-success" : "text-timer-text"}`}>
              <input type="checkbox" checked={!!data?.verified[p.id]} onChange={(e) => verify(p.id, e.target.checked)} /> reference verified</label>}
          </div>
          <div className="space-y-3">
            {p.fields.map((f, fi) => (
              <div key={f.key} className="grid lg:grid-cols-3 gap-2 border-t border-gray-100 pt-2">
                <div><div className="text-xs text-muted">EN · {f.key}{f.numeric ? " · numeric" : ""}</div><textarea className={ta + " en"} rows={f.en.length > 120 ? 4 : 2} value={f.en} onChange={(e) => setField(pi, fi, { en: e.target.value })} /></div>
                {!f.numeric && <div><div className="text-xs text-muted">CAG Hindi reference (from the published Hindi; verify!)</div><textarea className={ta} rows={f.en.length > 120 ? 4 : 2} value={f.hiReference} onChange={(e) => setField(pi, fi, { hiReference: e.target.value })} /></div>}
                {!f.numeric && <div><div className="text-xs text-muted">BHASHINI draft (with planted slips)</div><textarea className={ta} rows={f.en.length > 120 ? 4 : 2} value={f.draft ?? ""} onChange={(e) => setField(pi, fi, { draft: e.target.value })} /></div>}
                {!f.numeric && <div className="lg:col-span-3 text-xs flex flex-wrap items-center gap-1.5">
                  <span className="text-muted">Locked numbers:</span>
                  {f.locked.map((tk) => <button key={tk} className="chip bg-royal-soft border-blue-200 text-royal-deep text-xs" title="click to remove" onClick={() => setField(pi, fi, { locked: f.locked.filter((x) => x !== tk) })}>{tk} ✕</button>)}
                  <button className="underline text-royal" onClick={() => setField(pi, fi, { locked: [...new Set(numberTokens(f.en))] })}>auto-detect</button>
                  <button className="underline text-royal" onClick={() => { const v = prompt("Add locked token"); if (v) setField(pi, fi, { locked: [...f.locked, v] }); }}>+ add</button>
                  {f.locked.filter((tk) => f.hiReference && !f.hiReference.includes(tk)).length > 0 && <span className="text-timer-text">⚠ missing in reference: {f.locked.filter((tk) => !f.hiReference.includes(tk)).join(", ")}</span>}
                </div>}
              </div>
            ))}
          </div>
        </div>
      ))}

      {tab === "slips" && (
        <div className={card}>
          <p className="text-sm text-muted mb-3">Mark wrong words in the draft. They drive the draft highlights and Sahayika's hints; the fix hint is never sent to players.</p>
          {pg.slips.map((s, i) => {
            const part = pg.parts.find((p) => p.id === s.partId);
            const inDraft = part?.fields.some((f) => (f.draft ?? "").includes(s.wrongText));
            return (
              <div key={i} className="grid grid-cols-[6rem_9rem_1fr_1fr_1fr_auto] gap-2 items-center mb-2">
                <select className={ta} value={s.partId} onChange={(e) => setPg({ ...pg, slips: pg.slips.map((x, j) => j === i ? { ...x, partId: e.target.value } : x) })}>{pg.parts.map((p) => <option key={p.id}>{p.id}</option>)}</select>
                <select className={ta} value={s.kind} onChange={(e) => setPg({ ...pg, slips: pg.slips.map((x, j) => j === i ? { ...x, kind: e.target.value as PlantedSlip["kind"] } : x) })}>{["term", "transliteration", "grammar", "omission"].map((k) => <option key={k}>{k}</option>)}</select>
                <input className={`${ta} ${inDraft ? "" : "border-red-400"}`} placeholder="wrong text (in draft)" value={s.wrongText} onChange={(e) => setPg({ ...pg, slips: pg.slips.map((x, j) => j === i ? { ...x, wrongText: e.target.value } : x) })} />
                <input className={ta + " en"} placeholder="English term" value={s.enTerm ?? ""} onChange={(e) => setPg({ ...pg, slips: pg.slips.map((x, j) => j === i ? { ...x, enTerm: e.target.value || null } : x) })} />
                <input className={ta} placeholder="fix hint (hidden)" value={s.fixHint} onChange={(e) => setPg({ ...pg, slips: pg.slips.map((x, j) => j === i ? { ...x, fixHint: e.target.value } : x) })} />
                <button className={btnG} onClick={() => setPg({ ...pg, slips: pg.slips.filter((_, j) => j !== i) })}>✕</button>
              </div>
            );
          })}
          <button className={btnG} onClick={() => setPg({ ...pg, slips: [...pg.slips, { partId: pg.parts.find((p) => p.editable)?.id ?? "", kind: "term", wrongText: "", enTerm: null, fixHint: "" }] })}>+ Add slip</button>
        </div>
      )}

      {tab === "terms" && <TermsEditor pg={pg} setPg={setPg} />}

      {tab === "preview" && <Preview pg={pg} />}
    </div>
  );
}

function TermsEditor({ pg, setPg }: { pg: AdminPage; setPg(p: AdminPage): void }) {
  const [q, setQ] = useState("");
  const { data: hits = [] } = useQuery({ queryKey: ["gl", q], queryFn: () => api<GlossaryEntry[]>(`/glossary?q=${encodeURIComponent(q)}`), enabled: q.length > 1 });
  const ref = pg.parts.flatMap((p) => p.fields.map((f) => f.hiReference)).join(" ");
  return (
    <div className={card}>
      <p className="text-sm text-muted mb-3">The terms scored for शब्दावली. Each term's Hindi must appear in the CAG reference.</p>
      <table className="w-full text-[15px] mb-4"><tbody>{pg.terms.map((t, i) => (
        <tr key={t.en} className="border-t border-gray-100">
          <td className="py-1.5 en font-semibold">{t.en}</td><td>{t.hi}{t.variants.length > 0 && <span className="text-muted"> / {t.variants.join(", ")}</span>}</td>
          <td className="text-sm text-muted">avoid: {t.avoid.join(", ")}</td>
          <td>{[t.hi, ...t.variants].some((v) => ref.includes(v)) ? <span className="text-success">✓ in reference</span> : <span className="text-timer-text">⚠ not in reference</span>}</td>
          <td><button className={btnG} onClick={() => setPg({ ...pg, terms: pg.terms.filter((_, j) => j !== i) })}>✕</button></td>
        </tr>
      ))}</tbody></table>
      <input className={ta} placeholder="Search glossary to add a term…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mt-2 flex flex-wrap gap-2">{hits.slice(0, 12).map((h: any) => (
        <button key={h.en} className="chip bg-white border-gray-200" onClick={() => setPg({ ...pg, terms: [...pg.terms.filter((x) => x.en !== h.en), { en: h.en, hi: h.hi, variants: h.variants, avoid: h.avoid }] })}>+ {h.en} = {h.hi}</button>
      ))}</div>
    </div>
  );
}

function Preview({ pg }: { pg: AdminPage }) {
  const parts = pg.parts.map((p) => ({ ...p, fields: p.fields.map(({ hiReference: _h, ...f }) => f) })) as ClientPart[];
  const answers = Object.fromEntries(pg.parts.filter((p) => p.editable).map((p) => [p.id, { fields: Object.fromEntries(p.fields.filter((f) => !f.numeric).map((f) => [f.key, f.draft ?? ""])), done: false }]));
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className={card}><SourcePanel parts={parts} terms={{}} focusedPart={null} sentenceIndex={null} onTerm={() => {}} onPartClick={() => {}} /></div>
      <div className={card}>{pg.roundKey === "trial" ? <div className="text-muted">परख: the player starts from an empty editor.</div> :
        <DraftPanel parts={parts} answers={answers} readOnly watch={pg.slips.map((s) => s.wrongText)} focusedPart={null} register={() => {}} onField={() => {}} onTick={() => {}} onFocus={() => {}} onBlocked={() => {}} onTyping={() => {}} onWatchClick={() => {}} onXlit={() => {}} />}
      </div>
    </div>
  );
}

// ---------------- ingest wizard ----------------
function Ingest() {
  const nav = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [pageNo, setPageNo] = useState(1);
  const [seg, setSeg] = useState<any>(null);
  const [meta, setMeta] = useState({ id: "", round: "primary", label: "", printed: "", sector: "" });
  const [err, setErr] = useState("");
  const segment = async () => {
    if (!file) return;
    const fd = new FormData();
    fd.append("page", String(pageNo));
    fd.append("file", file);
    setErr("");
    const r = await fetch("/api/admin/ingest/segment", { method: "POST", body: fd });
    const j = await r.json();
    if (!r.ok) return setErr(j.error);
    setSeg(j);
  };
  const create = async () => {
    try {
      await api("/admin/pages", { body: {
        page_id: meta.id, round: meta.round, label: meta.label || meta.id,
        source: { english_pdf_page: pageNo, printed_page: meta.printed, sector_hidden_from_player: meta.sector, file: file?.name },
        parts: seg.parts, planted_slips: [], glossary_terms: [],
      } });
      nav(`/manager/pages/${meta.id}`);
    } catch (e) { setErr((e as ApiError).code); }
  };
  return (
    <div className="space-y-4">
      <div className={card}>
        <h2 className="font-bold text-lg">a. Choose the English PDF and page</h2>
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <label className="text-sm">PDF page <input type="number" min={1} className={ta + " w-24 inline"} value={pageNo} onChange={(e) => setPageNo(Number(e.target.value))} /></label>
          <button className={btnB} disabled={!file} onClick={segment}>b. Auto-segment</button>
          {seg && <span className="text-sm text-muted">{seg.numPages} pages in PDF · {seg.parts.length} parts found</span>}
        </div>
        {err && <div className="err">{err}</div>}
      </div>
      {seg && (
        <div className={card}>
          <h2 className="font-bold text-lg mb-2">Parts (edit types after creating)</h2>
          <ol className="space-y-1.5 text-[15px] en">{seg.parts.map((p: any) => <li key={p.part_id}><span className="chip-plain text-xs mr-2">{p.type}</span>{p.en.slice(0, 180)}{p.en.length > 180 && "…"}</li>)}</ol>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mt-4">
            <input className={ta} placeholder="page id (a-z, 0-9, -)" value={meta.id} onChange={(e) => setMeta({ ...meta, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} />
            <select className={ta} value={meta.round} onChange={(e) => setMeta({ ...meta, round: e.target.value })}>{ROUNDS.map((r) => <option key={r}>{r}</option>)}</select>
            <input className={ta} placeholder="label" value={meta.label} onChange={(e) => setMeta({ ...meta, label: e.target.value })} />
            <input className={ta} placeholder="printed page no." value={meta.printed} onChange={(e) => setMeta({ ...meta, printed: e.target.value })} />
            <input className={ta} placeholder="sector (hidden)" value={meta.sector} onChange={(e) => setMeta({ ...meta, sector: e.target.value })} />
          </div>
          <p className="text-sm text-muted mt-3">Next steps on the page editor: c. paste/OCR the matching Hindi into each part's reference and tick "verified" · d. check locked numbers · e. generate the BHASHINI draft · f. mark planted slips · g. choose glossary terms · h. preview and publish.</p>
          <button className={btnP + " mt-3"} disabled={!meta.id} onClick={create}>Create draft page →</button>
        </div>
      )}
    </div>
  );
}

// ---------------- glossary ----------------
function Glossary() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [flagged, setFlagged] = useState(false);
  const { data = [] } = useQuery({ queryKey: ["agl", q, flagged], queryFn: () => api<any[]>(`/admin/glossary?q=${encodeURIComponent(q)}&flagged=${flagged ? 1 : 0}`) });
  const [csv, setCsv] = useState("");
  const toggleOverride = useMutation({
    mutationFn: (g: any) => api(`/admin/glossary/${g.id}`, { method: "PUT", body: { hi: g.hi, variants: g.accepted_variants, avoid: g.avoid_forms, override: { ...g.override, active: !(g.override.active !== false) } } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agl"] }),
  });
  return (
    <div className="space-y-4">
      <div className={card}>
        <div className="flex gap-3 items-center mb-3">
          <input className={ta} placeholder="Search English or Hindi" value={q} onChange={(e) => setQ(e.target.value)} />
          <label className="text-sm whitespace-nowrap flex items-center gap-1"><input type="checkbox" checked={flagged} onChange={(e) => setFlagged(e.target.checked)} /> flagged / overrides only</label>
        </div>
        <table className="w-full text-[14.5px]"><thead><tr className="text-left text-sm text-muted"><th>English</th><th>Hindi</th><th>Accepted</th><th>Avoid</th><th>Flags / override</th></tr></thead>
          <tbody>{data.map((g) => (
            <tr key={g.id} className="border-t border-gray-100 align-top">
              <td className="py-1.5 en font-semibold">{g.en}</td><td>{g.override?.active !== false && g.override ? <><s className="text-muted">{g.hi}</s> → <b>{g.override.hi}</b></> : g.hi}</td>
              <td className="text-sm">{g.accepted_variants.join(", ")}</td><td className="text-sm text-muted">{g.avoid_forms.slice(0, 4).join(", ")}</td>
              <td className="text-xs">{g.flags.join(", ")}{g.override && <div className="mt-1"><span className="chip bg-amber-50 border-amber-200 text-amber-800">{g.override.status}</span> <button className="underline text-royal" onClick={() => toggleOverride.mutate(g)}>{g.override.active === false ? "re-apply override" : "revert to glossary"}</button><div className="text-muted mt-1">{g.override.reason}</div></div>}</td>
            </tr>
          ))}</tbody></table>
      </div>
      <div className={card}>
        <h2 className="font-bold">Import CSV</h2>
        <p className="text-sm text-muted">Columns: english_term, hindi_term, accepted_variants (separated by ;), category. Variants that look like transliterations of the English are moved to avoid forms automatically.</p>
        <textarea className={ta + " mt-2 en"} rows={4} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder="english_term,hindi_term,accepted_variants,category" />
        <button className={btnB + " mt-2"} onClick={async () => { const r = await api<any>("/admin/glossary/import", { body: { csv } }); alert(`Imported ${r.rows} rows`); qc.invalidateQueries({ queryKey: ["agl"] }); }}>Import</button>
      </div>
    </div>
  );
}

// ---------------- offices ----------------
function Offices() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["offices"], queryFn: () => api<any[]>("/admin/offices") });
  const [msg, setMsg] = useState("");
  return (
    <div className={card}>
      <div className="flex items-center gap-3 mb-3">
        <h2 className="font-bold text-lg flex-1">Offices ({data.length}) · {data.filter((o) => o.name_hi).length} with Hindi names</h2>
        <button className={btnB} onClick={async () => { try { const r = await api<any>("/admin/offices/translate-names", { body: {} }); setMsg(`Translated ${r.translated}. ${r.note}`); qc.invalidateQueries({ queryKey: ["offices"] }); } catch (e) { setMsg((e as ApiError).code); } }}>Batch-translate names (BHASHINI)</button>
      </div>
      {msg && <div className="text-sm text-royal-deep mb-2">{msg}</div>}
      <div className="max-h-[70vh] overflow-y-auto">
        <table className="w-full text-[14px]"><tbody>{data.map((o) => <OfficeRow key={o.id} o={o} />)}</tbody></table>
      </div>
    </div>
  );
}
function OfficeRow({ o }: { o: any }) {
  const [hi, setHi] = useState(o.name_hi ?? "");
  const [addr, setAddr] = useState(o.address);
  const dirty = hi !== (o.name_hi ?? "") || addr !== o.address;
  return (
    <tr className="border-t border-gray-100">
      <td className="py-1.5 en w-[34%]">{o.name_en}<div className="text-xs text-muted">{o.city}, {o.state}</div></td>
      <td><input className={ta} value={hi} placeholder="Hindi name" onChange={(e) => setHi(e.target.value)} /></td>
      <td><input className={ta} value={addr} onChange={(e) => setAddr(e.target.value)} />{o.address_composed && <span className="text-xs text-muted">composed</span>}</td>
      <td>{dirty && <button className={btnG} onClick={() => api(`/admin/offices/${o.id}`, { method: "PUT", body: { nameHi: hi || null, address: addr } })}>Save</button>}</td>
    </tr>
  );
}

// ---------------- Sahayika ----------------
function SahayikaAdmin() {
  const { data: lines = [] } = useQuery({ queryKey: ["alines"], queryFn: () => api<any[]>("/admin/sahayika/lines") });
  const { data: chat = [] } = useQuery({ queryKey: ["chatlog"], queryFn: () => api<any[]>("/admin/chatlog") });
  const [sec, setSec] = useState("before_game");
  const [msg, setMsg] = useState("");
  const sections = useMemo(() => [...new Set(lines.map((l) => l.section))], [lines]);
  return (
    <div className="space-y-4">
      <div className={card}>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {sections.map((s) => <button key={s} className={s === sec ? btnP : btnG} onClick={() => setSec(s)}>{s}</button>)}
          <span className="flex-1" />
          <button className={btnB} onClick={async () => { try { const r = await api<any>("/admin/sahayika/audio", { body: {} }); setMsg(`Audio: ${r.ok} generated, ${r.failed} failed`); } catch (e) { setMsg((e as ApiError).code); } }}>Regenerate audio (BHASHINI TTS)</button>
        </div>
        {msg && <div className="text-sm text-royal-deep mb-2">{msg}</div>}
        {lines.filter((l) => l.section === sec).map((l) => <LineRow key={l.id} l={l} />)}
      </div>
      <div className={card}>
        <h2 className="font-bold text-lg mb-2">Chat log (blocked first)</h2>
        <table className="w-full text-[14px]"><tbody>{chat.map((c) => (
          <tr key={c.id} className={`border-t border-gray-100 align-top ${c.blocked ? "bg-timer-bg/60" : ""}`}>
            <td className="py-1.5 text-xs text-muted w-40">{new Date(c.at).toLocaleString()}<div>{c.email}</div></td>
            <td className="w-1/4">{c.question}</td><td>{c.hi}<div className="en text-xs text-muted">{c.en}</div></td><td className="text-xs">{c.source}{c.blocked && " · blocked"}</td>
          </tr>
        ))}</tbody></table>
      </div>
    </div>
  );
}
function LineRow({ l }: { l: any }) {
  const [en, setEn] = useState(l.en);
  const [hi, setHi] = useState(l.hi);
  const [ok, setOk] = useState(false);
  return (
    <div className="grid grid-cols-[14rem_1fr_1fr_auto] gap-2 border-t border-gray-100 py-2 items-start">
      <div className="text-xs en"><b>{l.id}</b><div className="text-muted">{l.when}{l.spoken ? " · spoken" : " · shown only"}</div></div>
      <textarea className={ta + " en"} rows={2} value={en} onChange={(e) => { setEn(e.target.value); setOk(false); }} />
      <textarea className={ta} rows={2} value={hi} onChange={(e) => { setHi(e.target.value); setOk(false); }} />
      <div className="flex flex-col gap-1">
        <button className={btnG} onClick={() => { const u = new SpeechSynthesisUtterance(en); u.lang = "en-IN"; speechSynthesis.speak(u); }}>▶</button>
        {(en !== l.en || hi !== l.hi) && <button className={btnP} onClick={async () => { await api(`/admin/sahayika/lines/${l.id}`, { method: "PUT", body: { en, hi } }); setOk(true); }}>{ok ? "✓" : "Save"}</button>}
      </div>
    </div>
  );
}

// ---------------- results ----------------
function Results() {
  const { data = [] } = useQuery({ queryKey: ["results"], queryFn: () => api<any[]>("/admin/results") });
  return (
    <div className={card}>
      <div className="flex items-center mb-3"><h2 className="font-bold text-lg flex-1">Results ({data.length} players)</h2><a className={btnP} href="/api/admin/exports/credits">Export credits (xlsx)</a></div>
      <div className="overflow-x-auto"><table className="w-full text-[14px]"><thead><tr className="text-left text-sm text-muted"><th>Player</th><th>Office</th>{ROUNDS.map((r) => <th key={r}>{r}</th>)}<th>Titles</th><th>Total</th></tr></thead>
        <tbody>{data.map((p) => (
          <tr key={p.email} className="border-t border-gray-100 align-top">
            <td className="py-1.5"><b>{p.name}</b><div className="text-xs text-muted en">{p.email} · {p.mobile}</div></td><td className="text-xs en max-w-[16rem]">{p.office}</td>
            {p.summary.rounds.map((r: any) => <td key={r.key}>{r.best ?? "—"}<div className="text-xs text-muted">{r.chancesUsed}/3 · {r.credits} cr</div></td>)}
            <td className="text-xs">{p.summary.rounds.filter((r: any) => r.titleEarned).map((r: any) => r.title).join(", ")}</td><td className="font-bold">{p.summary.totalCredits}</td>
          </tr>
        ))}</tbody></table></div>
    </div>
  );
}

// ---------------- settings & audit ----------------
function Settings() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["acfg"], queryFn: () => api<any>("/admin/config") });
  const [rounds, setRounds] = useState<Record<string, { timeLimitMinutes: number; creditCap: number; pages: number }>>({});
  const [w, setW] = useState<Record<string, number>>({});
  const [qual, setQual] = useState(33);
  const [pass, setPass] = useState(33);
  const [chances, setChances] = useState(3);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    if (!data) return;
    const e = data.effective;
    setRounds(Object.fromEntries(e.rounds.map((r: any) => [r.key, { timeLimitMinutes: r.timeLimitMinutes, creditCap: r.creditCap, pages: r.pages ?? 0 }])));
    setW(e.scoringWeights); setQual(e.levels?.trialQualifyingScore ?? 33); setPass(e.titlePassMark); setChances(e.maxChancesPerRound);
  }, [data]);
  if (!data) return null;
  const e = data.effective;
  const credits = e.registration.credits + Object.values(rounds).reduce((a, r) => a + (r.creditCap || 0), 0);
  const wsum = Object.values(w).reduce((a, b) => a + (Number(b) || 0), 0);
  const ok = credits === e.maxCredits && wsum === e.scoreOutOf;
  const save = async () => {
    try {
      await api("/admin/config/settings", { method: "PUT", body: { rounds, scoringWeights: w, trialQualifyingScore: qual, titlePassMark: pass, maxChancesPerRound: chances } });
      setMsg("Saved. Players see the new settings on their next screen."); qc.invalidateQueries();
    } catch (err) { setMsg((err as ApiError).body?.message ?? "Save failed"); }
  };
  const num = (v: number, on: (n: number) => void, wcls = "w-24") => <input type="number" className={ta + " " + wcls} value={v} onChange={(ev) => on(Number(ev.target.value))} />;
  return (
    <div className="space-y-4">
      <div className={card}>
        <h2 className="font-bold text-lg">Levels</h2>
        <p className="text-sm text-muted">Trial is the entry level. Passing it unlocks every other playable level, independently. Report pages = pages per bundle (Trial is measured in words).</p>
        <table className="w-full text-[15px] mt-3"><thead><tr className="text-left text-sm text-muted"><th>Level</th><th>Time (min)</th><th>Credit cap</th><th>Report pages</th><th>Status</th></tr></thead>
          <tbody>{e.rounds.map((r: any) => (
            <tr key={r.key} className="border-t border-gray-100">
              <td className="py-2 font-semibold">{r.levelLabel} · {r.nameEn}</td>
              <td>{rounds[r.key] && num(rounds[r.key].timeLimitMinutes, (n) => setRounds({ ...rounds, [r.key]: { ...rounds[r.key], timeLimitMinutes: n } }))}</td>
              <td>{rounds[r.key] && num(rounds[r.key].creditCap, (n) => setRounds({ ...rounds, [r.key]: { ...rounds[r.key], creditCap: n } }))}</td>
              <td>{rounds[r.key] && (r.key === "trial" ? <span className="text-sm text-muted">~{e.levels?.trialWords?.min}–{e.levels?.trialWords?.max} words</span> : num(rounds[r.key].pages, (n) => setRounds({ ...rounds, [r.key]: { ...rounds[r.key], pages: n } })))}</td>
              <td>{r.playable === false ? <span className="chip bg-purple-50 border-purple-200 text-purple-800 text-xs">{r.phase ?? "preview"}</span> : <span className="chip bg-success-soft border-green-200 text-green-800 text-xs">playable</span>}</td>
            </tr>
          ))}</tbody></table>
        <p className="text-sm mt-2">Registration {e.registration.credits} + caps = <b className={credits === e.maxCredits ? "text-success" : "text-timer-text"}>{credits}</b> (must be {e.maxCredits})</p>
      </div>
      <div className={card}>
        <h2 className="font-bold text-lg">Rules</h2>
        <div className="flex flex-wrap gap-6 mt-2 text-sm">
          <label>Trial qualifying score (unlocks the other levels){num(qual, setQual)}</label>
          <label>Title pass mark{num(pass, setPass)}</label>
          <label>Chances per level{num(chances, setChances)}</label>
        </div>
      </div>
      <div className={card}>
        <h2 className="font-bold text-lg">Scoring weights</h2>
        <div className="flex flex-wrap gap-4 mt-2 text-sm">
          {[["translation", "Translation quality"], ["completion", "Completion"], ["sentenceConstruction", "Sentence construction"], ["glossary", "Glossary"], ["time", "Time"]].map(([k, l]) => (
            <label key={k}>{l}{num(w[k] ?? 0, (n) => setW({ ...w, [k]: n }))}</label>
          ))}
        </div>
        <p className="text-sm mt-2">Total <b className={wsum === e.scoreOutOf ? "text-success" : "text-timer-text"}>{wsum}</b> (must be {e.scoreOutOf})</p>
      </div>
      <div className="flex items-center gap-3"><button className={btnP} disabled={!ok} onClick={save}>Save settings (audited)</button>{msg && <span className="text-sm">{msg}</span>}</div>
      <div className={card}><h2 className="font-bold text-lg mb-2">Effective config (read-only)</h2><pre className="text-xs en overflow-x-auto bg-gray-50 rounded-lg p-3 max-h-[50vh]">{JSON.stringify(e, null, 2)}</pre></div>
    </div>
  );
}
function Audit() {
  const { data = [] } = useQuery({ queryKey: ["audit"], queryFn: () => api<any[]>("/admin/audit") });
  return (
    <div className={card}><h2 className="font-bold text-lg mb-2">Audit log</h2>
      <table className="w-full text-[14px] en"><tbody>{data.map((a) => <tr key={a.id} className="border-t border-gray-100"><td className="py-1 text-xs text-muted w-44">{new Date(a.at).toLocaleString()}</td><td>{a.actor}</td><td className="font-semibold">{a.action}</td><td>{a.target}</td><td className="text-xs text-muted truncate max-w-xs">{a.meta ? JSON.stringify(a.meta) : ""}</td></tr>)}</tbody></table>
    </div>
  );
}
