import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { lineById, useLines, type Progress } from "../lib/queries";
import { sfx } from "../lib/sfx";
import { t, tList } from "../lib/strings";
import type { Line } from "../lib/voice";
import { Coin, Header, Page, PageTitle } from "../components/Layout";
import { SahayikaPanel } from "../components/Sahayika";
import { Ambient, Burst, CountUp, GameButton } from "../components/Juice";
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
      <span className="absolute right-4 top-3 text-primary pointer-events-none">▾</span>
      <AnimatePresence>
        {open && (
          <motion.ul id="office-list" role="listbox" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto rounded-xl bg-white border border-gray-200 shadow-pop">
            {items.length === 0 && <li className="px-4 py-3 text-muted">{t("registration.officeNone")}</li>}
            {items.map((o, i) => (
              <li key={o.id} role="option" aria-selected={i === hi} onMouseDown={(e) => { e.preventDefault(); pick(o); }}
                className={`px-4 py-2.5 cursor-pointer ${i === hi ? "bg-royal-soft" : "hover:bg-gray-50"}`}>
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
          <motion.span animate={{ scale: i === at ? 1.12 : 1 }} className={`w-8 h-8 shrink-0 rounded-full grid place-items-center text-sm font-extrabold border-2 ${i < at ? "bg-success border-success text-white" : i === at ? "bg-primary border-primary text-white shadow-glow" : "bg-white border-gray-200 text-muted"}`}>
            {i < at ? "✓" : i + 1}
          </motion.span>
          <span className={`text-sm font-semibold ${i === at ? "text-navy" : "text-muted"}`}>{s}</span>
          {i < steps.length - 1 && <span className={`flex-1 h-1 rounded-full ${i < at ? "bg-success" : "bg-gray-200"}`} />}
        </li>
      ))}
    </ol>
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
  const [returning, setReturning] = useState(false);
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
              <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-primary via-amber-400 to-royal-bright" />
              <Steps at={3} />
              <motion.div animate={{ rotateY: [0, 360] }} transition={{ duration: 1.2, delay: 0.3 }} className="mx-auto w-24 h-24 grid place-items-center"><Coin size={96} /></motion.div>
              <h2 className="mt-4 text-3xl font-extrabold text-primary">{t("registration.unlocked")}</h2>
              <p className="mt-1 text-muted">{t("registration.unlockedSub")}</p>
              <div className="mt-4 text-5xl font-extrabold text-amber-600">+<CountUp to={2} /> <span className="text-2xl">{t("common.credits")}</span></div>
              <div className="mt-5"><SahayikaPanel lines={[doneLine]} /></div>
              <GameButton className="mt-6 w-full" sound="whoosh" onClick={() => nav("/how-to-play")}>{t("common.continue")} →</GameButton>
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
        <PageTitle hi={t("registration.heading")} kicker={t("registration.headingEn")} right={<span className="chip-credit text-base"><Coin size={16} /> {t("registration.creditBadge")}</span>} />
        <div className="grid lg:grid-cols-[1.35fr_1fr] gap-6">
          <motion.form initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-5 sm:p-7" noValidate
            onSubmit={(e) => { e.preventDefault(); if (step === "form" && validate()) sendOtp(); if (step === "otp") verify(); }}>
            <Steps at={step === "form" ? 0 : 1} />
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-2xl font-bold">{t("registration.formHeading")}</h2>
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
                  <span className="inline-flex items-center rounded-l-xl border-2 border-r-0 border-gray-200 bg-gray-50 px-3 text-muted">+91</span>
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
                  className="mt-5 rounded-card bg-royal-soft border border-blue-200 p-4 overflow-hidden">
                  <div className="font-semibold text-royal-deep">✉️ {t("registration.otpSent")}</div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <label className="sr-only" htmlFor="otp">{t("registration.otpLabel")}</label>
                    <input id="otp" ref={otpRef} className="input max-w-[12rem] text-center text-2xl tracking-[0.5em]" inputMode="numeric" autoComplete="one-time-code"
                      maxLength={6} value={otp} placeholder="••••••" onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} />
                    <GameButton type="submit" variant="blue" disabled={otp.length !== 6 || busy}>{t("registration.otpVerify")}</GameButton>
                    <button type="button" className="text-sm font-semibold text-royal underline" onClick={sendOtp} disabled={busy}>{t("registration.resend")}</button>
                    <button type="button" className="text-sm font-semibold text-muted underline" onClick={() => { setStep("form"); setOtp(""); }}>{t("registration.changeEmail")}</button>
                  </div>
                  {devCode && <div className="mt-2 text-sm text-muted">{t("registration.devCode", { code: devCode })}</div>}
                  {fieldErr("otp")}
                  <p className="mt-2 text-sm text-royal-deep/80">{t("registration.welcomeBack")}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {step === "form" && (
              <div className="mt-6 flex flex-wrap items-center gap-4">
                <GameButton type="submit" disabled={busy}>{t("registration.submit")} <span aria-hidden>→</span></GameButton>
                <span className="text-sm text-muted">{t("registration.submitNote")}</span>
                <button type="button" className="text-sm font-semibold text-royal underline" onClick={() => { setReturning(!returning); setErrors({}); }}>
                  {returning ? t("registration.newLink") : t("registration.returningLink")}
                </button>
              </div>
            )}
            <p className="mt-4 text-sm text-muted">🔒 {t("registration.privacyNote")}</p>
          </motion.form>

          <SahayikaPanel lines={[openLine]}>
            <motion.div whileHover={{ scale: 1.03, rotate: -1 }} className="mt-auto rounded-card bg-gradient-to-br from-primary to-amber-500 text-white text-center py-7 shadow-glow relative overflow-hidden">
              <motion.div className="absolute -left-10 top-0 h-full w-20 bg-white/25 skew-x-12" animate={{ x: [0, 600] }} transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.6 }} />
              <div className="flex items-center justify-center gap-3 text-4xl font-extrabold relative"><Coin size={44} /> {t("registration.bigCredit")}</div>
            </motion.div>
            <div className="text-center text-sm text-blue-100">{t("common.officersOnly")}</div>
          </SahayikaPanel>
        </div>
      </Page>
    </>
  );
}
