import Link from "next/link";
import { cn } from "./ui";

export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn("inline-grid place-items-center rounded-[9px] text-white shadow-[inset_0_1px_0_rgb(255_255_255/.2)]", className)}
      style={{ width: size, height: size, background: "linear-gradient(145deg,#7a74f0,#4a42c4)" }}
    >
      <svg viewBox="0 0 24 24" width={size * 0.55} height={size * 0.55} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 17 L10 7 L14 13 L20 5" />
        <path d="M15.5 5H20v4.5" />
      </svg>
    </span>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2 text-[15px] font-semibold tracking-tight text-ink", className)}>
      <LogoMark />
      ApplyPilot
    </Link>
  );
}
