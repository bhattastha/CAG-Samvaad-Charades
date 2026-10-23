import { useNavigate } from "react-router-dom";
import cagLogo from "@assets/brand/cag-logo.png";
import bhashiniLogo from "@assets/brand/bhashini-logo.png";
import { useProgress } from "../lib/queries";
import { usePrefs } from "../lib/store";
import { t } from "../lib/strings";
import { routeFor } from "./flow";

/** §7.1 Title — design 01. */
export function Title() {
  const nav = useNavigate();
  const { data } = useProgress();
  const unlock = usePrefs((s) => s.unlockAudio);
  const start = () => {
    unlock(); // first tap: Sahayika may speak from now on (§15.9)
    nav(data?.registered ? routeFor(data) : "/register");
  };
  const tagline = t("title.tagline").split("·").map((s) => s.trim());
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <section className="relative flex flex-col px-6 sm:px-12 lg:px-16 py-8 bg-white/80">
        <img src={cagLogo} alt="CAG" className="h-16 w-auto self-start rounded-lg border border-gray-100 bg-white p-1 shadow-sm" />
        <div className="my-auto py-10 animate-rise">
          <span className="chip bg-primary-soft border-orange-200 text-primary-strong en tracking-[0.25em] text-xs">{t("common.brandLine")}</span>
          <h1 className="mt-5 font-bold leading-[1.05]">
            <span className="block text-6xl sm:text-7xl text-navy">{t("title.heading").split(" ")[0]}</span>
            <span className="block text-6xl sm:text-7xl text-primary mt-1">{t("title.heading").split(" ").slice(1).join(" ")}</span>
          </h1>
          <div className="en mt-3 tracking-[0.45em] text-sm font-semibold text-muted">{t("title.subheadingEn")}</div>
          <p className="mt-6 text-xl sm:text-2xl text-navy/90 leading-relaxed">{tagline.map((l) => <span key={l} className="block">{l}</span>)}</p>
          <button onClick={start} className="btn-primary mt-8 px-10 py-4 text-xl animate-breathe hover:animate-none">
            {t("title.start")} <span aria-hidden>→</span>
          </button>
        </div>
      </section>
      <section className="relative overflow-hidden bg-gradient-to-br from-cream via-[#FFF7F0] to-royal-soft flex flex-col items-center justify-center py-16">
        <img src={bhashiniLogo} alt="BHASHINI" className="absolute top-8 right-8 h-16 w-auto rounded-lg border border-gray-100 bg-white p-1 shadow-sm" />
        {[520, 420, 320, 220].map((d, i) => (
          <div key={d} className="absolute rounded-full border border-orange-200/70" style={{ width: d, height: d, opacity: 0.4 + i * 0.12 }} />
        ))}
        <div className="relative flex items-center animate-float">
          <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-full bg-navy text-white grid place-items-center en text-7xl sm:text-8xl font-bold shadow-pop ring-8 ring-white">A</div>
          <div className="-ml-10 mt-16 w-40 h-40 sm:w-48 sm:h-48 rounded-full bg-primary text-white grid place-items-center text-7xl sm:text-8xl font-bold shadow-glow ring-8 ring-white">अ</div>
        </div>
        <div className="relative mt-8 text-xl font-bold text-navy">{t("title.artCaption")}</div>
      </section>
    </div>
  );
}
