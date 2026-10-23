import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { t } from "../lib/strings";

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
  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-label={t("common.glossaryButton")}>
      <div className="absolute inset-0 bg-navy/30" onClick={onClose} />
      <aside className="relative w-full max-w-md h-full bg-white shadow-pop flex flex-col animate-rise" onMouseDown={(e) => { if ((e.target as HTMLElement).tagName === "BUTTON") e.preventDefault(); }}>
        <div className="p-4 border-b border-orange-100 flex items-center gap-3 bg-cream">
          <span className="text-2xl">📖</span>
          <h2 className="text-xl font-bold text-primary-strong flex-1">{t("common.glossaryButton")}</h2>
          <button onClick={onClose} className="text-2xl text-muted hover:text-navy" aria-label={t("ui.close")}>✕</button>
        </div>
        <div className="p-4">
          {/* plain input: the transliteration helper is never active here (§9.2) */}
          <input autoFocus className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("glossary.searchPlaceholder")} />
        </div>
        <ul className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
          {hits.map((h) => (
            <li key={h.en} className="card p-3">
              <div className="en text-sm text-muted">{h.en}</div>
              <div className="flex flex-wrap gap-2 mt-1">
                {[h.hi, ...h.variants].filter(Boolean).slice(0, 4).map((v, i) => (
                  <button key={v} onClick={() => onInsert(v)} className={`rounded-full px-3 py-1 text-[17px] font-semibold border ${i === 0 ? "bg-primary-soft border-orange-200 text-primary-strong" : "bg-white border-gray-200"}`}>
                    {v} <span className="text-xs font-bold">＋ {t("glossary.insert")}</span>
                  </button>
                ))}
              </div>
              {h.avoid.length > 0 && <div className="mt-1.5 text-sm text-muted">{t("glossary.avoid")}: <s>{h.avoid.join(", ")}</s></div>}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
