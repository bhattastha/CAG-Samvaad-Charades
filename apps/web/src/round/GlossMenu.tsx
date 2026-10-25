import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { t } from "../lib/strings";
import { Icon } from "../components/Icon";
import { api } from "../lib/api";
import type { FieldKey } from "./PageViews";

export interface GlossMenuState {
  rect: DOMRect;
  /** pair id of the term (highlights both sides while the menu is open); "" for a plain watch word */
  pair: string;
  en: string;
  area?: string | null;
  options: { hi: string; tag: "approved" | "variant" | "other" | "translit"; area?: string | null }[];
  avoid: string[];
  mode: "replace" | "insert";
  target: FieldKey | null;
  range?: { from: number; to: number };
  /** the Hindi word the menu was opened on (replace mode) */
  current?: string;
  currentKind?: "ok" | "avoid";
}

/**
 * The inline glossary menu, as in CAG Anuvaad: a small dropdown anchored directly under the clicked word listing the
 * approved Hindi (approved first, then accepted variants, sector forms, avoid-forms struck out). Picking replaces the
 * selected Hindi word, or inserts at the cursor when opened from the English side.
 */
/** BHASHINI transliteration of the English term (word by word), offered as the last option. */
const translitCache = new Map<string, string>();
function useTranslit(en: string) {
  const [v, setV] = useState<string | null>(translitCache.get(en) ?? null);
  useEffect(() => {
    const words = en.split(/[^A-Za-z]+/).filter(Boolean);
    if (translitCache.has(en) || !words.length || words.length > 6 || words.some((w) => w.length > 30)) return;
    let live = true;
    Promise.all(words.map((w) => api<{ suggestions: string[]; fallback?: string }>(`/xlit?word=${encodeURIComponent(w)}`).then((r) => r.suggestions[0] ?? r.fallback ?? "")))
      .then((parts) => { if (parts.every(Boolean)) { const tr = parts.join(" "); translitCache.set(en, tr); if (live) setV(tr); } })
      .catch(() => {});
    return () => { live = false; };
  }, [en]);
  return v;
}

export function GlossMenu({ s: base, readOnly, onPick, onClose, onSearch }: { s: GlossMenuState; readOnly: boolean; onPick(v: string): void; onClose(): void; onSearch(q: string): void }) {
  const translit = useTranslit(base.en);
  const s = useMemo(() => (translit
    ? { ...base, options: [...base.options.filter((o) => o.hi !== translit), { hi: translit, tag: "translit" as const }] }
    : base), [base, translit]);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number }>({ left: Math.max(8, s.rect.left), top: s.rect.bottom + 4 });
  const [hi, setHi] = useState(0);
  const enabled = !readOnly && !!s.target;
  useLayoutEffect(() => {
    const w = ref.current?.offsetWidth ?? 280;
    const h = ref.current?.offsetHeight ?? 240;
    const left = Math.max(8, Math.min(s.rect.left, window.innerWidth - w - 8));
    const room = window.innerHeight - s.rect.bottom;
    setPos(room < h + 12 && s.rect.top > h + 12 ? { left, bottom: window.innerHeight - s.rect.top + 4 } : { left, top: s.rect.bottom + 4 });
  }, [s]);
  useEffect(() => {
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (!enabled) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setHi((i) => (i + (e.key === "ArrowDown" ? 1 : s.options.length - 1)) % Math.max(1, s.options.length)); }
      if (e.key === "Enter" && s.options[hi]) { e.preventDefault(); e.stopPropagation(); onPick(s.options[hi].hi); }
    };
    const scroll = (e: Event) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const tm = setTimeout(() => document.addEventListener("mousedown", down), 0);
    document.addEventListener("keydown", key, true);
    window.addEventListener("scroll", scroll, { capture: true, passive: true });
    window.addEventListener("resize", scroll);
    return () => { clearTimeout(tm); document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key, true); window.removeEventListener("scroll", scroll, { capture: true } as any); window.removeEventListener("resize", scroll); };
  }, [onClose, onPick, enabled, hi, s.options]);

  return createPortal(
    <div ref={ref} role="menu" aria-label={t("round.glossMenu.label")} translate="no" onMouseDown={(e) => e.preventDefault()}
      className="fixed z-[85] w-[min(19rem,calc(100vw-1rem))] rounded-lg bg-white border border-slate-200 shadow-pop overflow-hidden animate-pop"
      style={pos}>
      <div className="px-3 pt-2 pb-1.5 bg-navy-50 border-b border-slate-200 flex items-center gap-2">
        <Icon name="book" size={14} className="text-royal shrink-0" />
        <span className="en text-[13px] font-bold text-navy truncate">{s.en}</span>
        {s.area && <span className="ml-auto rounded bg-gold-soft border border-gold-light px-1.5 text-[10px] font-bold uppercase text-gold-deep">{s.area}</span>}
      </div>
      {s.currentKind === "avoid" && <div className="px-3 pt-1.5 text-[12px] font-semibold text-primary-strong inline-flex items-center gap-1"><Icon name="alert" size={12} />{t("round.glossMenu.avoidUsed")}</div>}
      <ul className="py-1 max-h-60 overflow-y-auto">
        {s.options.map((o, i) => (
          <li key={o.hi + i} className={o.tag === "translit" ? "border-t border-dashed border-slate-200" : undefined}>
            <button role="menuitem" disabled={!enabled} onClick={() => onPick(o.hi)} onMouseEnter={() => setHi(i)}
              className={`w-full text-left px-3 py-1.5 flex items-center gap-2 disabled:opacity-50 ${hi === i && enabled ? "bg-navy-50 shadow-[inset_3px_0_0_#F15A24]" : "hover:bg-slate-50"}`}>
              <span className="text-[18px] leading-snug text-ink">{o.hi}</span>
              <span className="ml-auto flex items-center gap-1.5 shrink-0">
                {s.current === o.hi && <span className="text-[10px] font-bold uppercase text-success inline-flex items-center gap-0.5"><Icon name="check" size={11} stroke={3} />{t("round.glossMenu.current")}</span>}
                <span className={`text-[10px] font-bold uppercase tracking-wide ${o.tag === "approved" ? "text-gold-deep" : o.tag === "translit" ? "text-royal" : "text-muted"}`}>
                  {o.tag === "approved" ? t("round.glossMenu.approved") : o.tag === "translit" ? t("round.glossMenu.translit") : o.tag === "other" && o.area ? o.area : t("round.glossMenu.variant")}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {s.avoid.length > 0 && (
        <div className="px-3 py-1.5 border-t border-slate-100 text-[13px] text-muted flex flex-wrap items-baseline gap-x-2">
          <span className="text-[10px] font-bold uppercase tracking-wide">{t("round.glossMenu.avoid")}</span>
          {s.avoid.map((a) => <s key={a} className="text-[15px]">{a}</s>)}
        </div>
      )}
      <button className="w-full px-3 py-2 border-t border-slate-200 text-[13px] font-semibold text-royal inline-flex items-center gap-1.5 hover:bg-slate-50" onClick={() => onSearch(s.en)}>
        <Icon name="search" size={13} />{t("round.glossMenu.search")}
      </button>
    </div>,
    document.body,
  );
}

/** Highlights both halves of a glossary pair (English underline + Hindi underline) while hovered or open. */
export function PairStyle({ keys }: { keys: (string | null | undefined)[] }) {
  const ks = [...new Set(keys.filter((k): k is string => !!k))];
  if (!ks.length) return null;
  return <style>{ks.map((k) => `[data-pair="${k.replace(/[^A-Za-z0-9_]/g, "")}"]{background:#FBE7B0;box-shadow:0 0 0 2px #FBE7B0;border-radius:3px}`).join("")}</style>;
}
