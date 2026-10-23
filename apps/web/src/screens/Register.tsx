import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { lineById, useConfig, useLines, type Progress } from "../lib/queries";
import { sfx } from "../lib/sfx";
import { t, tList } from "../lib/strings";
import type { Line } from "../lib/voice";
import { Avatar, Coin, Header, Page, PageTitle } from "../components/Layout";
import { Icon } from "../components/Icon";
import { SahayikaPanel } from "../components/Sahayika";
import { Ambient, Burst, CountUp, GameButton, Medal } from "../components/Juice";
import { routeFor } from "./flow";

interface Office { id: string; name: string; nameEn: string; city: string; state: string; address: string }

function OfficeCombo({ value, onPick, error }: { value: Office | null; onPick(o: Office): void; error?: string }) {
  const [q, setQ] = useState(value?.nameEn ?? "");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Office[]>([]);
  const [hi, setHi] = useState(0);
  useEffect(() => {
    if (!open) return;
    const ctl = new AbortController();
    const tm = setTimeout(() => api<Office[]>(`/offices?q=${encodeURIComponent(q)}`, { signal: ctl.signal }).then((r) => { setItems(r); setHi(0); }).catch(() => {}), 150);
    return () => { clearTimeout(tm); ctl.abort(); };
  }, [q, open]);
  const pick = (o: Office) => { onPick(o); setQ(o.nameEn); setOpen(false); sfx("pop"); };
  return (
    <div className="relative">
      <input id="office" className="input pr-10" role="combobox" aria-expanded={open} aria-controls="office-list" aria-autocomplete="list"
        value={q} placeholder={t("registration.officeSearch")} autoComplete="off"
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { setHi((h) => Math.min(items.length - 1, h + 1)); e.preventDefault(); }
          if (e.key === "ArrowUp") { setHi((h) => Math.max(0, h - 1)); e.preventDefault(); }
          if (e.key === "Enter" && open && items[hi]) { pick(items[hi]); e.preventDefault(); }
        }} />
      <Icon name="chevronDown" size={18} className="absolute right-3 top-3 text-muted pointer-events-none" />
      <AnimatePresence>
        {open && (
          <motion.ul id="office-list" role="listbox" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto rounded-ui bg-white border border-slate-200 shadow-pop">
            {items.length === 0 && <li className="px-4 py-3 text-muted">{t("registration.officeNone")}</li>}
            {items.map((o, i) => (
              <li key={o.id} role="option" aria-selected={i === hi} onMouseDown={(e) => { e.preventDefault(); pick(o); }}
                className={`px-4 py-2.5 cursor-pointer ${i === hi ? "bg-navy-50" : "hover:bg-slate-50"}`}>
                <div className="text-[0.95rem] font-semibold">{o.nameEn}</div>
                <div className="text-xs text-muted">{o.city}, {o.state}</div>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
      {error && <div className="err">{error}</div>}
    </div>
  );
}

function Steps({ at }: { at: number }) {
  const steps = tList("registration.steps");
  return (
    <ol className="flex items-center gap-2 mb-5" aria-label="progress">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-2 flex-1">
          <motion.span animate={{ scale: i === at ? 1.06 : 1 }} className={`w-7 h-7 shrink-0 rounded-md grid place-items-center text-[13px] font-bold border ${i < at ? "bg-success border-success text-white" : i === at ? "bg-navy border-navy text-white" : "bg-white border-slate-300 text-muted"}`}>
            {i < at ? <Icon name="check" size={15} stroke={2.4} /> : i + 1}
          </motion.span>
          <span className={`text-[13px] font-bold uppercase tracking-[0.12em] ${i === at ? "text-navy" : "text-muted"}`}>{s}</span>
          {i < steps.length - 1 && <span className={`flex-1 h-[2px] ${i < at ? "bg-success" : "bg-slate-200"}`} />}
        </li>
      ))}
    </ol>
  );
}

/** Live player card: fills in as the officer types, so registering feels like creating a game character. */
function PlayerCard({ name, office, credits, verified }: { name: string; office: string; credits: number; verified: boolean }) {
  return (
    <div className="card-dark hud-grid p-5 relative overflow-hidden" data-testid="player-card">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-primary via-gold to-transparent" aria-hidden />
      <div className="flex items-center justify-between">
        <span className="kicker !text-gold-light">{t("registration.cardKicker")}</span>
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-100/70">{verified ? t("registration.cardVerifying") : t("registration.cardDraft")}</span>
      </div>
      <div className="mt-4 flex items-center gap-4">
        <Avatar name={name || "?"} size={64} />
        <div className="min-w-0">
          <div className="text-xl font-extrabold truncate">{name.trim() || t("registration.cardName")}</div>
          <div className="text-sm text-blue-100/80 truncate">{office || t("registration.cardOffice")}</div>
          <div className="mt-1.5 inline-flex items-center gap-1.5 rounded bg-white/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.14em] text-gold-light">
            <Icon name="shield" size={12} /> {t("registration.cardRank")}
          </div>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2 text-center">
        {[[t("registration.cardCredits"), <span key="c" className="inline-flex items-center gap-1"><Coin size={16} />+{credits}</span>], [t("registration.cardTitles"), "0 / 4"], [t("registration.cardLevels"), "5"]].map(([k, v], i) => (
          <div key={i} className="rounded-ui bg-white/[0.06] border border-white/10 py-2">
            <div className="text-lg font-extrabold tnum text-white">{v}</div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-blue-100/70">{k}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** What's on the table: joining bonus, then each level's credits and title. */
function RewardTrack() {
  const { data: cfg } = useConfig();
  return (
    <div className="card p-4">
      <div className="kicker mb-3">{t("registration.trackHeading")}</div>
      <ol className="space-y-2">
        <li className="flex items-center gap-3 rounded-ui bg-gold-soft border border-gold-light px-3 py-2">
          <span className="w-9 h-9 rounded-md bg-gold text-white grid place-items-center"><Icon name="gift" size={18} /></span>
          <span className="flex-1 text-sm font-semibold text-navy">{t("registration.trackJoin")}</span>
          <span className="font-bold text-gold-deep tnum">+{cfg?.registration?.credits ?? 2}</span>
        </li>
        {cfg?.rounds.filter((r) => r.playable !== false).map((r) => (
          <li key={r.key} className="flex items-center gap-3 px-3 py-1.5">
            <Medal k={r.key} size={36} />
            <span className="flex-1 text-sm"><span className="font-semibold text-navy">{r.nameEn}</span> <span className="text-muted">· {r.titleEn}</span></span>
            <span className="font-bold text-navy tnum text-sm">+{r.creditCap}</span>
          </li>
        ))}
      </ol>
      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
        <span className="text-muted">{t("registration.trackTotal")}</span>
        <span className="font-extrabold text-navy tnum">{cfg?.maxCredits ?? 50} {t("common.credits")}</span>
      </div>
    </div>
  );
}

/** §7.2 Registration — design 02, as "create your player profile". */
export function Register() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: lines } = useLines("before_game");
  const [f, setF] = useState({ name: "", mobile: "", email: "" });
  const [office, setOffice] = useState<Office | null>(null);
  const [address, setAddress] = useState("");
  const [addressEdited, setAddressEdited] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState<"form" | "otp" | "done">("form");
  const [otp, setOtp] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [params] = useSearchParams();
  const [returning, setReturning] = useState(params.get("returning") === "1");
  const { data: cfg } = useConfig();
  const [doneLine, setDoneLine] = useState<Line | null>(null);
  const otpRef = useRef<HTMLInputElement>(null);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = t("registration.errEmail");
    if (!returning) {
      if (f.name.trim().length < 2) e.name = t("registration.errName");
      if (!/^[6-9]\d{9}$/.test(f.mobile)) e.mobile = t("registration.errMobile");
      if (!office) e.office = t("registration.errOffice");
      if (address.trim().length < 5) e.address = t("registration.errAddress");
    }
    setErrors(e);
    if (Object.keys(e).length) sfx("error");
    return !Object.keys(e).length;
  };

  const sendOtp = async () => {
    setBusy(true);
    try {
      const r = await api<{ devCode?: string }>("/auth/otp/request", { body: { email: f.email.trim() } });
      setDevCode(r.devCode ?? null);
      setStep("otp");
      sfx("pop");
      setTimeout(() => otpRef.current?.focus(), 80);
    } catch (e) {
      const code = (e as ApiError).code;
      sfx("error");
      setErrors({ email: code === "otp_rate" ? t("registration.errOtpRate") : code === "email_domain" ? t("registration.errDomain") : t("common.error") });
    } finally { setBusy(false); }
  };

  const verify = async () => {
    setBusy(true);
    try {
      const v = await api<{ status: "new" | "existing" }>("/auth/otp/verify", { body: { email: f.email.trim(), code: otp } });
      if (v.status === "existing") {
        sfx("success");
        await qc.invalidateQueries();
        const p = await qc.fetchQuery({ queryKey: ["progress"], queryFn: () => api<Progress>("/me/progress") });
        nav(routeFor(p));
        return;
      }
      if (returning || !office) { setReturning(false); setStep("form"); setOtp(""); return; }
      const r = await api<{ line: Line }>("/players/register", { body: { name: f.name.trim(), mobile: f.mobile, officeId: office.id, officeAddress: address.trim() } });
      setDoneLine(r.line);
      setStep("done");
      sfx("fanfare");
      setTimeout(() => sfx("coin"), 900);
      await qc.invalidateQueries();
    } catch (e) {
      sfx("error");
      setErrors({ otp: (e as ApiError).code === "otp_invalid" ? t("registration.errOtp") : t("common.error") });
    } finally { setBusy(false); }
  };

  const openLine = lineById(lines, "before_game.screen.registration_open");
  const fieldErr = (k: string) => errors[k] && <motion.div initial={{ x: -6 }} animate={{ x: [6, -4, 2, 0] }} className="err" role="alert">{errors[k]}</motion.div>;
  const hidden = returning ? "hidden" : "";

  if (step === "done") {
    return (
      <>
        <Header />
        <Ambient />
        <Burst fire={1} count={40} spread={320} />
        <Page>
          <div className="flex justify-center pt-2 sm:pt-8">
            <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 160, damping: 14 }}
              className="card max-w-lg w-full p-8 text-center relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-primary via-gold to-navy-600" />
              <Steps at={3} />
              <motion.div animate={{ rotateY: [0, 360] }} transition={{ duration: 1.2, delay: 0.3 }} className="mx-auto w-24 h-24 grid place-items-center"><Coin size={96} /></motion.div>
              <div className="mt-4 kicker">{t("registration.unlockedKicker")}</div>
              <h2 className="mt-1 text-3xl font-extrabold text-navy tracking-tight">{t("registration.unlocked")}</h2>
              <p className="mt-1 text-muted">{t("registration.unlockedSub")}</p>
              <div className="mt-4 text-5xl font-extrabold text-gold-deep tnum">+<CountUp to={cfg?.registration?.credits ?? 2} /> <span className="text-2xl">{t("common.credits")}</span></div>
              <div className="mt-5"><SahayikaPanel lines={[doneLine]} /></div>
              <GameButton className="mt-6 w-full" sound="whoosh" onClick={() => nav("/how-to-play")}>{t("registration.toTraining")} <Icon name="arrowRight" size={18} /></GameButton>
            </motion.div>
          </div>
        </Page>
      </>
    );
  }

  return (
    <>
      <Header />
      <Page>
        <PageTitle hi={returning ? t("registration.headingReturning") : t("registration.heading")} kicker={t("registration.headingEn")} en={returning ? t("registration.subReturning") : t("registration.sub")} right={<span className="chip-credit text-sm"><Coin size={16} /> {t("registration.creditBadge")}</span>} />
        <div className="grid lg:grid-cols-[1.35fr_1fr] gap-6">
          <motion.form initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-5 sm:p-7" noValidate
            onSubmit={(e) => { e.preventDefault(); if (step === "form" && validate()) sendOtp(); if (step === "otp") verify(); }}>
            <Steps at={step === "form" ? 0 : 1} />
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-xl font-bold text-navy">{returning ? t("registration.formHeadingReturning") : t("registration.formHeading")}</h2>
              <span className="text-sm text-muted">{t("registration.required")}</span>
            </div>
            <fieldset disabled={step !== "form"} className="grid sm:grid-cols-2 gap-x-5 gap-y-4">
              <div className={hidden}>
                <label className="label" htmlFor="name">{t("registration.name")} *</label>
                <input id="name" className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" />
                {fieldErr("name")}
              </div>
              <div className={hidden}>
                <label className="label" htmlFor="mobile">{t("registration.mobile")} *</label>
                <div className="flex">
                  <span className="inline-flex items-center rounded-l-ui border border-r-0 border-slate-300 bg-slate-50 px-3 text-muted">+91</span>
                  <input id="mobile" className="input rounded-l-none tracking-wider" inputMode="numeric" maxLength={10} value={f.mobile}
                    onChange={(e) => setF({ ...f, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })} autoComplete="tel-national" />
                </div>
                {fieldErr("mobile")}
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="email">{t("registration.email")} *</label>
                <input id="email" type="email" className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" />
                {fieldErr("email")}
              </div>
              <div className={`sm:col-span-2 ${hidden}`}>
                <label className="label" htmlFor="office">{t("registration.office")} *</label>
                <OfficeCombo value={office} error={errors.office} onPick={(o) => { setOffice(o); if (!addressEdited) setAddress(o.address); }} />
              </div>
              <div className={`sm:col-span-2 ${hidden}`}>
                <label className="label" htmlFor="address">
                  {t("registration.officeAddress")} * {addressEdited && <span className="ml-1 rounded bg-primary-soft px-1.5 text-xs font-bold text-primary-strong">{t("registration.newBadge")}</span>}
                </label>
                <textarea id="address" rows={2} className="input" value={address} onChange={(e) => { setAddress(e.target.value); setAddressEdited(true); }} />
                {fieldErr("address")}
              </div>
            </fieldset>

            <AnimatePresence>
              {step === "otp" && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="mt-5 rounded-ui bg-navy-50 border border-slate-200 p-4 overflow-hidden">
                  <div className="font-semibold text-navy flex items-center gap-2"><Icon name="mail" size={18} /> {t("registration.otpSent")}</div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <label className="sr-only" htmlFor="otp">{t("registration.otpLabel")}</label>
                    <input id="otp" ref={otpRef} className="input max-w-[12rem] text-center text-2xl tracking-[0.5em]" inputMode="numeric" autoComplete="one-time-code"
                      maxLength={6} value={otp} placeholder="••••••" onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} />
                    <GameButton type="submit" variant="blue" disabled={otp.length !== 6 || busy}>{t("registration.otpVerify")}</GameButton>
                    <button type="button" className="text-sm font-semibold text-navy-600 underline" onClick={sendOtp} disabled={busy}>{t("registration.resend")}</button>
                    <button type="button" className="text-sm font-semibold text-muted underline" onClick={() => { setStep("form"); setOtp(""); }}>{t("registration.changeEmail")}</button>
                  </div>
                  {devCode && <div className="mt-2 text-sm text-muted">{t("registration.devCode", { code: devCode })}</div>}
                  {fieldErr("otp")}
                  <p className="mt-2 text-sm text-muted">{t("registration.welcomeBack")}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {step === "form" && (
              <div className="mt-6 flex flex-wrap items-center gap-4">
                <GameButton type="submit" disabled={busy}>{returning ? t("registration.signInSubmit") : t("registration.submit")} <Icon name="arrowRight" size={18} /></GameButton>
                <span className="text-sm text-muted">{t("registration.submitNote")}</span>
                <button type="button" className="text-sm font-semibold text-navy-600 underline" onClick={() => { setReturning(!returning); setErrors({}); }}>
                  {returning ? t("registration.newLink") : t("registration.returningLink")}
                </button>
              </div>
            )}
            <p className="mt-4 text-sm text-muted flex items-start gap-2"><Icon name="shield" size={16} className="mt-0.5" /> {t("registration.privacyNote")}</p>
          </motion.form>

          <div className="space-y-4">
            <PlayerCard name={f.name} office={office ? `${office.city}, ${office.state}` : ""} credits={cfg?.registration?.credits ?? 2} verified={step === "otp"} />
            <RewardTrack />
            <SahayikaPanel lines={[openLine]} />
          </div>
        </div>
      </Page>
    </>
  );
}
