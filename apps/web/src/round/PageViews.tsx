import { Fragment, useEffect, useRef } from "react";
import type { Answers, ChartLayout, ClientField, ClientPart, TableLayout } from "@hc/shared";
import { t } from "../lib/strings";
import { TranslationEditor, type EditorHandle, type WatchClick } from "../editor/TranslationEditor";
import type { SourceTerm, WatchWord } from "./useAttempt";

export type FieldKey = `${string}:${string}`;
export const fk = (partId: string, key: string): FieldKey => `${partId}:${key}`;

// ---------------- glossary popover (source term or watch word) ----------------

export interface PopoverState {
  rect: DOMRect;
  title: string;
  options: string[];
  avoid?: string[];
  mode: "insert" | "replace";
  target: FieldKey | null;
  range?: { from: number; to: number };
}

export function GlossPopover({ s, onPick, onClose }: { s: PopoverState; onPick(v: string): void; onClose(): void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    setTimeout(() => document.addEventListener("mousedown", h), 0);
    document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, [onClose]);
  const left = Math.max(8, Math.min(s.rect.left, window.innerWidth - 300));
  const below = s.rect.bottom + 230 < window.innerHeight;
  return (
    <div ref={ref} role="dialog" aria-label={t("round.suggestFor")} onMouseDown={(e) => e.preventDefault()}
      className="fixed z-[85] w-[280px] rounded-card bg-white border border-blue-200 shadow-pop p-3 animate-pop"
      style={below ? { left, top: s.rect.bottom + 6 } : { left, bottom: window.innerHeight - s.rect.top + 6 }}>
      <div className="text-xs font-bold text-royal uppercase tracking-wide">{s.mode === "replace" ? t("round.watchWord") : t("round.suggestFor")}</div>
      <div className="mt-0.5 font-semibold text-navy">{s.title}</div>
      <div className="mt-2 flex flex-col gap-1.5">
        {s.options.map((o, i) => (
          <button key={o} onClick={() => onPick(o)} disabled={!s.target}
            className={`text-left rounded-lg px-3 py-1.5 text-[17px] border flex items-center justify-between gap-2 disabled:opacity-50 ${i === 0 ? "bg-primary-soft border-orange-200 font-semibold" : "bg-white border-gray-200 hover:bg-gray-50"}`}>
            <span>{o}</span><span className="text-xs font-bold text-primary-strong whitespace-nowrap">{s.mode === "replace" ? t("round.replaceWith") : "＋ " + t("glossary.insert")}</span>
          </button>
        ))}
      </div>
      {s.avoid && s.avoid.length > 0 && <div className="mt-2 text-xs text-muted">{t("glossary.avoid")}: <s>{s.avoid.join(", ")}</s></div>}
    </div>
  );
}

// ---------------- English source ----------------

function TermText({ text, terms, onTerm }: { text: string; terms?: SourceTerm[]; onTerm?(term: SourceTerm, rect: DOMRect): void }) {
  if (!terms?.length) return <>{text}</>;
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const tm of [...terms].sort((a, b) => a.start - b.start)) {
    if (tm.start < last) continue;
    out.push(text.slice(last, tm.start));
    out.push(
      <span key={tm.start} role="button" tabIndex={0} className="hc-source-term" title={`${tm.en} = ${tm.hi}`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => onTerm?.(tm, (e.currentTarget as HTMLElement).getBoundingClientRect())}
        onKeyDown={(e) => { if (e.key === "Enter") onTerm?.(tm, (e.currentTarget as HTMLElement).getBoundingClientRect()); }}>
        {text.slice(tm.start, tm.end)}
      </span>,
    );
    last = tm.end;
  }
  out.push(text.slice(last));
  return <>{out}</>;
}

function SourceChart({ part, render }: { part: ClientPart; render(f: ClientField | undefined, cls?: string): React.ReactNode }) {
  const L = part.layout as ChartLayout;
  const f = (k?: string) => part.fields.find((x) => x.key === k);
  return (
    <div>
      {L.title && <div className="text-center text-[14px] font-semibold mb-1">{render(f(L.title))}</div>}
      <ChartSvg layout={L} labels={L.xLabels.map((k) => f(k)?.en ?? "")} />
      <div className="flex flex-wrap gap-3 justify-center text-xs mt-1">
        {L.series.map((s, i) => <span key={i} className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ background: SERIES[i % SERIES.length] }} />{render(f(s.name))}</span>)}
      </div>
      {L.source && <div className="text-xs text-muted mt-1 italic">{render(f(L.source))}</div>}
    </div>
  );
}

export const SERIES = ["#E8590C", "#2563EB", "#16A34A", "#F59E0B"];

/** Read-only bars and values; only words are translated (§7.6). */
export function ChartSvg({ layout, labels }: { layout: ChartLayout; labels: string[] }) {
  const n = layout.xLabels.length;
  const s = layout.series.length || 1;
  const max = Math.max(...(layout.yTicks ?? []), ...layout.series.flatMap((x) => x.values), 1);
  const W = 520, H = 210, padL = 30, padB = 34, plotH = H - padB - 12;
  const gw = (W - padL - 6) / n;
  const bw = Math.min(26, (gw - 8) / s);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="chart">
      {(layout.yTicks ?? [0, max / 2, max]).map((tk) => {
        const y = 12 + plotH - (tk / max) * plotH;
        return <g key={tk}><line x1={padL} x2={W} y1={y} y2={y} stroke="#E5E7EB" /><text x={padL - 4} y={y + 3} fontSize="9" textAnchor="end" fill="#6B7280">{tk}</text></g>;
      })}
      {layout.series.map((ser, si) => ser.values.map((v, i) => {
        const h = (v / max) * plotH;
        const x = padL + i * gw + (gw - bw * s) / 2 + si * bw;
        return (
          <g key={`${si}-${i}`}>
            <rect x={x} y={12 + plotH - h} width={bw - 2} height={h} fill={SERIES[si % SERIES.length]} rx="2" />
            {s <= 2 && <text x={x + bw / 2 - 1} y={12 + plotH - h - 3} fontSize="8" textAnchor="middle" fill="#22293B">{layout.valueDecimals !== undefined ? v.toFixed(layout.valueDecimals) : v}</text>}
          </g>
        );
      }))}
      {labels.map((l, i) => <text key={i} x={padL + i * gw + gw / 2} y={H - padB + 14} fontSize="10" textAnchor="middle" fill="#22293B">{l}</text>)}
    </svg>
  );
}

function SourceTable({ part, render }: { part: ClientPart; render(f: ClientField | undefined): React.ReactNode }) {
  const L = part.layout as TableLayout;
  const f = (k?: string) => part.fields.find((x) => x.key === k);
  return (
    <div>
      {L.title && <div className="font-semibold text-[14px] mb-1.5">{render(f(L.title))}</div>}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-[13px] border-collapse">
          <tbody>
            {L.rows.map((row, ri) => (
              <tr key={ri} className={ri === 0 ? "bg-gray-50 font-semibold" : "border-t border-gray-100"}>
                {row.map((k, ci) => { const c = f(k); return <td key={ci} className={`px-2 py-1.5 ${c?.numeric ? "text-right en tabular-nums" : ""}`}>{render(c)}</td>; })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {L.note && <div className="text-xs text-muted mt-1">{render(f(L.note))}</div>}
    </div>
  );
}

export function SourcePanel({ parts, terms, focusedPart, sentenceIndex, onTerm, onPartClick }: {
  parts: ClientPart[];
  terms: Record<string, Record<string, SourceTerm[]>>;
  focusedPart: string | null;
  sentenceIndex: number | null;
  onTerm(partId: string, fieldKey: string, term: SourceTerm, rect: DOMRect): void;
  onPartClick(partId: string): void;
}) {
  return (
    <div className="no-select en text-[15.5px] leading-[1.7] text-navy space-y-3" onCopy={(e) => e.preventDefault()}>
      {parts.map((p) => {
        const render = (f?: ClientField) => f ? <TermText text={f.en} terms={terms[p.id]?.[f.key]} onTerm={(tm, r) => onTerm(p.id, f.key, tm, r)} /> : null;
        const linked = focusedPart === p.id && p.type !== "passage";
        const wrap = (cls: string, child: React.ReactNode) => (
          <div key={p.id} data-src={p.id} onClick={() => p.editable && onPartClick(p.id)} className={`${cls} ${linked ? "linked" : ""} transition-shadow ${p.editable ? "cursor-pointer" : ""} px-1 -mx-1`}>{child}</div>
        );
        const f0 = p.fields[0];
        switch (p.type) {
          case "passage": {
            // each sentence is its own span, so the caret position in the Hindi maps to the English sentence (§15.3)
            const en = f0.en;
            const sents = p.enSentences ?? [en];
            const all = terms[p.id]?.[f0.key] ?? [];
            let cur = 0;
            return wrap("", sents.map((sent, i) => {
              const at = en.indexOf(sent, cur);
              const start = at < 0 ? cur : at;
              const gap = en.slice(cur, start);
              cur = start + sent.length;
              const local = all.filter((x) => x.start >= start && x.end <= cur).map((x) => ({ ...x, start: x.start - start, end: x.end - start }));
              return (
                <Fragment key={i}>
                  {gap.includes("\n") ? <span className="block h-3" /> : i > 0 ? " " : null}
                  <span className={sentenceIndex === i ? "bg-amber-100 rounded px-0.5 transition-colors" : ""}>
                    <TermText text={sent} terms={local} onTerm={(tm, r) => onTerm(p.id, f0.key, tm, r)} />
                  </span>
                </Fragment>
              );
            }));
          }
          case "header": return wrap("text-[12.5px] italic text-muted", render(f0));
          case "footer": return wrap("text-[12.5px] italic text-muted border-t border-gray-100 pt-2 mt-4", render(f0));
          case "page_number": return <div key={p.id} className="text-right text-[12.5px] text-muted">{f0?.en}</div>;
          case "heading": return wrap("font-bold text-[16.5px]", render(f0));
          case "headnote": return wrap("rounded-lg bg-gray-100 border border-gray-200 px-3 py-2 text-[14.5px]", render(f0));
          case "footnote": return wrap("text-[12.5px] text-navy/80 border-t border-gray-200 pt-1.5", render(f0));
          case "table": return wrap("", <SourceTable part={p} render={render} />);
          case "chart": return wrap("", <SourceChart part={p} render={(f) => render(f)} />);
          default: return wrap("", <p>{render(f0)}</p>);
        }
      })}
    </div>
  );
}

// ---------------- Hindi draft (main rounds) ----------------

interface DraftProps {
  parts: ClientPart[];
  answers: Answers;
  readOnly: boolean;
  watch: string[];
  focusedPart: string | null;
  register(key: FieldKey, h: EditorHandle | null): void;
  onField(partId: string, key: string, v: string): void;
  onTick(partId: string, done: boolean): void;
  onFocus(partId: string, key: string): void;
  onBlocked(kind: string): void;
  onTyping(): void;
  onWatchClick(partId: string, key: string, w: WatchClick): void;
  onXlit(i: number): void;
}

function FieldEditor({ p, f, d, compact = false, singleLine = false }: { p: ClientPart; f: ClientField; d: DraftProps; compact?: boolean; singleLine?: boolean }) {
  if (f.numeric) return <span className="en tabular-nums">{f.en}</span>;
  return (
    <TranslationEditor
      ref={(h) => d.register(fk(p.id, f.key), h)}
      value={d.answers[p.id]?.fields[f.key] ?? ""}
      locked={f.locked}
      readOnly={d.readOnly || !!d.answers[p.id]?.done}
      compact={compact}
      singleLine={singleLine}
      watch={d.watch}
      showLatin
      ariaLabel={`${p.type} ${f.key}`}
      onChange={(v) => d.onField(p.id, f.key, v)}
      onFocus={() => d.onFocus(p.id, f.key)}
      onBlocked={d.onBlocked}
      onTyping={d.onTyping}
      onWatchClick={(w) => d.onWatchClick(p.id, f.key, w)}
      onXlitAccept={d.onXlit}
    />
  );
}

function TickButton({ done, disabled, onClick }: { done: boolean; disabled: boolean; onClick(): void }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={done}
      className={`shrink-0 rounded-full px-3 py-1 text-[13px] font-bold border-2 transition ${done ? "bg-success text-white border-success animate-pop" : "bg-white text-success border-green-300 hover:bg-success-soft"}`}>
      {done ? t("round.partDone") : t("round.tick")}
    </button>
  );
}

export function DraftPanel(d: DraftProps) {
  return (
    <div className="space-y-3">
      {d.parts.map((p) => {
        if (!p.editable) {
          return <div key={p.id} className="text-right text-[12.5px] text-muted en">{p.fields[0]?.en}</div>;
        }
        const done = !!d.answers[p.id]?.done;
        const linked = d.focusedPart === p.id;
        const f = (k?: string) => p.fields.find((x) => x.key === k);
        const head = (
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[11px] font-bold tracking-wide text-muted">{t(`round.partTypes.${p.type}`)}</span>
            <div className="flex items-center gap-2">
              {!done && <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[12px] font-semibold text-muted">{t("round.partIncomplete")}</span>}
              {!d.readOnly && <TickButton done={done} disabled={false} onClick={() => d.onTick(p.id, !done)} />}
            </div>
          </div>
        );
        let body: React.ReactNode;
        if (p.type === "table") {
          const L = p.layout as TableLayout;
          body = (
            <div>
              {L.title && f(L.title) && <div className="font-semibold mb-1.5"><FieldEditor p={p} f={f(L.title)!} d={d} compact singleLine /></div>}
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-[14px] border-collapse">
                  <tbody>
                    {L.rows.map((row, ri) => (
                      <tr key={ri} className={ri === 0 ? "bg-gray-50 font-semibold" : "border-t border-gray-100"}>
                        {row.map((k, ci) => { const c = f(k); return <td key={ci} className={`px-2 py-1 align-top ${c?.numeric ? "text-right bg-gray-50/60 text-muted" : "min-w-[7rem]"}`}>{c ? <FieldEditor p={p} f={c} d={d} compact singleLine /> : null}</td>; })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {L.note && f(L.note) && <div className="text-[13px] mt-1"><FieldEditor p={p} f={f(L.note)!} d={d} compact /></div>}
            </div>
          );
        } else if (p.type === "chart") {
          const L = p.layout as ChartLayout;
          body = (
            <div>
              {L.title && f(L.title) && <div className="text-center font-semibold mb-1"><FieldEditor p={p} f={f(L.title)!} d={d} compact /></div>}
              <ChartSvg layout={L} labels={L.xLabels.map((k) => f(k)?.en ?? "")} />
              <div className="grid sm:grid-cols-2 gap-2 mt-2">
                {[...L.series.map((s) => s.name), ...L.xLabels, L.yAxis].filter((k): k is string => !!k && !f(k)?.numeric).map((k, i) => (
                  <div key={k} className="flex items-center gap-2 text-[14px]">
                    {i < L.series.length && <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: SERIES[i % SERIES.length] }} />}
                    <div className="flex-1 rounded-md border border-gray-200 px-2"><FieldEditor p={p} f={f(k)!} d={d} compact singleLine /></div>
                  </div>
                ))}
              </div>
              {L.source && f(L.source) && <div className="text-[13px] mt-1.5 italic"><FieldEditor p={p} f={f(L.source)!} d={d} compact /></div>}
            </div>
          );
        } else {
          const cls = p.type === "heading" ? "font-bold" : p.type === "headnote" ? "rounded-lg bg-gray-50 border border-gray-200 px-3 py-1.5" : p.type === "header" || p.type === "footer" || p.type === "footnote" ? "text-[15px]" : "";
          body = <div className={cls}>{p.fields[0] && <FieldEditor p={p} f={p.fields[0]} d={d} compact={["header", "footer", "footnote"].includes(p.type)} />}</div>;
        }
        return (
          <div key={p.id} data-dst={p.id} className={`rounded-xl border p-2.5 transition ${done ? "border-green-300 bg-success-soft/40" : "border-gray-200 bg-white"} ${linked ? "linked" : ""}`}>
            {head}
            {body}
          </div>
        );
      })}
    </div>
  );
}
