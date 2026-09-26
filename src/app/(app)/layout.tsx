"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Briefcase, LayoutDashboard, LogOut, Menu, Puzzle, Sparkles, UserRound } from "lucide-react";
import { api, type Usage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { Spinner, cn } from "@/components/ui";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/profile", label: "Profile", icon: UserRound },
  { href: "/extension", label: "Extension", icon: Puzzle },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);
  useEffect(() => setOpen(false), [path]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-subtle">
        <Spinner className="h-5 w-5" />
      </div>
    );
  }

  return (
    <div className="min-h-screen lg:pl-[248px]">
      {/* mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-white/90 px-4 backdrop-blur lg:hidden">
        <button onClick={() => setOpen(true)} className="rounded-md p-1.5 text-muted hover:bg-canvas" aria-label="Open menu">
          <Menu size={18} />
        </button>
        <Logo href="/dashboard" />
      </header>

      {open && <div className="fixed inset-0 z-40 bg-ink/20 lg:hidden" onClick={() => setOpen(false)} />}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col border-r border-line bg-[#fbfbfc] transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="px-5 pt-5 pb-4">
          <Logo href="/dashboard" />
        </div>
        <nav className="flex flex-col gap-0.5 px-3">
          {nav.map((n) => {
            const active = path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                  active ? "bg-white text-ink shadow-card ring-1 ring-line" : "text-muted hover:bg-black/[.03] hover:text-ink",
                )}
              >
                <n.icon size={16} className={active ? "text-brand-600" : "text-subtle group-hover:text-muted"} />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-3 p-3">
          <UsageMeter />
          <UserCard />
        </div>
      </aside>

      <main className="mx-auto max-w-[1180px] px-4 py-8 sm:px-8">{children}</main>
    </div>
  );
}

function UsageMeter() {
  const [u, setU] = useState<Usage | null>(null);
  const path = usePathname();
  useEffect(() => {
    api<Usage>("/ai/usage").then(setU).catch(() => {});
  }, [path]);
  if (!u) return null;
  const pct = u.daily_limit ? Math.min(100, (u.calls_today / u.daily_limit) * 100) : 0;
  return (
    <div className="rounded-xl border border-line bg-white p-3 shadow-card">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 font-medium"><Sparkles size={13} className="text-brand-600" /> AI today</span>
        <span className="tabular text-muted">{u.calls_today}{u.daily_limit ? ` / ${u.daily_limit}` : ""}</span>
      </div>
      {u.daily_limit > 0 && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-canvas">
          <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all" style={{ width: `${Math.max(pct, 2)}%` }} />
        </div>
      )}
    </div>
  );
}

function UserCard() {
  const { user, logout } = useAuth();
  if (!user) return null;
  const initials = (user.name || user.email).split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <div className="flex items-center gap-2.5 rounded-lg px-1.5 py-1">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-xs font-semibold text-white">{initials}</span>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-[13px] font-medium">{user.name || "Your account"}</p>
        <p className="truncate text-xs text-muted">{user.email}</p>
      </div>
      <button onClick={logout} title="Log out" className="rounded-md p-1.5 text-subtle hover:bg-black/[.04] hover:text-ink">
        <LogOut size={15} />
      </button>
    </div>
  );
}
