const DEFAULTS = { apiUrl: "http://localhost:8080", webUrl: "http://localhost:3000" };
const $ = (id) => document.getElementById(id);

chrome.storage.local.get(["apiUrl", "webUrl"]).then((s) => {
  $("apiUrl").value = s.apiUrl || DEFAULTS.apiUrl;
  $("webUrl").value = s.webUrl || DEFAULTS.webUrl;
});

$("f").addEventListener("submit", async (e) => {
  e.preventDefault();
  const apiUrl = $("apiUrl").value.trim().replace(/\/$/, "");
  const webUrl = $("webUrl").value.trim().replace(/\/$/, "");
  const cur = await chrome.storage.local.get(["apiUrl", "webUrl"]);
  await chrome.storage.local.set({ apiUrl, webUrl });
  if (cur.apiUrl !== apiUrl || cur.webUrl !== webUrl) await chrome.storage.local.remove(["token", "user"]);
  $("ok").classList.remove("hidden");
  setTimeout(() => $("ok").classList.add("hidden"), 1500);
});
