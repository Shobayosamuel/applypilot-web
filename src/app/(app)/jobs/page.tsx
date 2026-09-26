"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Briefcase, Columns3, ExternalLink, List, MapPin, Plus, Search } from "lucide-react";
import { api, JOB_STATUSES, type Job, type JobStatus } from "@/lib/api";
import { Button, Card, CompanyAvatar, Empty, Input, PageHeader, STATUS_META, ScoreRing, Select, Skeleton, StatusDot, cn, hostOf, timeAgo } from "@/components/ui";
import { AddJobModal } from "@/components/add-job";

export default function JobsPage() {
  return (
    <Suspense>
      <Jobs />
    </Suspense>
  );
}

type View = "board" | "list";

function Jobs() {
  const params = useSearchParams();
  const router = useRouter();
  const status = (params.get("status") as JobStatus | null) ?? "";
  const [view, setViewState] = useState<View>("board");
  const [q, setQ] = useState("");
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem("applypilot.jobsView") as View | null;
      if (v) setViewState(v);
    } catch {}
  }, []);
  const setView = (v: View) => {
    setViewState(v);
    try { localStorage.setItem("applypilot.jobsView", v); } catch {}
  };

  const load = useCallback(() => {
    api<Job[]>("/jobs?limit=500").then(setJobs).catch(() => setJobs([]));
  }, []);
  useEffect(load, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (jobs ?? []).filter(
      (j) => (!status || j.status === status) && (!needle || `${j.title} ${j.company} ${j.location}`.toLowerCase().includes(needle)),
    );
  }, [jobs, q, status]);

  async function move(job: Job, s: JobStatus) {
    if (job.status === s) return;
    setJobs((js) => js?.map((j) => (j.id === job.id ? { ...j, status: s, updated_at: new Date().toISOString() } : j)) ?? null);
    try {
      const updated = await api<Job>(`/jobs/${job.id}`, { method: "PATCH", json: { status: s } });
      setJobs((js) => js?.map((j) => (j.id === job.id ? updated : j)) ?? null);
    } catch {
      load();
    }
  }

  const effectiveView = status ? "list" : view;

  return (
    <div className="animate-in">
      <PageHeader
        title="Jobs"
        subtitle={jobs ? `${jobs.length} tracked · drag cards between columns to update status` : " "}
        actions={<Button icon={<Plus size={15} />} onClick={() => setAdding(true)}>Add job</Button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
          <Input placeholder="Search role, company, location" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <Select value={status} onChange={(e) => router.replace(e.target.value ? `/jobs?status=${e.target.value}` : "/jobs")} className="w-44">
          <option value="">All statuses</option>
          {JOB_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
        </Select>
        <div className="ml-auto flex rounded-lg border border-line bg-white p-0.5 shadow-card">
          {([["board", Columns3, "Board"], ["list", List, "List"]] as const).map(([v, Icon, label]) => (
            <button
              key={v}
              onClick={() => { setView(v); if (status) router.replace("/jobs"); }}
              className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors", effectiveView === v ? "bg-canvas text-ink" : "text-muted hover:text-ink")}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </div>

      {jobs === null ? (
        <div className="grid gap-3 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-64" />)}</div>
      ) : jobs.length === 0 ? (
        <Empty icon={<Briefcase size={20} />} title="Your tracker is empty" action={<Button icon={<Plus size={15} />} onClick={() => setAdding(true)}>Add your first job</Button>}>
          Click “Save job” in the ApplyPilot extension on any posting, or add one manually. Jobs you apply to with autofill are tracked automatically.
        </Empty>
      ) : effectiveView === "board" ? (
        <Board jobs={filtered} onMove={move} />
      ) : (
        <ListView jobs={filtered} onMove={move} />
      )}

      <AddJobModal open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

const BOARD_COLUMNS: JobStatus[] = ["saved", "applied", "interviewing", "offer", "rejected"];

function Board({ jobs, onMove }: { jobs: Job[]; onMove: (j: Job, s: JobStatus) => void }) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<JobStatus | null>(null);
  const byId = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs]);

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-8 sm:px-8">
      <div className="grid grid-cols-[repeat(5,minmax(232px,1fr))] gap-3">
        {BOARD_COLUMNS.map((s) => {
          const col = jobs.filter((j) => j.status === s);
          return (
            <div
              key={s}
              onDragOver={(e) => { e.preventDefault(); setOver(s); }}
              onDragLeave={() => setOver((o) => (o === s ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                const j = dragId && byId.get(dragId);
                if (j) onMove(j, s);
                setDragId(null);
                setOver(null);
              }}
              className={cn("flex min-h-[420px] flex-col rounded-xl border bg-black/[.018] p-2 transition-colors", over === s ? "border-brand-400 bg-brand-50/60" : "border-transparent")}
            >
              <div className="flex items-center gap-2 px-1.5 pb-2 pt-1">
                <StatusDot status={s} />
                <span className="text-[13px] font-semibold">{STATUS_META[s].label}</span>
                <span className="tabular rounded-md bg-black/[.05] px-1.5 text-xs font-medium text-muted">{col.length}</span>
              </div>
              <div className="flex flex-1 flex-col gap-2">
                {col.map((j) => (
                  <JobCard key={j.id} job={j} dragging={dragId === j.id} onDragStart={() => setDragId(j.id)} onDragEnd={() => { setDragId(null); setOver(null); }} />
                ))}
                {col.length === 0 && <div className="grid flex-1 place-items-center rounded-lg border border-dashed border-line-strong/70 text-xs text-subtle">Drop here</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function JobCard({ job, dragging, onDragStart, onDragEnd }: { job: Job; dragging: boolean; onDragStart: () => void; onDragEnd: () => void }) {
  return (
    <Link
      href={`/jobs/${job.id}`}
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart(); }}
      onDragEnd={onDragEnd}
      className={cn(
        "group block cursor-grab rounded-lg border border-line bg-white p-3 shadow-card transition-all hover:-translate-y-px hover:border-line-strong hover:shadow-pop active:cursor-grabbing",
        dragging && "rotate-1 opacity-50",
      )}
    >
      <div className="flex items-center gap-2">
        <CompanyAvatar name={job.company || job.title} size={22} className="rounded-md" />
        <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-muted">{job.company || hostOf(job.url) || "—"}</p>
        {job.match_score != null && <ScoreRing score={job.match_score} size={24} stroke={2.5} />}
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug">{job.title || "Untitled role"}</p>
      <div className="mt-2.5 flex items-center gap-2 text-xs text-subtle">
        {job.location && <span className="flex min-w-0 items-center gap-1 truncate"><MapPin size={12} className="shrink-0" />{job.location}</span>}
        <span className="ml-auto shrink-0">{timeAgo(job.applied_at || job.updated_at)}</span>
      </div>
    </Link>
  );
}

function ListView({ jobs, onMove }: { jobs: Job[]; onMove: (j: Job, s: JobStatus) => void }) {
  if (!jobs.length) return <Empty title="No jobs match these filters" />;
  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th className="px-5 py-3 font-medium">Role</th>
            <th className="px-3 py-3 font-medium">Match</th>
            <th className="px-3 py-3 font-medium">Status</th>
            <th className="px-3 py-3 font-medium">Applied</th>
            <th className="px-3 py-3 font-medium">Updated</th>
            <th className="w-10 px-3 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {jobs.map((j) => (
            <tr key={j.id} className="group transition-colors hover:bg-canvas/70">
              <td className="px-5 py-2.5">
                <Link href={`/jobs/${j.id}`} className="flex items-center gap-3">
                  <CompanyAvatar name={j.company || j.title} size={32} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium group-hover:text-brand-700">{j.title || "Untitled role"}</span>
                    <span className="block truncate text-[13px] text-muted">{[j.company, j.location].filter(Boolean).join(" · ")}</span>
                  </span>
                </Link>
              </td>
              <td className="px-3 py-2.5"><ScoreRing score={j.match_score} size={30} stroke={3} /></td>
              <td className="px-3 py-2.5">
                <Select value={j.status} onChange={(e) => onMove(j, e.target.value as JobStatus)} className="h-8 w-40 text-[13px]">
                  {JOB_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                </Select>
              </td>
              <td className="tabular px-3 py-2.5 text-muted">{j.applied_at ? new Date(j.applied_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—"}</td>
              <td className="px-3 py-2.5 text-subtle">{timeAgo(j.updated_at)}</td>
              <td className="px-3 py-2.5">
                {j.url && (
                  <a href={j.url} target="_blank" rel="noreferrer" className="text-subtle opacity-0 transition-opacity hover:text-ink group-hover:opacity-100" title="Open posting">
                    <ExternalLink size={15} />
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
