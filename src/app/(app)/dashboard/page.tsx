"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ArrowUpRight, Briefcase, Check, Plus, Puzzle } from "lucide-react";
import { api, JOB_STATUSES, type Job, type Profile, type Stats } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button, Card, CardHeader, CompanyAvatar, Empty, PageHeader, STATUS_META, ScoreRing, Skeleton, StatusPill, cn, timeAgo } from "@/components/ui";
import { AddJobModal } from "@/components/add-job";

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    api<Stats>("/stats").then(setStats).catch(() => {});
    api<Job[]>("/jobs?limit=500").then(setJobs).catch(() => setJobs([]));
    api<{ profile: Profile }>("/profile").then((r) => setProfile(r.profile)).catch(() => {});
  }, []);

  const weeks = useMemo(() => weeklyApplications(jobs ?? []), [jobs]);
  const lastWeek = weeks.at(-2)?.count ?? 0;
  const thisWeek = weeks.at(-1)?.count ?? 0;
  const responded = (stats?.by_status.interviewing ?? 0) + (stats?.by_status.offer ?? 0);
  const responseRate = stats && stats.applied_total ? Math.round((responded / stats.applied_total) * 100) : null;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="animate-in">
      <PageHeader
        title={`${greeting}${user?.name ? `, ${user.name.split(" ")[0]}` : ""}`}
        subtitle={new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        actions={<Button icon={<Plus size={15} />} onClick={() => setAdding(true)}>Add job</Button>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Applied this week" value={stats?.applied_this_week} delta={jobs ? thisWeek - lastWeek : undefined} />
        <Kpi label="Total applications" value={stats?.applied_total} />
        <Kpi label="Response rate" value={responseRate == null ? (stats ? "—" : undefined) : `${responseRate}%`} hint="Interviews + offers ÷ applied" />
        <Kpi label="Offers" value={stats?.by_status.offer} />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Card className="flex flex-col lg:col-span-2">
          <CardHeader title="Applications" subtitle="Per week, last 8 weeks" />
          <WeeklyChart weeks={weeks} loading={!jobs} />
        </Card>
        <ProfileStrength profile={profile} />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Card>
          <CardHeader title="Pipeline" subtitle={stats ? `${stats.total} jobs tracked` : " "} />
          <Pipeline stats={stats} />
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Recent activity" action={<Link href="/jobs" className="flex items-center gap-1 text-[13px] font-medium text-brand-600 hover:text-brand-700">All jobs <ArrowRight size={14} /></Link>} />
          <div className="px-2 pb-2 pt-2">
            {!jobs ? (
              <div className="space-y-2 p-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : jobs.length === 0 ? (
              <div className="p-3">
                <Empty icon={<Briefcase size={20} />} title="No jobs yet" action={<Link href="/extension"><Button variant="secondary" icon={<Puzzle size={15} />}>Set up the extension</Button></Link>}>
                  Save postings with one click from the Chrome extension, or add one manually.
                </Empty>
              </div>
            ) : (
              jobs.slice(0, 6).map((j) => (
                <Link key={j.id} href={`/jobs/${j.id}`} className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-canvas">
                  <CompanyAvatar name={j.company || j.title} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{j.title || "Untitled role"}</p>
                    <p className="truncate text-[13px] text-muted">{[j.company, j.location].filter(Boolean).join(" · ")}</p>
                  </div>
                  <ScoreRing score={j.match_score} size={30} stroke={3} />
                  <span className="hidden w-28 justify-end sm:flex"><StatusPill status={j.status} /></span>
                  <span className="hidden w-16 text-right text-xs text-subtle md:block">{timeAgo(j.updated_at)}</span>
                </Link>
              ))
            )}
          </div>
        </Card>
      </div>

      <AddJobModal open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

function Kpi({ label, value, delta, hint }: { label: string; value: number | string | undefined; delta?: number; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-[13px] text-muted" title={hint}>{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        {value === undefined ? <Skeleton className="h-8 w-12" /> : <span className="tabular text-[28px] font-semibold leading-none tracking-tight">{value}</span>}
        {delta !== undefined && delta !== 0 && (
          <span className={cn("flex items-center text-xs font-medium", delta > 0 ? "text-emerald-600" : "text-rose-600")}>
            <ArrowUpRight size={13} className={delta < 0 ? "rotate-90" : ""} />
            {Math.abs(delta)} vs last wk
          </span>
        )}
      </div>
    </Card>
  );
}

function weeklyApplications(jobs: Job[]) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // Monday this week
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() - (7 - i) * 7);
    return { start: d, count: 0 };
  });
  for (const j of jobs) {
    if (!j.applied_at) continue;
    const t = new Date(j.applied_at).getTime();
    for (let i = weeks.length - 1; i >= 0; i--) {
      if (t >= weeks[i].start.getTime()) {
        weeks[i].count++;
        break;
      }
    }
  }
  return weeks;
}

function WeeklyChart({ weeks, loading }: { weeks: { start: Date; count: number }[]; loading: boolean }) {
  const max = Math.max(4, ...weeks.map((w) => w.count));
  return (
    <div className="flex flex-1 flex-col px-5 pb-4 pt-6">
      <div className="relative flex min-h-40 flex-1 items-end gap-2 sm:gap-3">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <div key={f} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line" style={{ bottom: `${f * 100}%` }} />
        ))}
        {weeks.map((w, i) => {
          const current = i === weeks.length - 1;
          return (
            <div key={i} className="group relative flex h-full flex-1 flex-col justify-end">
              <span className="tabular pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full rounded-md bg-ink px-1.5 py-0.5 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                {w.count}
              </span>
              <div
                className={cn("relative w-full rounded-t-md transition-all", loading ? "bg-black/[.04]" : current ? "bg-brand-600" : "bg-brand-200 group-hover:bg-brand-400")}
                style={{ height: loading ? "30%" : `${Math.max((w.count / max) * 100, w.count ? 4 : 1.5)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2 sm:gap-3">
        {weeks.map((w, i) => (
          <span key={i} className={cn("flex-1 text-center text-[11px]", i === weeks.length - 1 ? "font-medium text-ink" : "text-subtle")}>
            {i === weeks.length - 1 ? "This wk" : w.start.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
        ))}
      </div>
    </div>
  );
}

function Pipeline({ stats }: { stats: Stats | null }) {
  const active = JOB_STATUSES.filter((s) => s !== "archived");
  const total = active.reduce((a, s) => a + (stats?.by_status[s] ?? 0), 0);
  return (
    <div className="px-5 pb-5 pt-4">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-canvas">
        {total > 0 && active.map((s) => {
          const n = stats?.by_status[s] ?? 0;
          return n ? <div key={s} className={cn("h-full", STATUS_META[s].dot)} style={{ width: `${(n / total) * 100}%` }} /> : null;
        })}
      </div>
      <ul className="mt-4 space-y-1">
        {JOB_STATUSES.map((s) => (
          <li key={s}>
            <Link href={`/jobs?status=${s}`} className="-mx-2 flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-canvas">
              <span className={cn("h-2 w-2 rounded-full", STATUS_META[s].dot)} />
              <span className="flex-1 text-ink/80">{STATUS_META[s].label}</span>
              <span className="tabular font-medium">{stats ? stats.by_status[s] : "–"}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProfileStrength({ profile }: { profile: Profile | null }) {
  const checks = profile
    ? [
        { label: "Contact details", ok: !!(profile.first_name && profile.email && profile.phone) },
        { label: "Location", ok: !!(profile.location?.city && profile.location?.country) },
        { label: "LinkedIn or portfolio", ok: !!(profile.links?.linkedin || profile.links?.portfolio || profile.links?.github) },
        { label: "Work experience", ok: !!profile.work_experience?.length },
        { label: "Education", ok: !!profile.education?.length },
        { label: "5+ skills", ok: (profile.skills?.length ?? 0) >= 5 },
        { label: "Work authorization", ok: !!(profile.preferences?.work_authorization && profile.preferences?.requires_sponsorship) },
      ]
    : [];
  const pct = checks.length ? Math.round((checks.filter((c) => c.ok).length / checks.length) * 100) : null;
  return (
    <Card className="flex flex-col">
      <CardHeader title="Profile strength" subtitle="Better profile, better autofill" />
      <div className="flex items-center gap-4 px-5 pt-4">
        {pct === null ? <Skeleton className="h-16 w-16 rounded-full" /> : <ScoreRing score={pct} size={64} stroke={6} />}
        <p className="text-[13px] text-muted">
          {pct === 100 ? "Your profile is complete. Autofill has everything it needs." : "Fill the gaps below so autofill and AI answers have what they need."}
        </p>
      </div>
      <ul className="mt-3 flex-1 space-y-1.5 px-5 text-[13px]">
        {checks.map((c) => (
          <li key={c.label} className="flex items-center gap-2">
            <span className={cn("grid h-4 w-4 place-items-center rounded-full", c.ok ? "bg-emerald-500 text-white" : "border border-line-strong")}>
              {c.ok && <Check size={10} strokeWidth={3} />}
            </span>
            <span className={c.ok ? "text-muted line-through decoration-line-strong" : ""}>{c.label}</span>
          </li>
        ))}
      </ul>
      <div className="p-5 pt-4">
        <Link href="/profile"><Button variant="secondary" className="w-full">{pct === 100 ? "Review profile" : "Complete profile"}</Button></Link>
      </div>
    </Card>
  );
}
