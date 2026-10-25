import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";

/** Set by the workbench "Full Screen" toggle just before the player deliberately leaves fullscreen, so that is not counted as leaving. */
export const fullscreenExit = { until: 0 };

export type LeaveKind = "left_tab" | "left_fullscreen" | "left_blur";

/**
 * Freeze screen (§12) from start to submit: block copy/cut/paste/drop/right-click everywhere
 * in the round, and count each departure (tab hidden, window blur, fullscreen exit) once,
 * with a 2 s debounce, reporting it to the server.
 */
export function useFairPlay(attemptId: string | null, active: boolean, onBlocked: () => void, initialLeft = 0) {
  const [left, setLeft] = useState<{ kind: LeaveKind; count: number } | null>(null);
  const [count, setCount] = useState(initialLeft);
  const last = useRef(0);
  const away = useRef<LeaveKind | null>(null);
  const blocked = useRef(onBlocked);
  blocked.current = onBlocked;

  useEffect(() => setCount(initialLeft), [initialLeft]);

  useEffect(() => {
    if (!active || !attemptId) return;
    const depart = (kind: LeaveKind) => {
      const now = Date.now();
      if (now - last.current < 2000 || away.current) return;
      last.current = now;
      away.current = kind;
      api<{ leftPageCount: number }>(`/attempts/${attemptId}/events`, { body: { type: kind } })
        .then((r) => setCount(r.leftPageCount)).catch(() => setCount((c) => c + 1));
    };
    const back = () => {
      if (!away.current) return;
      const kind = away.current;
      away.current = null;
      setLeft({ kind, count: 0 });
    };
    const vis = () => (document.visibilityState === "hidden" ? depart("left_tab") : back());
    const blur = () => { if (window.matchMedia("(pointer: fine)").matches) depart("left_blur"); };
    const focus = () => back();
    const fs = () => { if (Date.now() < fullscreenExit.until) return; if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) { depart("left_fullscreen"); setTimeout(back, 50); } };
    const stop = (e: Event) => { e.preventDefault(); blocked.current(); };
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ["c", "v", "x", "a"].includes(e.key.toLowerCase()) && !(e.target as HTMLElement)?.closest?.("[data-allow-select]")) {
        if (e.key.toLowerCase() !== "a") { e.preventDefault(); blocked.current(); }
      }
    };
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("blur", blur);
    window.addEventListener("focus", focus);
    document.addEventListener("fullscreenchange", fs);
    document.addEventListener("webkitfullscreenchange", fs);
    for (const ev of ["copy", "cut", "paste", "drop", "contextmenu"]) document.addEventListener(ev, stop, true);
    const drag = (e: Event) => e.preventDefault();
    document.addEventListener("dragstart", drag, true);
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("visibilitychange", vis);
      window.removeEventListener("blur", blur);
      window.removeEventListener("focus", focus);
      document.removeEventListener("fullscreenchange", fs);
      document.removeEventListener("webkitfullscreenchange", fs);
      for (const ev of ["copy", "cut", "paste", "drop", "contextmenu"]) document.removeEventListener(ev, stop, true);
      document.removeEventListener("keydown", key, true);
      document.removeEventListener("dragstart", drag, true);
    };
  }, [active, attemptId]);

  return { left, count, dismiss: () => setLeft(null) };
}
