# ESSI

Unofficial fan companion for **Underpunks55 (UP55)** — a pocket ESSI terminal
for pilots. Tools, references and trackers in one offline-first web console.

This repository is a static web app (Vite + React + TypeScript), rewritten from
the original Flutter app. All data lives locally in the browser (IndexedDB +
localStorage); there is no ESSI server.

## Layout

| Path        | What it is                                                      |
| ----------- | -------------------------------------------------------------- |
| `webapp/`   | The web app (Vite + React + TS). See `webapp` scripts below.  |
| `worker/`   | Cloudflare Worker that proxies the NASA/JPL APIs (CORS).       |
| `docs/`     | Web-rewrite specs, content-repo guides, and archived audits.  |
| `.github/`  | GitHub Actions: build + deploy `webapp/` to GitHub Pages.     |

## Develop

```sh
cd webapp
npm install
npm run dev      # local dev server
npm test         # vitest
npm run build    # type-check + production build to webapp/dist
```

## NASA / JPL tools (System Scan, Discoveries, Tracker)

The JPL APIs (Horizons, SBDB) do not send CORS headers, so the browser cannot
call them directly. Those three tools route requests through **your own**
Cloudflare Worker (`worker/`, free tier). Deploy it once (see
[`worker/README.md`](worker/README.md)) and set the resulting URL either at
build time (`VITE_JPL_PROXY_URL`) or in the app's **Settings → JPL proxy URL**.
Leave it empty to disable those three tools; everything else works offline.

## Interactive maps content

The maps module ships a bundled seed and can pull updated content from a public
GitHub content repo (integrity-checked). Setting that repo up is optional and
documented in [`docs/content-repo/`](docs/content-repo/).

## Deploy (GitHub Pages)

`.github/workflows/deploy-pages.yml` builds `webapp/` and deploys it to GitHub
Pages on every push to `main`. It derives the base path from the repository
name and reads the optional `JPL_PROXY_URL` repository variable.
