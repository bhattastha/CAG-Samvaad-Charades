import type { Progress } from "../lib/queries";

/** §10.6: active attempt → resume; else the next playable round's pop-up; else total score. */
export function routeFor(p: Progress): string {
  if (!p.registered) return "/register";
  if (p.next?.action === "resume" && p.activeAttempt) return `/round/${p.activeAttempt.id}`;
  if (p.next?.action === "preround" && p.next.roundKey) {
    // a brand-new player meets how-to-play first
    const played = p.summary?.rounds.some((r) => r.chancesUsed > 0);
    return played ? `/play/${p.next.roundKey}` : "/how-to-play";
  }
  return "/total";
}
