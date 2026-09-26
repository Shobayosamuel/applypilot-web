"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { api, API_URL, getToken, type Education, type Profile, type Resume, type WorkExperience } from "@/lib/api";
import { Check, FileText, Plus, Sparkles, Trash2, Upload } from "lucide-react";
import { Button, Card, ErrorText, Field, Input, PageHeader, Select, Skeleton, Spinner, Textarea, cn, timeAgo } from "@/components/ui";

export default function ProfilePage() {
  return (
    <Suspense>
      <ProfileEditor />
    </Suspense>
  );
}

const emptyWork: WorkExperience = { company: "", title: "", location: "", start_date: "", end_date: "", current: false, description: "" };
const emptyEdu: Education = { school: "", degree: "", field_of_study: "", start_date: "", end_date: "", gpa: "" };

function ProfileEditor() {
  const welcome = useSearchParams().get("welcome");
  const [p, setP] = useState<Profile | null>(null);
  const [saved, setSaved] = useState<string>("");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ profile: Profile }>("/profile").then((r) => setP(r.profile));
  }, []);

  const update = useCallback((fn: (p: Profile) => Profile) => {
    setP((cur) => (cur ? fn(structuredClone(cur)) : cur));
    setDirty(true);
  }, []);

  async function save() {
    if (!p) return;
    setBusy(true);
    setError("");
    try {
      await api("/profile", { method: "PUT", json: { profile: p } });
      setDirty(false);
      setSaved("Saved");
      setTimeout(() => setSaved(""), 2000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!p) return <div className="space-y-3"><Skeleton className="h-8 w-40" /><Skeleton className="h-48" /><Skeleton className="h-64" /></div>;

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => update((x) => ({ ...x, [k]: v }));
  const setIn = <K extends "location" | "links" | "preferences" | "eeo">(k: K, sub: string, v: string) =>
    update((x) => ({ ...x, [k]: { ...(x[k] as object | undefined), [sub]: v } }));

  return (
    <div className="animate-in pb-28">
      <PageHeader title="Profile" subtitle="What the extension autofills and what the AI writes from. Keep it accurate." />

      {welcome && (
        <div className="mb-4 flex items-start gap-3 rounded-xl bg-gradient-to-br from-brand-50 to-white p-4 text-sm ring-1 ring-brand-100">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-brand-600 shadow-card ring-1 ring-brand-100"><Sparkles size={15} /></span>
          <p className="text-ink/80"><strong className="text-ink">Welcome to ApplyPilot.</strong> Upload your resume and click <em>Import into profile</em>. Claude fills in everything below. Review it, then save.</p>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[180px_1fr]">
      <nav className="hidden lg:block">
        <ul className="sticky top-8 space-y-0.5 text-[13px]">
          {SECTIONS.map((t) => (
            <li key={t}>
              <a href={`#${slug(t)}`} className="block rounded-md px-2.5 py-1.5 text-muted transition-colors hover:bg-black/[.03] hover:text-ink">{t}</a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0 space-y-4">

      <Resumes
        onImported={(parsed) => {
          update((cur) => mergeProfile(cur, parsed));
        }}
      />

      <Section title="Personal">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name"><Input value={p.first_name ?? ""} onChange={(e) => set("first_name", e.target.value)} /></Field>
          <Field label="Last name"><Input value={p.last_name ?? ""} onChange={(e) => set("last_name", e.target.value)} /></Field>
          <Field label="Email"><Input type="email" value={p.email ?? ""} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Phone"><Input value={p.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="+234 …" /></Field>
          <Field label="Headline" className="sm:col-span-2"><Input value={p.headline ?? ""} onChange={(e) => set("headline", e.target.value)} placeholder="Backend Engineer · Go, Python, Payments" /></Field>
          <Field label="Summary" className="sm:col-span-2"><Textarea rows={4} value={p.summary ?? ""} onChange={(e) => set("summary", e.target.value)} /></Field>
        </div>
      </Section>

      <Section title="Location">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Street address" className="sm:col-span-2"><Input value={p.location?.address ?? ""} onChange={(e) => setIn("location", "address", e.target.value)} /></Field>
          <Field label="City"><Input value={p.location?.city ?? ""} onChange={(e) => setIn("location", "city", e.target.value)} /></Field>
          <Field label="State / region"><Input value={p.location?.state ?? ""} onChange={(e) => setIn("location", "state", e.target.value)} /></Field>
          <Field label="Country"><Input value={p.location?.country ?? ""} onChange={(e) => setIn("location", "country", e.target.value)} /></Field>
          <Field label="Postal code"><Input value={p.location?.postal_code ?? ""} onChange={(e) => setIn("location", "postal_code", e.target.value)} /></Field>
        </div>
      </Section>

      <Section title="Links">
        <div className="grid gap-4 sm:grid-cols-2">
          {(["linkedin", "github", "portfolio", "website", "twitter"] as const).map((k) => (
            <Field key={k} label={k === "twitter" ? "X / Twitter" : k[0].toUpperCase() + k.slice(1)}>
              <Input value={p.links?.[k] ?? ""} onChange={(e) => setIn("links", k, e.target.value)} placeholder="https://" />
            </Field>
          ))}
        </div>
      </Section>

      <Section
        title="Work experience"
        action={<Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => set("work_experience", [...(p.work_experience ?? []), { ...emptyWork }])}>Add role</Button>}
      >
        <div className="space-y-6">
          {(p.work_experience ?? []).length === 0 && <p className="text-sm text-muted">No roles yet.</p>}
          {(p.work_experience ?? []).map((w, i) => {
            const setW = (k: keyof WorkExperience, v: string | boolean) =>
              update((x) => { x.work_experience![i] = { ...x.work_experience![i], [k]: v }; return x; });
            return (
              <div key={i} className="rounded-xl border border-line bg-canvas/40 p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Title"><Input value={w.title} onChange={(e) => setW("title", e.target.value)} /></Field>
                  <Field label="Company"><Input value={w.company} onChange={(e) => setW("company", e.target.value)} /></Field>
                  <Field label="Location"><Input value={w.location} onChange={(e) => setW("location", e.target.value)} /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Start"><Input value={w.start_date} onChange={(e) => setW("start_date", e.target.value)} placeholder="2023-01" /></Field>
                    <Field label="End"><Input value={w.current ? "" : w.end_date} disabled={w.current} onChange={(e) => setW("end_date", e.target.value)} placeholder={w.current ? "Present" : "2024-06"} /></Field>
                  </div>
                  <label className="flex items-center gap-2 text-sm sm:col-span-2">
                    <input type="checkbox" checked={!!w.current} onChange={(e) => setW("current", e.target.checked)} /> I currently work here
                  </label>
                  <Field label="Description / bullets" className="sm:col-span-2"><Textarea rows={5} value={w.description} onChange={(e) => setW("description", e.target.value)} /></Field>
                </div>
                <div className="mt-3 flex justify-end">
                  <Button size="sm" variant="ghost" onClick={() => update((x) => { x.work_experience!.splice(i, 1); return x; })}icon={<Trash2 size={14} />}>Remove</Button>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section
        title="Education"
        action={<Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => set("education", [...(p.education ?? []), { ...emptyEdu }])}>Add school</Button>}
      >
        <div className="space-y-6">
          {(p.education ?? []).length === 0 && <p className="text-sm text-muted">No education yet.</p>}
          {(p.education ?? []).map((ed, i) => {
            const setE = (k: keyof Education, v: string) =>
              update((x) => { x.education![i] = { ...x.education![i], [k]: v }; return x; });
            return (
              <div key={i} className="rounded-xl border border-line bg-canvas/40 p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="School"><Input value={ed.school} onChange={(e) => setE("school", e.target.value)} /></Field>
                  <Field label="Degree"><Input value={ed.degree} onChange={(e) => setE("degree", e.target.value)} placeholder="B.Eng" /></Field>
                  <Field label="Field of study"><Input value={ed.field_of_study} onChange={(e) => setE("field_of_study", e.target.value)} /></Field>
                  <Field label="GPA / class"><Input value={ed.gpa} onChange={(e) => setE("gpa", e.target.value)} /></Field>
                  <Field label="Start"><Input value={ed.start_date} onChange={(e) => setE("start_date", e.target.value)} placeholder="2021-09" /></Field>
                  <Field label="End (or expected)"><Input value={ed.end_date} onChange={(e) => setE("end_date", e.target.value)} placeholder="2026-07" /></Field>
                </div>
                <div className="mt-3 flex justify-end">
                  <Button size="sm" variant="ghost" onClick={() => update((x) => { x.education!.splice(i, 1); return x; })}icon={<Trash2 size={14} />}>Remove</Button>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Skills & languages">
        <div className="grid gap-4">
          <ListInput label="Skills" hint="Comma separated" value={p.skills ?? []} onChange={(v) => set("skills", v)} />
          <ListInput label="Languages" hint="Comma separated" value={p.languages ?? []} onChange={(v) => set("languages", v)} />
          <ListInput label="Certifications" hint="Comma separated" value={p.certifications ?? []} onChange={(v) => set("certifications", v)} />
        </div>
      </Section>

      <Section title="Work preferences" subtitle="Used to answer the standard screening questions.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Work authorization" hint="e.g. Authorized to work in Nigeria; requires visa for US/UK">
            <Input value={p.preferences?.work_authorization ?? ""} onChange={(e) => setIn("preferences", "work_authorization", e.target.value)} />
          </Field>
          <Field label="Requires visa sponsorship?">
            <YesNo value={p.preferences?.requires_sponsorship} onChange={(v) => setIn("preferences", "requires_sponsorship", v)} />
          </Field>
          <Field label="Willing to relocate?">
            <YesNo value={p.preferences?.willing_to_relocate} onChange={(v) => setIn("preferences", "willing_to_relocate", v)} />
          </Field>
          <Field label="Work arrangement">
            <Select value={p.preferences?.remote_preference ?? ""} onChange={(e) => setIn("preferences", "remote_preference", e.target.value)}>
              <option value="">—</option><option>Remote</option><option>Hybrid</option><option>On-site</option><option>Open to any</option>
            </Select>
          </Field>
          <Field label="Desired salary"><Input value={p.preferences?.desired_salary ?? ""} onChange={(e) => setIn("preferences", "desired_salary", e.target.value)} /></Field>
          <Field label="Notice period"><Input value={p.preferences?.notice_period ?? ""} onChange={(e) => setIn("preferences", "notice_period", e.target.value)} placeholder="2 weeks" /></Field>
          <Field label="Earliest start date"><Input value={p.preferences?.earliest_start_date ?? ""} onChange={(e) => setIn("preferences", "earliest_start_date", e.target.value)} /></Field>
        </div>
      </Section>

      <Section title="Voluntary self-identification (EEO)" subtitle="Optional. Leave blank and ApplyPilot will choose “decline to answer” where available.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Gender"><Input value={p.eeo?.gender ?? ""} onChange={(e) => setIn("eeo", "gender", e.target.value)} /></Field>
          <Field label="Pronouns"><Input value={p.eeo?.pronouns ?? ""} onChange={(e) => setIn("eeo", "pronouns", e.target.value)} /></Field>
          <Field label="Race / ethnicity"><Input value={p.eeo?.race ?? ""} onChange={(e) => setIn("eeo", "race", e.target.value)} /></Field>
          <Field label="Hispanic or Latino?"><YesNo value={p.eeo?.hispanic_latino} onChange={(v) => setIn("eeo", "hispanic_latino", v)} decline /></Field>
          <Field label="Veteran status"><Input value={p.eeo?.veteran_status ?? ""} onChange={(e) => setIn("eeo", "veteran_status", e.target.value)} /></Field>
          <Field label="Disability status"><Input value={p.eeo?.disability_status ?? ""} onChange={(e) => setIn("eeo", "disability_status", e.target.value)} /></Field>
        </div>
      </Section>

      <Section
        title="Saved answers"
        subtitle="Reusable answers to questions you see often. The AI uses these first."
        action={<Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => set("custom_answers", [...(p.custom_answers ?? []), { question: "", answer: "" }])}>Add answer</Button>}
      >
        <div className="space-y-4">
          {(p.custom_answers ?? []).length === 0 && <p className="text-sm text-muted">e.g. “How did you hear about us?”, “Are you open to contract roles?”</p>}
          {(p.custom_answers ?? []).map((qa, i) => (
            <div key={i} className="grid gap-2 rounded-xl border border-line bg-canvas/40 p-4">
              <Input value={qa.question} placeholder="Question" onChange={(e) => update((x) => { x.custom_answers![i].question = e.target.value; return x; })} />
              <Textarea rows={3} value={qa.answer} placeholder="Answer" onChange={(e) => update((x) => { x.custom_answers![i].answer = e.target.value; return x; })} />
              <div className="flex justify-end">
                <Button size="sm" variant="ghost" onClick={() => update((x) => { x.custom_answers!.splice(i, 1); return x; })}icon={<Trash2 size={14} />}>Remove</Button>
              </div>
            </div>
          ))}
        </div>
      </Section>

      </div>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-30 flex justify-center px-4 lg:left-[248px]">
        <div className={cn("pointer-events-auto flex items-center gap-3 rounded-full border bg-white/95 py-1.5 pl-4 pr-1.5 shadow-pop backdrop-blur transition-all", dirty ? "border-brand-200" : "border-line")}>
          {error && <span className="text-[13px] text-rose-600">{error}</span>}
          <span className="flex items-center gap-2 text-[13px] text-muted">
            <span className={cn("h-1.5 w-1.5 rounded-full", dirty ? "bg-amber-500" : "bg-emerald-500")} />
            {saved || (dirty ? "Unsaved changes" : "All changes saved")}
          </span>
          <Button onClick={save} loading={busy} disabled={!dirty} className="rounded-full">Save profile</Button>
        </div>
      </div>
    </div>
  );
}

const SECTIONS = ["Resumes", "Personal", "Location", "Links", "Work experience", "Education", "Skills & languages", "Work preferences", "Voluntary self-identification (EEO)", "Saved answers"];
const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function Section({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="scroll-mt-6">
      <div id={slug(title)} className="flex scroll-mt-6 items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </Card>
  );
}

function YesNo({ value, onChange, decline }: { value?: string; onChange: (v: string) => void; decline?: boolean }) {
  return (
    <Select value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
      <option value="">—</option>
      <option>Yes</option>
      <option>No</option>
      {decline && <option>Decline to answer</option>}
    </Select>
  );
}

function ListInput({ label, hint, value, onChange }: { label: string; hint?: string; value: string[]; onChange: (v: string[]) => void }) {
  const joined = value.join(", ");
  const [text, setText] = useState(joined);
  const [prev, setPrev] = useState(joined);
  // Resync when the value changes from outside (e.g. resume import).
  if (joined !== prev) {
    setPrev(joined);
    setText(joined);
  }
  return (
    <Field label={label} hint={hint}>
      <Textarea
        rows={2}
        value={text}
        onChange={(e) => {
          const next = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
          setText(e.target.value);
          setPrev(next.join(", "));
          onChange(next);
        }}
      />
    </Field>
  );
}

// mergeProfile fills the current profile with parsed resume data, keeping
// preferences, EEO and saved answers (which resumes don't contain).
function mergeProfile(cur: Profile, parsed: Profile): Profile {
  const pick = <T,>(a: T | undefined, b: T | undefined) => (b !== undefined && b !== "" && !(Array.isArray(b) && b.length === 0) ? b : a);
  return {
    ...cur,
    first_name: pick(cur.first_name, parsed.first_name),
    last_name: pick(cur.last_name, parsed.last_name),
    email: pick(cur.email, parsed.email),
    phone: pick(cur.phone, parsed.phone),
    headline: pick(cur.headline, parsed.headline),
    summary: pick(cur.summary, parsed.summary),
    location: { ...cur.location, ...stripEmpty(parsed.location) },
    links: { ...cur.links, ...stripEmpty(parsed.links) },
    work_experience: pick(cur.work_experience, parsed.work_experience?.map((w) => ({ ...emptyWork, ...w }))),
    education: pick(cur.education, parsed.education?.map((e) => ({ ...emptyEdu, ...e }))),
    skills: pick(cur.skills, parsed.skills),
    languages: pick(cur.languages, parsed.languages),
    certifications: pick(cur.certifications, parsed.certifications),
  };
}

function stripEmpty<T extends object>(o: T | undefined): Partial<T> {
  if (!o) return {};
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== "" && v != null)) as Partial<T>;
}

function Resumes({ onImported }: { onImported: (p: Profile) => void }) {
  const [list, setList] = useState<Resume[] | null>(null);
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const load = () => api<Resume[]>("/resumes").then(setList).catch(() => setList([]));
  useEffect(() => { load(); }, []);

  async function upload(f: File) {
    setBusy("upload");
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", f);
      await api("/resumes", { method: "POST", body: fd });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function importResume(id: string) {
    setBusy(id);
    setError("");
    setMsg("");
    try {
      const r = await api<{ profile: Profile }>("/ai/parse-resume", { method: "POST", json: { resume_id: id } });
      onImported(r.profile);
      setMsg("Imported. Review the sections below, then click Save profile.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function open(r: Resume) {
    const res = await fetch(`${API_URL}/api/resumes/${r.id}/file`, { headers: { Authorization: `Bearer ${getToken()}` } });
    const url = URL.createObjectURL(await res.blob());
    window.open(url, "_blank");
  }

  return (
    <Section
      title="Resumes"
      subtitle="Your default resume is attached automatically when an application asks for one."
      action={<input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />}
    >
      <div className="space-y-3">
        <ErrorText>{error}</ErrorText>
        {msg && <p className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800"><Check size={14} />{msg}</p>}
        {list === null ? <Skeleton className="h-16" /> : (
          <>
            {list.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-rose-50 text-rose-600"><FileText size={18} /></span>
                <button onClick={() => open(r)} className="min-w-0 flex-1 text-left">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium hover:text-brand-700">{r.name}</span>
                    {r.is_default && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">Default</span>}
                  </span>
                  <span className="text-xs text-muted">{r.filename} · {(r.size_bytes / 1024).toFixed(0)} KB · {timeAgo(r.created_at)}</span>
                </button>
                {(r.content_type === "application/pdf" || r.content_type === "text/plain") && (
                  <Button size="sm" variant="secondary" icon={<Sparkles size={14} className="text-brand-600" />} loading={busy === r.id} disabled={!!busy} onClick={() => importResume(r.id)}>Import into profile</Button>
                )}
                {!r.is_default && <Button size="sm" variant="ghost" onClick={async () => { await api(`/resumes/${r.id}/default`, { method: "POST" }); load(); }}>Make default</Button>}
                <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} aria-label="Delete" onClick={async () => { if (confirm("Delete this resume?")) { await api(`/resumes/${r.id}`, { method: "DELETE" }); load(); } }} />
              </div>
            ))}
            <button
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) upload(f); }}
              className={cn("flex w-full flex-col items-center rounded-xl border-2 border-dashed px-6 py-7 text-center transition-colors", drag ? "border-brand-400 bg-brand-50" : "border-line-strong hover:border-brand-200 hover:bg-canvas")}
            >
              {busy === "upload" ? <Spinner className="h-5 w-5 text-brand-600" /> : <Upload size={20} className="text-subtle" />}
              <span className="mt-2 text-sm font-medium">{list.length ? "Upload another resume" : "Drop your resume here, or click to browse"}</span>
              <span className="mt-0.5 text-xs text-muted">PDF works best for import · DOCX and TXT also accepted · 5 MB max</span>
            </button>
          </>
        )}
      </div>
    </Section>
  );
}
