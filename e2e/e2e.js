const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const EXT = path.resolve(__dirname, '../extension');
const OUT = path.join(__dirname, 'out');
const WEB = process.env.WEB_URL || 'http://localhost:3000';
const FORM = process.env.FORM_URL || 'http://localhost:5050/apply.html';
const API = (process.env.API_URL || 'http://localhost:8080') + '/api';
const log = (...a) => console.log(...a);
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const ctx = await chromium.launchPersistentContext(require('os').tmpdir() + '/applypilot-e2e-' + Date.now(), {
    headless: true, channel: 'chromium', ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
    viewport: { width: 1280, height: 900 },
  });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  log('extension loaded:', sw.url());

  const page = await ctx.newPage();
  page.on('pageerror', (e) => log('PAGE ERROR', e.message));
  const email = `e2e${Date.now()}@test.com`;
  await page.goto(WEB + '/signup');
  await page.getByLabel('Full name').fill('Samuel Shobayo');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL('**/profile**');
  const token = await page.evaluate(() => localStorage.getItem('applypilot.token'));
  const H = { Authorization: `Bearer ${token}` };
  await fetch(`${API}/profile`, { method: 'PUT', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ profile: {
    first_name: 'Samuel', last_name: 'Shobayo', email, phone: '+2348012345678',
    location: { city: 'Lagos', country: 'Nigeria' }, links: { linkedin: 'https://linkedin.com/in/samuel' },
    preferences: { requires_sponsorship: 'No' }, skills: ['Go', 'Python'],
    work_experience: [{ company: 'Myxellia', title: 'Backend Engineer', current: true }],
  } }) });
  const fd = new FormData(); fd.append('file', new Blob([fs.readFileSync(path.join(__dirname, 'resume.pdf'))], { type: 'application/pdf' }), 'Samuel_Resume.pdf');
  log('resume upload:', (await fetch(`${API}/resumes`, { method: 'POST', headers: H, body: fd })).status);

  await page.waitForTimeout(1000);
  const stored = await sw.evaluate(() => chrome.storage.local.get(['token', 'user']));
  log('extension got session from dashboard:', stored.token === token, stored.user && stored.user.email);

  await page.goto(WEB + '/extension');
  await page.getByText('Extension connected').waitFor({ timeout: 5000 }).then(() => log('dashboard shows: Extension connected')).catch(() => log('FAIL: not connected'));

  await page.goto(FORM);
  await page.waitForTimeout(2000);
  log('panel injected:', await page.evaluate(() => !!document.getElementById('applypilot-root')));
  await page.screenshot({ path: path.join(OUT, 'panel.png') });
  await sw.evaluate(async (pattern) => {
    const [t] = await chrome.tabs.query({ url: pattern });
    await chrome.tabs.sendMessage(t.id, { type: 'autofill' });
  }, new URL(FORM).origin + '/*');
  await page.waitForTimeout(4000);
  const v = await page.evaluate(() => {
    const $ = (id) => document.getElementById(id);
    const sel = (id) => $(id).selectedIndex > 0 ? $(id).options[$(id).selectedIndex].text : '';
    return {
      first: $('fn').value, last: $('ln').value, email: $('em').value, phone: $('ph').value, linkedin: $('li').value, location: $('loc').value,
      resume: $('cv').files[0] && $('cv').files[0].name, sponsorship: sel('sp'),
      authorized: (document.querySelector('input[name=auth]:checked') || {}).value || '',
      hear: sel('hear'), years: sel('yrs'), gender: sel('g'), consent: $('consent').checked, inputEvents: window.events,
      aiButtons: [...document.querySelectorAll('button')].filter((b) => b.textContent.includes('Write with AI')).length,
    };
  });
  log('filled values:', JSON.stringify(v, null, 1));
  await page.screenshot({ path: path.join(OUT, 'filled.png'), fullPage: true });

  await page.getByRole('button', { name: /Write with AI/ }).click();
  await page.waitForFunction(() => document.getElementById('why').value.length > 0, null, { timeout: 8000 });
  log('essay answer:', await page.$eval('#why', (e) => e.value));

  await page.getByRole('button', { name: 'Submit Application' }).click();
  await page.waitForTimeout(3500);
  const jobs = await (await fetch(`${API}/jobs`, { headers: H })).json();
  log('tracked jobs:', JSON.stringify(jobs.map((j) => ({ title: j.title, company: j.company, location: j.location, status: j.status, url: j.url, desc: j.description.length }))));
  const gens = await (await fetch(`${API}/ai/generations`, { headers: H })).json();
  log('ai generations logged:', gens.map((g) => g.kind).join(', '));

  const seed = [['Senior Backend Engineer','Paystack','Lagos','saved'],['Platform Engineer','Moniepoint','Remote','saved'],['Software Engineer, Payments','Flutterwave','Lagos','interviewing'],['Go Engineer','Kuda','Remote','applied'],['Backend Engineer, Ledger','Stripe','Remote · EMEA','offer'],['Staff Engineer','Chipper Cash','Remote','rejected']];
  for (const [title, company, location, status] of seed) await fetch(`${API}/jobs`, { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ title, company, location, status, url: 'https://example.com/' + company }) });
  // Dashboard views render with data
  for (const p of ['/dashboard', '/jobs', `/jobs/${jobs[0].id}`, '/profile', '/extension']) {
    await page.goto(WEB + p);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(OUT, `web${p.replace(/\//g, '_')}.png`), fullPage: true });
  }
  // Run match from the job page
  await page.goto(`${WEB}/jobs/${jobs[0].id}`);
  await page.getByRole('button', { name: 'Analyze fit' }).click();
  await page.getByText(/good fit/i).first().waitFor({ timeout: 8000 });
  await page.screenshot({ path: path.join(OUT, 'web_match.png'), fullPage: true });
  log('match rendered on job page');
  const extId = sw.url().split('/')[2];
  const pop = await ctx.newPage(); await pop.setViewportSize({ width: 320, height: 420 });
  await pop.goto(`chrome-extension://${extId}/popup/popup.html`); await pop.waitForTimeout(800); await pop.screenshot({ path: path.join(OUT, 'popup.png') }); await pop.close();
  await page.evaluate(() => localStorage.removeItem('applypilot.token'));
  for (const p of ['/', '/login']) { await page.goto(WEB + p); await page.waitForTimeout(1200); await page.screenshot({ path: path.join(OUT, `web${p === '/' ? '_landing' : p.replace(/\//g, '_')}.png`), fullPage: p === '/' }); }
  await ctx.close();
})().catch((e) => { console.error('E2E FAILED', e); process.exit(1); });
