import { useEffect, useRef, useState } from "react";
import { t } from "../lib/strings";
import { Icon } from "../components/Icon";

/** Page control for the workbench status bar: "‹ Page 3 of 10 ›" with a small grid popover (opens upward) to jump to a page. */
export function PageControl({ pageNos, idx, onChange, done }: { pageNos: number[]; idx: number; onChange(i: number): void; done(n: number): boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [open]);
  const go = (i: number) => { if (i < 0 || i >= pageNos.length) return; onChange(i); window.scrollTo({ top: 0 }); document.querySelector("[data-canvas]")?.scrollTo?.({ top: 0 }); };
  const arrow = "w-6 h-6 rounded-full grid place-items-center text-navy hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent";
  return (
    <div ref={ref} className="relative shrink-0 whitespace-nowrap" role="navigation" aria-label={t("round.pageControl.label")}>
      {open && (
        <div className="absolute bottom-9 left-0 w-[min(17rem,calc(100vw-1.5rem))] rounded-lg bg-white border border-slate-200 shadow-pop p-2.5 animate-pop">
          <div className="kicker mb-1.5">{t("round.pageControl.jump")}</div>
          <div className="grid grid-cols-6 gap-1 max-h-48 overflow-y-auto">
            {pageNos.map((n, i) => (
              <button key={n} onClick={() => { go(i); setOpen(false); }} aria-current={i === idx} aria-label={t("round.pageNav", { n: i + 1, total: pageNos.length })}
                className={`h-8 rounded-md text-xs font-bold tnum border ${i === idx ? "bg-navy border-navy text-white" : done(n) ? "bg-success-soft border-success/40 text-success" : "bg-white border-slate-200 text-muted hover:border-navy"}`}>
                {done(n) && i !== idx ? <Icon name="check" size={14} stroke={2.6} className="mx-auto" /> : i + 1}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-0.5">
        <button className={arrow} disabled={idx === 0} onClick={() => go(idx - 1)} aria-label={t("round.prevPage")}><Icon name="chevronLeft" size={16} /></button>
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="dialog" aria-label={t("round.pageNav", { n: idx + 1, total: pageNos.length })}
          className="px-2 h-6 text-[12.5px] font-bold tnum text-navy rounded-full hover:bg-slate-100">{t("round.pageControl.pageOf", { n: idx + 1, total: pageNos.length })}</button>
        <button className={arrow} disabled={idx === pageNos.length - 1} onClick={() => go(idx + 1)} aria-label={t("round.nextPage")}><Icon name="chevronRight" size={16} /></button>
      </div>
    </div>
  );
}
