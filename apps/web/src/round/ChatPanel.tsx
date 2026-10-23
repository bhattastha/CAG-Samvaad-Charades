import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { t } from "../lib/strings";
import { speak, type Line } from "../lib/voice";
import { SahayikaAvatar } from "../components/SahayikaAvatar";
import { ListenButton } from "../components/Sahayika";

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
  useEffect(() => { if (open && !msgs.length && opener) setMsgs([{ who: "her", hi: opener.hi, en: opener.en, id: opener.id }]); }, [open, opener]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  const ask = async (body: { quick?: string; question?: string }, label: string) => {
    if (busy) return;
    setMsgs((m) => [...m, { who: "me", hi: label }]);
    setBusy(true);
    try {
      const r = await api<{ en: string; hi: string; spoken: boolean; remaining: number | null; limit?: boolean }>("/sahayika/chat", { body: { attemptId: attemptId ?? undefined, ...body } });
      setMsgs((m) => [...m, { who: "her", hi: r.hi, en: r.en, id: "chat" }]);
      setLeft(r.remaining);
      if (r.en) speak({ id: "chat", en: r.en, hi: r.hi, spoken: r.spoken }, { auto: true });
    } catch {
      setMsgs((m) => [...m, { who: "her", hi: t("ui.error") }]);
    } finally { setBusy(false); }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-label={t("chat.title")}>
      <div className="absolute inset-0 bg-navy/30" onClick={onClose} />
      <aside className="relative w-full max-w-md h-full bg-white shadow-pop flex flex-col animate-rise">
        <div className="sahayika-panel !rounded-none p-4 flex items-center gap-3">
          <SahayikaAvatar size={44} />
          <div className="flex-1"><div className="text-lg font-bold">{t("common.sahayikaButton")}</div><div className="text-sm text-blue-100">{t("chat.title")}</div></div>
          <button onClick={onClose} className="text-2xl text-white/80 hover:text-white" aria-label={t("ui.close")}>✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-royal-soft/30" aria-live="polite">
          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.who === "me" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[16px] leading-relaxed ${m.who === "me" ? "bg-primary text-white rounded-br-sm" : "bg-white border border-blue-100 rounded-bl-sm shadow-sm"}`}>
                {m.hi}
                {m.who === "her" && m.en && <div className="mt-1"><ListenButton line={{ id: m.id ?? "chat", en: m.en, hi: m.hi }} /></div>}
              </div>
            </div>
          ))}
          {busy && <div className="text-muted italic">{thinking?.hi ?? "…"}</div>}
          <div ref={end} />
        </div>
        <div className="p-3 border-t border-gray-100 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {quick.map((k) => (
              <button key={k} disabled={busy} onClick={() => ask({ quick: k }, t(`chat.quick.${k}`))} className="chip bg-royal-soft border-blue-200 text-royal-deep hover:bg-blue-100">{t(`chat.quick.${k}`)}</button>
            ))}
          </div>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (q.trim()) { ask({ question: q.trim() }, q.trim()); setQ(""); } }}>
            {/* plain input: no transliteration helper here (§9.2) */}
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("chat.placeholder")} maxLength={500} data-allow-select />
            <button className="btn-blue px-4 py-2 text-base" disabled={busy || !q.trim()}>{t("chat.send")}</button>
          </form>
          {left !== null && <div className="text-xs text-muted">{t("chat.remaining", { n: left })}</div>}
        </div>
      </aside>
    </div>
  );
}
