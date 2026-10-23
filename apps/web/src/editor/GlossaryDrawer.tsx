import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../lib/api";
import { t } from "../lib/strings";
import { Icon } from "../components/Icon";

export interface GlossaryHit { en: string; hi: string; variants: string[]; avoid: string[] }

/** शब्दावली drawer: search English or Hindi, जोड़ें inserts at the caret of the last focused editor. */
export function GlossaryDrawer({ open, onClose, onInsert, initial = "" }: { open: boolean; onClose(): void; onInsert(hi: string): void; initial?: string }) {
  const [q, setQ] = useState(initial);
  const [hits, setHits] = useState<GlossaryHit[]>([]);
  useEffect(() => { if (open && initial) setQ(initial); }, [open, initial]);
  useEffect(() => {
    if (!open || q.trim().length < 2) { setHits([]); return; }
    const ctl = new AbortController();
    const tm = setTimeout(() => api<GlossaryHit[]>(`/glossary?q=${encodeURIComponent(q.trim())}`, { signal: ctl.signal }).then(setHits).catch(() => {}), 180);
    return () => { clearTimeout(tm); ctl.abort(); };
  }, [q, open]);
  if (!open) return null;
  // portalled: a transformed ancestor would otherwise turn `fixed` into `absolute`
  return createPortal(
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-label={t("common.glossaryButton")}>
      <div className="absolute inset-0 bg-navy-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="relative w-full max-w-md h-full bg-white shadow-pop flex flex-col animate-rise" onMouseDown={(e) => { if ((e.target as HTMLElement).tagName === "BUTTON") e.preventDefault(); }}>
        <div className="p-4 card-dark hud-grid !rounded-none !border-0 !shadow-none flex items-center gap-3">
          <span className="w-9 h-9 rounded-ui bg-white/10 border border-white/15 grid place-items-center text-gold-light" aria-hidden><Icon name="book" size={19} /></span>
          <h2 className="text-xl font-bold flex-1">{t("common.glossaryButton")}</h2>
          <button onClick={onClose} className="w-9 h-9 rounded-ui grid place-items-center text-white/80 hover:text-white hover:bg-white/10" aria-label={t("common.close")}><Icon name="x" size={20} /></button>
        </div>
        <div className="p-4 border-b border-slate-200 bg-navy-50">
          {/* plain input: the transliteration helper is never active here (§9.2) */}
          <div className="relative"><Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input autoFocus className="input pl-10" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("glossary.searchPlaceholder")} /></div>
        </div>
        <ul className="flex-1 overflow-y-auto p-4 space-y-2">
          {hits.map((h) => (
            <li key={h.en} className="card p-3">
              <div className="en text-sm font-semibold text-navy">{h.en}</div>
              <div className="flex flex-wrap gap-2 mt-1">
                {[h.hi, ...h.variants].filter(Boolean).slice(0, 4).map((v, i) => (
                  <button key={v} onClick={() => onInsert(v)} className={`inline-flex items-center gap-2 rounded-ui px-3 py-1 text-[17px] font-semibold border transition ${i === 0 ? "bg-primary-soft border-primary-ring/70 text-primary-strong hover:border-primary" : "bg-white border-slate-200 text-navy hover:border-navy-600"}`}>
                    {v} <span className="inline-flex items-center gap-0.5 text-xs font-bold opacity-80"><Icon name="arrowRight" size={12} />{t("glossary.insert")}</span>
                  </button>
                ))}
              </div>
              {h.avoid.length > 0 && <div className="mt-2 text-sm text-muted flex items-start gap-1.5"><Icon name="alert" size={14} className="mt-0.5 text-timer-text" /><span>{t("glossary.avoid")}: <s>{h.avoid.join(", ")}</s></span></div>}
            </li>
          ))}
        </ul>
      </aside>
    </div>,
    document.body,
  );
}
