// ApplyPilot content script. Runs in every frame:
//  - top frame: detects job pages, shows the floating panel, saves jobs
//  - any frame with an application form: autofills it, adds "Write with AI" buttons,
//    and marks the job as applied on submit
//  - on the ApplyPilot dashboard: picks up the signed-in session
(() => {
  if (window.__applypilot) return;
  window.__applypilot = true;

  const IS_TOP = window === window.top;

  // ---------------------------------------------------------------- messaging

  function bg(msg) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(msg, (res) => {
          if (chrome.runtime.lastError) resolve({ ok: false, error: chrome.runtime.lastError.message });
          else resolve(res || { ok: false, error: "no response" });
        });
      } catch (e) {
        resolve({ ok: false, error: "ApplyPilot was updated. Reload the page." });
      }
    });
  }

  async function api(path, method = "GET", body) {
    const r = await bg({ type: "api", path, method, body });
    if (!r.ok) throw new Error(r.error || "Request failed");
    return r.data;
  }

  // ---------------------------------------------------------------- dashboard bridge

  bg({ type: "state" }).then((r) => {
    if (!r.ok) return;
    const webOrigin = new URL(r.data.webUrl).origin;
    if (location.origin !== webOrigin) return;
    window.addEventListener("message", async (e) => {
      if (e.source !== window || e.origin !== webOrigin) return;
      const d = e.data;
      if (!d || d.source !== "applypilot-web" || d.type !== "auth") return;
      const res = await bg({ type: "webAuth", token: d.token || null });
      if (res.ok && d.token) window.postMessage({ source: "applypilot-ext", type: "connected" }, webOrigin);
    });
    window.postMessage({ source: "applypilot-ext", type: "ready" }, webOrigin);
  });

  // ---------------------------------------------------------------- helpers

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clean = (s) => (s || "").replace(/\s+/g, " ").replace(/\*+/g, "").replace(/\(required\)|required/gi, "").trim();
  const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  function visible(el) {
    if (!el.isConnected) return false;
    const st = getComputedStyle(el);
    if (st.display === "none" || st.visibility === "hidden") return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function htmlToText(html) {
    const d = document.createElement("div");
    d.innerHTML = html.replace(/<(br|\/p|\/li|\/h\d|\/div)>/gi, "\n$&");
    return d.textContent.replace(/\n{3,}/g, "\n\n").trim();
  }

  // Canonical URL so the posting page and its application page map to the same job.
  function canonicalUrl(href = location.href) {
    try {
      const u = new URL(href);
      const keep = ["gh_jid", "jk", "currentJobId", "jobId", "job", "id", "for", "token"];
      const params = new URLSearchParams();
      for (const k of keep) if (u.searchParams.has(k)) params.set(k, u.searchParams.get(k));
      let path = u.pathname.replace(/\/(apply|application|applications?\/new)\/?$/i, "").replace(/\/$/, "");
      if (/linkedin\.com$/.test(u.hostname) && params.get("currentJobId")) path = `/jobs/view/${params.get("currentJobId")}`, params.delete("currentJobId");
      const qs = params.toString();
      return `${u.origin}${path}${qs ? "?" + qs : ""}`;
    } catch {
      return href;
    }
  }

  // ---------------------------------------------------------------- job extraction

  const ATS_HOSTS = /(greenhouse\.io|lever\.co|ashbyhq\.com|myworkdayjobs\.com|workday\.com|smartrecruiters\.com|workable\.com|icims\.com|jobvite\.com|bamboohr\.com|recruitee\.com|breezy\.hr|teamtailor\.com|personio\.|rippling\.com|wellfound\.com|linkedin\.com\/jobs|indeed\.com|glassdoor\.)/i;

  function jsonLdJob() {
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      let data;
      try { data = JSON.parse(s.textContent); } catch { continue; }
      const stack = Array.isArray(data) ? [...data] : [data];
      while (stack.length) {
        const n = stack.shift();
        if (!n || typeof n !== "object") continue;
        if (n["@graph"]) stack.push(...n["@graph"]);
        const t = n["@type"];
        if (t === "JobPosting" || (Array.isArray(t) && t.includes("JobPosting"))) return n;
      }
    }
    return null;
  }

  function jobLocation(n) {
    const locs = Array.isArray(n.jobLocation) ? n.jobLocation : n.jobLocation ? [n.jobLocation] : [];
    const parts = locs.map((l) => {
      const a = l.address || {};
      const country = typeof a.addressCountry === "object" ? a.addressCountry.name : a.addressCountry;
      return [a.addressLocality, a.addressRegion, country].filter(Boolean).join(", ");
    }).filter(Boolean);
    if (n.jobLocationType === "TELECOMMUTE") parts.unshift("Remote");
    return [...new Set(parts)].join(" / ");
  }

  function firstText(selectors) {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && clean(el.innerText || el.textContent)) return clean(el.innerText || el.textContent);
    }
    return "";
  }

  function longestText(selectors) {
    let best = "";
    for (const sel of selectors) {
      for (const el of document.querySelectorAll(sel)) {
        const t = (el.innerText || "").trim();
        if (t.length > best.length) best = t;
      }
    }
    return best;
  }

  function extractJob() {
    const job = { title: "", company: "", location: "", description: "", url: canonicalUrl() };
    const ld = jsonLdJob();
    if (ld) {
      job.title = clean(ld.title);
      job.company = clean((ld.hiringOrganization && (ld.hiringOrganization.name || ld.hiringOrganization)) || "");
      job.location = jobLocation(ld);
      job.description = ld.description ? htmlToText(ld.description) : "";
    }
    job.title ||= firstText([
      ".job-details-jobs-unified-top-card__job-title", ".jobsearch-JobInfoHeader-title", ".posting-headline h2",
      "h1.app-title", ".job__title h1", "[data-automation-id='jobPostingHeader']", ".ashby-job-posting-heading", "h1",
    ]);
    job.company ||= firstText([
      ".job-details-jobs-unified-top-card__company-name", "[data-company-name]", ".company-name", ".main-header-logo img[alt]",
    ]) || (document.querySelector('meta[property="og:site_name"]') || {}).content || "";
    job.location ||= firstText([
      ".job-details-jobs-unified-top-card__primary-description-container .tvm__text", ".posting-categories .location",
      ".job__location", ".location", "[data-automation-id='locations']",
    ]);
    if (job.description.length < 200) {
      job.description = longestText([
        ".jobs-description__content", "#jobDescriptionText", ".posting-page .section-wrapper", "#content", ".job__description",
        "[data-automation-id='jobPostingDescription']", "._descriptionText_", "[class*='description']", "article", "main",
      ]).slice(0, 30000);
    }
    if (/^(.+?) (at|@|-|–|\|) (.+)$/.test(job.title) && !job.company) {
      const m = job.title.match(/^(.+?) (?:at|@) (.+)$/);
      if (m) { job.title = m[1]; job.company = m[2]; }
    }
    job.company = clean(job.company).slice(0, 200);
    job.title = clean(job.title).slice(0, 300);
    return job;
  }

  function looksLikeJobPage() {
    return !!jsonLdJob() || ATS_HOSTS.test(location.hostname + location.pathname);
  }

  async function jobContext() {
    if (!IS_TOP) {
      const r = await bg({ type: "getTabJob" });
      if (r.ok && r.data && r.data.title) return r.data;
    }
    return state.job || extractJob();
  }

  // ---------------------------------------------------------------- form discovery

  let nextId = 1;
  const FIELD_SEL = "input, textarea, select";
  const SKIP_TYPES = /^(hidden|submit|button|image|reset|password|search)$/i;

  function textOf(el) {
    return el ? clean(el.innerText || el.textContent || "") : "";
  }

  function labelFor(el) {
    if (el.labels && el.labels.length) {
      const t = textOf(el.labels[0]);
      if (t) return t;
    }
    const by = el.getAttribute("aria-labelledby");
    if (by) {
      const t = by.split(/\s+/).map((id) => textOf(document.getElementById(id))).join(" ").trim();
      if (t) return t;
    }
    if (el.getAttribute("aria-label")) return clean(el.getAttribute("aria-label"));
    return "";
  }

  // For radios/checkboxes/custom widgets: the question text usually lives in a
  // legend or a label-ish element above the control.
  function questionFor(el) {
    const fs = el.closest("fieldset");
    if (fs) {
      const lg = fs.querySelector("legend");
      if (lg && textOf(lg)) return textOf(lg);
    }
    const group = el.closest('[role="radiogroup"], [role="group"]');
    if (group) {
      const t = labelFor(group) || textOf(group.querySelector("label, legend, [class*='label'], [class*='question']"));
      if (t) return t;
    }
    let node = el.closest("label") || el;
    for (let depth = 0; depth < 5 && node; depth++) {
      node = node.parentElement;
      if (!node) break;
      const cands = node.querySelectorAll(":scope > label, :scope > legend, :scope > [class*='label'], :scope > [class*='question'], :scope > [class*='Label'], :scope > p, :scope > span, :scope > div > label");
      for (const cand of cands) {
        if (cand.contains(el) || cand.querySelector("input, select, textarea")) continue;
        const t = textOf(cand);
        if (t && t.length < 400) return t;
      }
    }
    return "";
  }

  function fieldLabel(el) {
    let t = "";
    if (el.type === "radio" || el.type === "checkbox") t = questionFor(el);
    if (t) return clean(t).slice(0, 400);
    t ||= labelFor(el) || (el.closest("label") ? textOf(el.closest("label")) : "") || questionFor(el);
    t ||= el.placeholder || el.name || el.id || "";
    return clean(t).slice(0, 400);
  }

  function optionLabel(input) {
    return (input.labels && input.labels[0] && textOf(input.labels[0])) || clean(input.closest("label") && input.closest("label").innerText) || input.value;
  }

  // Returns logical fields: text-like inputs, selects, radio groups, checkbox groups, file inputs.
  function collectFields(root = document) {
    const fields = [];
    const groups = new Map();
    for (const el of root.querySelectorAll(FIELD_SEL)) {
      if (el.closest("#applypilot-root")) continue;
      if (el.tagName === "INPUT" && SKIP_TYPES.test(el.type)) continue;
      if (el.disabled || el.readOnly) continue;
      if (el.type !== "file" && !visible(el)) {
        // Radios/checkboxes are often visually hidden behind custom styling.
        if (!((el.type === "radio" || el.type === "checkbox") && el.closest("label") && visible(el.closest("label")))) continue;
      }
      if (!el.dataset.applypilotId) el.dataset.applypilotId = "ap-" + nextId++;

      if (el.type === "radio" || el.type === "checkbox") {
        const key = el.type + ":" + (el.name || el.dataset.applypilotId);
        if (!groups.has(key)) {
          const g = { id: el.dataset.applypilotId, kind: el.type, elements: [], label: fieldLabel(el), required: el.required };
          groups.set(key, g);
          fields.push(g);
        }
        groups.get(key).elements.push(el);
        continue;
      }
      const f = { id: el.dataset.applypilotId, el, label: fieldLabel(el), required: el.required || el.getAttribute("aria-required") === "true" };
      if (el.tagName === "SELECT") {
        f.kind = "select";
        f.options = [...el.options].filter((o) => o.value !== "" && !/^(select|choose|--|please)/i.test(o.text.trim())).map((o) => o.text.trim());
      } else if (el.type === "file") f.kind = "file";
      else if (el.tagName === "TEXTAREA") f.kind = "textarea";
      else if (el.getAttribute("role") === "combobox" || el.getAttribute("aria-autocomplete") === "list") f.kind = "combobox";
      else f.kind = "text";
      fields.push(f);
    }
    for (const g of fields) {
      if (g.kind === "radio" || g.kind === "checkbox") {
        g.options = g.elements.map(optionLabel);
        if (g.kind === "checkbox" && g.elements.length === 1) {
          g.kind = "checkbox1"; // single consent / yes-no checkbox
          const c = g.elements[0];
          g.label = labelFor(c) || (c.closest("label") ? textOf(c.closest("label")) : "") || g.label;
        }
      }
    }
    return fields;
  }

  function isApplicationForm(fields) {
    const texty = fields.filter((f) => f.kind !== "checkbox1");
    const hasIdentity = fields.some((f) => /e-?mail|first name|full name|last name|phone/i.test(f.label));
    const hasResume = fields.some((f) => f.kind === "file" && /resume|cv/i.test(f.label + " " + (f.el && f.el.name)));
    return texty.length >= 3 && (hasIdentity || hasResume);
  }

  function isFilled(f) {
    if (f.kind === "radio" || f.kind === "checkbox") return f.elements.some((e) => e.checked);
    if (f.kind === "checkbox1") return f.elements[0].checked;
    if (f.kind === "file") return f.el.files && f.el.files.length > 0;
    if (f.kind === "select") return f.el.selectedIndex > 0 && f.el.value !== "";
    return (f.el.value || "").trim() !== "";
  }

  // ---------------------------------------------------------------- heuristic mapping

  function yn(v) {
    if (v == null || v === "") return "";
    if (typeof v === "boolean") return v ? "Yes" : "No";
    return /^(y|yes|true)$/i.test(String(v).trim()) ? "Yes" : /^(n|no|false)$/i.test(String(v).trim()) ? "No" : String(v);
  }

  function latestJob(p) {
    const w = p.work_experience || [];
    return w.find((x) => x.current) || w[0] || {};
  }

  function heuristicValue(f, p) {
    const el = f.el || (f.elements && f.elements[0]);
    const key = norm([f.label, el && el.name, el && el.id, el && el.getAttribute("autocomplete"), el && el.placeholder].join(" "));
    const L = p.location || {}, links = p.links || {}, pref = p.preferences || {}, eeo = p.eeo || {};
    const edu = (p.education || [])[0] || {};
    const work = latestJob(p);
    const full = [p.first_name, p.last_name].filter(Boolean).join(" ");
    const rules = [
      [/\b(first|given) ?name\b|\bfname\b|\bgiven name\b/, p.first_name],
      [/\b(last|family) ?name\b|\bsurname\b|\blname\b/, p.last_name],
      [/\bpreferred (first )?name\b/, p.first_name],
      [/\bmiddle name\b/, ""],
      [/\b(full|legal) ?name\b|^name$|^your name$/, full],
      [/\be ?mail\b/, p.email],
      [/\b(phone|mobile|telephone|cell)\b|\btel\b/, p.phone],
      [/linkedin/, links.linkedin],
      [/github/, links.github],
      [/twitter|\bx com\b/, links.twitter],
      [/portfolio/, links.portfolio || links.website],
      [/\bwebsite\b|personal (site|url)|\bblog\b|other url/, links.website || links.portfolio],
      [/\b(zip|postal) ?code\b|\bpostcode\b/, L.postal_code],
      [/\bcity\b|\btown\b/, L.city],
      [/\bstate\b|\bprovince\b|\bregion\b|\bcounty\b/, L.state],
      [/\bcountry\b/, L.country],
      [/\baddress\b|\bstreet\b/, L.address],
      [/\blocation\b|where are you (located|based)|current(ly)? (location|based)/, [L.city, L.state, L.country].filter(Boolean).join(", ")],
      [/(current|most recent|present) (company|employer)|^company$|\bemployer\b/, work.company],
      [/(current|most recent) (job )?(title|role|position)|^job title$|^title$/, work.title],
      [/\b(school|university|college|institution)\b/, edu.school],
      [/\bdegree\b/, edu.degree],
      [/\b(major|field of study|discipline|course of study)\b/, edu.field_of_study],
      [/\bgpa\b|\bgrade point\b/, edu.gpa],
      [/graduat(ion|e) (date|year)/, edu.end_date],
      [/\bsponsor/, yn(pref.requires_sponsorship)],
      [/\breloca/, yn(pref.willing_to_relocate)],
      [/salary|compensation|pay (expectation|requirement)|expected (pay|ctc)/, pref.desired_salary],
      [/notice period/, pref.notice_period],
      [/(earliest )?start date|when can you start|available to start/, pref.earliest_start_date],
      [/\bpronoun/, eeo.pronouns],
      [/\bgender\b|\bsex\b/, eeo.gender],
      [/hispanic|latino/, eeo.hispanic_latino],
      [/\brace\b|ethnic/, eeo.race],
      [/veteran/, eeo.veteran_status],
      [/disabilit/, eeo.disability_status],
    ];
    for (const [re, val] of rules) {
      if (re.test(key)) return val == null ? "" : String(val);
    }
    // Saved answers: fuzzy match the question text.
    const q = new Set(norm(f.label).split(" ").filter((w) => w.length > 2));
    if (q.size >= 2) {
      for (const qa of p.custom_answers || []) {
        const words = norm(qa.question).split(" ").filter((w) => w.length > 2);
        if (!words.length) continue;
        const hit = words.filter((w) => q.has(w)).length / Math.max(words.length, q.size);
        if (hit >= 0.6 && qa.answer) return qa.answer;
      }
    }
    return null; // unknown -> AI
  }

  function bestOption(options, value) {
    if (!value) return -1;
    const v = norm(value);
    let i = options.findIndex((o) => norm(o) === v);
    if (i < 0) i = options.findIndex((o) => norm(o).startsWith(v) || v.startsWith(norm(o)));
    if (i < 0 && v.length >= 3) i = options.findIndex((o) => norm(o).includes(v) || v.includes(norm(o)));
    if (i < 0 && /^(yes|no)$/.test(v)) i = options.findIndex((o) => norm(o).split(" ")[0] === v);
    return i;
  }

  // ---------------------------------------------------------------- filling

  function setNativeValue(el, value) {
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : el.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
    el.focus({ preventScroll: true });
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  function flash(el) {
    const target = el.type === "radio" || el.type === "checkbox" ? el.closest("label") || el : el;
    const prev = target.style.boxShadow;
    target.style.transition = "box-shadow .3s";
    target.style.boxShadow = "0 0 0 2px rgba(90,82,223,.55)";
    setTimeout(() => (target.style.boxShadow = prev), 1800);
  }

  async function fillCombobox(el, value) {
    setNativeValue(el, value);
    el.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" }));
    for (let i = 0; i < 12; i++) {
      await sleep(120);
      const opts = [...document.querySelectorAll('[role="option"]')].filter(visible);
      if (!opts.length) continue;
      const idx = bestOption(opts.map((o) => textOf(o)), value);
      if (idx >= 0) {
        opts[idx].dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        opts[idx].click();
        return true;
      }
      return false;
    }
    return false;
  }

  async function fillField(f, value) {
    if (value == null || value === "") return false;
    switch (f.kind) {
      case "text":
      case "textarea": {
        let v = String(value);
        if (f.el.maxLength > 0) v = v.slice(0, f.el.maxLength);
        if (f.el.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
        if (f.el.type === "number" && isNaN(Number(v))) return false;
        setNativeValue(f.el, v);
        flash(f.el);
        return true;
      }
      case "combobox": {
        const ok = await fillCombobox(f.el, String(value));
        if (ok) flash(f.el);
        return ok;
      }
      case "select": {
        const opts = [...f.el.options];
        const idx = bestOption(opts.map((o) => o.text.trim()), String(value));
        if (idx < 0) return false;
        setNativeValue(f.el, opts[idx].value);
        flash(f.el);
        return true;
      }
      case "radio": {
        const idx = bestOption(f.options, String(value));
        if (idx < 0) return false;
        const r = f.elements[idx];
        if (!r.checked) r.click();
        flash(r);
        return true;
      }
      case "checkbox": {
        const wanted = String(value).split(/\s*[,;]\s*/);
        let any = false;
        for (const w of wanted) {
          const idx = bestOption(f.options, w);
          if (idx >= 0 && !f.elements[idx].checked) { f.elements[idx].click(); flash(f.elements[idx]); any = true; }
        }
        return any;
      }
      case "checkbox1": {
        const want = /^(true|yes|1)$/i.test(String(value));
        const c = f.elements[0];
        if (c.checked !== want) c.click();
        flash(c);
        return true;
      }
    }
    return false;
  }

  async function attachResume(f) {
    const r = await bg({ type: "resume" });
    if (!r.ok) return { ok: false, error: r.error };
    const bytes = Uint8Array.from(atob(r.data.base64), (c) => c.charCodeAt(0));
    const file = new File([bytes], r.data.filename, { type: r.data.contentType });
    const dt = new DataTransfer();
    dt.items.add(file);
    f.el.files = dt.files;
    f.el.dispatchEvent(new Event("input", { bubbles: true }));
    f.el.dispatchEvent(new Event("change", { bubbles: true }));
    // Some ATSs use a drop zone instead of listening to the input.
    const zone = f.el.closest("[class*='drop'], [class*='upload'], [data-testid*='upload']");
    if (zone) {
      try { zone.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: dt })); } catch {}
    }
    return { ok: true };
  }

  const isEssay = (f) => f.kind === "textarea" && !/address|street/i.test(f.label);

  let autofilling = false;
  async function autofill() {
    if (autofilling) return null;
    autofilling = true;
    try {
      const fields = collectFields();
      if (!isApplicationForm(fields)) return null;
      const pr = await bg({ type: "profile", force: true });
      if (!pr.ok) throw new Error(pr.error);
      const profile = pr.data || {};
      const pending = fields.filter((f) => !isFilled(f));
      let filled = 0;
      const unresolved = [];
      let resumeNote = "";

      for (const f of pending) {
        if (f.kind === "file") {
          const k = (f.label + " " + (f.el.name || "") + " " + (f.el.id || "")).toLowerCase();
          if (/cover/.test(k)) continue;
          if (/resume|cv|attach|upload/.test(k) || fields.filter((x) => x.kind === "file").length === 1) {
            const r = await attachResume(f);
            if (r.ok) filled++;
            else resumeNote = r.error;
          }
          continue;
        }
        if (isEssay(f)) continue; // handled by the per-field AI button
        if (f.kind === "checkbox1" && /agree|consent|terms|privacy|acknowledge|certify|attest/i.test(f.label)) continue; // user must tick these
        const v = heuristicValue(f, profile);
        if (v === null || v === "") {
          unresolved.push(f);
          continue;
        }
        if (await fillField(f, v)) filled++;
        else unresolved.push(f);
      }

      // Ask Claude for the rest (choices, screening questions, odd labels).
      let aiFilled = 0;
      const aiFields = unresolved.filter((f) => f.label && f.label.length > 1);
      if (aiFields.length) {
        const job = await jobContext();
        const payload = aiFields.map((f) => ({
          id: f.id,
          label: f.label,
          type: f.kind === "checkbox1" ? "checkbox" : f.kind,
          name: (f.el && f.el.name) || undefined,
          placeholder: (f.el && f.el.placeholder) || undefined,
          options: f.options && f.options.length ? f.options.slice(0, 80) : undefined,
          required: !!f.required,
        }));
        try {
          const res = await api("/ai/map-fields", "POST", { job: { title: job.title, company: job.company, location: job.location, description: (job.description || "").slice(0, 8000), url: job.url }, fields: payload });
          const byId = new Map(aiFields.map((f) => [f.id, f]));
          for (const { id, value } of res.values || []) {
            const f = byId.get(id);
            if (f && (await fillField(f, value))) aiFilled++;
          }
        } catch (e) {
          resumeNote = (resumeNote ? resumeNote + " · " : "") + "AI: " + e.message;
        }
      }
      markAutofilled();
      addEssayButtons();
      const essays = fields.filter((f) => isEssay(f) && !isFilled(f)).length;
      return { filled: filled + aiFilled, aiFilled, total: fields.length, essays, note: resumeNote };
    } finally {
      autofilling = false;
    }
  }

  // ---------------------------------------------------------------- AI essay buttons

  function addEssayButtons() {
    for (const ta of document.querySelectorAll("textarea")) {
      if (ta.dataset.applypilotBtn || !visible(ta) || ta.closest("#applypilot-root")) continue;
      const label = fieldLabel(ta);
      if (/address|street/i.test(label)) continue;
      ta.dataset.applypilotBtn = "1";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "✦ Write with AI";
      btn.setAttribute("style", "all:initial;display:inline-block;margin:6px 0 2px;padding:6px 11px;border-radius:8px;background:#5a52df;color:#fff;font:600 12px/1.2 system-ui,sans-serif;cursor:pointer;box-shadow:0 4px 12px -4px rgba(90,82,223,.6);");
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const original = btn.textContent;
        btn.textContent = "Writing…";
        btn.style.opacity = "0.7";
        try {
          const job = await jobContext();
          const res = await api("/ai/answer", "POST", {
            job: { title: job.title || "(unknown role)", company: job.company, location: job.location, description: (job.description || "").slice(0, 12000), url: job.url },
            question: label || "Tell us about yourself",
            max_chars: ta.maxLength > 0 ? ta.maxLength : 1500,
          });
          setNativeValue(ta, res.answer);
          flash(ta);
          btn.textContent = "↻ Rewrite with AI";
        } catch (err) {
          btn.textContent = original;
          alert("ApplyPilot: " + err.message);
        } finally {
          btn.style.opacity = "1";
        }
      });
      ta.insertAdjacentElement("afterend", btn);
    }
  }

  // ---------------------------------------------------------------- applied tracking

  let usedAutofill = false;
  let reportedApplied = false;
  function markAutofilled() { usedAutofill = true; }

  async function reportApplied() {
    if (reportedApplied) return;
    reportedApplied = true;
    const job = await jobContext();
    try {
      const saved = await api("/jobs", "POST", { ...job, url: job.url || canonicalUrl(), status: "applied", source: "extension" });
      bg({ type: "toTop", payload: { type: "applied", job: saved } });
    } catch {
      reportedApplied = false;
    }
  }

  function watchSubmit() {
    document.addEventListener("submit", (e) => {
      const fields = collectFields(e.target);
      if (usedAutofill || isApplicationForm(fields)) reportApplied();
    }, true);
    document.addEventListener("click", (e) => {
      const b = e.target.closest && e.target.closest("button, input[type=submit], [role=button]");
      if (!b) return;
      const t = (b.innerText || b.value || "").trim();
      if (/^(submit( (my )?application)?|send application|apply( now)?|finish|complete application)$/i.test(t) && (usedAutofill || isApplicationForm(collectFields()))) {
        // Give the form a moment to validate; only report if the page moves on or the button is gone.
        const before = location.href;
        setTimeout(() => {
          if (location.href !== before || !b.isConnected || /thank|received|submitted/i.test(document.body.innerText.slice(0, 5000))) reportApplied();
        }, 2500);
      }
    }, true);
  }

  // ---------------------------------------------------------------- message handling

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "autofill") {
      bg({ type: "state" }).then(async (st) => {
        if (!st.ok || !st.data.loggedIn) {
          if (IS_TOP) panel.show("Sign in to ApplyPilot first.");
          return;
        }
        try {
          const r = await autofill();
          if (r) bg({ type: "toTop", payload: { type: "fillReport", result: r } });
        } catch (e) {
          bg({ type: "toTop", payload: { type: "fillReport", error: e.message } });
        }
      });
      sendResponse({ ok: true });
      return;
    }
    if (!IS_TOP) return;
    if (msg.type === "fillReport") panel.onFillReport(msg);
    else if (msg.type === "frameHasForm") panel.show();
    else if (msg.type === "applied") panel.onApplied(msg.job);
    else if (msg.type === "getJob") sendResponse({ ok: true, data: state.job || extractJob() });
    else if (msg.type === "saveJob") {
      panel.show();
      panel.saveJob().then((j) => sendResponse({ ok: !!j, data: j }));
      return true;
    }
  });

  // ---------------------------------------------------------------- floating panel (top frame)

  const state = { job: null, saved: null, loggedIn: false };

  const panel = (() => {
    let host, root, els = {}, shown = false, fillTotals = null, fillTimer = null;

    function build() {
      host = document.createElement("div");
      host.id = "applypilot-root";
      host.style.cssText = "all:initial;position:fixed;top:96px;right:16px;z-index:2147483646;";
      root = host.attachShadow({ mode: "closed" });
      root.innerHTML = `
        <style>
          :host { all: initial; }
          * { box-sizing: border-box; font-family: "Inter Variable", Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; -webkit-font-smoothing: antialiased; }
          .pill { display:flex; align-items:center; gap:8px; background:#0b0b12; color:#fff; border:0; border-radius:999px; padding:6px 14px 6px 6px; font-size:13px; font-weight:600; cursor:pointer; box-shadow:0 10px 28px -8px rgba(16,16,32,.45); transition:transform .15s; }
          .pill:hover { transform:translateX(-2px); }
          .card { width:320px; background:#fff; color:#0b0b12; border:1px solid #e8e8ee; border-radius:16px; box-shadow:0 18px 44px -12px rgba(16,16,32,.28), 0 2px 6px rgba(16,16,32,.06); overflow:hidden; animation:in .2s ease-out; }
          @keyframes in { from { opacity:0; transform:translateY(6px) scale(.98); } to { opacity:1; transform:none; } }
          .hd { display:flex; align-items:center; gap:8px; padding:12px 12px 12px 14px; }
          .brand { display:flex; align-items:center; gap:8px; font-weight:650; font-size:14px; letter-spacing:-.01em; flex:1; }
          .logo { width:24px; height:24px; border-radius:8px; background:linear-gradient(145deg,#7a74f0,#4a42c4); display:grid; place-items:center; box-shadow:inset 0 1px 0 rgba(255,255,255,.2); flex-shrink:0; }
          .x { border:0; background:none; color:#9a9aab; cursor:pointer; padding:5px; border-radius:7px; display:grid; place-items:center; }
          .x:hover { background:#f4f4f7; color:#0b0b12; }
          .bd { padding:0 14px 14px; display:grid; gap:10px; }
          .job { display:flex; gap:10px; align-items:center; padding:10px; border:1px solid #efeff4; border-radius:12px; background:#fafafc; }
          .av { width:34px; height:34px; border-radius:9px; display:grid; place-items:center; color:#fff; font-weight:650; font-size:13px; flex-shrink:0; }
          .job .t { font-size:13.5px; font-weight:600; line-height:1.3; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
          .job .c { font-size:12px; color:#6b6b7b; margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
          .muted { color:#6b6b7b; font-size:12px; }
          .btn { width:100%; height:38px; border-radius:10px; border:1px solid #e8e8ee; background:#fff; color:#0b0b12; font-size:13px; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:7px; box-shadow:0 1px 2px rgba(16,16,32,.04); transition:background .15s, transform .1s; }
          .btn:hover { background:#f7f7f9; border-color:#d9d9e2; }
          .btn:active { transform:scale(.985); }
          .btn.primary { background:#5a52df; border-color:#5a52df; color:#fff; height:42px; box-shadow:inset 0 1px 0 rgba(255,255,255,.15), 0 6px 16px -6px rgba(90,82,223,.7); }
          .btn.primary:hover { background:#4a42c4; }
          .btn .k { margin-left:auto; font-size:10.5px; font-weight:500; opacity:.7; border:1px solid rgba(255,255,255,.35); border-radius:5px; padding:1px 5px; }
          .btn.primary { justify-content:flex-start; padding:0 12px; }
          .btn[disabled] { opacity:.6; cursor:default; }
          .row { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
          .msg { font-size:12.5px; line-height:1.45; padding:10px 12px; border-radius:10px; background:#f7f7f9; color:#33333f; }
          .msg.ok { background:#ecfdf5; color:#065f46; }
          .msg.err { background:#fff1f2; color:#9f1239; }
          .score { display:flex; align-items:center; gap:12px; }
          .score .v { font-size:13px; font-weight:600; text-transform:capitalize; }
          .chips { display:flex; flex-wrap:wrap; gap:4px; margin-top:6px; }
          .chip { font-size:11px; padding:2px 7px; border-radius:6px; background:#fff1f2; color:#9f1239; font-weight:500; }
          .badge { font-size:11px; font-weight:600; padding:3px 8px; border-radius:999px; background:#f1f1fe; color:#4a42c4; text-transform:capitalize; display:inline-flex; align-items:center; gap:5px; }
          .badge:before { content:""; width:6px; height:6px; border-radius:50%; background:#6d67eb; }
          .ft { display:flex; align-items:center; justify-content:space-between; border-top:1px solid #f0f0f4; padding:10px 14px; }
          a { color:#5a52df; text-decoration:none; font-size:12px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:4px; }
          a:hover { color:#4a42c4; }
          .spin { width:14px; height:14px; border:2px solid currentColor; border-right-color:transparent; border-radius:50%; animation:s .7s linear infinite; }
          @keyframes s { to { transform: rotate(360deg); } }
          .hidden { display:none !important; }
        </style>
        <button class="pill hidden" id="pill"><span class="logo"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17 L10 7 L14 13 L20 5"/><path d="M15.5 5H20v4.5"/></svg></span> ApplyPilot</button>
        <div class="card hidden" id="card">
          <div class="hd">
            <div class="brand"><span class="logo"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17 L10 7 L14 13 L20 5"/><path d="M15.5 5H20v4.5"/></svg></span> ApplyPilot</div>
            <span class="badge hidden" id="status"></span>
            <button class="x" id="min" title="Minimize"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg></button>
          </div>
          <div class="bd">
            <div id="signedOut" class="hidden">
              <p class="muted" style="margin:0 0 10px">Sign in to autofill applications and track every job you apply to.</p>
              <button class="btn primary" id="signin" style="justify-content:center">Sign in to ApplyPilot</button>
            </div>
            <div id="signedIn" class="bd" style="padding:0">
              <div class="job" id="job"></div>
              <button class="btn primary" id="fill"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.6 4.6 1.9-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/><path d="M19 15l.8 1.9 1.9.8-1.9.8L19 20.4l-.8-1.9-1.9-.8 1.9-.8z"/></svg> Autofill application<span class="k">Alt⇧F</span></button>
              <div class="row">
                <button class="btn" id="save"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg> Save job</button>
                <button class="btn" id="match"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg> Match</button>
              </div>
              <button class="btn" id="tailor"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.6 4.6 1.9-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/><path d="M19 15l.8 1.9 1.9.8-1.9.8L19 20.4l-.8-1.9-1.9-.8 1.9-.8z"/></svg> Tailor resume</button>
              <div id="out" class="hidden"></div>
            </div>
          </div>
          <div class="ft" id="ft"><span class="muted">Review before submitting</span><a id="dash">Dashboard <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></a></div>
        </div>`;
      const $ = (id) => root.getElementById(id);
      els = { pill: $("pill"), card: $("card"), job: $("job"), fill: $("fill"), save: $("save"), match: $("match"), tailor: $("tailor"), out: $("out"), status: $("status"), signedIn: $("signedIn"), signedOut: $("signedOut") };
      $("min").onclick = () => collapse(true);
      els.pill.onclick = () => collapse(false);
      $("signin").onclick = () => bg({ type: "openDashboard", path: "/login" });
      $("dash").onclick = () => bg({ type: "openDashboard", path: state.saved ? `/jobs/${state.saved.id}` : "/dashboard" });
      els.fill.onclick = runAutofill;
      els.save.onclick = () => saveJob();
      els.match.onclick = runMatch;
      els.tailor.onclick = runTailor;
      document.documentElement.appendChild(host);
    }

    function collapse(c) {
      els.card.classList.toggle("hidden", c);
      els.pill.classList.toggle("hidden", !c);
      try { sessionStorage.setItem("applypilot.collapsed", c ? "1" : ""); } catch {}
    }

    function render() {
      els.signedIn.classList.toggle("hidden", !state.loggedIn);
      els.signedOut.classList.toggle("hidden", state.loggedIn);
      const j = state.job || {};
      els.job.innerHTML = "";
      const name = j.company || j.title || "?";
      const av = document.createElement("span");
      av.className = "av";
      av.textContent = name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
      av.style.background = avatarColor(name);
      const txt = document.createElement("div");
      txt.style.minWidth = "0";
      const t = document.createElement("div");
      t.className = "t";
      t.textContent = j.title || "Job application";
      const c = document.createElement("div");
      c.className = "c";
      c.textContent = [j.company, j.location].filter(Boolean).join(" · ") || location.hostname;
      txt.append(t, c);
      els.job.append(av, txt);
      if (state.saved) {
        els.status.textContent = state.saved.status;
        els.status.classList.remove("hidden");
        els.save.innerHTML = SAVED_HTML;
      }
    }

    function out(html, kind = "") {
      els.out.className = "msg " + kind;
      els.out.innerHTML = html;
    }

    function busy(btn, on, label) {
      btn.disabled = on;
      if (on) { btn.dataset.html = btn.innerHTML; btn.innerHTML = `<span class="spin"></span>${label || ""}`; }
      else if (btn.dataset.html) btn.innerHTML = btn.dataset.html;
    }

    async function runAutofill() {
      busy(els.fill, true, "Filling…");
      fillTotals = { filled: 0, aiFilled: 0, essays: 0, notes: [], frames: 0 };
      bg({ type: "broadcast", payload: { type: "autofill" } });
      clearTimeout(fillTimer);
      fillTimer = setTimeout(() => {
        busy(els.fill, false);
        if (!fillTotals.frames) out("No application form found on this page. Open the “Apply” form and try again.", "err");
      }, 25000);
    }

    function onFillReport(msg) {
      if (!fillTotals) fillTotals = { filled: 0, aiFilled: 0, essays: 0, notes: [], frames: 0 };
      fillTotals.frames++;
      if (msg.error) fillTotals.notes.push(msg.error);
      else {
        fillTotals.filled += msg.result.filled;
        fillTotals.aiFilled += msg.result.aiFilled;
        fillTotals.essays += msg.result.essays;
        if (msg.result.note) fillTotals.notes.push(msg.result.note);
      }
      clearTimeout(fillTimer);
      busy(els.fill, false);
      const t = fillTotals;
      let html = `<b>Filled ${t.filled} field${t.filled === 1 ? "" : "s"}</b>${t.aiFilled ? ` (${t.aiFilled} with AI)` : ""}.`;
      if (t.essays) html += `<br>${t.essays} written question${t.essays === 1 ? "" : "s"} left: use <b>✦ Write with AI</b> under each.`;
      html += "<br>Review everything before submitting.";
      if (t.notes.length) html += `<br><span style="color:#991b1b">${escapeHtml(t.notes.join(" · "))}</span>`;
      out(html, "ok");
    }

    async function saveJob() {
      if (state.saved) return state.saved;
      busy(els.save, true);
      try {
        let job = state.job || extractJob();
        if (job.description.length < 300 || !job.title) {
          const text = document.body.innerText.slice(0, 40000);
          try {
            const ai = await api("/ai/extract-job", "POST", { url: job.url, page_text: text });
            job = { ...job, ...Object.fromEntries(Object.entries(ai).filter(([, v]) => v)), url: job.url };
          } catch {}
        }
        state.job = job;
        bg({ type: "setTabJob", job });
        state.saved = await api("/jobs", "POST", { ...job, source: "extension" });
        render();
        out("Saved to your tracker.", "ok");
        return state.saved;
      } catch (e) {
        out(escapeHtml(e.message), "err");
      } finally {
        busy(els.save, false);
        if (state.saved) els.save.innerHTML = SAVED_HTML;
      }
    }

    async function runMatch() {
      busy(els.match, true);
      try {
        const saved = state.saved || (await saveJob());
        if (!saved) return;
        const m = await api("/ai/match", "POST", { job_id: saved.id });
        const chips = (m.missing_skills || []).slice(0, 8).map((s) => `<span class="chip">${escapeHtml(s)}</span>`).join("");
        out(`<div class="score">${ring(m.score)}<div><div class="v" style="color:${tone(m.score)}">${escapeHtml(m.verdict)} fit</div><div class="muted">${m.score}% match with your profile</div></div></div>
             <div style="margin-top:4px">${escapeHtml(m.summary)}</div>
             ${chips ? `<div class="muted" style="margin-top:6px">Missing</div><div class="chips">${chips}</div>` : ""}`);
      } catch (e) {
        out(escapeHtml(e.message), "err");
      } finally {
        busy(els.match, false);
      }
    }

    async function runTailor() {
      busy(els.tailor, true, "Tailoring…");
      try {
        const saved = state.saved || (await saveJob());
        if (!saved) return;
        const t = await api("/ai/tailor-resume", "POST", { job_id: saved.id });
        renderTailor(t);
      } catch (e) {
        out(escapeHtml(e.message), "err");
      } finally {
        busy(els.tailor, false);
      }
    }

    function renderTailor(t) {
      out(`<div><b>${escapeHtml(t.headline || "Tailored resume ready")}</b></div>
           <div class="muted" style="margin-top:4px">${escapeHtml(t.summary || "")}</div>
           <button class="btn" id="dlpdf" style="margin-top:10px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m-4-4 4 4 4-4M4 21h16"/></svg> Download tailored resume (PDF)</button>`, "ok");
      const btn = els.out.querySelector("#dlpdf");
      if (btn) btn.onclick = () => downloadTailoredPdf(t.generation_id, btn);
    }

    async function downloadTailoredPdf(generationId, btn) {
      busy(btn, true, "Preparing…");
      const r = await bg({ type: "downloadResumePdf", generationId });
      busy(btn, false);
      if (!r.ok) out(escapeHtml(r.error || "Could not download the PDF."), "err");
    }

    function onApplied(job) {
      state.saved = job;
      if (shown) { render(); out("Marked as <b>applied</b> in your tracker. Good luck!", "ok"); }
    }

    function show(message) {
      if (!host) build();
      if (!shown) {
        shown = true;
        let collapsed = false;
        try { collapsed = sessionStorage.getItem("applypilot.collapsed") === "1"; } catch {}
        collapse(collapsed);
      }
      render();
      if (message) { collapse(false); out(escapeHtml(message), "err"); }
    }

    return { show, onFillReport, onApplied, saveJob, render };
  })();

  const SAVED_HTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg> Saved';
  const AV_COLORS = ["#5a52df", "#0e9f6e", "#d97706", "#e11d48", "#0891b2", "#7c3aed", "#db2777", "#2563eb", "#65a30d", "#ea580c"];
  function avatarColor(n) {
    let h = 0;
    for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0;
    const c = AV_COLORS[h % AV_COLORS.length];
    return `linear-gradient(135deg, ${c}, ${c}cc)`;
  }
  function tone(score) { return score >= 75 ? "#059669" : score >= 50 ? "#d97706" : "#e11d48"; }
  function ring(score) {
    const r = 19, c = 2 * Math.PI * r;
    return `<svg width="46" height="46" viewBox="0 0 46 46" style="flex-shrink:0"><circle cx="23" cy="23" r="${r}" fill="none" stroke="#ededf2" stroke-width="5"/><circle cx="23" cy="23" r="${r}" fill="none" stroke="${tone(score)}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - score / 100)}" transform="rotate(-90 23 23)"/><text x="23" y="27.5" text-anchor="middle" font-size="13" font-weight="700" fill="#0b0b12">${score}</text></svg>`;
  }

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  // ---------------------------------------------------------------- boot

  async function boot() {
    const st = await bg({ type: "state" });
    if (!st.ok) return;
    state.loggedIn = st.data.loggedIn;
    if (location.origin === new URL(st.data.webUrl).origin) return; // no panel on our own dashboard

    watchSubmit();

    let lookedUp = "";
    const check = async () => {
      const hasForm = isApplicationForm(collectFields());
      if (IS_TOP) {
        const jobPage = looksLikeJobPage();
        if (jobPage || hasForm) {
          state.job = extractJob();
          bg({ type: "setTabJob", job: state.job });
          panel.show();
          if (state.loggedIn && !state.saved && lookedUp !== state.job.url) {
            lookedUp = state.job.url;
            try { state.saved = await api(`/jobs/lookup?url=${encodeURIComponent(state.job.url)}`); panel.render(); } catch {}
          }
        }
      } else if (hasForm) {
        bg({ type: "toTop", payload: { type: "frameHasForm" } });
      }
      if (hasForm && state.loggedIn) addEssayButtons();
    };
    await check();

    // SPA job boards (LinkedIn, Workday, Ashby) render late and change URL without reloading.
    let lastUrl = location.href;
    let t;
    new MutationObserver(() => {
      clearTimeout(t);
      t = setTimeout(() => {
        if (location.href !== lastUrl) {
          lastUrl = location.href;
          state.saved = null;
          reportedApplied = false;
        }
        check();
      }, 800);
    }).observe(document.documentElement, { childList: true, subtree: true });

    chrome.storage.onChanged.addListener((ch) => {
      if (ch.token) {
        state.loggedIn = !!ch.token.newValue;
        check();
      }
    });
  }

  boot();
})();
