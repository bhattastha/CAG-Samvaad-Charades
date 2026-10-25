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
import { Services } from "./Services";
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
    { to: "/manager/services", label: "BHASHINI services", icon: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" /> },
    { to: "/manager/audit", label: "Audit log", icon: <path d="M9 3h6l1 2h3v16H5V5h3zM9 12l2 2 4-4" /> },
  ] },
];

function Icon({ children }: { children: ReactNode }) {
  return <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{children}</svg>;
}

const A = "/landing";
const reducedMotion = () => typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("hc-reduce-motion"));
const saveData = () => typeof navigator !== "undefined" && !!(navigator as any).connection?.saveData;

/** White logo plate with the official CAG + BHASHINI marks (same markup family as the player header). */
function LogoPlate({ small = false }: { small?: boolean }) {
  return (
    <div className={`flex items-center rounded-2xl bg-white/95 shadow-lg shadow-black/25 ring-1 ring-white/60 ${small ? "gap-2.5 px-2.5 py-1.5" : "gap-3 px-3 py-2 sm:gap-5 sm:px-5 sm:py-2.5"}`}>
      <img src={`${A}/cag-logo.png`} alt="Comptroller and Auditor General of India" className={small ? "h-8 w-auto" : "h-11 w-auto sm:h-[60px]"} width={195} height={240} />
      <span className="w-px self-stretch bg-slate-300" aria-hidden />
      <img src={`${A}/bhashini-logo.png`} alt="Digital India BHASHINI" className={small ? "h-6 w-auto" : "h-8 w-auto sm:h-11"} width={330} height={160} />
    </div>
  );
}

const CHIPS: { title: string; body: string; icon: ReactNode }[] = [
  { title: "Monitor players", body: "Live activity, scores and fair play", icon: <path d="M3 13h4v8H3zM10 8h4v13h-4zM17 3h4v18h-4z" /> },
  { title: "Manage reports", body: "Pages, glossary and Sahayak lines", icon: <path d="M4 4h6v16H4zM14 4h6v16h-6z" /> },
  { title: "Tune scoring", body: "Credits, levels and evaluation", icon: <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4" /> },
];

function Login() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState<string | null | false>(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const reduce = reducedMotion();
  const video = !reduce && !saveData();
  const submit = async () => {
    setErr(""); setBusy(true);
    try {
      if (sent === false) { const r = await api<{ devCode?: string }>("/auth/otp/request", { body: { email } }); setSent(r.devCode ?? null); }
      else { const v = await api<{ role: string | null }>("/auth/otp/verify", { body: { email, code } }); if (!v.role) setErr("This email is not registered as a game manager."); qc.invalidateQueries({ queryKey: ["admin-me"] }); }
    } catch (e) { setErr((e as ApiError).code); } finally { setBusy(false); }
  };
  const field = "mt-1.5 w-full rounded-xl border border-white/25 bg-white/95 px-3.5 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-[#FFD27A]/60";
  return (
    <div className="relative isolate flex min-h-screen flex-col overflow-x-clip bg-[#051024] font-latin text-white">
      <div className="absolute inset-0 -z-0 overflow-hidden" aria-hidden>
        {video
          ? <video className="absolute inset-0 h-full w-full object-cover" src={`${A}/hero.mp4`} poster={`${A}/hero-poster.jpg`} autoPlay muted loop playsInline preload="auto" />
          : <img className="absolute inset-0 h-full w-full object-cover" src={`${A}/hero-poster.jpg`} alt="" />}
        <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(5,16,36,.94) 0%, rgba(7,26,51,.82) 35%, rgba(7,26,51,.45) 65%, rgba(7,26,51,.3) 100%)" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(5,16,36,.55) 0%, rgba(5,16,36,0) 25%, rgba(5,16,36,0) 55%, #051024 100%)" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(55% 50% at 75% 45%, rgba(255,170,60,.14), transparent 70%)" }} />
      </div>
      <header className="relative z-10 mx-auto w-full max-w-[1440px] px-4 pt-4 sm:px-8 sm:pt-5">
        <div className="inline-block"><LogoPlate /></div>
      </header>
      <main className="relative z-10 mx-auto grid w-full max-w-[1440px] flex-1 items-center gap-8 px-4 py-8 sm:px-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="mgr-rise max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#F3D58A]/50 bg-[#F3D58A]/10 px-3.5 py-1 text-[12px] font-bold uppercase tracking-[0.16em] text-[#F3D58A]">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" /></svg>
            Game Manager Console
          </span>
          <h1 className="mt-4 text-[3rem] font-extrabold leading-[0.95] tracking-tight sm:text-[4.4rem] xl:text-[5.2rem]" translate="no">
            <span className="block text-white drop-shadow-[0_6px_24px_rgba(0,0,0,.45)]">Samvaad</span>
            <span className="block bg-gradient-to-b from-[#FFD27A] via-[#FF9A3C] to-[#F15A24] bg-clip-text text-transparent">Charades</span>
          </h1>
          <svg viewBox="0 0 420 18" className="-mt-1 w-[70%] max-w-[380px]" aria-hidden><defs><linearGradient id="mg" x1="0" x2="1"><stop offset="0" stopColor="#F15A24" stopOpacity="0" /><stop offset=".4" stopColor="#FF8A00" /><stop offset="1" stopColor="#FFD27A" /></linearGradient></defs><path d="M4 12 C 120 2, 300 2, 416 10" stroke="url(#mg)" strokeWidth="5" fill="none" strokeLinecap="round" /></svg>
          <p className="mt-4 text-lg text-blue-100/90 sm:text-xl">Run the game: see who is playing, keep the content sharp, and award credits fairly.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {CHIPS.map((c, i) => (
              <div key={c.title} className="mgr-rise flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 p-3 backdrop-blur-md sm:block" style={{ animationDelay: `${300 + i * 90}ms` }}>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-b from-[#FF9A3C] to-[#F15A24] text-white shadow-lg shadow-orange-600/30">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{c.icon}</svg>
                </span>
                <div className="sm:mt-2"><div className="text-[15px] font-bold">{c.title}</div><div className="text-[12.5px] leading-snug text-blue-100/80">{c.body}</div></div>
              </div>
            ))}
          </div>
        </div>
        <div className="mgr-rise flex justify-center lg:justify-end" style={{ animationDelay: "150ms" }}>
          <form className="w-full max-w-md rounded-3xl border border-white/25 bg-[#0B2342]/70 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <h2 className="text-2xl font-extrabold">Sign in</h2>
            <p className="mt-1 text-sm text-blue-100/80">We email you a one-time password. Only addresses on the admin list can open the console.</p>
            <label className="mt-5 block text-sm font-semibold text-blue-50">Official email<input className={field} type="email" autoComplete="email" placeholder="name@cag.gov.in" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            {sent !== false && <label className="mt-4 block text-sm font-semibold text-blue-50">One-time password<input className={`${field} text-center text-lg tracking-[0.4em]`} inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} /></label>}
            {sent && <p className="mt-1.5 text-xs text-[#F3D58A]">Development code: {sent}</p>}
            {err && <p role="alert" className="mt-4 rounded-xl border border-red-300/60 bg-red-950/60 px-3 py-2 text-sm text-red-100">{err}</p>}
            <button type="submit" disabled={busy || !email}
              className="mt-6 w-full rounded-full bg-gradient-to-b from-[#FF9A3C] to-[#F15A24] px-6 py-3 text-lg font-bold text-white shadow-[0_14px_40px_-12px_rgba(241,90,36,.85)] ring-1 ring-white/40 transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#FFD27A] disabled:cursor-not-allowed disabled:opacity-60">
              {sent === false ? "Send code" : "Sign in"}
            </button>
          </form>
        </div>
      </main>
      <footer className="relative z-10 px-4 pb-4 text-center text-xs text-blue-100/60 sm:px-8">Comptroller and Auditor General of India · Digital India BHASHINI</footer>
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
    `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold transition-colors ${isActive ? "bg-[#F15A24]/15 text-white shadow-[inset_4px_0_0_#F15A24]" : "text-slate-300 hover:bg-white/5 hover:text-white"}`;
  return (
    <div className="flex min-h-screen bg-[#F3F6FB] font-latin text-slate-900">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-[#0B2342] md:flex">
        <div className="border-b border-white/10 px-4 py-4"><LogoPlate small />
          <div className="mt-3 text-[15px] font-extrabold text-white" translate="no">Samvaad <span className="text-[#FF9A3C]">Charades</span></div>
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#D6A642]">Game Manager Console</div></div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Console">
          {NAV.map((g) => (
            <div key={g.group}>
              <div className="px-3 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#D6A642]">{g.group}</div>
              <div className="space-y-0.5">{g.items.map((i) => <NavLink key={i.to} to={i.to} end={i.end} className={link}><Icon>{i.icon}</Icon>{i.label}</NavLink>)}</div>
            </div>
          ))}
        </nav>
        <div className="border-t border-white/10 px-4 py-3 text-[11px] text-slate-400">CAG · BHASHINI</div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/95 px-5 backdrop-blur">
          <div className="md:hidden text-sm font-extrabold text-[#0B2342]" translate="no">Samvaad <span className="text-[#F15A24]">Charades</span></div>
          <div className="hidden text-sm text-slate-500 md:block">Console <span className="mx-1 text-slate-300">/</span> <span className="font-extrabold text-[#0B2342]">{current?.label ?? "Overview"}</span></div>
          <select className={`${select} ml-2 md:hidden`} aria-label="Navigate" value={current?.to ?? "/manager"} onChange={(e) => nav(e.target.value)}>
            {NAV.flatMap((g) => g.items).map((i) => <option key={i.to} value={i.to}>{i.label}</option>)}
          </select>
          <span className="flex-1" />
          <a href="/" className="hidden text-xs font-semibold text-[#24558A] hover:underline lg:block" target="_blank" rel="noreferrer">Open player app ↗</a>
          <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-b from-[#FF9A3C] to-[#F15A24] text-xs font-bold uppercase text-white" aria-hidden>{me.data.email.slice(0, 2)}</div>
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
            <Route path="services" element={<Services />} />
            <Route path="audit" element={<Audit />} />
            <Route path="*" element={<Navigate to="/manager" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
