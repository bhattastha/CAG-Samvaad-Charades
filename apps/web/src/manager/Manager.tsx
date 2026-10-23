import { useState, type ReactNode } from "react";
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { Pill, btn, input, useMe, select } from "./ui";
import { Overview } from "./Overview";
import { Players } from "./Players";
import { AddReport, BundleEditor, Library } from "./Content";
import { Glossary, Offices } from "./Reference";
import { Sahayak } from "./Sahayak";
import { Results } from "./Results";
import { Settings } from "./Settings";
import { Audit } from "./Audit";

// Staff-facing admin portal (§8): desktop-first, left navigation + top bar, CAG Anuvaad visual language.

const NAV: { group: string; items: { to: string; label: string; icon: ReactNode; end?: boolean }[] }[] = [
  { group: "Monitor", items: [
    { to: "/manager", label: "Overview", end: true, icon: <path d="M3 13h4v8H3zM10 8h4v13h-4zM17 3h4v18h-4z" /> },
    { to: "/manager/players", label: "Players", icon: <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 10a7 7 0 0 1 14 0zm15-10a3 3 0 1 0 0-6M22 21a6 6 0 0 0-4-5.6" /> },
    { to: "/manager/results", label: "Results & export", icon: <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" /> },
  ] },
  { group: "Content", items: [
    { to: "/manager/content", label: "Content library", icon: <path d="M4 4h6v16H4zM14 4h6v16h-6zM7 8h0M17 8h0" /> },
    { to: "/manager/glossary", label: "Glossary", icon: <path d="M4 5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2zm0 0v16M8 7h8M8 11h6" /> },
    { to: "/manager/offices", label: "Offices", icon: <path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6" /> },
    { to: "/manager/sahayak", label: "Sahayak", icon: <path d="M4 5h16v11H8l-4 4zM8 9h8M8 12h5" /> },
  ] },
  { group: "Administration", items: [
    { to: "/manager/settings", label: "Evaluation & settings", icon: <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4" /> },
    { to: "/manager/audit", label: "Audit log", icon: <path d="M9 3h6l1 2h3v16H5V5h3zM9 12l2 2 4-4" /> },
  ] },
];

function Icon({ children }: { children: ReactNode }) {
  return <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{children}</svg>;
}

function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-md border border-[#C49B3D]/60 bg-[#C49B3D]/15 text-[15px] font-bold text-[#C49B3D]" aria-hidden>सं</div>
      <div className="leading-tight">
        <div className={`text-[15px] font-bold ${light ? "text-white" : "text-[#0B2545]"}`} translate="no">Samvaad Charades</div>
        <div className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${light ? "text-[#C49B3D]" : "text-slate-500"}`}>CAG × BHASHINI · Console</div>
      </div>
    </div>
  );
}

function Login() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState<string | null | false>(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setErr(""); setBusy(true);
    try {
      if (sent === false) { const r = await api<{ devCode?: string }>("/auth/otp/request", { body: { email } }); setSent(r.devCode ?? null); }
      else { const v = await api<{ role: string | null }>("/auth/otp/verify", { body: { email, code } }); if (!v.role) setErr("This email is not registered as a game manager."); qc.invalidateQueries({ queryKey: ["admin-me"] }); }
    } catch (e) { setErr((e as ApiError).code); } finally { setBusy(false); }
  };
  return (
    <div className="flex min-h-screen bg-slate-50">
      <div className="hidden w-[42%] flex-col justify-between bg-[#0B2545] p-10 lg:flex">
        <Brand light />
        <div>
          <h1 className="text-3xl font-bold leading-tight text-white">Game manager console</h1>
          <p className="mt-3 max-w-sm text-sm text-slate-300">Monitor participation, manage report content and the glossary, tune evaluation settings and export Hindi Pakhwada credits.</p>
        </div>
        <p className="text-xs text-slate-400">Comptroller and Auditor General of India × Digital India BHASHINI</p>
      </div>
      <div className="flex flex-1 items-center justify-center p-6">
        <form className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <div className="mb-5 lg:hidden"><Brand /></div>
          <h2 className="text-lg font-semibold text-slate-900">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">Email one-time password. Only addresses in the admin list can open the console.</p>
          <label className="mt-5 block text-sm font-medium text-slate-700">Official email<input className={`${input} mt-1`} type="email" autoComplete="email" placeholder="name@cag.gov.in" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          {sent !== false && <label className="mt-3 block text-sm font-medium text-slate-700">One-time password<input className={`${input} mt-1 text-center tracking-[0.4em]`} inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} /></label>}
          {sent && <p className="mt-1 text-xs text-slate-500">Development code: {sent}</p>}
          {err && <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{err}</p>}
          <button type="submit" className={`${btn.navy} mt-5 w-full py-2`} disabled={busy || !email}>{sent === false ? "Send code" : "Sign in"}</button>
        </form>
      </div>
    </div>
  );
}

const PageRedirect = () => <Navigate to={`/manager/content/${useParams().id}`} replace />;

export default function Manager() {
  const me = useMe();
  const qc = useQueryClient();
  const loc = useLocation();
  const nav = useNavigate();
  if (me.isLoading) return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">Loading console…</div>;
  if (me.error || !me.data) return <Login />;
  const current = NAV.flatMap((g) => g.items).filter((i) => (i.end ? loc.pathname === i.to : loc.pathname.startsWith(i.to))).at(-1);
  const link = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 rounded-md px-3 py-2 text-[13.5px] font-medium ${isActive ? "bg-white/10 text-white shadow-[inset_3px_0_0_#E85A1A]" : "text-slate-300 hover:bg-white/5 hover:text-white"}`;
  return (
    <div className="flex min-h-screen bg-slate-50 font-latin text-slate-900">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-[#0B2545] md:flex">
        <div className="border-b border-white/10 px-4 py-4"><Brand light /></div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Console">
          {NAV.map((g) => (
            <div key={g.group}>
              <div className="px-3 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#C49B3D]">{g.group}</div>
              <div className="space-y-0.5">{g.items.map((i) => <NavLink key={i.to} to={i.to} end={i.end} className={link}><Icon>{i.icon}</Icon>{i.label}</NavLink>)}</div>
            </div>
          ))}
        </nav>
        <div className="border-t border-white/10 px-4 py-3 text-[11px] text-slate-400">Hindi Pakhwada · IA&AD</div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-5">
          <div className="md:hidden"><Brand /></div>
          <div className="hidden text-sm text-slate-500 md:block">Console <span className="mx-1 text-slate-300">/</span> <span className="font-semibold text-slate-800">{current?.label ?? "Overview"}</span></div>
          <select className={`${select} ml-2 md:hidden`} aria-label="Navigate" value={current?.to ?? "/manager"} onChange={(e) => nav(e.target.value)}>
            {NAV.flatMap((g) => g.items).map((i) => <option key={i.to} value={i.to}>{i.label}</option>)}
          </select>
          <span className="flex-1" />
          <a href="/" className="hidden text-xs font-semibold text-slate-600 hover:text-slate-900 lg:block" target="_blank" rel="noreferrer">Open player app ↗</a>
          <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0B2545] text-xs font-bold uppercase text-white" aria-hidden>{me.data.email.slice(0, 2)}</div>
            <div className="hidden leading-tight sm:block"><div className="text-xs font-semibold text-slate-800">{me.data.email}</div><div><Pill tone={me.data.role === "manager" ? "gold" : "slate"}>{me.data.role}</Pill></div></div>
            <button className={`${btn.ghost} ml-1`} onClick={async () => { try { await api("/auth/logout", { body: {} }); } finally { qc.clear(); window.location.href = "/manager"; } }}>Sign out</button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1480px] flex-1 px-5 py-6">
          <Routes>
            <Route index element={<Overview />} />
            <Route path="players" element={<Players />} />
            <Route path="content" element={<Library />} />
            <Route path="content/new" element={<AddReport />} />
            <Route path="content/:id" element={<BundleEditor />} />
            <Route path="pages" element={<Navigate to="/manager/content" replace />} />
            <Route path="pages/:id" element={<PageRedirect />} />
            <Route path="ingest" element={<Navigate to="/manager/content/new" replace />} />
            <Route path="glossary" element={<Glossary />} />
            <Route path="offices" element={<Offices />} />
            <Route path="sahayak" element={<Sahayak />} />
            <Route path="sahayika" element={<Navigate to="/manager/sahayak" replace />} />
            <Route path="results" element={<Results />} />
            <Route path="settings" element={<Settings />} />
            <Route path="audit" element={<Audit />} />
            <Route path="*" element={<Navigate to="/manager" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
