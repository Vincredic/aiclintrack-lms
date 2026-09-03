# AiClinTrack LMS

Jamstack video tutorial portal ([jamstack.org](https://jamstack.org/)): the catalog is **pre-rendered into HTML at build time**, then JavaScript enhances the player, search, and progress. There is no LMS origin server. Admins add YouTube videos in a catalog editor, then ship them by replacing `courses.json` and rebuilding. Progress is cached in `localStorage` and synced to CTMS when `VITE_PROGRESS_API_URL` and a launch `?token=` are present.

**Docs:** [web/docs/README.md](web/docs/README.md) · [Web client](web/docs/CLIENT.md) · [Progress tracking plan](web/docs/PROGRESS_TRACKING.md)

| | |
| --- | --- |
| Architecture | Jamstack — pre-render + JS + APIs |
| Markup | Channel feed baked into `index.html` at build (`web/prerender.ts`) |
| JavaScript | React 18.3 player, admin, progress (Vite 7, TypeScript 5.7, Tailwind 4) |
| Videos | [YouTube @AIClinTrack](https://www.youtube.com/@AIClinTrack) only |
| APIs | YouTube channel RSS + oEmbed; CTMS `postMessage` + progress HTTP |
| Learner | `/` — live channel feed (`/youtube/feed`), snapshot fallback |
| Admin | `/#admin` — add a URL only if it is from @AIClinTrack |
| Snapshot | `web/public/courses.json` (used if the feed is unreachable) |
| Admin draft | `localStorage` key `lms_admin_draft` |
| Progress | `localStorage` cache + CTMS `GET`/`PUT`/`POST` when launched with a token |
| Node | ≥ 18 |

## Run locally

From the repo root (or from `web/`):

```bash
cd web
npm install
npm run dev
```

Open http://localhost:5174 for the learner. Open http://localhost:5174/#admin to edit the catalog.

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on port 5174 |
| `npm run build` | Production build to `web/build` |
| `npm run preview` | Serve the production build |
| `npm run type-check` | `tsc --noEmit` |

## Learner vs admin

This app is two surfaces on the same static site:

- **Learner (`/`)** lists public uploads from [YouTube @AIClinTrack](https://www.youtube.com/@AIClinTrack). New channel videos appear after a refresh (RSS via `/youtube/feed`).
- **Admin (`/#admin`)** can pin an extra @AIClinTrack URL into a local draft. Videos from other channels are rejected.

In development, `#admin` unlocks without a key. In production, set `VITE_ADMIN_KEY` at build time. The key is inlined into the bundle — it deters casual access; it is not a server login.

## Course catalog

### Channel lessons

Learners load the official [AIClinTrack YouTube channel](https://www.youtube.com/@AIClinTrack) RSS feed (same-origin `/youtube/feed`). `web/public/courses.json` is only a fallback snapshot if YouTube is unreachable.

The channel config is `web/src/config/youtubeChannel.ts` (`UCRxbK63ZwgkspA_afRlpxqA`).

### Add YouTube videos (admin)

1. Open `/#admin` and unlock if a key is configured.
2. Click **Add YouTube** and paste a URL from **@AIClinTrack only**. Other channels are rejected after oEmbed lookup.
3. Duplicates (same YouTube ID already in the draft) are rejected.
4. **Discard draft** restores the live channel catalog in this browser.

## Player

`VideoPlayerWrapper` picks an engine from `sourceType`:

| `sourceType` | Engine |
| --- | --- |
| `youtube` | `https://www.youtube-nocookie.com/embed/{id}?rel=0&modestbranding=1&enablejsapi=1` |
| `vimeo` | Vimeo player iframe |
| `html5` | Native `<video>` (MP4 / S3 objects) |

Add another engine (HLS, etc.) by registering it next to the existing ones in `web/src/components/lms/VideoPlayerWrapper.tsx`.

## Progress

Completed video IDs, last watched lesson, and resume positions are cached under `lms_user_progress` so playback never waits on the network.

When CTMS launches the LMS with `?token=…` and `VITE_PROGRESS_API_URL` is set, the client hydrates from `GET /progress`, merges with the cache, and sends `PUT /progress` plus `POST /progress/events` (`VIDEO_COMPLETED` / `TRAINING_COMPLETED`). Completions on the server are append-only. Without a token, progress stays on this device only.

Contract and CTMS work: [web/docs/PROGRESS_TRACKING.md](web/docs/PROGRESS_TRACKING.md).

## Embed in CTMS

Iframe this app from `https://app.yourdomain.com` (override with `VITE_CTMS_ORIGIN` in `web/.env.example`). Pass a launch token as `?token=…` so progress can sync. The iframe should load the learner surface, not `/#admin`.

**Outgoing** (`postMessage` to the parent):

```ts
{ event: 'LMS_READY', courseId: string }
{ event: 'VIDEO_COMPLETED', videoId: string }
{ event: 'TRAINING_COMPLETED', courseId: string } // all lessons complete
{ event: 'PROGRESS_SNAPSHOT', courseId, completedVideoIds, lastWatchedVideoId, percent }
```

**Incoming** (from a trusted parent origin):

```ts
{ event: 'SELECT_VIDEO', videoId: string }
{ event: 'MARK_COMPLETE', videoId: string }
{ event: 'REQUEST_PROGRESS' }
```

## Deploy

GitHub Pages builds `web/` on every push to `main` (`.github/workflows/pages.yml`) and publishes at `https://<owner>.github.io/aiclintrack-lms/`. The live channel RSS proxy is not available on Pages; learners use the catalog baked in at build time, then `courses.json` if needed.

`render.yaml` is the Docker/nginx path (includes `/youtube/feed`). Set `VITE_CTMS_ORIGIN` and `VITE_ADMIN_KEY` as Docker build args (Vite inlines them at build time).
