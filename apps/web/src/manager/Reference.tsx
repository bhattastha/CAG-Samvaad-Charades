import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { Card, Dialog, Empty, Notice, PageHeader, Pill, btn, input, th, td, tr, useIsManager } from "./ui";

// ---------------- glossary ----------------
export function Glossary() {
  const qc = useQueryClient();
  const isManager = useIsManager();
  const [q, setQ] = useState("");
  const [flagged, setFlagged] = useState(false);
  const { data = [], isFetching } = useQuery({ queryKey: ["agl", q, flagged], queryFn: () => api<any[]>(`/admin/glossary?q=${encodeURIComponent(q)}&flagged=${flagged ? 1 : 0}`) });
  const [edit, setEdit] = useState<any | null>(null);
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [replace, setReplace] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const { data: stats } = useQuery({ queryKey: ["agl-stats"], queryFn: () => api<{ terms: number; variants: number; lastImport: any }>("/admin/glossary/stats") });
  const runImport = async () => {
    if (replace && !window.confirm("Replace the whole glossary with this file? Terms that are not in the file will be removed (manager overrides on kept terms stay).")) return;
    setBusy(true);
    try {
      const r = await api<any>("/admin/glossary/import", { body: { csv, mode: replace ? "replace" : "merge" } });
      setMsg(`Imported ${r.rows.toLocaleString("en-IN")} terms${r.mode === "replace" ? `, removed ${r.removed.toLocaleString("en-IN")} not in the file` : ""}. Players see them on their next page load.`);
      setCsv(""); setFileName("");
      qc.invalidateQueries({ queryKey: ["agl"] }); qc.invalidateQueries({ queryKey: ["agl-stats"] });
    } catch (e) { setMsg((e as ApiError).body?.message ?? (e as ApiError).code); } finally { setBusy(false); }
  };
  const toggleOverride = useMutation({
    mutationFn: (g: any) => api(`/admin/glossary/${g.id}`, { method: "PUT", body: { hi: g.hi, variants: g.accepted_variants, avoid: g.avoid_forms, override: { ...g.override, active: !(g.override.active !== false) } } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agl"] }),
  });
  return (
    <div>
      <PageHeader title="Glossary" subtitle={<>CAG standard glossary{stats ? <> · <b data-testid="glossary-total">{stats.terms.toLocaleString("en-IN")}</b> terms, {stats.variants.toLocaleString("en-IN")} alternative forms</> : ""}{stats?.lastImport ? ` · last import ${new Date(stats.lastImport.at).toLocaleString("en-IN")} by ${stats.lastImport.actor}` : ""}. Search shows up to 100 matches.</>} />
      <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
        <Card pad={false}>
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-3">
            <input className={`${input} max-w-md`} placeholder="Search English or Hindi" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search glossary" />
            <label className="flex items-center gap-1.5 whitespace-nowrap text-sm"><input type="checkbox" checked={flagged} onChange={(e) => setFlagged(e.target.checked)} /> Flagged / overrides queue</label>
            <span className="ml-auto text-xs text-slate-500">{isFetching ? "Searching…" : `${data.length} shown`}</span>
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50"><tr><th className={th}>English</th><th className={th}>Hindi</th><th className={th}>Accepted</th><th className={th}>Avoid</th><th className={th}>Flags / override</th><th className={th} /></tr></thead>
              <tbody>{data.map((g) => (
                <tr key={g.id} className={tr}>
                  <td className={`${td} font-semibold`}>{g.en}</td>
                  <td className={td} lang="hi">{g.override && g.override.active !== false ? <><s className="text-slate-400">{g.hi}</s> → <b>{g.override.hi}</b></> : g.hi}</td>
                  <td className={`${td} text-xs`} lang="hi">{g.accepted_variants.join(", ")}</td>
                  <td className={`${td} text-xs text-slate-500`} lang="hi">{g.avoid_forms.slice(0, 4).join(", ")}{g.avoid_forms.length > 4 && ` +${g.avoid_forms.length - 4}`}</td>
                  <td className={`${td} text-xs`}>
                    {g.flags.map((f: string) => <Pill key={f} tone="amber">{f}</Pill>)}
                    {g.override && <div className="mt-1 space-y-1"><Pill tone={g.override.active === false ? "slate" : "gold"}>{g.override.status}{g.override.active === false && " · reverted"}</Pill>
                      {isManager && <button className={`${btn.link} ml-2 text-xs`} onClick={() => toggleOverride.mutate(g)}>{g.override.active === false ? "Re-apply override" : "Revert to glossary"}</button>}
                      <div className="text-slate-500">{g.override.reason}</div></div>}
                  </td>
                  <td className={td}>{isManager && <button className={btn.ghost} onClick={() => setEdit(structuredClone(g))}>Edit</button>}</td>
                </tr>
              ))}</tbody>
            </table>
            {data.length === 0 && <div className="p-4"><Empty>No matches.</Empty></div>}
          </div>
        </Card>
        {isManager && (
          <Card title="Import glossary" subtitle="Upload the Anuvaad glossary export (Source term, Target term 1, Other target terms, Sector, Status). Target term 1 is the approved Hindi; every other target term is offered to players as an accepted option. The older english_term, hindi_term, accepted_variants format also works.">
            <textarea data-testid="glossary-import-text" className={`${input} font-mono text-xs`} rows={6} value={csv.length > 20000 ? `${csv.slice(0, 2000)}\n… (${csv.split("\n").length.toLocaleString("en-IN")} lines loaded from ${fileName || "file"})` : csv} readOnly={csv.length > 20000} onChange={(e) => setCsv(e.target.value)} placeholder="Source term,Target term 1,Other target terms,Sector,Status" />
            <label className="mt-2 flex items-start gap-2 text-sm"><input data-testid="glossary-import-replace" type="checkbox" className="mt-1" checked={replace} onChange={(e) => setReplace(e.target.checked)} /> <span><b>Replace the whole glossary</b> with this file (official list). Untick to add new terms and update matching ones only.</span></label>
            <div className="mt-2 flex items-center gap-2">
              <label className={`${btn.ghost} cursor-pointer`}>Choose file<input data-testid="glossary-import-file" type="file" accept=".csv,text/csv" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setCsv(await f.text()); setFileName(f.name); } e.target.value = ""; }} /></label>
              <button data-testid="glossary-import-btn" className={btn.navy} disabled={!csv.trim() || busy} onClick={runImport}>{busy ? "Importing…" : "Import"}</button>
            </div>
            {msg && <div className="mt-2" data-testid="glossary-import-msg"><Notice>{msg}</Notice></div>}
          </Card>
        )}
      </div>
      {edit && <GlossaryEdit g={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function GlossaryEdit({ g, onClose }: { g: any; onClose(): void }) {
  const qc = useQueryClient();
  const [hi, setHi] = useState(g.hi);
  const [variants, setVariants] = useState(g.accepted_variants.join(", "));
  const [avoid, setAvoid] = useState(g.avoid_forms.join(", "));
  const [ov, setOv] = useState<any>(g.override ?? null);
  const [err, setErr] = useState("");
  const list = (s: string) => s.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
  const save = async () => {
    try {
      await api(`/admin/glossary/${g.id}`, { method: "PUT", body: { hi, variants: list(variants), avoid: list(avoid), override: ov ? { hi: ov.hi, variants: Array.isArray(ov.variants) ? ov.variants : list(ov.variants ?? ""), avoid: Array.isArray(ov.avoid) ? ov.avoid : list(ov.avoid ?? ""), reason: ov.reason ?? "", status: ov.status ?? "pending_confirmation", active: ov.active !== false } : null } });
      qc.invalidateQueries({ queryKey: ["agl"] });
      onClose();
    } catch (e) { setErr((e as ApiError).code); }
  };
  return (
    <Dialog open onClose={onClose} title={`Edit term · ${g.en}`} width="max-w-2xl" footer={<><button className={btn.ghost} onClick={onClose}>Cancel</button><button className={btn.primary} onClick={save}>Save (audited)</button></>}>
      <div className="grid gap-3">
        <label>Hindi (primary)<input lang="hi" className={`${input} mt-1`} value={hi} onChange={(e) => setHi(e.target.value)} /></label>
        <label>Accepted variants (comma separated)<input lang="hi" className={`${input} mt-1`} value={variants} onChange={(e) => setVariants(e.target.value)} /></label>
        <label>Avoid-forms (comma separated)<textarea lang="hi" className={`${input} mt-1`} rows={2} value={avoid} onChange={(e) => setAvoid(e.target.value)} /></label>
        <div className="rounded-md border border-slate-200 p-3">
          <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={!!ov} onChange={(e) => setOv(e.target.checked ? { hi, variants: [], avoid: [], reason: "", status: "pending_confirmation", active: true } : null)} /> Manager override (applies on top of the glossary in scoring)</label>
          {ov && <div className="mt-2 grid gap-2 md:grid-cols-2">
            <label>Override Hindi<input lang="hi" className={`${input} mt-1`} value={ov.hi} onChange={(e) => setOv({ ...ov, hi: e.target.value })} /></label>
            <label>Status<select className={`${input} mt-1`} value={ov.status} onChange={(e) => setOv({ ...ov, status: e.target.value })}><option value="pending_confirmation">pending_confirmation</option><option value="confirmed">confirmed</option></select></label>
            <label className="md:col-span-2">Reason<input className={`${input} mt-1`} value={ov.reason} onChange={(e) => setOv({ ...ov, reason: e.target.value })} /></label>
          </div>}
        </div>
        {err && <Notice tone="red">{err}</Notice>}
      </div>
    </Dialog>
  );
}

// ---------------- offices ----------------
export function Offices() {
  const qc = useQueryClient();
  const isManager = useIsManager();
  const { data = [] } = useQuery({ queryKey: ["offices"], queryFn: () => api<any[]>("/admin/offices") });
  const [q, setQ] = useState("");
  const [missing, setMissing] = useState(false);
  const [msg, setMsg] = useState("");
  const [csv, setCsv] = useState("");
  const rows = useMemo(() => data.filter((o) => (!missing || !o.name_hi) && (!q || `${o.name_en} ${o.name_hi ?? ""} ${o.city} ${o.state}`.toLowerCase().includes(q.toLowerCase()))), [data, q, missing]);
  return (
    <div>
      <PageHeader title="Offices" subtitle={`${data.length} IA&AD offices · ${data.filter((o) => o.name_hi).length} with Hindi names (D8). Office-admin contacts are never imported.`}
        actions={isManager && <button className={btn.navy} onClick={async () => { try { const r = await api<any>("/admin/offices/translate-names", { body: {} }); setMsg(`Translated ${r.translated}. ${r.note}`); qc.invalidateQueries({ queryKey: ["offices"] }); } catch (e) { setMsg((e as ApiError).code === "nmt_not_configured" ? "BHASHINI translation key is not configured on the server." : (e as ApiError).code); } }}>Batch-translate names (BHASHINI)</button>} />
      {msg && <div className="mb-4"><Notice>{msg}</Notice></div>}
      <Card pad={false}>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-3">
          <input className={`${input} max-w-sm`} placeholder="Search office, city, state" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search offices" />
          <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={missing} onChange={(e) => setMissing(e.target.checked)} /> Missing Hindi name</label>
          <span className="ml-auto text-xs text-slate-500">{rows.length} shown</span>
        </div>
        <div className="max-h-[65vh] overflow-y-auto">
          <table className="w-full text-sm"><thead className="sticky top-0 bg-slate-50"><tr><th className={th}>Office (English)</th><th className={th}>Hindi name</th><th className={th}>Address</th><th className={th} /></tr></thead>
            <tbody>{rows.map((o) => <OfficeRow key={o.id} o={o} ro={!isManager} />)}</tbody></table>
        </div>
      </Card>
      {isManager && (
        <Card className="mt-5" title="Import offices CSV" subtitle="Same columns as the supplied offices CSV. Admin names and emails in the file are ignored.">
          <textarea className={`${input} font-mono text-xs`} rows={4} value={csv} onChange={(e) => setCsv(e.target.value)} />
          <div className="mt-2 flex gap-2">
            <label className={`${btn.ghost} cursor-pointer`}>Choose file<input type="file" accept=".csv,text/csv" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setCsv(await f.text()); }} /></label>
            <button className={btn.navy} disabled={!csv.trim()} onClick={async () => { try { const r = await api<any>("/admin/offices/import", { body: { csv } }); setMsg(`Imported ${r.rows} offices.`); qc.invalidateQueries({ queryKey: ["offices"] }); } catch (e) { setMsg((e as ApiError).code); } }}>Import</button>
          </div>
        </Card>
      )}
    </div>
  );
}

function OfficeRow({ o, ro }: { o: any; ro: boolean }) {
  const qc = useQueryClient();
  const [hi, setHi] = useState(o.name_hi ?? "");
  const [addr, setAddr] = useState(o.address);
  const [saved, setSaved] = useState(false);
  const dirty = hi !== (o.name_hi ?? "") || addr !== o.address;
  return (
    <tr className={tr}>
      <td className={`${td} w-[34%]`}><div className="font-semibold text-slate-900">{o.name_en}</div><div className="text-xs text-slate-500">{o.city}, {o.state} · {o.type}</div></td>
      <td className={td}><input lang="hi" className={input} disabled={ro} value={hi} placeholder="Hindi name" onChange={(e) => { setHi(e.target.value); setSaved(false); }} /></td>
      <td className={td}><input className={input} disabled={ro} value={addr} onChange={(e) => { setAddr(e.target.value); setSaved(false); }} />{o.address_composed && <span className="text-[11px] text-slate-500">composed from city/state/PIN</span>}</td>
      <td className={`${td} w-24`}>{dirty && <button className={btn.ghost} onClick={async () => { await api(`/admin/offices/${o.id}`, { method: "PUT", body: { nameHi: hi || null, address: addr } }); setSaved(true); qc.invalidateQueries({ queryKey: ["offices"] }); }}>Save</button>}{saved && !dirty && <span className="text-xs text-emerald-700">✓ saved</span>}</td>
    </tr>
  );
}
