import { Check, MapPin, Sparkles } from "lucide-react";
import { CompanyAvatar, ScoreRing, StatusDot } from "./ui";

// Static, illustrative preview of the product used on the landing and auth pages.
export function ProductPreview() {
  const cols = [
    { s: "saved" as const, label: "Saved", jobs: [["Paystack", "Senior Backend Engineer", "Lagos", 88], ["Moniepoint", "Platform Engineer", "Remote", 74]] },
    { s: "applied" as const, label: "Applied", jobs: [["Flutterwave", "Software Engineer, Payments", "Lagos", 91], ["Kuda", "Go Engineer", "Remote", 67]] },
    { s: "interviewing" as const, label: "Interviewing", jobs: [["Stripe", "Backend Engineer, Ledger", "Remote · EMEA", 82]] },
  ];
  return (
    <div className="relative">
      <div className="rounded-2xl border border-white/15 bg-white/10 p-3 shadow-2xl backdrop-blur">
        <div className="grid grid-cols-3 gap-2.5">
          {cols.map((c) => (
            <div key={c.label} className="rounded-xl bg-white/80 p-2">
              <div className="mb-2 flex items-center gap-1.5 px-1 text-[11px] font-semibold text-ink">
                <StatusDot status={c.s} className="h-1.5 w-1.5" /> {c.label}
              </div>
              <div className="space-y-2">
                {c.jobs.map(([co, title, loc, score]) => (
                  <div key={co as string} className="rounded-lg border border-line bg-white p-2 shadow-card">
                    <div className="flex items-start gap-2">
                      <CompanyAvatar name={co as string} size={20} className="rounded-md" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[10px] text-muted">{co}</p>
                        <p className="line-clamp-2 text-[11px] font-semibold leading-tight text-ink">{title}</p>
                      </div>
                      <ScoreRing score={score as number} size={20} stroke={2.5} label={false} />
                    </div>
                    <p className="mt-1.5 flex items-center gap-1 text-[9px] text-subtle"><MapPin size={9} />{loc}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute -bottom-6 -left-4 w-60 rounded-xl border border-line bg-white p-3 text-ink shadow-pop sm:-left-8">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="grid h-5 w-5 place-items-center rounded-md bg-brand-600 text-white"><Check size={11} strokeWidth={3} /></span>
          Filled 14 fields
          <span className="ml-auto flex items-center gap-1 rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-700"><Sparkles size={9} />4 with AI</span>
        </div>
        <div className="mt-2 space-y-1">
          {[88, 64, 76].map((w, i) => <div key={i} className="h-1.5 rounded-full bg-canvas"><div className="h-full rounded-full bg-brand-200" style={{ width: `${w}%` }} /></div>)}
        </div>
      </div>
    </div>
  );
}
