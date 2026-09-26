"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, FileText, Gauge, KanbanSquare, MousePointerClick, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { ProductPreview } from "@/components/product-preview";

const features = [
  { icon: MousePointerClick, title: "One-click autofill", text: "Name, links, work history, EEO and screening questions filled on Greenhouse, Lever, Ashby, Workday and custom forms." },
  { icon: KanbanSquare, title: "Automatic tracking", text: "Save any posting in one click. Submitted applications move to Applied on their own." },
  { icon: Gauge, title: "Match score", text: "See your fit, the skills you're missing and the ATS keywords to include, before you apply." },
  { icon: FileText, title: "Cover letters & tailoring", text: "Tailored bullets and cover letters written from your profile, ready to copy." },
  { icon: Sparkles, title: "Essay answers", text: "A “Write with AI” button under every long question, respecting the character limit." },
  { icon: ShieldCheck, title: "Truthful by design", text: "The AI never invents employers, skills or numbers. It leaves a blank rather than guess." },
];

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [user, loading, router]);

  return (
    <main className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/login" className="rounded-lg px-3 py-2 font-medium text-muted hover:text-ink">Log in</Link>
          <Link href="/signup" className="rounded-lg bg-ink px-4 py-2 font-medium text-white hover:bg-ink/85">Get started</Link>
        </nav>
      </header>

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(60%_60%_at_50%_0%,#e4e3fd_0%,transparent_70%)]" />
        <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-16 text-center sm:pt-24">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-100 bg-white px-3 py-1 text-xs font-medium text-brand-700 shadow-card">
            <Sparkles size={12} /> Powered by Claude
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-[-0.03em] text-ink sm:text-6xl">
            Apply to jobs in minutes, <span className="bg-gradient-to-r from-brand-500 to-brand-700 bg-clip-text text-transparent">not hours.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted">
            ApplyPilot autofills applications, tracks every job you apply to, and writes tailored answers from your real experience.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 font-medium text-white shadow-[0_8px_24px_-8px_rgb(90_82_223/.7)] hover:bg-brand-700">
              Create free account <ArrowRight size={16} />
            </Link>
            <Link href="/login" className="rounded-xl border border-line bg-white px-5 py-3 font-medium text-ink shadow-card hover:bg-canvas">Log in</Link>
          </div>
          <div className="mx-auto mt-16 max-w-3xl rounded-3xl bg-[radial-gradient(120%_90%_at_80%_0%,#8c88f2_0%,#4a42c4_50%,#1c1850_100%)] p-6 pb-12 text-left sm:p-10 sm:pb-14">
            <ProductPreview />
          </div>
        </div>
      </section>

      <section className="border-t border-line bg-canvas">
        <div className="mx-auto grid max-w-6xl gap-4 px-6 py-20 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-line bg-white p-6 shadow-card">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-600"><f.icon size={18} /></span>
              <h3 className="mt-4 font-semibold tracking-tight">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-line py-8 text-center text-sm text-subtle">ApplyPilot · Review every application before you submit.</footer>
    </main>
  );
}
