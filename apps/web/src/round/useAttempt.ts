import { useCallback, useEffect, useRef, useState } from "react";
import type { Answers, ClientPart } from "@hc/shared";
import { api, ApiError, clientId } from "../lib/api";

export interface WatchWord { text: string; en?: string; hi?: string; options?: string[] }
export interface SourceTerm { start: number; end: number; en: string; hi: string; variants: string[]; avoid: string[]; area?: string | null; alternatives?: { hi: string; area: string | null }[] }
export interface AttemptView {
  id: string;
  roundKey: "trial" | "primary" | "secondary" | "pro";
  chanceNo: number;
  status: "active" | "submitted";
  startedAt: string;
  deadlineAt: string;
  serverNow: string;
  answers: Answers;
  version: number;
  activeClientId: string | null;
  leftPageCount: number;
  creditCap: number;
  page: {
    id: string; label: string; printedPageNo: string | null; sample: boolean; parts: ClientPart[];
    sourceTerms: Record<string, Record<string, SourceTerm[]>>; watchWords: WatchWord[];
  };
}

// ---- tiny IndexedDB mirror so a crash or offline spell never loses work (§12) ----
const DB = "hc-autosave";
function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("a");
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function mirror(id: string, v: unknown) {
  try { const d = await idb(); d.transaction("a", "readwrite").objectStore("a").put(v, id); } catch { /* private mode */ }
}
async function readMirror(id: string): Promise<{ version: number; answers: Answers } | null> {
  try {
    const d = await idb();
    return await new Promise((res) => { const r = d.transaction("a").objectStore("a").get(id); r.onsuccess = () => res(r.result ?? null); r.onerror = () => res(null); });
  } catch { return null; }
}

export type SaveState = "saved" | "saving" | "offline" | "other_window" | "closed";

export function useAttempt(id: string, autosaveSeconds = 10) {
  const [view, setView] = useState<AttemptView | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [save, setSave] = useState<SaveState>("saved");
  const [error, setError] = useState<string | null>(null);
  const offset = useRef(0); // serverNow − clientNow
  const ans = useRef<Answers>({});
  const version = useRef(0);
  const dirty = useRef(false);
  const savedVersion = useRef(0);
  const typingTimer = useRef<number>();
  const inFlight = useRef(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const v = await api<AttemptView>(`/attempts/${id}?clientId=${encodeURIComponent(clientId)}`);
        if (!alive) return;
        offset.current = new Date(v.serverNow).getTime() - Date.now();
        let a = v.answers;
        let ver = v.version;
        // a newer local copy (e.g. typed while offline) wins and is flushed
        const local = await readMirror(id);
        if (local && local.version > v.version && v.status === "active") { a = local.answers; ver = local.version; dirty.current = true; }
        ans.current = a; version.current = ver; savedVersion.current = v.version;
        setAnswers(a);
        setView(v);
        if (v.status !== "active") setSave("closed");
      } catch (e) { setError((e as ApiError).code ?? "error"); }
    })();
    return () => { alive = false; };
  }, [id]);

  const flush = useCallback(async () => {
    if (!dirty.current || inFlight.current || save === "other_window" || save === "closed") return;
    inFlight.current = true;
    setSave("saving");
    const v = version.current;
    try {
      await api(`/attempts/${id}/autosave`, { method: "PUT", body: { version: v, clientId, answers: ans.current } });
      savedVersion.current = v;
      if (version.current === v) dirty.current = false;
      setSave("saved");
    } catch (e) {
      const code = (e as ApiError).code;
      if (code === "other_window") setSave("other_window");
      else if (code === "deadline_passed" || code === "submitted") setSave("closed");
      else if (code === "stale_version") { version.current = savedVersion.current + 1; setSave("saving"); }
      else setSave("offline");
    } finally { inFlight.current = false; }
  }, [id, save]);

  const update = useCallback((partId: string, patch: { field?: [string, string]; done?: boolean }) => {
    const cur = ans.current[partId] ?? { fields: {}, done: false };
    const next = { ...cur, fields: patch.field ? { ...cur.fields, [patch.field[0]]: patch.field[1] } : cur.fields, done: patch.done ?? cur.done };
    if (patch.field && cur.fields[patch.field[0]] === patch.field[1] && patch.done === undefined) return;
    ans.current = { ...ans.current, [partId]: next };
    version.current += 1;
    dirty.current = true;
    setAnswers(ans.current);
    mirror(id, { version: version.current, answers: ans.current });
    window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(flush, 2000); // 2 s after typing stops
  }, [id, flush]);

  // every 10 s, on reconnect, and a beacon on pagehide
  useEffect(() => {
    const iv = window.setInterval(flush, autosaveSeconds * 1000);
    const online = () => flush();
    const hide = () => {
      if (!dirty.current) return;
      const body = JSON.stringify({ version: version.current, clientId, answers: ans.current });
      navigator.sendBeacon?.(`/api/attempts/${id}/autosave`, new Blob([body], { type: "text/plain" }));
    };
    window.addEventListener("online", online);
    window.addEventListener("pagehide", hide);
    return () => { window.clearInterval(iv); window.removeEventListener("online", online); window.removeEventListener("pagehide", hide); };
  }, [flush, id, autosaveSeconds]);

  // the other window check: an older tab learns it lost control within one autosave period
  useEffect(() => {
    if (!view || view.status !== "active") return;
    const iv = window.setInterval(async () => {
      try {
        const c = await api<{ status: string; activeClientId: string | null }>(`/attempts/${id}/clock`);
        if (c.status !== "active") setSave("closed");
        else if (c.activeClientId && c.activeClientId !== clientId) setSave("other_window");
      } catch { /* offline */ }
    }, autosaveSeconds * 1000);
    return () => window.clearInterval(iv);
  }, [view, id]);

  const submit = useCallback(async () => {
    window.clearTimeout(typingTimer.current);
    const body = { version: version.current + 1, clientId, answers: ans.current };
    const r = await api<{ ok: boolean; score: number }>(`/attempts/${id}/submit`, { body });
    setSave("closed");
    return r;
  }, [id]);

  const now = () => Date.now() + offset.current;
  return { view, answers, update, save, error, submit, now, flush };
}
