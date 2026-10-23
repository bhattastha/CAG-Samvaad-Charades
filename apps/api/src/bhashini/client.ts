import { config } from "../content.js";
import { env } from "../env.js";

/** All BHASHINI calls go through here. Keys never leave the server (§9). */
export const PIPELINE = "https://dhruva-api.bhashini.gov.in/services/inference/pipeline";
export const LLM = "https://dhruva-api.bhashini.gov.in/services/inference/llm";
/** CAG's Anuvaad document pipeline (same models, no Dhruva key needed); used for drafts when config says so. */
export const ANUVAAD_PIPELINE = "https://anuvaad-backend.bhashini.co.in/v1/pipeline";
const anuvaadDrafts = () => svc().translationProvider !== "dhruva";
const svc = () => config().bhashiniServices;

type Task = "translation" | "transliteration" | "asr" | "tts" | "llm";

export class ServiceUnavailable extends Error {
  constructor(public task: Task, msg: string) { super(msg); }
}

/** Circuit breaker per task: 5 consecutive failures open it for 30 s. */
const breaker = new Map<Task, { fails: number; openUntil: number }>();
export function health() {
  const now = Date.now();
  return (["translation", "transliteration", "asr", "tts", "llm"] as Task[]).map((t) => {
    const b = breaker.get(t);
    return { task: t, configured: isConfigured(t), open: !!b && b.openUntil > now, recentFailures: b?.fails ?? 0 };
  });
}

function keyFor(task: Task): string {
  switch (task) {
    case "translation": return anuvaadDrafts() ? env.ANUVAAD_XLIT_AUTH : env.DHRUVA_NMT_KEY;
    case "asr": return env.DHRUVA_ASR_KEY;
    case "tts": return env.DHRUVA_TTS_KEY;
    case "llm": return env.DHRUVA_LLM_KEY;
    case "transliteration": return env.ANUVAAD_XLIT_AUTH;
  }
}
const keyOptional = (task: Task) => task === "transliteration" || (task === "translation" && anuvaadDrafts());
export const isConfigured = (task: Task) => (keyOptional(task) ? true : !!keyFor(task));

export async function callService<T = any>(task: Task, url: string, body: unknown, opts: { timeoutMs?: number; signal?: AbortSignal } = {}): Promise<T> {
  const key = keyFor(task);
  if (!key && !keyOptional(task)) throw new ServiceUnavailable(task, `${task} key not configured`);
  const b = breaker.get(task) ?? { fails: 0, openUntil: 0 };
  if (b.openUntil > Date.now()) throw new ServiceUnavailable(task, `${task} circuit open`);
  const timeoutMs = opts.timeoutMs ?? 8000;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    const onAbort = () => ctl.abort();
    opts.signal?.addEventListener("abort", onAbort);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
      if (key) headers.Authorization = key; // raw token, not "Bearer"
      const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: ctl.signal });
      if (res.status >= 500) throw Object.assign(new Error(`${task} HTTP ${res.status}`), { retry: true });
      if (!res.ok) throw new Error(`${task} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const json = (await res.json()) as T;
      breaker.set(task, { fails: 0, openUntil: 0 });
      return json;
    } catch (e: any) {
      lastErr = e;
      if (opts.signal?.aborted) throw e;
      // retry 5xx only (timeouts are not retried for the 2.5 s transliteration budget)
      if (!e?.retry || attempt === 2) break;
      await new Promise((r) => setTimeout(r, 300 * 2 ** attempt));
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onAbort);
    }
  }
  b.fails++;
  if (b.fails >= 5) b.openUntil = Date.now() + 30_000;
  breaker.set(task, b);
  throw new ServiceUnavailable(task, String((lastErr as Error)?.message ?? lastErr));
}

// ---------- Translation (console batch only, never during play) ----------

/**
 * Mask locked tokens before sending and restore after. The spec's ⟦0⟧ form is stripped by the live model
 * (tested 23 Oct: it returns bare digits, and bare numbers get reordered), so tokens are sent as {0}, {1}…,
 * which come back intact and in the right place.
 */
export function mask(text: string, locked: string[]) {
  let out = text;
  const used: string[] = [];
  [...locked].sort((a, b) => b.length - a.length).forEach((tok) => {
    if (!out.includes(tok)) return;
    const i = used.push(tok) - 1;
    out = out.split(tok).join(`{${i}}`);
  });
  return { masked: out, tokens: used };
}
export function unmask(text: string, tokens: string[]): { text: string; lost: boolean } {
  let lost = false;
  let out = text;
  tokens.forEach((tok, i) => {
    const re = new RegExp(`(?:\\{\\s*${i}\\s*\\}|⟦\\s*${i}\\s*⟧)`, "g");
    if (!re.test(out)) lost = true;
    out = out.replace(re, tok);
  });
  if (/⟦\s*\d+\s*⟧|\{\s*\d+\s*\}/.test(out)) lost = true;
  return { text: out, lost };
}

export async function translateBatch(items: { text: string; locked: string[] }[]): Promise<{ text: string; lost: boolean }[]> {
  const out: { text: string; lost: boolean }[] = new Array(items.length);
  const chunks: number[][] = [];
  for (let i = 0; i < items.length; i += 25) chunks.push(Array.from({ length: Math.min(25, items.length - i) }, (_, k) => i + k));
  // 5 calls in parallel
  for (let c = 0; c < chunks.length; c += 5) {
    await Promise.all(chunks.slice(c, c + 5).map(async (idx) => {
      const masked = idx.map((i) => mask(items[i].text, items[i].locked));
      const res = await callService<any>("translation", anuvaadDrafts() ? ANUVAAD_PIPELINE : PIPELINE, {
        pipelineTasks: [{ taskType: "translation", config: { language: { sourceLanguage: "en", targetLanguage: "hi" }, serviceId: svc().translation } }],
        inputData: { input: masked.map((m) => ({ source: m.masked })) },
      });
      const outputs: { target: string }[] = res?.pipelineResponse?.[0]?.output ?? [];
      idx.forEach((i, k) => (out[i] = unmask(outputs[k]?.target ?? "", masked[k].tokens)));
    }));
  }
  return out;
}

// ---------- TTS (Sahayika, English, female) ----------

export async function tts(text: string): Promise<Buffer> {
  const res = await callService<any>("tts", PIPELINE, {
    pipelineTasks: [{ taskType: "tts", config: { language: { sourceLanguage: "en" }, serviceId: env.DHRUVA_TTS_SERVICE_ID || svc().ttsEnglish, gender: svc().ttsGender, samplingRate: 22050 } }],
    inputData: { input: [{ source: text }] },
  });
  const b64: string | undefined = res?.pipelineResponse?.[0]?.audio?.[0]?.audioContent;
  if (!b64) throw new ServiceUnavailable("tts", "no audio in response");
  return Buffer.from(b64, "base64");
}

// ---------- LLM (Sahayika chat) ----------

export async function llm(system: string, user: string): Promise<string> {
  const res = await callService<any>("llm", LLM, {
    pipelineTasks: [{ taskType: "llm", config: { serviceId: config().sahayika.llmServiceId, temperature: 0 } }],
    inputData: { input: [[{ role: "system", content: system }, { role: "user", content: user }]] },
  });
  return String(res?.pipelineResponse?.[0]?.output?.[0]?.target ?? "");
}

// ---------- ASR file fallback ----------

export async function asrFile(wavBase64: string): Promise<string> {
  const res = await callService<any>("asr", PIPELINE, {
    pipelineTasks: [{ taskType: "asr", config: { language: { sourceLanguage: "hi" }, serviceId: svc().asrHindi, samplingRate: 16000, postProcessors: ["punctuation"] } }],
    inputData: { audio: [{ audioContent: wavBase64 }] },
  });
  return String(res?.pipelineResponse?.[0]?.output?.[0]?.source ?? "");
}
