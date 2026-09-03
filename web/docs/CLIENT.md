# Web client

Jamstack LMS for AiClinTrack video tutorials, following [jamstack.org](https://jamstack.org/what-is-jamstack/): **pre-render** the catalog at build, **enhance** with JavaScript, **call APIs** for anything dynamic. Learners watch public uploads from [YouTube @AIClinTrack](https://www.youtube.com/@AIClinTrack). There is no LMS login and no LMS database.

| | |
| --- | --- |
| Package | `web/` (`@aiclintrack/lms-web`) |
| Architecture | Jamstack (pre-rendered HTML + React + APIs) |
| Runtime | Static files (Vite → nginx) |
| Stack | React 18.3, TypeScript 5.7, Vite 7, Tailwind CSS 4 |
| Node | ≥ 18 |
| Learner | `/` |
| Admin | `/#admin` |
| Catalog | Live @AIClinTrack RSS (`/youtube/feed`); `courses.json` fallback |
| Host CTMS | `app.yourdomain.com` (iframe parent) |
| This app | `lms.yourdomain.com` |

## Jamstack layout

| Layer | This app |
| --- | --- |
| Markup | `web/prerender.ts` fetches the @AIClinTrack RSS feed (or `courses.json`) and writes real HTML into `index.html`. |
| JavaScript | React hydrates the UI: player, search, mark complete, `#admin`. |
| APIs | Channel RSS at `/youtube/feed`, YouTube oEmbed (admin, channel-gated), CTMS `postMessage` / progress HTTP. |

New videos published on @AIClinTrack show up on the next learner load. `courses.json` is only used if the feed is down.

## Surfaces

`App` switches on the URL hash.

- **Learner (`LmsShell`)** — @AIClinTrack channel videos. Search, outline, player, mark complete, resume. Progress cache + optional CTMS sync.
- **Admin (`AdminShell`)** — same channel catalog plus a local draft. Add is limited to @AIClinTrack URLs.

In development, `#admin` unlocks without a key. In production, set `VITE_ADMIN_KEY` at **build** time. The value is inlined into the bundle; it is a gate, not a server login.

## Source map

```
web/
  prerender.ts                 Build-time HTML from channel RSS
  public/courses.json          Offline snapshot if the feed is down
  public/favicon.svg
  src/
    App.tsx                    Hash route: learner vs admin
    main.tsx                   React mount (replaces prerendered #root)
    config/lms.ts              VITE_CTMS_ORIGIN
    config/youtubeChannel.ts   @AIClinTrack id, handle, feed path
    types/lms.ts               Catalog, progress, iframe messages
    hooks/
      useCourseData.ts         Channel RSS, then courses.json snapshot
      useLmsProgress.ts        Complete / resume / percent + CTMS sync
      useIframeBridge.ts       CTMS postMessage
      useAdminCatalog.ts       Draft add/remove/export
    lib/
      courseCatalog.ts         Parse / flatten / search
      inlineCatalog.ts         Read #lms-catalog from HTML
      progressApi.ts           CTMS GET/PUT/POST + launch token + outbox
      lmsProgress.ts           localStorage cache + merge
      iframeBridge.ts          Trusted-origin postMessage
      videoSource.ts           YouTube / Vimeo / HTML5 URLs
      youtubeChannelFeed.ts    Parse channel RSS into a catalog
      youtubeMetadata.ts       oEmbed + @AIClinTrack gate
      adminCatalog.ts          Draft CRUD + download
      adminAuth.ts             #admin key gate
    components/lms/
      LmsShell.tsx             Learner chrome
      HeaderBar.tsx            Title, search, completion bar
      SidebarNav.tsx           Module accordion
      MainViewport.tsx         Player + lesson copy
      VideoPlayerWrapper.tsx   Engine switch
      engines/                 YouTube, Vimeo, HTML5
      AdminShell.tsx           Catalog editor
      AddYouTubeModal.tsx
      AdminGate.tsx
```

## Learner flow

1. The CDN/nginx serves pre-rendered HTML (course title, outline, first lesson) plus `#lms-catalog` JSON.
2. React reads that inline catalog immediately (`useCourseData`), then refreshes from `/youtube/feed` (falls back to `/courses.json`).
3. Restore progress from `localStorage`.
4. Select a lesson from `#v={videoId}`, last watched id, or the first video.
5. Play through `VideoPlayerWrapper`. Time updates debounce (~1.2s) into resume positions. Ending the video or **Mark as Complete** records completion.
6. Header shows `N of M Completed — P%`.
7. If the page is an iframe of a trusted CTMS origin, emit `LMS_READY`, `VIDEO_COMPLETED`, `TRAINING_COMPLETED`, and answer `REQUEST_PROGRESS` with a snapshot.

The catalog does not need a network round-trip for first paint. Progress writes are best-effort (private mode / quota failures are ignored). Without JavaScript, the outline and a fallback “open this lesson” link still render.

## Admin flow

1. Unlock `#admin` (dev: open; prod: `VITE_ADMIN_KEY`).
2. Load published catalog; overlay `lms_admin_draft` if present.
3. **Add YouTube** — paste a URL from **@AIClinTrack only**. oEmbed must report that channel or the add is rejected.
4. Duplicate YouTube ids in the draft are rejected. The last remaining video cannot be removed.
5. **Discard draft** restores the live channel catalog in this browser.

## Catalog schema

The live catalog is the @AIClinTrack RSS feed. `courses.json` uses the same shape as a fallback:

```json
{
  "id": "aiclintrack-channel",
  "title": "AIClinTrack tutorials",
  "subtitle": "@AIClinTrack",
  "description": "…",
  "modules": [
    {
      "id": "mod-aiclintrack",
      "title": "AIClinTrack channel",
      "summary": "…",
      "videos": [
        {
          "id": "yt-XCY1jv3gqvs",
          "title": "Study Management Tutorial",
          "description": "…",
          "duration": "",
          "category": "AIClinTrack",
          "tags": ["youtube", "AIClinTrack"],
          "sourceType": "youtube",
          "sourceUrlOrId": "XCY1jv3gqvs",
          "thumbnailUrl": "https://i.ytimg.com/vi/XCY1jv3gqvs/hqdefault.jpg"
        }
      ]
    }
  ]
}
```

| Field | Notes |
| --- | --- |
| `sourceType` | `youtube`, `vimeo`, or `html5` |
| `sourceUrlOrId` | Provider id or full URL |
| `duration` | Display string only; not used for tracking math |
| `id` (course / module / video) | Stable ids — progress keys off **video** `id` |

Live source: [youtube.com/@AIClinTrack](https://www.youtube.com/@AIClinTrack) (`UCRxbK63ZwgkspA_afRlpxqA`). Config: `web/src/config/youtubeChannel.ts`.

## Player

`VideoPlayerWrapper` selects an engine from `sourceType`:

| `sourceType` | Engine | Notes |
| --- | --- | --- |
| `youtube` | youtube-nocookie embed + JS API `postMessage` | Resume via `start`; complete on ended |
| `vimeo` | `player.vimeo.com` iframe | `timeupdate` / `finish` |
| `html5` | Native `<video>` | `poster` from `thumbnailUrl` |

Register another engine next to these in `VideoPlayerWrapper.tsx`.

## Progress

Cached under `lms_user_progress`:

```ts
{
  completedVideoIds: string[]
  lastWatchedVideoId: string | null
  positions: Record<string, number>  // seconds, for resume
  updatedAt: string                  // ISO
}
```

`localStorage` is an optimistic cache so the player never waits on the network.

**Server sync** (when both are present):

1. `VITE_PROGRESS_API_URL` — CTMS base, e.g. `https://app.yourdomain.com/api/lms`
2. Launch token — `?token=…` on the iframe URL (also accepted in the hash). Stored in `sessionStorage` as `lms_launch_token`.

Then the learner:

- `GET /progress?courseId=` on load and **unions** completions / **max** resume positions with the cache
- `PUT /progress` immediately on complete, debounced (~8s) on playback position, and on `pagehide`
- `POST /progress/events` for `VIDEO_COMPLETED` and `TRAINING_COMPLETED`
- Failed calls go to `lms_progress_outbox` and retry on `online` / next load
- `401`/`403`: keep playing, stop syncing (token expired). Do not invent anonymous users.

Without a token or API URL, behavior is device-local only. CTMS still needs the three routes; this repo only sends them. Details: [PROGRESS_TRACKING.md](./PROGRESS_TRACKING.md).

## Embed in CTMS

Iframe the **learner** origin (not `/#admin`). Parent origin must match `VITE_CTMS_ORIGIN` (plus the LMS origin; in dev, localhost:5173). For server-side progress, set the iframe `src` to `https://lms.yourdomain.com/?token=…`.

**LMS → parent**

```ts
{ event: 'LMS_READY', courseId: string }
{ event: 'VIDEO_COMPLETED', videoId: string }
{ event: 'TRAINING_COMPLETED', courseId: string }
{ event: 'PROGRESS_SNAPSHOT', courseId, completedVideoIds, lastWatchedVideoId, percent }
```

**Parent → LMS** (trusted origin only)

```ts
{ event: 'SELECT_VIDEO', videoId: string }
{ event: 'MARK_COMPLETE', videoId: string }
{ event: 'REQUEST_PROGRESS' }
```

`postMessage` is for the CTMS UI (open a lesson, show a badge). It is not a durable training record. Durable records belong on the CTMS server — see the progress plan.

## Configuration

Vite inlines `VITE_*` at **build** time (`web/.env.example`):

| Variable | Purpose |
| --- | --- |
| `VITE_CTMS_ORIGIN` | Trusted iframe parent (`https://app.yourdomain.com`) |
| `VITE_ADMIN_KEY` | Production `#admin` gate |
| `VITE_PROGRESS_API_URL` | CTMS progress base URL (`https://app.yourdomain.com/api/lms`). Empty = local only |

`web/.env.development` is for local Vite only.

## Run and deploy

```bash
cd web
npm install
npm run dev          # http://localhost:5173
npm run type-check
npm run build        # web/build
npm run preview
```

`render.yaml` builds the Docker image in `web/`: Node 22 compiles the SPA, nginx-alpine serves it. Pass `VITE_CTMS_ORIGIN`, `VITE_ADMIN_KEY`, and `VITE_PROGRESS_API_URL` as Docker build args. `/health` returns `OK`.
