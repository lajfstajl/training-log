# Training Log

A personal training log with a coach grounded in evidence based progression rules. It is an installable PWA, it keeps all data on the device, and it has no backend.

See `docs/coaching-methods.md` for every rule and its sources, and `CLAUDE.md` for the principles and conventions.

## Run locally

Install dependencies and start the dev server:

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5173.

Run the tests:

```bash
npm test
```

## Open on your phone (same wifi)

Start the dev server so it is reachable on your network:

```bash
npm run dev -- --host
```

Vite prints a "Network" URL such as `http://192.168.1.23:5173`. Open it in Safari on your iPhone. This is fine for checking the UI. Installing to the home screen and offline use need HTTPS, so use the GitHub Pages URL for that.

## Deploy to GitHub Pages

1. Create an empty repository on GitHub named `training-log`, with no README.
2. Add it as the remote and push:

   ```bash
   git remote add origin https://github.com/<you>/training-log.git
   ```

   ```bash
   git push -u origin main
   ```

3. On GitHub, open **Settings → Pages** and set **Source** to **GitHub Actions**.

Every push to `main` then runs the tests and deploys to `https://<you>.github.io/training-log/`. If you name the repo differently, the workflow picks up the name automatically.

**Install on iPhone:** open the Pages URL in Safari, tap **Share**, then **Add to Home Screen**.

## Backups and moving to a new phone

Your data lives only in the app on your phone.

- **Back up:** Today shows a reminder when there is no backup from the last 7 days. Tap **Back up now**, then **Save to Files → iCloud Drive**. You can also back up any time from **Settings → Back up to iCloud Drive**.
- **Restore:** use **Settings → Restore from a backup…**, or on a brand-new install, **Restore from a backup** on the first screen.
- **New phone:** follow **Settings → Move to a new phone**, a step-by-step guide with the buttons built in.
- Backups never include your API key. Paste it again after restoring.

## API key (Phase 3)

Create a key at https://console.anthropic.com under **API Keys**. Paste it in Settings when the coach arrives. It is stored on the device only.
