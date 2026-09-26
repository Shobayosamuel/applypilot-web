"use client";

import { forwardRef, useEffect } from "react";
import { X } from "lucide-react";
import { twMerge } from "tailwind-merge";
import type { JobStatus } from "@/lib/api";

export function cn(...c: (string | false | null | undefined)[]) {
  return twMerge(c.filter(Boolean).join(" "));
}

// ---------------------------------------------------------------- buttons

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "dark";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
};

export function Button({ variant = "primary", size = "md", loading, icon, className, children, disabled, ...p }: BtnProps) {
  return (
    <button
      {...p}
      disabled={disabled || loading}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition-all active:scale-[.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
        size === "sm" && "h-8 px-2.5 text-[13px]",
        size === "md" && "h-9 px-3.5 text-sm",
        size === "lg" && "h-11 px-5 text-[15px]",
        variant === "primary" && "bg-brand-600 text-white shadow-[inset_0_1px_0_rgb(255_255_255/.15),0_1px_2px_rgb(74_66_196/.4)] hover:bg-brand-700",
        variant === "dark" && "bg-ink text-white hover:bg-ink/85",
        variant === "secondary" && "border border-line bg-white text-ink shadow-card hover:border-line-strong hover:bg-canvas",
        variant === "ghost" && "text-muted hover:bg-black/[.04] hover:text-ink",
        variant === "danger" && "text-rose-600 hover:bg-rose-50",
        className,
      )}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cn("inline-block h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-current border-r-transparent", className)} />;
}

// ---------------------------------------------------------------- form controls

const control =
  "w-full rounded-lg border border-line bg-white text-sm text-ink shadow-card placeholder:text-subtle transition-colors hover:border-line-strong focus:border-brand-500 focus:outline-none focus:ring-[3px] focus:ring-brand-100 disabled:bg-canvas disabled:text-subtle";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} {...p} className={cn(control, "h-9 px-3", className)} />;
});

export function Textarea({ className, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={cn(control, "px-3 py-2 leading-relaxed", className)} />;
}

export function Select({ className, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...p}
      className={cn(
        control,
        "h-9 appearance-none bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%239a9aab' stroke-width='2' viewBox='0 0 24 24'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")] bg-[length:16px] bg-[right_10px_center] bg-no-repeat pl-3 pr-9",
        className,
      )}
    />
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-ink/80">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

// ---------------------------------------------------------------- surfaces

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("rounded-xl border border-line bg-white shadow-card", className)}>{children}</div>;
}

export function CardHeader({ title, subtitle, action, className }: { title: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 pt-4", className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-black/[.05]", className)} />;
}

// ---------------------------------------------------------------- status & score

export const STATUS_META: Record<JobStatus, { label: string; dot: string; pill: string }> = {
  saved: { label: "Saved", dot: "bg-slate-400", pill: "bg-slate-100 text-slate-700" },
  applied: { label: "Applied", dot: "bg-brand-500", pill: "bg-brand-50 text-brand-700" },
  interviewing: { label: "Interviewing", dot: "bg-amber-500", pill: "bg-amber-50 text-amber-800" },
  offer: { label: "Offer", dot: "bg-emerald-500", pill: "bg-emerald-50 text-emerald-700" },
  rejected: { label: "Rejected", dot: "bg-rose-500", pill: "bg-rose-50 text-rose-700" },
  archived: { label: "Archived", dot: "bg-zinc-300", pill: "bg-zinc-100 text-zinc-500" },
};

export function StatusDot({ status, className }: { status: JobStatus; className?: string }) {
  return <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", STATUS_META[status].dot, className)} />;
}

export function StatusPill({ status }: { status: JobStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", m.pill)}>
      <StatusDot status={status} className="h-1.5 w-1.5" />
      {m.label}
    </span>
  );
}

export function scoreTone(score: number) {
  return score >= 75 ? "#059669" : score >= 50 ? "#d97706" : "#e11d48";
}

export function ScoreRing({ score, size = 36, stroke = 3.5, label = true }: { score: number | null; size?: number; stroke?: number; label?: boolean }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  if (score == null)
    return (
      <span className="grid place-items-center rounded-full border border-dashed border-line-strong text-[10px] text-subtle" style={{ width: size, height: size }} title="Not scored yet">
        –
      </span>
    );
  return (
    <span className="relative inline-grid place-items-center" style={{ width: size, height: size }} title={`${score}% match`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ededf2" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={scoreTone(score)} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} style={{ transition: "stroke-dashoffset .6s ease" }} />
      </svg>
      {label && <span className="tabular absolute font-semibold" style={{ fontSize: size * 0.3 }}>{score}</span>}
    </span>
  );
}

// ---------------------------------------------------------------- company avatar

const AVATAR_COLORS = ["#5a52df", "#0e9f6e", "#d97706", "#e11d48", "#0891b2", "#7c3aed", "#db2777", "#2563eb", "#65a30d", "#ea580c"];

export function CompanyAvatar({ name, size = 36, className }: { name: string; size?: number; className?: string }) {
  const n = (name || "?").trim();
  let h = 0;
  for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0;
  const color = AVATAR_COLORS[h % AVATAR_COLORS.length];
  const initials = n.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
  return (
    <span
      className={cn("inline-grid shrink-0 place-items-center rounded-lg font-semibold text-white", className)}
      style={{ width: size, height: size, fontSize: size * 0.38, background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
    >
      {initials}
    </span>
  );
}

// ---------------------------------------------------------------- misc

export function ErrorText({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <p className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">{children}</p>;
}

export function Empty({ icon, title, children, action }: { icon?: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-line-strong bg-white/60 px-6 py-14 text-center">
      {icon && <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600">{icon}</div>}
      <p className="font-medium">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/30 p-4 backdrop-blur-[2px] sm:pt-[10vh]" onMouseDown={onClose}>
      <div className={cn("animate-in w-full rounded-2xl border border-line bg-white shadow-pop", wide ? "max-w-2xl" : "max-w-lg")} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-subtle hover:bg-canvas hover:text-ink" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 pb-5 pt-2">{children}</div>
      </div>
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border border-line bg-canvas px-1.5 py-0.5 font-sans text-[11px] font-medium text-muted">{children}</kbd>;
}

export function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
