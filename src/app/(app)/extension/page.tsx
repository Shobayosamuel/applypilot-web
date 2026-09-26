"use client";

import { useEffect, useState } from "react";
import { FileUp, Keyboard, KanbanSquare, MousePointerClick, RefreshCw, Sparkles } from "lucide-react";
import { getToken, setToken } from "@/lib/api";
import { Button, Card, CardHeader, Kbd, PageHeader, cn } from "@/components/ui";

export default function ExtensionPage() {
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.source === window && e.data?.source === "applypilot-ext" && e.data.type === "connected") setConnected(true);
    }
    window.addEventListener("message", onMsg);
    setToken(getToken()); // ask the extension to confirm it has our session
    const t = setTimeout(() => setConnected((c) => c ?? false), 1500);
    return () => {
      window.removeEventListener("message", onMsg);
      clearTimeout(t);
    };
  }, []);

  const steps = [
    <>Download the <code className="rounded bg-canvas px-1 py-0.5 text-[13px]">extension/</code> folder from the applypilot-web repo.</>,
    <>Open <code className="rounded bg-canvas px-1 py-0.5 text-[13px]">chrome://extensions</code> and switch on <b>Developer mode</b>.</>,
    <>Click <b>Load unpacked</b> and select the <code className="rounded bg-canvas px-1 py-0.5 text-[13px]">extension</code> folder.</>,
    <>Pin ApplyPilot from the puzzle-piece menu, then reload this page. It signs in automatically.</>,
  ];

  const features = [
    { icon: MousePointerClick, title: "Autofill", text: "Click Autofill in the ApplyPilot panel. Known fields fill instantly; Claude handles the rest from your profile." },
    { icon: FileUp, title: "Resume upload", text: "Your default resume is attached to the resume field automatically." },
    { icon: Sparkles, title: "Essay questions", text: "Use “✦ Write with AI” under any long text box. It respects character limits." },
    { icon: KanbanSquare, title: "Tracking", text: "Save job adds the posting to your board. Submitting moves it to Applied." },
  ];

  return (
    <div className="animate-in max-w-4xl">
      <PageHeader title="Chrome extension" subtitle="Autofill applications, save jobs, and write answers right on the page." />

      <Card className={cn("flex flex-wrap items-center gap-4 p-5", connected && "ring-1 ring-emerald-200")}>
        <span className={cn("relative grid h-11 w-11 place-items-center rounded-xl", connected ? "bg-emerald-50 text-emerald-600" : "bg-canvas text-subtle")}>
          <span className={cn("h-2.5 w-2.5 rounded-full", connected ? "bg-emerald-500" : connected === false ? "bg-zinc-300" : "animate-pulse bg-amber-400")} />
          {connected && <span className="absolute h-2.5 w-2.5 animate-ping rounded-full bg-emerald-400 opacity-60" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{connected ? "Extension connected" : connected === false ? "Extension not detected" : "Checking…"}</p>
          <p className="text-[13px] text-muted">
            {connected ? "The extension is signed in with this account." : "Install it with the steps below, then reload this page."}
          </p>
        </div>
        <Button variant="secondary" icon={<RefreshCw size={14} />} onClick={() => location.reload()}>Re-check</Button>
      </Card>

      <div className="mt-3 grid gap-3 md:grid-cols-5">
        <Card className="md:col-span-3">
          <CardHeader title="Install" subtitle="Developer mode, until it's on the Chrome Web Store" />
          <ol className="space-y-4 p-5">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed text-ink/80">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">{i + 1}</span>
                <span className="pt-0.5">{s}</span>
              </li>
            ))}
          </ol>
          <p className="border-t border-line px-5 py-3 text-xs text-muted">
            Hosting the API somewhere other than localhost? Set the API and dashboard URLs in the extension&apos;s Settings.
          </p>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader title="Shortcut" />
          <div className="p-5 text-sm text-ink/80">
            <p className="flex items-center gap-1.5"><Kbd>Alt</Kbd>+<Kbd>Shift</Kbd>+<Kbd>F</Kbd></p>
            <p className="mt-2 text-[13px] text-muted">Autofill the application on the current page.</p>
            <div className="mt-5 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-[13px] text-amber-900">
              <Keyboard size={15} className="mt-0.5 shrink-0" />
              Always review before you submit. Autofill is fast, not infallible.
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {features.map((f) => (
          <Card key={f.title} className="flex gap-3 p-5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600"><f.icon size={17} /></span>
            <div>
              <p className="text-sm font-semibold">{f.title}</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{f.text}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
