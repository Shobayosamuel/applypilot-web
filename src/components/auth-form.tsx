"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Button, ErrorText, Field, Input } from "@/components/ui";
import { Logo } from "@/components/logo";
import { ProductPreview } from "@/components/product-preview";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const { login, signup } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await signup(name, email, password);
      router.push(mode === "signup" ? "/profile?welcome=1" : "/dashboard");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Logo />
        <div className="mx-auto flex w-full max-w-[360px] flex-1 flex-col justify-center py-12">
          <h1 className="text-2xl font-semibold tracking-tight">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
          <p className="mt-1.5 text-sm text-muted">
            {mode === "login" ? "Log in to keep your applications moving." : "Set up your profile once. Apply everywhere in minutes."}
          </p>
          <form onSubmit={submit} className="mt-8 space-y-4">
            {mode === "signup" && (
              <Field label="Full name">
                <Input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" placeholder="Ada Lovelace" className="h-10" />
              </Field>
            )}
            <Field label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com" className="h-10" />
            </Field>
            <Field label="Password" hint={mode === "signup" ? "At least 8 characters" : undefined}>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === "signup" ? 8 : undefined}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="h-10"
              />
            </Field>
            <ErrorText>{error}</ErrorText>
            <Button type="submit" size="lg" loading={busy} className="w-full">
              {mode === "login" ? "Log in" : "Create account"}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted">
            {mode === "login" ? (
              <>New to ApplyPilot? <Link className="font-medium text-brand-600 hover:text-brand-700" href="/signup">Create an account</Link></>
            ) : (
              <>Already have an account? <Link className="font-medium text-brand-600 hover:text-brand-700" href="/login">Log in</Link></>
            )}
          </p>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-[radial-gradient(120%_80%_at_80%_0%,#8c88f2_0%,#4a42c4_45%,#1c1850_100%)] p-12 lg:flex lg:flex-col lg:justify-center">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/.06)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/.06)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
        <div className="relative mx-auto w-full max-w-lg">
          <p className="text-2xl font-semibold leading-snug tracking-tight text-white">Every application, autofilled.<br />Every job, tracked.</p>
          <p className="mt-3 max-w-md text-[15px] text-white/70">The Chrome extension fills Greenhouse, Lever, Ashby and Workday forms from your profile. Claude writes the essay answers from your real experience.</p>
          <div className="mt-10"><ProductPreview /></div>
        </div>
      </div>
    </main>
  );
}
