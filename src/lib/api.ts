export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080").replace(/\/$/, "");

const TOKEN_KEY = "applypilot.token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
  // Let the ApplyPilot Chrome extension (if installed) pick up the session.
  window.postMessage({ source: "applypilot-web", type: "auth", token, apiUrl: API_URL }, window.location.origin);
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let body = init.body;
  if (init.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.json);
  }
  const res = await fetch(`${API_URL}/api${path}`, { ...init, headers, body });
  if (res.status === 401 && token) {
    setToken(null);
    if (typeof window !== "undefined" && !location.pathname.startsWith("/login")) location.href = "/login";
  }
  if (!res.ok) {
    let msg = res.statusText;
    try {
      msg = (await res.json()).error || msg;
    } catch {}
    throw new ApiError(res.status, msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ---------- types ----------

export type User = { id: string; email: string; name: string; created_at: string };

export type JobStatus = "saved" | "applied" | "interviewing" | "offer" | "rejected" | "archived";
export const JOB_STATUSES: JobStatus[] = ["saved", "applied", "interviewing", "offer", "rejected", "archived"];

export type MatchResult = {
  score: number;
  verdict: "strong" | "good" | "fair" | "weak";
  summary: string;
  matched_skills: string[];
  missing_skills: string[];
  keywords: string[];
  suggestions: string[];
};

export type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  salary: string;
  source: string;
  status: JobStatus;
  notes: string;
  match_score: number | null;
  match_details: MatchResult | null;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Stats = {
  by_status: Record<JobStatus, number>;
  total: number;
  applied_this_week: number;
  applied_total: number;
  ai_calls_today: number;
};

export type Resume = {
  id: string;
  name: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  is_default: boolean;
  created_at: string;
};

export type Usage = {
  calls_today: number;
  daily_limit: number;
  input_tokens_30d: number;
  output_tokens_30d: number;
  cache_read_tokens_30d: number;
  calls_30d: number;
};

export type Generation = {
  id: string;
  job_id: string | null;
  kind: string;
  input_summary: string;
  output: string;
  model: string;
  created_at: string;
};

export type WorkExperience = {
  company: string;
  title: string;
  location: string;
  start_date: string;
  end_date: string;
  current: boolean;
  description: string;
};

export type Education = {
  school: string;
  degree: string;
  field_of_study: string;
  start_date: string;
  end_date: string;
  gpa: string;
};

export type Profile = {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  headline?: string;
  summary?: string;
  location?: { address?: string; city?: string; state?: string; country?: string; postal_code?: string };
  links?: { linkedin?: string; github?: string; portfolio?: string; website?: string; twitter?: string };
  work_experience?: WorkExperience[];
  education?: Education[];
  skills?: string[];
  languages?: string[];
  certifications?: string[];
  preferences?: {
    work_authorization?: string;
    requires_sponsorship?: string;
    willing_to_relocate?: string;
    remote_preference?: string;
    desired_salary?: string;
    notice_period?: string;
    earliest_start_date?: string;
  };
  eeo?: { gender?: string; pronouns?: string; race?: string; hispanic_latino?: string; veteran_status?: string; disability_status?: string };
  custom_answers?: { question: string; answer: string }[];
};

export type TailoredResume = {
  headline: string;
  summary: string;
  skills: string[];
  experience: { company: string; title: string; bullets: string[] }[];
  keywords_added: string[];
  notes: string;
};
