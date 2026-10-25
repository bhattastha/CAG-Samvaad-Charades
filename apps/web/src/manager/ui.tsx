import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

/** Console design system: CAG Anuvaad admin look — navy, saffron for primary actions, gold accents, slate neutrals. */
export const NAVY = "#0B2342";
export const SAFFRON = "#F15A24";
export const GOLD = "#D6A642";
export const BLUE = "#24558A";

export const ROUNDS = ["trial", "primary", "secondary", "pro", "varchaspati"] as const;

const btnBase = "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold border transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#F15A24]";
export const btn = {
  primary: `${btnBase} bg-[#F15A24] border-[#F15A24] text-white shadow-sm shadow-orange-500/30 hover:bg-[#D94A17]`,
  navy: `${btnBase} bg-[#F15A24] border-[#F15A24] text-white shadow-sm shadow-orange-500/30 hover:bg-[#D94A17]`,
  ghost: `${btnBase} bg-white border-slate-300 text-[#24558A] hover:bg-[#EEF3FA]`,
  danger: `${btnBase} bg-red-700 border-red-700 text-white hover:bg-red-800`,
  dangerGhost: `${btnBase} bg-white border-red-300 text-red-700 hover:bg-red-50`,
  link: "text-sm font-semibold text-[#24558A] underline underline-offset-2 hover:text-[#0B2342]",
};
export const inputBase = "rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#24558A] focus:outline-none focus:ring-2 focus:ring-[#24558A]/25";
export const input = `w-full ${inputBase}`;
export const select = `w-auto ${inputBase}`;
export const th = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap";
export const td = "px-3 py-2 align-top";
export const tr = "border-t border-slate-100 hover:bg-slate-50/70";

export function useMe() {
  return useQuery({ queryKey: ["admin-me"], queryFn: () => api<{ email: string; role: "manager" | "viewer" }>("/admin/me"), retry: false });
}
export const useIsManager = () => useMe().data?.role === "manager";

export function Card({ title, subtitle, actions, children, className = "", pad = true }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_10px_rgba(11,35,66,.06)] ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start gap-3 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0 flex-1">
            {title && <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={pad ? "p-4" : ""}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#0B2342]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CountUp({ value }: { value: unknown }) {
  const [v, setV] = useState<number | null>(null);
  const num = typeof value === "number" && Number.isFinite(value) ? value : null;
  useEffect(() => {
    if (num === null) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("hc-reduce-motion");
    if (reduce) { setV(num); return; }
    let raf = 0; const t0 = performance.now();
    const step = (t: number) => { const p = Math.min(1, (t - t0) / 700); setV(num * (1 - Math.pow(1 - p, 3))); if (p < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [num]);
  if (num === null) return <>{(value as ReactNode) ?? "—"}</>;
  const dec = Number.isInteger(num) ? 0 : 1;
  return <>{(v ?? 0).toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, (m, o, str) => (str.includes(".") && o > str.indexOf(".") ? "" : ","))}</>;
}

export function Kpi({ label, value, sub, accent = NAVY, warn, icon, index = 0 }: { label: string; value: ReactNode; sub?: ReactNode; accent?: string; warn?: boolean; icon?: ReactNode; index?: number }) {
  return (
    <div className="mgr-rise relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_2px_10px_rgba(11,35,66,.06)]" style={{ animationDelay: `${index * 60}ms` }}>
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: accent }} aria-hidden />
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white shadow-md" style={{ background: `linear-gradient(145deg, ${accent}, ${accent}CC)`, boxShadow: `0 6px 14px -4px ${accent}99` }} aria-hidden>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{icon ?? <circle cx="12" cy="12" r="4" />}</svg>
        </span>
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
          <div className={`mt-0.5 text-2xl font-extrabold tabular-nums ${warn ? "text-red-700" : "text-[#0B2342]"}`}>{value === null || value === undefined ? "—" : <CountUp value={value} />}</div>
        </div>
      </div>
      {sub && <div className="mt-2 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

const PILL: Record<string, string> = {
  green: "bg-emerald-50 text-emerald-800 border-emerald-200",
  amber: "bg-amber-50 text-amber-800 border-amber-200",
  red: "bg-red-50 text-red-800 border-red-200",
  slate: "bg-slate-100 text-slate-700 border-slate-200",
  navy: "bg-[#E8EEF7] text-[#24558A] border-[#C7D3E6]",
  gold: "bg-[#FBF3DF] text-[#7A5E1C] border-[#EBD79B]",
  purple: "bg-violet-50 text-violet-800 border-violet-200",
};
export function Pill({ tone = "slate", children, title }: { tone?: keyof typeof PILL; children: ReactNode; title?: string }) {
  return <span title={title} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${PILL[tone]}`}>{children}</span>;
}
export const StatusPill = ({ s }: { s: string }) => (
  <Pill tone={s === "published" ? "green" : s === "retired" ? "slate" : "amber"}>{s === "published" ? "● Published" : s === "retired" ? "○ Retired" : "◐ Draft"}</Pill>
);

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">{children}</div>;
}

export function Notice({ tone = "navy", children }: { tone?: "navy" | "red" | "green" | "amber"; children: ReactNode }) {
  const c = { navy: "border-[#C7D3E6] bg-[#F3F6FB] text-[#0B2342]", red: "border-red-200 bg-red-50 text-red-800", green: "border-emerald-200 bg-emerald-50 text-emerald-800", amber: "border-amber-200 bg-amber-50 text-amber-900" }[tone];
  return <div role="status" className={`rounded-md border px-3 py-2 text-sm ${c}`}>{children}</div>;
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { key: T; label: ReactNode }[] }) {
  return (
    <div role="tablist" className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
      {items.map((i) => (
        <button key={i.key} role="tab" aria-selected={value === i.key} onClick={() => onChange(i.key)}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${value === i.key ? "border-[#F15A24] text-[#0B2342]" : "border-transparent text-slate-500 hover:text-slate-800"}`}>{i.label}</button>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, items, label }: { value: T; onChange: (v: T) => void; items: { key: T; label: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-slate-300 bg-white p-0.5">
      {items.map((i) => (
        <button key={i.key} role="radio" aria-checked={value === i.key} onClick={() => onChange(i.key)}
          className={`rounded px-2.5 py-1 text-xs font-semibold ${value === i.key ? "bg-[#24558A] text-white" : "text-slate-600 hover:bg-slate-100"}`}>{i.label}</button>
      ))}
    </div>
  );
}

/** Modal dialog with focus on open and Esc to close. */
export function Dialog({ open, onClose, title, children, footer, width = "max-w-lg" }: { open: boolean; onClose(): void; title: string; children: ReactNode; footer?: ReactNode; width?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    ref.current?.focus();
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={`w-full ${width} rounded-2xl bg-white shadow-xl outline-none`}>
        <div className="border-b border-slate-200 px-5 py-3 text-base font-semibold text-slate-900">{title}</div>
        <div className="px-5 py-4 text-sm text-slate-700">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/** Right-side drawer for detail views. */
export function Drawer({ open, onClose, title, children }: { open: boolean; onClose(): void; title: ReactNode; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/30" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside role="dialog" aria-modal="true" className="flex h-full w-full max-w-3xl flex-col bg-slate-50 shadow-2xl">
        <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-5 py-3">
          <div className="min-w-0 flex-1 text-base font-semibold text-slate-900">{title}</div>
          <button className={btn.ghost} onClick={onClose} aria-label="Close">Close ✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </aside>
    </div>
  );
}

/** Typed-confirmation guard for destructive actions. */
export function ConfirmDanger({ open, onClose, title, body, phrase, action, onConfirm, extra }: {
  open: boolean; onClose(): void; title: string; body: ReactNode; phrase: string; action: string; onConfirm(): Promise<void>; extra?: ReactNode;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { if (open) { setTyped(""); setErr(""); } }, [open]);
  const ok = typed.trim().toLowerCase() === phrase.toLowerCase();
  return (
    <Dialog open={open} onClose={onClose} title={title}
      footer={<>
        <button className={btn.ghost} onClick={onClose}>Cancel</button>
        <button className={btn.danger} disabled={!ok || busy} onClick={async () => { setBusy(true); setErr(""); try { await onConfirm(); onClose(); } catch (e: any) { setErr(e?.code ?? "failed"); } finally { setBusy(false); } }}>{busy ? "Working…" : action}</button>
      </>}>
      <div className="space-y-3">
        <Notice tone="red">{body}</Notice>
        {extra}
        <label className="block text-sm">Type <code className="rounded bg-slate-100 px-1 font-mono text-[13px] text-slate-900">{phrase}</code> to confirm
          <input className={`${input} mt-1 font-mono`} value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus aria-label="Confirmation text" />
        </label>
        {err && <Notice tone="red">Failed: {err}</Notice>}
      </div>
    </Dialog>
  );
}

export const fmtDate = (d: string | Date | null | undefined) => (d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
export const fmtDay = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
export function ago(d: string | Date) {
  const s = (Date.now() - +new Date(d)) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}
export const fmt = (n: number | null | undefined, unit = "") => (n === null || n === undefined ? "—" : `${n}${unit}`);

export const ReadOnlyNote = () => <Notice tone="amber">You have viewer access: editing is disabled. Ask a game manager for changes.</Notice>;
