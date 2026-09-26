# applypilot-web

The frontend for ApplyPilot, a job application copilot:

- **`src/`:** the Next.js 15 dashboard. Covers auth, the profile editor with resume import, a kanban job tracker, and per-job AI tools (match score, cover letter, resume tailoring, answers).
- **`extension/`:** the Chrome extension (Manifest V3, plain JS, no build step). It autofills applications, attaches your resume, writes essay answers with AI, saves jobs, and marks them applied when you submit.
- **`e2e/`:** a Playwright end-to-end test covering the dashboard, the extension and the API together.

Backend: [`applypilot-backend`](../applypilot-backend). Schema: [`applypilot-migrations`](../applypilot-migrations).

## Dashboard

```bash
cp .env.example .env.local        # NEXT_PUBLIC_API_URL=http://localhost:8080
npm install
npm run dev                       # http://localhost:3000
```

**Stack:** Tailwind v4, `lucide-react` icons, Inter via `@fontsource-variable/inter`, and `tailwind-merge`.

**Code layout:**

- `src/lib/api.ts` holds the API client and types.
- `src/lib/auth.tsx` holds the session.
- `src/components/ui.tsx` holds the UI primitives.

**Session sharing with the extension:** the dashboard sends the session to the extension with `window.postMessage`. The extension only accepts it from the dashboard URL set in its Settings.

Docker: `docker build --build-arg NEXT_PUBLIC_API_URL=https://api.example.com -t applypilot-web .`

## Chrome extension

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select `extension/`.
3. Sign in on the dashboard. The extension connects automatically.

If you deploy the API or the dashboard somewhere other than localhost, set their URLs in the extension's **Settings**, or change `DEFAULTS` in `extension/background.js`.

| File | Role |
|---|---|
| `manifest.json` | MV3 manifest. The content script runs in all frames, so embedded ATS forms work |
| `background.js` | Service worker: session, API proxy, per-tab job context, frame messaging |
| `content/content.js` | Job extraction, form discovery, rule-based and AI autofill, essay buttons, applied tracking, floating panel |
| `popup/`, `options/` | Toolbar popup and settings page |

Shortcut: **Alt+Shift+F** autofills the current page.
