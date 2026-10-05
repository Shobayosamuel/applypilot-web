// ApplyPilot service worker: owns the session, proxies API calls (no CORS
// issues from content scripts), and relays messages between frames of a tab.

const DEFAULTS = { apiUrl: "http://localhost:8080", webUrl: "http://localhost:3000" };

async function settings() {
  const s = await chrome.storage.local.get(["apiUrl", "webUrl", "token", "user"]);
  return {
    apiUrl: (s.apiUrl || DEFAULTS.apiUrl).replace(/\/$/, ""),
    webUrl: (s.webUrl || DEFAULTS.webUrl).replace(/\/$/, ""),
    token: s.token || null,
    user: s.user || null,
  };
}

async function api(path, { method = "GET", body } = {}) {
  const { apiUrl, token } = await settings();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let res;
  try {
    res = await fetch(`${apiUrl}/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (e) {
    return { ok: false, status: 0, error: `Can't reach ApplyPilot API at ${apiUrl}` };
  }
  if (res.status === 401 && token) {
    await chrome.storage.local.remove(["token", "user"]);
  }
  let data = null;
  if (res.status !== 204) {
    try { data = await res.json(); } catch { data = null; }
  }
  if (!res.ok) return { ok: false, status: res.status, error: (data && data.error) || res.statusText };
  return { ok: true, status: res.status, data };
}

// Short-lived profile cache so every frame on a page doesn't refetch it.
let profileCache = { at: 0, data: null };
async function getProfile(force) {
  if (!force && profileCache.data && Date.now() - profileCache.at < 60_000) return { ok: true, data: profileCache.data };
  const r = await api("/profile");
  if (r.ok) profileCache = { at: Date.now(), data: r.data.profile };
  return r.ok ? { ok: true, data: r.data.profile } : r;
}

async function getResume() {
  const { apiUrl, token } = await settings();
  if (!token) return { ok: false, error: "Not signed in" };
  const res = await fetch(`${apiUrl}/api/resumes/default/file`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 404) return { ok: false, error: "No resume uploaded yet" };
  if (!res.ok) return { ok: false, error: `Resume download failed (${res.status})` };
  const buf = new Uint8Array(await res.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return {
    ok: true,
    data: {
      base64: btoa(bin),
      filename: res.headers.get("X-Resume-Filename") || "resume.pdf",
      contentType: res.headers.get("Content-Type") || "application/pdf",
    },
  };
}

// Fetches a tailored resume PDF and saves it with chrome.downloads (content
// scripts can't call that API directly, so the panel asks the background page).
async function downloadResumePdf(generationId) {
  const { apiUrl, token } = await settings();
  if (!token) return { ok: false, error: "Not signed in" };
  let res;
  try {
    res = await fetch(`${apiUrl}/api/ai/generations/${generationId}/resume.pdf`, { headers: { Authorization: `Bearer ${token}` } });
  } catch (e) {
    return { ok: false, error: `Can't reach ApplyPilot API at ${apiUrl}` };
  }
  if (!res.ok) {
    let msg = `Could not generate the PDF (${res.status})`;
    try { const j = await res.json(); if (j.error) msg = j.error; } catch {}
    return { ok: false, error: msg };
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  const match = /filename="?([^";]+)"?/.exec(res.headers.get("Content-Disposition") || "");
  const filename = match ? match[1] : "resume.pdf";
  try {
    const id = await chrome.downloads.download({ url: `data:application/pdf;base64,${btoa(bin)}`, filename, saveAs: false });
    return { ok: true, data: { downloadId: id } };
  } catch (e) {
    return { ok: false, error: "Download failed: " + (e.message || e) };
  }
}

// Per-tab job context so iframes (e.g. embedded Greenhouse forms) can use the
// job details the top frame extracted.
const tabJobs = new Map();
chrome.tabs.onRemoved.addListener((id) => tabJobs.delete(id));

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handle(msg, sender).then(sendResponse, (e) => sendResponse({ ok: false, error: String(e && e.message || e) }));
  return true; // async response
});

async function handle(msg, sender) {
  const tabId = sender.tab && sender.tab.id;
  switch (msg.type) {
    case "state": {
      const s = await settings();
      return { ok: true, data: { loggedIn: !!s.token, user: s.user, apiUrl: s.apiUrl, webUrl: s.webUrl } };
    }
    case "api":
      return api(msg.path, { method: msg.method, body: msg.body });
    case "profile":
      return getProfile(msg.force);
    case "resume":
      return getResume();
    case "downloadResumePdf":
      return downloadResumePdf(msg.generationId);
    case "login": {
      const r = await api("/auth/login", { method: "POST", body: { email: msg.email, password: msg.password } });
      if (!r.ok) return r;
      await chrome.storage.local.set({ token: r.data.token, user: r.data.user });
      profileCache = { at: 0, data: null };
      return { ok: true, data: r.data.user };
    }
    case "logout":
      await chrome.storage.local.remove(["token", "user"]);
      profileCache = { at: 0, data: null };
      return { ok: true };
    case "webAuth": {
      // Only accept sessions from the configured dashboard origin.
      const { webUrl } = await settings();
      const senderOrigin = sender.origin || (sender.url && new URL(sender.url).origin);
      if (senderOrigin !== new URL(webUrl).origin) return { ok: false, error: "origin not allowed" };
      if (!msg.token) {
        await chrome.storage.local.remove(["token", "user"]);
        return { ok: true };
      }
      const cur = await chrome.storage.local.get(["token"]);
      if (cur.token === msg.token) return { ok: true, data: "unchanged" };
      await chrome.storage.local.set({ token: msg.token });
      const me = await api("/me");
      if (!me.ok) {
        await chrome.storage.local.remove(["token", "user"]);
        return me;
      }
      await chrome.storage.local.set({ user: me.data });
      profileCache = { at: 0, data: null };
      return { ok: true };
    }
    case "setTabJob":
      if (tabId != null) tabJobs.set(tabId, msg.job);
      return { ok: true };
    case "getTabJob":
      return { ok: true, data: (tabId != null && tabJobs.get(tabId)) || null };
    case "broadcast": {
      // From popup (no sender tab) or a content script: send to every frame of the tab.
      const target = msg.tabId ?? tabId;
      if (target == null) return { ok: false, error: "no tab" };
      chrome.tabs.sendMessage(target, msg.payload).catch(() => {});
      return { ok: true };
    }
    case "toTop": {
      // A child frame reporting to the top frame's panel.
      if (tabId == null) return { ok: false };
      chrome.tabs.sendMessage(tabId, msg.payload, { frameId: 0 }).catch(() => {});
      return { ok: true };
    }
    case "openDashboard": {
      const { webUrl } = await settings();
      await chrome.tabs.create({ url: webUrl + (msg.path || "/dashboard") });
      return { ok: true };
    }
    default:
      return { ok: false, error: "unknown message " + msg.type };
  }
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "autofill") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) chrome.tabs.sendMessage(tab.id, { type: "autofill" }).catch(() => {});
});
