import { Fragment, useMemo, useState } from "react";
import type { Answers, ClientPart } from "@hc/shared";
import { t } from "../lib/strings";
import { Icon } from "../components/Icon";
import { PartEditorBody, PartSource, TickButton, type DraftProps } from "./PageViews";
import type { SourceTerm } from "./useAttempt";

const HINT_KEY = "hc.wb.tickHint.v1";
const hintSeen = () => { try { return localStorage.getItem(HINT_KEY) === "1"; } catch { return false; } };

/**
 * Translation workbench in the CAG Anuvaad document layout: two "papers" side by side on a grey canvas, one row per segment
 * (English left, Hindi right, always in the same row). Glossary is inline: underlined terms on both sides open a menu.
 * A segment is finished with the round "Mark as done" control; done rows get a green rail and tint.
 */
export function SegmentRows({ parts, allParts, terms, onTerm, focusedPart, onSelect, d, collapsed = false }: {
  parts: ClientPart[];
  allParts: ClientPart[];
  terms: Record<string, Record<string, SourceTerm[]>>;
  onTerm(partId: string, fieldKey: string, term: SourceTerm, rect: DOMRect): void;
  focusedPart: string | null;
  onSelect(partId: string): void;
  d: DraftProps;
  collapsed?: boolean;
}) {
  const number = useMemo(() => new Map(allParts.filter((p) => p.editable).map((p, i) => [p.id, i + 1])), [allParts]);
  const [hint, setHint] = useState(() => !hintSeen());
  const firstEditable = parts.find((p) => p.editable)?.id;
  const dismissHint = () => { setHint(false); try { localStorage.setItem(HINT_KEY, "1"); } catch { /* ignore */ } };
  const srcCell = collapsed ? "md:hidden" : "";
  const pad = "px-5 md:px-7 xl:px-10";
  return (
    <div className={`hc-papers relative grid ${collapsed ? "md:grid-cols-1" : "md:grid-cols-2"} md:gap-x-6 max-md:bg-white max-md:rounded-lg max-md:shadow-paper`} translate="no">
      {!collapsed && <div className="hc-paper hidden md:block absolute inset-y-0 left-0" style={{ width: "calc(50% - 0.75rem)" }} aria-hidden />}
      <div className="hc-paper hidden md:block absolute inset-y-0 right-0" style={{ width: collapsed ? "100%" : "calc(50% - 0.75rem)" }} aria-hidden />
      <div className={`h-5 md:h-8 ${srcCell}`} aria-hidden /><div className="h-1 md:h-8" aria-hidden />
      {parts.map((p) => {
        if (!p.editable) {
          return (
            <Fragment key={p.id}>
              <div className={`relative ${pad} py-1.5 text-right text-[12px] text-muted en ${srcCell}`}>{t("round.pageNumberLabel")} {p.fields[0]?.en}</div>
              <div className="relative h-1" aria-hidden />
            </Fragment>
          );
        }
        const done = !!d.answers[p.id]?.done;
        const on = focusedPart === p.id;
        const issues = qaFor(p, d.answers, d.watch).filter((q) => !q.ok).length;
        const tint = done ? "bg-success-soft/45" : on ? "bg-navy-50/80" : "";
        const head = (
          <div className="flex items-center gap-2 min-h-[32px] text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
            <span className={`tnum rounded px-1.5 py-0.5 ${on ? "bg-navy text-white" : "bg-slate-100 text-navy"}`}>#{number.get(p.id)}</span>
            <span>{t(`round.partTypes.${p.type}`)}</span>
            {issues > 0 && !done && <span className="inline-flex items-center gap-1 normal-case tracking-normal text-primary-strong"><Icon name="alert" size={12} />{t("round.qaIssues", { n: issues })}</span>}
          </div>
        );
        const sel = { onFocusCapture: () => onSelect(p.id), onClick: () => onSelect(p.id) };
        return (
          <Fragment key={p.id}>
            <div data-src={p.id} {...sel} className={`relative min-w-0 ${pad} pt-3 pb-3 transition-colors ${tint} ${srcCell}`}>
              {head}
              <div className="mt-1.5 no-select en text-[15px] leading-[1.7] text-navy" onCopy={(e) => e.preventDefault()}><PartSource p={p} terms={terms} onTerm={onTerm} /></div>
            </div>
            <div data-dst={p.id} {...sel} className={`relative min-w-0 ${pad} pt-3 pb-3 transition-colors ${tint} ${done ? "hc-seg-done" : ""}`}>
              <span className={`absolute left-0 inset-y-0 w-1 rounded-r ${done ? "bg-success" : on ? "bg-primary" : "bg-transparent"} transition-colors`} aria-hidden />
              <div className="flex items-center justify-end gap-2 mb-1.5 min-h-[32px]">
                {!d.readOnly && <TickButton done={done} disabled={false} onClick={() => d.onTick(p.id, !done)} />}
              </div>
              {hint && p.id === firstEditable && !d.readOnly && (
                <div className="mb-2 flex items-start gap-2 rounded-lg border border-gold/50 bg-gold-soft px-3 py-2 text-[13px] text-navy" role="note">
                  <Icon name="info" size={16} className="mt-0.5 text-gold-deep" />
                  <span className="flex-1">{t("round.tickHint")}</span>
                  <button type="button" onClick={dismissHint} className="shrink-0 font-bold text-primary-strong hover:underline">{t("round.hintDismiss")}</button>
                </div>
              )}
              <PartEditorBody p={p} d={d} />
            </div>
          </Fragment>
        );
      })}
      <div className={`h-5 md:h-8 ${srcCell}`} aria-hidden /><div className="h-2 md:h-8" aria-hidden />
    </div>
  );
}

export interface QaCheck { key: string; ok: boolean; label: string; detail?: string }

/** Live QA for one segment, in the spirit of Anuvaad's QA panel: numbers, Latin words, watch-words, full stop, empty. */
export function qaFor(p: ClientPart, answers: Answers, watch: string[]): QaCheck[] {
  const a = answers[p.id];
  const fields = p.fields.filter((f) => !f.numeric && f.en);
  const texts = fields.map((f) => a?.fields[f.key] ?? "");
  const all = texts.join(" ");
  const locked = new Set(fields.flatMap((f) => f.locked));
  const empty = fields.filter((f, i) => f.en.trim() && !texts[i].trim()).length;
  const missingNums = fields.flatMap((f, i) => f.locked.filter((tok) => f.en.includes(tok) && !texts[i].includes(tok)));
  // words inside locked number chips ("83 per cent") are not the player's English
  const unlocked = [...locked].sort((a, b) => b.length - a.length).reduce((x, tok) => x.split(tok).join(" "), all);
  const latin = (unlocked.match(/[A-Za-z][A-Za-z'’-]+/g) ?? []).filter((w) => !/^[IVXLC]+$/.test(w));
  const flagged = watch.filter((w) => w && all.includes(w));
  const needsStop = (p.type === "body" || p.type === "headnote") && /[.]\s*$/.test(fields[0]?.en ?? "") && !!texts[0]?.trim();
  const out: QaCheck[] = [
    { key: "empty", ok: empty === 0, label: t("round.qa.empty"), detail: empty ? t("round.qa.emptyN", { n: empty }) : undefined },
    { key: "numbers", ok: missingNums.length === 0, label: t("round.qa.numbers"), detail: missingNums.slice(0, 4).join(", ") || undefined },
    { key: "latin", ok: latin.length === 0, label: t("round.qa.latin"), detail: latin.slice(0, 4).join(", ") || undefined },
    { key: "watch", ok: flagged.length === 0, label: t("round.qa.watch"), detail: flagged.slice(0, 4).join(", ") || undefined },
  ];
  if (needsStop) out.push({ key: "stop", ok: /[।?!:]\s*$/.test(texts[0]), label: t("round.qa.stop") });
  return out;
}
