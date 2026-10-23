import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { escapeRegExp, type Answers, type ClientPart, type Flag } from "@hc/shared";
import { api } from "../lib/api";
import { t } from "../lib/strings";
import { Header, Page, PageTitle, Spinner } from "../components/Layout";

interface ReviewData { roundKey: string; page: { parts: ClientPart[] }; answers: Answers; flags: Flag[]; termChecks: { en: string; hi: string; correct: boolean }[] }

const CLS: Record<string, string> = { avoid: "hc-watch", slip: "hc-watch", latin: "hc-latin", grammar: "hc-latin" };

function Marked({ text, flags }: { text: string; flags: Flag[] }) {
  const words = flags.filter((f) => f.text).map((f) => f.text);
  if (!words.length) return <>{text}</>;
  const re = new RegExp(`(${[...new Set(words)].sort((a, b) => b.length - a.length).map(escapeRegExp).join("|")})`, "g");
  return <>{text.split(re).map((seg, i) => {
    const f = flags.find((x) => x.text === seg);
    return f ? <span key={i} className={CLS[f.kind]} title={f.enTerm ?? ""}>{seg}</span> : <span key={i}>{seg}</span>;
  })}</>;
}

/** §15.6 Review own answer: the player's text with flags. Never the CAG reference. */
export function Review() {
  const { id = "" } = useParams();
  const { data } = useQuery({ queryKey: ["review", id], queryFn: () => api<ReviewData>(`/attempts/${id}/review`) });
  if (!data) return <><Header /><Spinner /></>;
  const missing = data.termChecks.filter((x) => !x.correct);
  return (
    <>
      <Header />
      <Page>
        <PageTitle hi={t("reportCard.reviewHeading")} en="Your translation" right={<Link to={`/report/${id}`} className="btn-ghost">← {t("common.back")}</Link>} />
        <p className="text-muted mb-4">{t("reportCard.reviewNote")}</p>
        <div className="flex flex-wrap gap-4 mb-4 text-sm">
          <span><span className="hc-watch">शब्द</span> {t("reportCard.legendAvoid")} / {t("reportCard.legendSlip")}</span>
          <span><span className="hc-latin">word</span> {t("reportCard.legendLatin")}</span>
        </div>
        <div className="grid lg:grid-cols-[1.6fr_1fr] gap-6">
          <div className="card p-5 space-y-3 text-[18px] leading-[1.8]" data-allow-select>
            {data.page.parts.filter((p) => p.editable).map((p) => (
              <div key={p.id}>
                {p.fields.filter((f) => !f.numeric).map((f) => {
                  const v = data.answers[p.id]?.fields[f.key] ?? "";
                  if (!v) return null;
                  return <p key={f.key} className="whitespace-pre-wrap"><Marked text={v} flags={data.flags.filter((x) => x.partId === p.id && x.fieldKey === f.key)} /></p>;
                })}
              </div>
            ))}
          </div>
          <aside className="card p-5">
            <h2 className="font-bold text-primary-strong">{t("reportCard.measureGlossary")}</h2>
            <ul className="mt-2 space-y-1.5">
              {data.termChecks.map((x) => (
                <li key={x.en} className="flex items-center gap-2"><span className={x.correct ? "text-success" : "text-timer-text"}>{x.correct ? "✓" : "✗"}</span><span className="en">{x.en}</span>{x.correct && <span>· {x.hi}</span>}</li>
              ))}
            </ul>
            {missing.length > 0 && <p className="mt-3 text-sm text-muted">{t("reportCard.missingTerms")} <span className="en">{missing.map((m) => m.en).join(", ")}</span></p>}
          </aside>
        </div>
      </Page>
    </>
  );
}
