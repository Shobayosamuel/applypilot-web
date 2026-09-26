const $ = (id) => document.getElementById(id);
const send = (msg) => new Promise((r) => chrome.runtime.sendMessage(msg, (res) => r(res || { ok: false, error: chrome.runtime.lastError?.message })));

let tab = null;

async function activeTab() {
  const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
  return t;
}

function toTop(msg) {
  return new Promise((r) => {
    if (!tab) return r(null);
    chrome.tabs.sendMessage(tab.id, msg, { frameId: 0 }, (res) => {
      void chrome.runtime.lastError;
      r(res || null);
    });
  });
}

function show(section) {
  for (const id of ["loading", "signedOut", "signedIn"]) $(id).classList.toggle("hidden", id !== section);
}

function message(text, bad) {
  $("msg").textContent = text;
  $("msg").className = "msg" + (bad ? " bad" : "");
}

async function init() {
  tab = await activeTab();
  const st = await send({ type: "state" });
  if (!st.ok) return show("signedOut");
  if (!st.data.loggedIn) return show("signedOut");
  show("signedIn");
  $("who").textContent = `Signed in as ${st.data.user?.email || "you"}`;

  const job = await toTop({ type: "getJob" });
  if (job?.ok && job.data?.title) {
    $("jobBox").classList.remove("hidden");
    $("jobTitle").textContent = job.data.title;
    $("jobMeta").textContent = [job.data.company, job.data.location].filter(Boolean).join(" · ");
  }
  if (!job) {
    $("fill").disabled = true;
    $("save").disabled = true;
    message("ApplyPilot can't run on this page. Open a job posting or application.", true);
  }
  const usage = await send({ type: "api", path: "/ai/usage" });
  if (usage.ok) $("usage").textContent = `AI today: ${usage.data.calls_today}/${usage.data.daily_limit}`;
}

$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("loginBtn").disabled = true;
  $("loginErr").classList.add("hidden");
  const r = await send({ type: "login", email: $("email").value, password: $("password").value });
  $("loginBtn").disabled = false;
  if (!r.ok) {
    $("loginErr").textContent = r.error;
    $("loginErr").classList.remove("hidden");
    return;
  }
  init();
});

$("fill").onclick = async () => {
  await send({ type: "broadcast", tabId: tab.id, payload: { type: "autofill" } });
  message("Autofilling… watch the ApplyPilot panel on the page.");
  setTimeout(() => window.close(), 900);
};

$("save").onclick = async () => {
  $("save").disabled = true;
  const r = await toTop({ type: "saveJob" });
  $("save").disabled = false;
  if (r?.ok) message("Saved to your tracker.");
  else message("Couldn't save this page as a job.", true);
};

$("dash").onclick = () => send({ type: "openDashboard" });
$("signup").onclick = () => send({ type: "openDashboard", path: "/signup" });
$("settings").onclick = () => chrome.runtime.openOptionsPage();
$("logout").onclick = async () => {
  await send({ type: "logout" });
  show("signedOut");
};

init();
