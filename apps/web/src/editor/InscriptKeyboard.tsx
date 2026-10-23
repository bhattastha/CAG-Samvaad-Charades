import { useState } from "react";
import { INSCRIPT, INSCRIPT_ROWS, INSCRIPT_SHIFT } from "@hc/shared";
import { t } from "../lib/strings";
import { Icon } from "../components/Icon";

/** On-screen InScript keys (§7.3). Taps insert into the focused editor without stealing focus. */
export function InscriptKeyboard({ onKey, onBackspace, compact = false }: { onKey(ch: string): void; onBackspace(): void; compact?: boolean }) {
  const [shift, setShift] = useState(false);
  const key = (k: string) => {
    const code = shift ? INSCRIPT_SHIFT[k] ?? k : k;
    return INSCRIPT[code] ?? k;
  };
  const btn = `rounded-md border border-slate-300 bg-white text-navy shadow-[0_1px_0_rgba(11,37,69,.12)] hover:bg-navy-50 hover:border-navy-600 active:bg-slate-100 active:translate-y-px transition ${compact ? "h-9 min-w-[2.1rem] text-[17px]" : "h-11 min-w-[2.6rem] text-[19px]"}`;
  return (
    <div className="flex flex-col gap-1.5 select-none" onMouseDown={(e) => e.preventDefault()}>
      {INSCRIPT_ROWS.map((row, i) => (
        <div key={i} className="flex gap-1 justify-center flex-wrap">
          {row.map((k) => {
            const ch = key(k);
            const sign = /^[ा-्ँ-ः़]$/.test(ch);
            return (
              <button key={k} type="button" className={btn} onClick={() => onKey(ch)} aria-label={ch}>
                {sign ? <span className="text-slate-400">◌</span> : null}{ch}
              </button>
            );
          })}
        </div>
      ))}
      <div className="flex gap-1 justify-center">
        <button type="button" className={`${btn} px-3 text-sm font-semibold ${shift ? "!bg-navy !text-white !border-navy" : ""}`} onClick={() => setShift(!shift)}>{t("round.shift")}</button>
        <button type="button" className={`${btn} flex-1 max-w-[14rem] text-sm`} onClick={() => onKey(" ")}>{t("round.space")}</button>
        <button type="button" className={`${btn} px-3 text-lg`} onClick={() => onKey("।")}>।</button>
        <button type="button" className={`${btn} px-3 text-sm font-semibold`} onClick={onBackspace} aria-label={t("round.backspace")}><Icon name="backspace" size={18} className="mx-auto" /></button>
      </div>
    </div>
  );
}
