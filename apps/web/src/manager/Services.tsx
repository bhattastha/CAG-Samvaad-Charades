import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { Card, Notice, PageHeader, Pill, ReadOnlyNote, btn, fmtDate, input, useIsManager } from "./ui";

type Svc = {
  translationProvider: "anuvaad" | "dhruva"; translation: string;
  transliterationProvider: "anuvaad" | "dhruva"; transliteration: string; transliterationSuggestions: number;
  tts: string; ttsGender: "female" | "male"; ttsLanguage: "en" | "hi"; ttsSamplingRate: number;
  asrHindi: string; llm: string;
};
type TestTask = "translation" | "transliteration" | "tts" | "llm";
const PROVIDERS = [{ v: "dhruva", l: "BHASHINI Dhruva (inference key)" }, { v: "anuvaad", l: "CAG Anuvaad pipeline" }];

function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="font-semibold text-slate-800">{label}</span>
      <div className="mt-1">{children}</div>
      {help && <span className="mt-1 block text-xs text-slate-500">{help}</span>}
    </label>
  );
}

function TestButton({ task, disabled }: { task: TestTask; disabled: boolean }) {
  const [res, setRes] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true); setRes(null);
    try {
      const r = await api<any>("/admin/config/services/test", { body: { task } });
      setRes({ ok: true, text: `OK in ${r.ms} ms · ${r.sample}` });
      if (r.audio) new Audio(`data:audio/wav;base64,${r.audio}`).play().catch(() => {});
    } catch (e) {
      const b = (e as ApiError).body;
      setRes({ ok: false, text: b?.message ?? (e as ApiError).code });
    } finally { setBusy(false); }
  };
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button data-testid={`svc-test-${task}`} className={btn.ghost} disabled={disabled || busy} onClick={run}>{busy ? "Testing…" : "Test saved setting"}</button>
      {res && <span data-testid={`svc-test-${task}-result`} className={`text-xs ${res.ok ? "text-emerald-700" : "text-red-700"}`} lang="hi">{res.text}</span>}
    </div>
  );
}

export function Services() {
  const qc = useQueryClient();
  const isManager = useIsManager();
  const { data } = useQuery({ queryKey: ["svc"], queryFn: () => api<{ current: Svc; defaults: Svc; updatedBy: string | null; updatedAt: string | null; health: any[] }>("/admin/config/services") });
  const [f, setF] = useState<Svc | null>(null);
  const [msg, setMsg] = useState<{ tone: "green" | "red"; text: string } | null>(null);
  useEffect(() => { if (data) setF(data.current); }, [data]);
  if (!data || !f) return null;
  const ro = !isManager;
  const set = <K extends keyof Svc>(k: K, v: Svc[K]) => setF({ ...f, [k]: v });
  const text = (k: keyof Svc) => (
    <input data-testid={`svc-${k}`} className={`${input} font-mono text-xs`} disabled={ro} value={String(f[k])} onChange={(e) => set(k, e.target.value as any)} />
  );
  const provider = (k: "translationProvider" | "transliterationProvider") => (
    <select data-testid={`svc-${k}`} className={input} disabled={ro} value={f[k]} onChange={(e) => set(k, e.target.value as any)}>
      {PROVIDERS.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
    </select>
  );
  const dirty = JSON.stringify(f) !== JSON.stringify(data.current);
  const save = async () => {
    try {
      const r = await api<any>("/admin/config/services", { method: "PUT", body: f });
      setMsg({ tone: "green", text: `Saved and audited. New calls use these services now.${r.voiceChanged ? " The voice changed, so saved Sahayak recordings were cleared; players hear live TTS until you regenerate them in Sahayak." : ""}` });
      qc.invalidateQueries({ queryKey: ["svc"] }); qc.invalidateQueries({ queryKey: ["analytics"] });
    } catch (e) { setMsg({ tone: "red", text: (e as ApiError).body?.message ?? (e as ApiError).body?.issues?.map((i: any) => i.message).join("; ") ?? "Save failed" }); }
  };
  const health = Object.fromEntries(data.health.map((h: any) => [h.task, h]));
  const status = (task: string) => {
    const h = health[task];
    if (!h) return null;
    return <Pill tone={!h.configured ? "slate" : h.open || h.recentFailures ? "amber" : "green"}>{!h.configured ? "key not set" : h.open ? "paused after failures" : h.recentFailures ? `${h.recentFailures} recent failure${h.recentFailures > 1 ? "s" : ""}` : "key set · use Test"}</Pill>;
  };
  return (
    <div data-testid="services-page">
      <PageHeader title="BHASHINI services" subtitle="Service IDs and models used for translation, transliteration, Sahayak's voice and chat. Changes apply immediately, are validated and recorded in the audit trail. The API key itself stays in the server's secrets."
        actions={isManager && <><button data-testid="svc-discard" className={btn.ghost} disabled={!dirty} onClick={() => { setF(data.current); setMsg(null); }}>Discard changes</button>
          <button data-testid="svc-defaults" className={btn.ghost} onClick={() => setF(data.defaults)}>Load file defaults</button>
          <button data-testid="svc-save" className={btn.primary} disabled={!dirty} onClick={save}>Save services</button></>} />
      {ro && <div className="mb-4"><ReadOnlyNote /></div>}
      {msg && <div className="mb-4" data-testid="svc-msg"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
      {data.updatedBy && <p className="mb-4 text-xs text-slate-500">Last changed by {data.updatedBy}{data.updatedAt ? ` · ${fmtDate(data.updatedAt)}` : ""}</p>}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Translation (BHASHINI drafts)" actions={status("translation")} subtitle="English → Hindi drafts made in the console when a report is added. Never called during play.">
          <div className="grid gap-3">
            <Field label="Provider">{provider("translationProvider")}</Field>
            <Field label="Service ID" help="e.g. ai4bharat/indictrans-v2-all-gpu--t4">{text("translation")}</Field>
          </div>
          <TestButton task="translation" disabled={ro || dirty} />
        </Card>
        <Card title="Transliteration (typing help + glossary)" actions={status("transliteration")} subtitle="Roman → Devanagari suggestions in the workbench, and the last option in each glossary menu.">
          <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
            <Field label="Provider">{provider("transliterationProvider")}</Field>
            <Field label="Suggestions"><input data-testid="svc-transliterationSuggestions" type="number" min={1} max={8} className={input} disabled={ro} value={f.transliterationSuggestions} onChange={(e) => set("transliterationSuggestions", Number(e.target.value))} /></Field>
            <div className="sm:col-span-2"><Field label="Service ID" help="e.g. ai4bharat/indicxlit--cpu-fsv2">{text("transliteration")}</Field></div>
          </div>
          <TestButton task="transliteration" disabled={ro || dirty} />
        </Card>
        <Card title="Text to speech (Sahayak's voice)" actions={status("tts")} subtitle="Sahayak reads its lines aloud. The test plays a short sample.">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-3"><Field label="Service ID" help="e.g. bhashini/bodhan/indic-tts, ai4bharat/indic-tts-coqui-indo_aryan-gpu--t4 (Hindi)">{text("tts")}</Field></div>
            <Field label="Voice"><select data-testid="svc-ttsGender" className={input} disabled={ro} value={f.ttsGender} onChange={(e) => set("ttsGender", e.target.value as any)}><option value="male">Male</option><option value="female">Female</option></select></Field>
            <Field label="Spoken language"><select data-testid="svc-ttsLanguage" className={input} disabled={ro} value={f.ttsLanguage} onChange={(e) => set("ttsLanguage", e.target.value as any)}><option value="en">English lines</option><option value="hi">Hindi lines</option></select></Field>
            <Field label="Sampling rate"><select data-testid="svc-ttsSamplingRate" className={input} disabled={ro} value={f.ttsSamplingRate} onChange={(e) => set("ttsSamplingRate", Number(e.target.value))}>{[8000, 16000, 22050, 44100].map((r) => <option key={r} value={r}>{r} Hz</option>)}</select></Field>
          </div>
          <TestButton task="tts" disabled={ro || dirty} />
        </Card>
        <Card title="Sahayak chat model and speech input" actions={status("llm")} subtitle="The model behind Sahayak's free-text answers, and Hindi speech recognition for voice typing.">
          <div className="grid gap-3">
            <Field label="Chat model (LLM service ID)" help="e.g. bhashini/google/gemma-4-26B-A4B-it">{text("llm")}</Field>
            <Field label="Hindi speech recognition (ASR service ID)" help="e.g. ai4bharat/conformer-hi-gpu--t4">{text("asrHindi")}</Field>
          </div>
          <TestButton task="llm" disabled={ro || dirty} />
        </Card>
      </div>
      {isManager && dirty && <p className="mt-4 text-xs text-slate-500">Save first: the test buttons check the saved settings.</p>}
    </div>
  );
}
