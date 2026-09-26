# End-to-end test

Loads the real extension into Chromium and runs the whole flow:

1. Signs up through the dashboard (the extension picks up the session).
2. Autofills `apply.html`: fields, resume and AI-mapped questions.
3. Writes an essay answer with AI.
4. Submits the form and checks the job shows up as **applied**.
5. Runs a match score on the job page.
6. Saves screenshots to `e2e/out/`.

A fake Claude server (`mock_claude.py`) stands in for the API, so no tokens are spent.

```bash
# 1. fake Claude + test form
python3 e2e/mock_claude.py &
python3 -m http.server 5050 -d e2e &

# 2. backend (in applypilot-backend, schema applied via applypilot-migrations)
ANTHROPIC_API_KEY=test ANTHROPIC_BASE_URL=http://127.0.0.1:9099 make run &

# 3. dashboard
npm run build && npm start &

# 4. run
cd e2e && npm install && npx playwright install chromium && npm test
```

To point it elsewhere, set `WEB_URL`, `API_URL` and `FORM_URL`. Set `CHROMIUM_PATH` to use an existing Chromium.
