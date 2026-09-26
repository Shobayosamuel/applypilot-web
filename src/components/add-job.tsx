"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, JOB_STATUSES, type Job, type JobStatus } from "@/lib/api";
import { Button, ErrorText, Field, Input, Modal, STATUS_META, Select, Textarea } from "./ui";

export function AddJobModal({ open, onClose, defaultStatus = "saved" }: { open: boolean; onClose: () => void; defaultStatus?: JobStatus }) {
  const router = useRouter();
  const [form, setForm] = useState({ title: "", company: "", location: "", url: "", description: "", status: defaultStatus as string });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const j = await api<Job>("/jobs", { method: "POST", json: form });
      router.push(`/jobs/${j.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add a job" wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Job title"><Input autoFocus value={form.title} onChange={set("title")} required placeholder="Backend Engineer" /></Field>
          <Field label="Company"><Input value={form.company} onChange={set("company")} placeholder="Acme" /></Field>
          <Field label="Location"><Input value={form.location} onChange={set("location")} placeholder="Remote · Lagos" /></Field>
          <Field label="Status">
            <Select value={form.status} onChange={set("status")}>
              {JOB_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Posting URL"><Input type="url" value={form.url} onChange={set("url")} placeholder="https://jobs.lever.co/…" /></Field>
        <Field label="Job description" hint="Paste the full posting so match scores, cover letters and tailoring have context.">
          <Textarea rows={6} value={form.description} onChange={set("description")} />
        </Field>
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy}>Save job</Button>
        </div>
      </form>
    </Modal>
  );
}
