import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../lib/api";
import { lineText, t } from "../lib/strings";
import { announce, type Line } from "../lib/voice";
import { sfx } from "../lib/sfx";
import { SahayikaAvatar } from "../components/SahayikaAvatar";
import { VoiceControl } from "../components/Sahayika";
import { Icon } from "../components/Icon";

interface Msg { who: "me" | "her"; hi: string; en?: string; id?: string }

/** The सहायिका button (§10.4): quick questions first, then free text. */
export function ChatPanel({ open, onClose, attemptId, quick, thinking, opener }: {
  open: boolean; onClose(): void; attemptId: string | null; quick: string[]; thinking: Line | null; opener: Line | null;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open && !msgs.length && opener) setMsgs([{ who: "her", hi: lineText(opener), en: opener.en, id: opener.id }]); }, [open, opener]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  const ask = async (body: { quick?: string; question?: string }, label: string) => {
    if (busy) return;
    setMsgs((m) => [...m, { who: "me", hi: label }]);
    setBusy(true);
    try {
      const r = await api<{ en: string; hi: string; spoken: boolean; remaining: number | null; limit?: boolean }>("/sahayika/chat", { body: { attemptId: attemptId ?? undefined, ...body } });
      setMsgs((m) => [...m, { who: "her", hi: lineText(r) || r.hi, en: r.en, id: `chat-${m.length}` }]);
      setLeft(r.remaining);
      sfx("pop");
      if (r.en) announce({ id: "chat", en: r.en, hi: r.hi, spoken: r.spoken });
    } catch {
      setMsgs((m) => [...m, { who: "her", hi: t("common.error") }]);
    } finally { setBusy(false); }
  };

  if (!open) return null;
  // portalled: a transformed ancestor would otherwise turn `fixed` into `absolute` and push the panel off-screen
  return createPortal(
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-label={t("chat.title")}>
      <div className="absolute inset-0 bg-navy-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="relative w-full max-w-md h-full bg-white shadow-pop flex flex-col animate-rise">
        <div className="sahayika-panel hud-grid !rounded-none !border-0 p-4 flex items-center gap-3 relative">
          <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-primary via-gold to-transparent" aria-hidden />
          <SahayikaAvatar size={44} />
          <div className="flex-1"><div className="text-lg font-bold">{t("common.sahayikaButton")}</div><div className="text-[12px] uppercase tracking-[0.14em] text-blue-200/80">{t("chat.title")}</div></div>
          <button onClick={onClose} className="w-9 h-9 rounded-ui grid place-items-center text-white/80 hover:text-white hover:bg-white/10" aria-label={t("common.close")}><Icon name="x" size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-navy-50" aria-live="polite">
          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.who === "me" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-card px-3.5 py-2 text-[16px] leading-relaxed ${m.who === "me" ? "bg-navy text-white rounded-br-sm" : "bg-white border border-slate-200 border-l-2 border-l-gold rounded-bl-sm shadow-sm text-ink"}`}>
                {m.hi}
                {m.who === "her" && m.en && <div className="mt-1"><VoiceControl line={{ id: m.id ?? "chat", en: m.en, hi: m.hi }} /></div>}
              </div>
            </div>
          ))}
          {busy && <div className="text-muted italic flex items-center gap-2"><span className="inline-flex gap-1">{[0,1,2].map((i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-navy-600 animate-pulse" style={{ animationDelay: `${i * 120}ms` }} />)}</span>{lineText(thinking) || "…"}</div>}
          <div ref={end} />
        </div>
        <div className="p-3 border-t border-slate-200 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {quick.map((k) => (
              <button key={k} disabled={busy} onClick={() => ask({ quick: k }, t(`chat.quick.${k}`))} className="chip bg-white border-slate-300 text-navy hover:border-navy-600 hover:bg-navy-50 disabled:opacity-50">{t(`chat.quick.${k}`)}</button>
            ))}
          </div>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (q.trim()) { ask({ question: q.trim() }, q.trim()); setQ(""); } }}>
            {/* plain input: no transliteration helper here (§9.2) */}
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("chat.placeholder")} maxLength={500} data-allow-select />
            <button className="btn-blue px-4 py-2 text-base" disabled={busy || !q.trim()}>{t("chat.send")} <Icon name="arrowRight" size={16} /></button>
          </form>
          {left !== null && <div className="text-xs text-muted">{t("chat.remaining", { n: left })}</div>}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
