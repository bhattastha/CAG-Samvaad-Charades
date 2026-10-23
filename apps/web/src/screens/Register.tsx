import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { lineById, useLines, type Progress } from "../lib/queries";
import { t } from "../lib/strings";
import { Confetti, Header, Page, PageTitle } from "../components/Layout";
import { SahayikaPanel } from "../components/Sahayika";
import type { Line } from "../lib/voice";
import { routeFor } from "./flow";

interface Office { id: string; name: string; nameEn: string; city: string; state: string; address: string }

function OfficeCombo({ value, onPick, error }: { value: Office | null; onPick(o: Office): void; error?: string }) {
  const [q, setQ] = useState(value?.name ?? "");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Office[]>([]);
  const [hi, setHi] = useState(0);
  useEffect(() => {
    if (!open) return;
    const ctl = new AbortController();
    const tm = setTimeout(() => api<Office[]>(`/offices?q=${encodeURIComponent(q)}`, { signal: ctl.signal }).then((r) => { setItems(r); setHi(0); }).catch(() => {}), 150);
    return () => { clearTimeout(tm); ctl.abort(); };
  }, [q, open]);
  const pick = (o: Office) => { onPick(o); setQ(o.name); setOpen(false); };
  return (
    <div className="relative">
      <input
        id="office" className="input pr-10" role="combobox" aria-expanded={open} aria-controls="office-list" aria-autocomplete="list"
        value={q} placeholder={t("registration.officeSearch")} autoComplete="off"
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { setHi((h) => Math.min(items.length - 1, h + 1)); e.preventDefault(); }
          if (e.key === "ArrowUp") { setHi((h) => Math.max(0, h - 1)); e.preventDefault(); }
          if (e.key === "Enter" && open && items[hi]) { pick(items[hi]); e.preventDefault(); }
        }}
      />
      <span className="absolute right-4 top-3 text-primary pointer-events-none">▾</span>
      {open && (
        <ul id="office-list" role="listbox" className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto rounded-xl bg-white border border-gray-200 shadow-pop">
          {items.length === 0 && <li className="px-4 py-3 text-muted">{t("registration.officeNone")}</li>}
          {items.map((o, i) => (
            <li key={o.id} role="option" aria-selected={i === hi} onMouseDown={(e) => { e.preventDefault(); pick(o); }}
              className={`px-4 py-2.5 cursor-pointer ${i === hi ? "bg-royal-soft" : "hover:bg-gray-50"}`}>
              <div className="text-[15px] font-semibold en">{o.name}</div>
              <div className="text-xs text-muted en">{o.city}, {o.state}</div>
            </li>
          ))}
        </ul>
      )}
      {error && <div className="err">{error}</div>}
    </div>
  );
}

/** §7.2 Registration — design 02. Form → email OTP → +2 credits → how to play. */
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
    if (returning) {
      if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = t("registration.errEmail");
      setErrors(e);
      return !Object.keys(e).length;
    }
    if (f.name.trim().length < 2) e.name = t("registration.errName");
    if (!/^[6-9]\d{9}$/.test(f.mobile)) e.mobile = t("registration.errMobile");
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = t("registration.errEmail");
    if (!office) e.office = t("registration.errOffice");
    if (address.trim().length < 5) e.address = t("registration.errAddress");
    setErrors(e);
    return !Object.keys(e).length;
  };

  const sendOtp = async () => {
    setBusy(true);
    try {
      const r = await api<{ devCode?: string }>("/auth/otp/request", { body: { email: f.email.trim() } });
      setDevCode(r.devCode ?? null);
      setStep("otp");
      setTimeout(() => otpRef.current?.focus(), 50);
    } catch (e) {
      const code = (e as ApiError).code;
      setErrors({ email: code === "otp_rate" ? t("registration.errOtpRate") : code === "email_domain" ? t("registration.errDomain") : t("ui.error") });
    } finally { setBusy(false); }
  };

  const verify = async () => {
    setBusy(true);
    try {
      const v = await api<{ status: "new" | "existing" }>("/auth/otp/verify", { body: { email: f.email.trim(), code: otp } });
      if (v.status === "existing") {
        await qc.invalidateQueries();
        const p = await qc.fetchQuery({ queryKey: ["progress"], queryFn: () => api<Progress>("/me/progress") });
        nav(routeFor(p));
        return;
      }
      if (returning || !office) { setReturning(false); setStep("form"); setOtp(""); return; }
      const r = await api<{ line: Line }>("/players/register", { body: { name: f.name.trim(), mobile: f.mobile, officeId: office!.id, officeAddress: address.trim() } });
      setDoneLine(r.line);
      setStep("done");
      await qc.invalidateQueries();
      setTimeout(() => nav("/how-to-play"), 3200);
    } catch (e) {
      setErrors({ otp: (e as ApiError).code === "otp_invalid" ? t("registration.errOtp") : t("ui.error") });
    } finally { setBusy(false); }
  };

  const openLine = lineById(lines, "before_game.screen.registration_open");
  const sideLines = useMemo(() => (doneLine ? [doneLine] : [openLine]), [doneLine, openLine]);
  const fieldErr = (k: string) => errors[k] && <div className="err" role="alert">{errors[k]}</div>;

  return (
    <>
      <Header />
      <Confetti run={step === "done"} />
      <Page>
        <PageTitle hi={t("registration.heading")} en="Registration" right={<span className="chip-credit text-base">{t("registration.creditBadge")}</span>} />
        <div className="grid lg:grid-cols-[1.35fr_1fr] gap-6">
          <form className="card p-5 sm:p-7 animate-rise" noValidate onSubmit={(e) => { e.preventDefault(); if (step === "form" && validate()) sendOtp(); if (step === "otp") verify(); }}>
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-2xl font-bold">{t("registration.formHeading")}</h2>
              <span className="text-sm text-muted">{t("registration.required")}</span>
            </div>
            <fieldset disabled={step !== "form"} className="grid sm:grid-cols-2 gap-x-5 gap-y-4">
              <div className={returning ? "hidden" : ""}>
                <label className="label" htmlFor="name">{t("registration.name")} *</label>
                <input id="name" className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" />
                {fieldErr("name")}
              </div>
              <div className={returning ? "hidden" : ""}>
                <label className="label" htmlFor="mobile">{t("registration.mobile")} *</label>
                <div className="flex">
                  <span className="en inline-flex items-center rounded-l-xl border-2 border-r-0 border-gray-200 bg-gray-50 px-3 text-[17px] text-muted">+91</span>
                  <input id="mobile" className="input rounded-l-none en tracking-wider" inputMode="numeric" maxLength={10} value={f.mobile}
                    onChange={(e) => setF({ ...f, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })} autoComplete="tel-national" />
                </div>
                {fieldErr("mobile")}
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="email">{t("registration.email")} *</label>
                <input id="email" type="email" className="input en" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" />
                {fieldErr("email")}
              </div>
              <div className={`sm:col-span-2 ${returning ? "hidden" : ""}`}>
                <label className="label" htmlFor="office">{t("registration.office")} *</label>
                <OfficeCombo value={office} error={errors.office} onPick={(o) => { setOffice(o); if (!addressEdited) setAddress(o.address); }} />
              </div>
              <div className={`sm:col-span-2 ${returning ? "hidden" : ""}`}>
                <label className="label" htmlFor="address">
                  {t("registration.officeAddress")} * {addressEdited && <span className="ml-1 rounded bg-primary-soft px-1.5 text-xs font-bold text-primary-strong">{t("registration.newBadge")}</span>}
                </label>
                <textarea id="address" rows={2} className="input" value={address} onChange={(e) => { setAddress(e.target.value); setAddressEdited(true); }} />
                {fieldErr("address")}
              </div>
            </fieldset>

            {step === "otp" && (
              <div className="mt-5 rounded-card bg-royal-soft border border-blue-200 p-4 animate-pop">
                <div className="font-semibold text-royal-deep">{t("registration.otpSent")}</div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <label className="sr-only" htmlFor="otp">{t("registration.otpLabel")}</label>
                  <input id="otp" ref={otpRef} className="input en max-w-[12rem] text-center text-2xl tracking-[0.5em]" inputMode="numeric" autoComplete="one-time-code"
                    maxLength={6} value={otp} placeholder="••••••" onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} />
                  <button type="submit" className="btn-blue" disabled={otp.length !== 6 || busy}>{t("registration.otpVerify")}</button>
                  <button type="button" className="text-sm font-semibold text-royal underline" onClick={sendOtp} disabled={busy}>{t("registration.resend")}</button>
                  <button type="button" className="text-sm font-semibold text-muted underline" onClick={() => { setStep("form"); setOtp(""); }}>{t("registration.changeEmail")}</button>
                </div>
                {devCode && <div className="mt-2 text-sm text-muted">{t("registration.devCode", { code: devCode })}</div>}
                {fieldErr("otp")}
                <p className="mt-2 text-sm text-royal-deep/80">{t("registration.welcomeBack")}</p>
              </div>
            )}

            {step === "form" && (
              <div className="mt-6 flex flex-wrap items-center gap-4">
                <button type="submit" className="btn-primary" disabled={busy}>{t("registration.submit")} <span aria-hidden>→</span></button>
                <span className="text-sm text-muted">{t("registration.submitNote")}</span>
                <button type="button" className="text-sm font-semibold text-royal underline" onClick={() => { setReturning(!returning); setErrors({}); }}>
                  {returning ? t("registration.newLink") : t("registration.returningLink")}
                </button>
              </div>
            )}
            <p className="mt-4 text-sm text-muted">🔒 {t("registration.privacyNote")}</p>
          </form>

          <SahayikaPanel lines={sideLines}>
            <div className={`mt-auto rounded-card bg-primary text-white text-center py-7 shadow-glow ${step === "done" ? "animate-pop" : ""}`}>
              <div className="text-4xl font-bold">{t("registration.bigCredit")}</div>
            </div>
            <div className="text-center text-sm text-blue-100">{t("common.officersOnly")}</div>
          </SahayikaPanel>
        </div>
      </Page>
    </>
  );
}
