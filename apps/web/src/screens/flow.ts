import type { Progress } from "../lib/queries";

/** §10.6: active attempt → resume; new player → training; else the journey map (next playable level highlighted). */
export function routeFor(p: Progress): string {
  if (!p.registered) return "/register";
  if (p.next?.action === "resume" && p.activeAttempt) return `/round/${p.activeAttempt.id}`;
  const played = p.summary?.rounds.some((r) => r.chancesUsed > 0);
  return played ? "/journey" : "/how-to-play";
}
