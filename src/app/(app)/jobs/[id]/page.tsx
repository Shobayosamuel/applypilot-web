"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Check, ChevronRight, Copy, ExternalLink, FileText, Gauge, History, MapPin, MessageSquareText, Pencil, Sparkles, Trash2, Wallet, Wand2 } from "lucide-react";
import { api, JOB_STATUSES, type Generation, type Job, type JobStatus, type MatchResult, type TailoredResume } from "@/lib/api";
import { Button, Card, CardHeader, CompanyAvatar, ErrorText, Field, Input, STATUS_META, ScoreRing, Select, Skeleton, Spinner, Textarea, cn, hostOf, scoreTone, timeAgo } from "@/components/ui";

type Tab = "match" | "cover" | "tailor" | "answer" | "history";
const TABS: { id: Tab; label: string; icon: typeof Gauge }[] = [
  { id: "match", label: "Match", icon: Gauge },
  { id: "cover", label: "Cover letter", icon: FileText },
  { id: "tailor", label: "Tailor resume", icon: Wand2 },
  { id: "answer", label: "Answer question", icon: MessageSquareText },
  { id: "history", label: "History", icon: History },
];

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<Tab>("match");

  const load = useCallback(() => {
    api<Job>(`/jobs/${id}`).then(setJob).catch(() => setNotFound(true));
  }, [id]);
  useEffect(load, [load]);

  async function patch(p: Partial<Job>) {
    setJob(await api<Job>(`/jobs/${id}`, { method: "PATCH", json: p }));
  }

  async function remove() {
    if (!confirm("Delete this job and its AI history?")) return;
    await api(`/jobs/${id}`, { method: "DELETE" });
    router.push("/jobs");
  }

  if (notFound) return <p className="text-muted">Job not found. <Link href="/jobs" className="text-brand-600">Back to jobs</Link></p>;
  if (!job)
    return (
      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-28" />
        <Skeleton className="h-96" />
      </div>
    );

  return (
    <div className="animate-in">
      <nav className="mb-4 flex items-center gap-1 text-[13px] text-muted">
        <Link href="/jobs" className="hover:text-ink">Jobs</Link>
        <ChevronRight size={14} className="text-subtle" />
        <span className="truncate text-ink">{job.company || job.title}</span>
      </nav>

      <Card className="p-5">
        <div className="flex flex-wrap items-start gap-4">
          <CompanyAvatar name={job.company || job.title} size={52} className="rounded-xl" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight">{job.title || "Untitled role"}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
              {job.company && <span className="font-medium text-ink/80">{job.company}</span>}
              {job.location && <span className="flex items-center gap-1"><MapPin size={13} />{job.location}</span>}
              {job.salary && <span className="flex items-center gap-1"><Wallet size={13} />{job.salary}</span>}
              {job.url && (
                <a href={job.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-brand-600 hover:text-brand-700">
                  <ExternalLink size={13} />{hostOf(job.url)}
                </a>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="secondary" size="sm" icon={<Pencil size={14} />} onClick={() => setEditing((v) => !v)}>{editing ? "Close" : "Edit"}</Button>
            <Button variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={remove} aria-label="Delete" />
          </div>
        </div>
        <StatusStepper job={job} onChange={(s) => patch({ status: s })} />
      </Card>

      {editing && <EditJob job={job} onSave={async (p) => { await patch(p); setEditing(false); }} />}

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex gap-1 overflow-x-auto border-b border-line px-3 pt-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 pb-2.5 pt-2 text-[13px] font-medium transition-colors",
                  tab === t.id ? "border-brand-600 text-ink" : "border-transparent text-muted hover:text-ink",
                )}
              >
                <t.icon size={14} className={tab === t.id ? "text-brand-600" : ""} />
                {t.label}
              </button>
            ))}
          </div>
          <div className="p-5">
            {!job.description && tab !== "history" && (
              <p className="mb-4 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
                No job description yet. Add one with <b>Edit</b> so the AI has context.
              </p>
            )}
            {tab === "match" && <MatchTab job={job} onDone={load} />}
            {tab === "cover" && <CoverTab job={job} />}
            {tab === "tailor" && <TailorTab job={job} />}
            {tab === "answer" && <AnswerTab job={job} />}
            {tab === "history" && <HistoryTab job={job} />}
          </div>
        </Card>

        <div className="space-y-3">
          <NotesCard job={job} onSave={(notes) => patch({ notes })} />
          <Description text={job.description} />
        </div>
      </div>
    </div>
  );
}

const STEPS: JobStatus[] = ["saved", "applied", "interviewing", "offer"];

function StatusStepper({ job, onChange }: { job: Job; onChange: (s: JobStatus) => void }) {
  const idx = STEPS.indexOf(job.status);
  const closed = job.status === "rejected" || job.status === "archived";
  return (
    <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
      <ol className="flex flex-1 items-center">
        {STEPS.map((s, i) => {
          const done = !closed && i <= idx;
          return (
            <li key={s} className="flex flex-1 items-center last:flex-none">
              <button onClick={() => onChange(s)} className="group flex items-center gap-2" title={`Mark as ${STATUS_META[s].label}`}>
                <span className={cn("grid h-6 w-6 place-items-center rounded-full border-2 text-[11px] font-semibold transition-colors", done ? "border-brand-600 bg-brand-600 text-white" : "border-line-strong bg-white text-subtle group-hover:border-brand-400")}>
                  {done && i < idx ? <Check size={12} strokeWidth={3} /> : i + 1}
                </span>
                <span className={cn("hidden text-[13px] font-medium sm:inline", done ? "text-ink" : "text-muted group-hover:text-ink")}>{STATUS_META[s].label}</span>
              </button>
              {i < STEPS.length - 1 && <span className={cn("mx-3 h-0.5 flex-1 rounded-full", !closed && i < idx ? "bg-brand-600" : "bg-line")} />}
            </li>
          );
        })}
      </ol>
      <div className="flex items-center gap-2">
        {job.applied_at && <span className="text-xs text-muted">Applied {new Date(job.applied_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}
        <Select value={job.status} onChange={(e) => onChange(e.target.value as JobStatus)} className="h-8 w-40 text-[13px]">
          {JOB_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
        </Select>
      </div>
    </div>
  );
}

function useAI<T>() {
  const [data, setData] = useState<T | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (path: string, body: unknown) => {
    setBusy(true);
    setError("");
    try {
      setData(await api<T>(path, { method: "POST", json: body }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { data, busy, error, run };
}

function AIIntro({ title, text, action }: { title: string; text: string; action: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl bg-gradient-to-br from-brand-50 to-white p-4 ring-1 ring-brand-100 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-brand-600 shadow-card ring-1 ring-brand-100"><Sparkles size={15} /></span>
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-[13px] text-muted">{text}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

function MatchTab({ job, onDone }: { job: Job; onDone: () => void }) {
  const ai = useAI<MatchResult>();
  const m = ai.data ?? job.match_details;
  return (
    <div className="space-y-5">
      <AIIntro
        title="How well do you fit?"
        text="Claude compares your profile with this posting like a recruiter would."
        action={<Button loading={ai.busy} icon={<Sparkles size={14} />} onClick={async () => { await ai.run("/ai/match", { job_id: job.id }); onDone(); }}>{m ? "Re-run" : "Analyze fit"}</Button>}
      />
      <ErrorText>{ai.error}</ErrorText>
      {ai.busy && !m && <Skeleton className="h-40" />}
      {m && (
        <div className="animate-in space-y-5">
          <div className="flex items-center gap-5">
            <ScoreRing score={m.score} size={88} stroke={8} />
            <div>
              <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize" style={{ color: scoreTone(m.score), background: `${scoreTone(m.score)}14` }}>{m.verdict} fit</span>
              <p className="mt-2 text-sm leading-relaxed text-ink/80">{m.summary}</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Chips title="You have" items={m.matched_skills} tone="green" />
            <Chips title="Gaps" items={m.missing_skills} tone="red" />
          </div>
          <Chips title="ATS keywords to include" items={m.keywords} tone="slate" />
          {m.suggestions?.length > 0 && (
            <div>
              <h3 className="mb-2 text-[13px] font-semibold">Suggestions</h3>
              <ul className="space-y-2">
                {m.suggestions.map((s, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-ink/80">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-50 text-[11px] font-semibold text-brand-700">{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Chips({ title, items, tone }: { title: string; items: string[]; tone: "green" | "red" | "slate" }) {
  if (!items?.length) return null;
  const c = tone === "green" ? "bg-emerald-50 text-emerald-700 ring-emerald-100" : tone === "red" ? "bg-rose-50 text-rose-700 ring-rose-100" : "bg-canvas text-ink/80 ring-line";
  return (
    <div>
      <h3 className="mb-2 text-[13px] font-semibold">{title}</h3>
      <div className="flex flex-wrap gap-1.5">
        {items.map((s) => <span key={s} className={cn("rounded-md px-2 py-0.5 text-xs font-medium ring-1", c)}>{s}</span>)}
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button variant="secondary" size="sm" icon={done ? <Check size={14} /> : <Copy size={14} />} onClick={() => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}>
      {done ? "Copied" : "Copy"}
    </Button>
  );
}

function CoverTab({ job }: { job: Job }) {
  const ai = useAI<{ cover_letter: string }>();
  const [tone, setTone] = useState("professional and warm");
  const [instructions, setInstructions] = useState("");
  const [text, setText] = useState("");
  useEffect(() => { if (ai.data) setText(ai.data.cover_letter); }, [ai.data]);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[180px_1fr_auto] sm:items-end">
        <Field label="Tone">
          <Select value={tone} onChange={(e) => setTone(e.target.value)}>
            <option>professional and warm</option>
            <option>concise and direct</option>
            <option>enthusiastic</option>
            <option>formal</option>
          </Select>
        </Field>
        <Field label="Extra instructions">
          <Input value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="e.g. mention my open-source work" />
        </Field>
        <Button loading={ai.busy} icon={<Sparkles size={14} />} onClick={() => ai.run("/ai/cover-letter", { job_id: job.id, tone, instructions })}>
          {text ? "Regenerate" : "Write letter"}
        </Button>
      </div>
      <ErrorText>{ai.error}</ErrorText>
      {ai.busy && !text && <Skeleton className="h-72" />}
      {text && (
        <div className="animate-in rounded-xl border border-line">
          <div className="flex items-center justify-between border-b border-line px-4 py-2">
            <span className="text-xs text-muted">{text.split(/\s+/).length} words · editable</span>
            <CopyButton text={text} />
          </div>
          <Textarea rows={16} value={text} onChange={(e) => setText(e.target.value)} className="rounded-none rounded-b-xl border-0 px-4 py-3 font-[450] shadow-none focus:ring-0" />
        </div>
      )}
    </div>
  );
}

function TailorTab({ job }: { job: Job }) {
  const ai = useAI<TailoredResume>();
  const t = ai.data;
  const asText = t
    ? [t.headline, "", t.summary, "", "Skills: " + t.skills.join(", "), "", ...t.experience.flatMap((e) => [`${e.title} — ${e.company}`, ...e.bullets.map((b) => `• ${b}`), ""])].join("\n")
    : "";
  return (
    <div className="space-y-5">
      <AIIntro
        title="Tailor your resume"
        text="Rewrites your headline, summary and bullets for this role, using only what's in your profile."
        action={<Button loading={ai.busy} icon={<Wand2 size={14} />} onClick={() => ai.run("/ai/tailor-resume", { job_id: job.id })}>{t ? "Regenerate" : "Tailor"}</Button>}
      />
      <ErrorText>{ai.error}</ErrorText>
      {ai.busy && !t && <Skeleton className="h-72" />}
      {t && (
        <div className="animate-in rounded-xl border border-line">
          <div className="flex items-center justify-between border-b border-line px-5 py-2.5">
            <span className="text-xs font-medium text-muted">Tailored content</span>
            <CopyButton text={asText} />
          </div>
          <div className="space-y-5 p-5 text-sm">
            <div>
              <p className="text-base font-semibold">{t.headline}</p>
              <p className="mt-1.5 leading-relaxed text-ink/80">{t.summary}</p>
            </div>
            <Chips title="Skills, by relevance" items={t.skills} tone="slate" />
            {t.experience.map((e, i) => (
              <div key={i}>
                <p className="font-semibold">{e.title} <span className="font-normal text-muted">· {e.company}</span></p>
                <ul className="mt-2 space-y-1.5">
                  {e.bullets.map((b, k) => <li key={k} className="relative pl-4 leading-relaxed text-ink/80 before:absolute before:left-0 before:top-[9px] before:h-1.5 before:w-1.5 before:rounded-full before:bg-brand-400">{b}</li>)}
                </ul>
              </div>
            ))}
            <Chips title="Keywords now covered" items={t.keywords_added} tone="green" />
            {t.notes && <p className="rounded-lg bg-amber-50 p-3 text-[13px] text-amber-900">{t.notes}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function AnswerTab({ job }: { job: Job }) {
  const ai = useAI<{ answer: string }>();
  const [question, setQuestion] = useState("");
  const [max, setMax] = useState(1200);
  const presets = ["Why do you want to work here?", "Tell us about a project you're proud of.", "Why are you a good fit for this role?"];
  return (
    <div className="space-y-4">
      <Field label="Application question">
        <Textarea rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Paste the question from the application form" />
      </Field>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button key={p} onClick={() => setQuestion(p)} className="rounded-full border border-line bg-white px-2.5 py-1 text-xs text-muted transition-colors hover:border-brand-200 hover:text-brand-700">{p}</button>
        ))}
      </div>
      <div className="flex items-end gap-3">
        <Field label="Max characters" className="w-36">
          <Input type="number" min={100} max={5000} value={max} onChange={(e) => setMax(Number(e.target.value))} />
        </Field>
        <Button loading={ai.busy} disabled={!question.trim()} icon={<Sparkles size={14} />} onClick={() => ai.run("/ai/answer", { job_id: job.id, question, max_chars: max })}>
          Generate answer
        </Button>
      </div>
      <ErrorText>{ai.error}</ErrorText>
      {ai.data && (
        <div className="animate-in rounded-xl border border-line">
          <div className="flex items-center justify-between border-b border-line px-4 py-2">
            <span className="tabular text-xs text-muted">{ai.data.answer.length} / {max} characters</span>
            <CopyButton text={ai.data.answer} />
          </div>
          <p className="whitespace-pre-wrap px-4 py-3 text-sm leading-relaxed">{ai.data.answer}</p>
        </div>
      )}
    </div>
  );
}

const KIND: Record<string, { label: string; icon: typeof Gauge }> = {
  match: { label: "Match analysis", icon: Gauge },
  cover_letter: { label: "Cover letter", icon: FileText },
  tailor_resume: { label: "Tailored resume", icon: Wand2 },
  answer: { label: "Answer", icon: MessageSquareText },
  map_fields: { label: "Autofill", icon: Sparkles },
};

function HistoryTab({ job }: { job: Job }) {
  const [gens, setGens] = useState<Generation[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { api<Generation[]>(`/ai/generations?job_id=${job.id}`).then(setGens).catch(() => setGens([])); }, [job.id]);
  if (!gens) return <Spinner />;
  if (!gens.length) return <p className="py-8 text-center text-sm text-muted">No AI generations for this job yet.</p>;
  return (
    <ol className="relative space-y-1 before:absolute before:bottom-3 before:left-[15px] before:top-3 before:w-px before:bg-line">
      {gens.map((g) => {
        const k = KIND[g.kind] ?? { label: g.kind, icon: Sparkles };
        return (
          <li key={g.id} className="relative">
            <button className="flex w-full items-center gap-3 rounded-lg py-2 pr-2 text-left hover:bg-canvas" onClick={() => setOpen(open === g.id ? null : g.id)}>
              <span className="relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line bg-white text-brand-600"><k.icon size={14} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{k.label}</span>
                <span className="block truncate text-xs text-muted">{g.input_summary}</span>
              </span>
              <span className="shrink-0 text-xs text-subtle">{timeAgo(g.created_at)}</span>
            </button>
            {open === g.id && <pre className="animate-in mb-2 ml-11 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-canvas p-3 text-xs leading-relaxed">{pretty(g.output)}</pre>}
          </li>
        );
      })}
    </ol>
  );
}

function pretty(s: string) {
  try { return JSON.stringify(JSON.parse(s), null, 2); } catch { return s; }
}

function NotesCard({ job, onSave }: { job: Job; onSave: (n: string) => Promise<void> }) {
  const [notes, setNotes] = useState(job.notes);
  const [busy, setBusy] = useState(false);
  const dirty = notes !== job.notes;
  return (
    <Card>
      <CardHeader title="Notes" />
      <div className="p-5 pt-3">
        <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Recruiter name, interview dates, follow-ups…" />
        {dirty && (
          <div className="mt-2 flex justify-end">
            <Button size="sm" loading={busy} onClick={async () => { setBusy(true); await onSave(notes).finally(() => setBusy(false)); }}>Save notes</Button>
          </div>
        )}
      </div>
    </Card>
  );
}

function Description({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 900;
  return (
    <Card>
      <CardHeader title="Job description" />
      <div className="relative px-5 pb-5 pt-3">
        <div className={cn("whitespace-pre-wrap text-[13px] leading-relaxed text-ink/75", !expanded && long && "max-h-[420px] overflow-hidden")}>
          {text || <span className="text-subtle">No description.</span>}
        </div>
        {long && !expanded && <div className="pointer-events-none absolute inset-x-0 bottom-12 h-20 bg-gradient-to-t from-white" />}
        {long && (
          <button onClick={() => setExpanded((v) => !v)} className="mt-2 text-[13px] font-medium text-brand-600 hover:text-brand-700">
            {expanded ? "Show less" : "Show full description"}
          </button>
        )}
      </div>
    </Card>
  );
}

function EditJob({ job, onSave }: { job: Job; onSave: (p: Partial<Job>) => Promise<void> }) {
  const [f, setF] = useState({ title: job.title, company: job.company, location: job.location, salary: job.salary, url: job.url, description: job.description });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Card className="animate-in mt-3 space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title"><Input value={f.title} onChange={set("title")} /></Field>
        <Field label="Company"><Input value={f.company} onChange={set("company")} /></Field>
        <Field label="Location"><Input value={f.location} onChange={set("location")} /></Field>
        <Field label="Salary"><Input value={f.salary} onChange={set("salary")} /></Field>
      </div>
      <Field label="URL"><Input value={f.url} onChange={set("url")} /></Field>
      <Field label="Description"><Textarea rows={8} value={f.description} onChange={set("description")} /></Field>
      <ErrorText>{error}</ErrorText>
      <div className="flex justify-end">
        <Button loading={busy} onClick={async () => {
          setBusy(true); setError("");
          try { await onSave(f); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
        }}>Save changes</Button>
      </div>
    </Card>
  );
}

