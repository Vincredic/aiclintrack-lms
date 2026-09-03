# Tutorial progress — server tracking

**Status:** LMS client adapter is implemented. CTMS still needs the launch token, three HTTP routes, and the progress table.

Goal: record **who** completed **which** lessons, on the server, so training can gate CTMS workflows (enrollment, site activation) and survive device changes. Scope is **tracking only** — not a second catalog, not LMS user accounts, not a new Moodle/Nest app in this repo.

## Why the client is not enough

| Client today | Problem |
| --- | --- |
| `localStorage` | Per browser, not per user |
| `postMessage` snapshot | Parent tab must be open; not an audit log |
| No auth | LMS cannot name the learner |
| Toggle complete | A user can un-complete a lesson locally |

Clinical training needs a user-scoped, monotonic record that CTMS already understands (users, sites, protocols).

## Recommended ownership

**CTMS is the system of record. This LMS stays a static player that syncs.**

```
Learner  →  LMS (static)  →  CTMS API  →  CTMS DB
                │                ▲
                │   GET hydrate / PUT snapshot / POST events
                └── postMessage to iframe parent (UI only)
```

- Users, sessions, and “training required for this site” already live in CTMS.
- Catalog remains `courses.json` (no progress tables for videos themselves).
- Do **not** stand up a Nest LMS API in this repo unless CTMS cannot host three small routes.

Standalone `lms.yourdomain.com` (no iframe) still needs a **CTMS launch** (redirect or signed URL). Anonymous playback can keep localStorage for resume, but that path is not a compliance record.

## Identity

LMS never stores passwords.

When CTMS opens the iframe (or a launch URL), it issues a **short-lived launch token** bound to `userId`, `courseId`, and optionally `siteId` / `trainingAssignmentId`.

Examples:

- `https://lms.yourdomain.com/?token=…` (preferred for iframe `src`)
- `https://lms.yourdomain.com/#v=v101&token=…` if hash routing must carry it

LMS sends `Authorization: Bearer <token>` on progress HTTP calls. CTMS validates the token and ignores any `userId` in the JSON body.

Token TTL: minutes to a few hours, refresh by reloading the iframe from CTMS. No LMS refresh endpoint.

## What to store (tracking only)

One **progress row** per `(userId, courseId)` (or per training assignment if CTMS already has that grain):

| Field | Source | Notes |
| --- | --- | --- |
| `userId` | Token | Never from the client body |
| `courseId` | Catalog `id` | e.g. `protocol-sit-video-v3` |
| `completedVideoIds` | Client events | **Union / append-only** on the server |
| `lastWatchedVideoId` | Client | Last successfully reported lesson |
| `positions` | Client | `{ [videoId]: seconds }` for resume only |
| `percent` | Server | Derived: completed ∩ published video ids / count |
| `updatedAt` | Server | Clock of last accepted write |
| `completedAt` | Server | Set once when percent hits 100 |

Optional **event log** (audit, not required for resume):

| `type` | When |
| --- | --- |
| `VIDEO_COMPLETED` | Lesson marked complete or playback ended |
| `TRAINING_COMPLETED` | All published video ids are in `completedVideoIds` |

Do **not** send: catalog JSON, admin drafts, per-second heartbeats, player quality metrics, PII beyond the token.

## HTTP contract (CTMS)

Base URL: CTMS origin or a dedicated path on the same API, e.g. `https://app.yourdomain.com/api/lms`. LMS config: `VITE_PROGRESS_API_URL` (build-time). CORS: allow the LMS origin; credentials only if you later use cookies instead of a launch token.

### `GET /progress?courseId={id}`

Hydrate on learner load (after catalog parse).

**200**

```json
{
  "courseId": "protocol-sit-video-v3",
  "completedVideoIds": ["v101", "v102"],
  "lastWatchedVideoId": "v102",
  "positions": { "v102": 184.5 },
  "percent": 20,
  "updatedAt": "2026-08-27T10:24:00.000Z",
  "completedAt": null
}
```

**404** — no row yet; LMS starts empty (or local cache only).  
**401** — missing/expired token; LMS keeps playing, does not pretend the user is certified.

### `PUT /progress`

Idempotent snapshot. Call on complete, on last-watched change, and on a **debounced** position flush (5–10s, plus `pagehide`).

**Request**

```json
{
  "courseId": "protocol-sit-video-v3",
  "completedVideoIds": ["v101", "v102"],
  "lastWatchedVideoId": "v102",
  "positions": { "v101": 252, "v102": 184.5 },
  "clientUpdatedAt": "2026-08-27T10:24:00.000Z"
}
```

**Server merge**

1. `completedVideoIds` = union(stored, payload). Never drop an id because the client toggled it off.
2. `positions[id]` = `max(stored, payload)` (resume forward; ignore going backwards unless the difference is a seek-to-start under ~2s).
3. `lastWatchedVideoId` = payload if it is a known video id.
4. Recompute `percent` from **published** catalog ids CTMS knows (or from the LMS-sent completed set ∩ a course version CTMS stores). If CTMS does not store the catalog, accept `completedVideoIds` but compute percent only when CTMS has a copy of the video id list (recommended: CTMS stores `courseId` + `videoIds[]` when the catalog is deployed).

### `POST /progress/events`

Append-only. Same auth.

```json
{
  "type": "VIDEO_COMPLETED",
  "courseId": "protocol-sit-video-v3",
  "videoId": "v102",
  "occurredAt": "2026-08-27T10:24:00.000Z"
}
```

```json
{
  "type": "TRAINING_COMPLETED",
  "courseId": "protocol-sit-video-v3",
  "occurredAt": "2026-08-27T10:30:00.000Z"
}
```

Treat duplicate `(userId, type, courseId, videoId)` within a short window as idempotent.

## LMS client (implemented)

Keep `localStorage` as an **optimistic cache** so playback never waits on the network.

| Moment | Local | Server |
| --- | --- | --- |
| Catalog ready + token present | Read cache | `GET /progress`, then merge |
| Playback `timeupdate` | Debounce write (~1.2s) | Debounce `PUT` (~8s) |
| Mark complete / video ended | Immediate write | Immediate `PUT` + `POST` event |
| All lessons complete | Immediate | `POST TRAINING_COMPLETED` |
| Tab hidden / unload | Flush cache | Flush `PUT` (`keepalive`) |
| 401 / offline | Keep playing | Queue in `lms_progress_outbox`, retry on `online` / next load |

**Merge on GET:** server completions win (union). Resume position = max(local, server) per video. If the URL hash selects a video, that selection still wins over `lastWatchedVideoId`.

**No token or empty `VITE_PROGRESS_API_URL`:** behave as device-local only. Do not invent anonymous user ids on the server.

Config: `web/.env.example`. Code: `web/src/lib/progressApi.ts`, `web/src/hooks/useLmsProgress.ts`.

### Completions policy

The learner UI currently **toggles** complete. For a training record, the server should treat completion as **monotonic**: once a video id is on the server, it stays. The client may still show an unchecked box locally; that must not un-certify the user. Product follow-up: change the button to “Completed” without un-complete, or keep un-complete as local-only.

### `postMessage` vs HTTP

| Channel | Role |
| --- | --- |
| `postMessage` | CTMS chrome: jump to a lesson, show % in the parent shell |
| HTTP progress API | Durable user record, reports, enrollment gates |

Keep both. Do not use the parent as a proxy that “saves for the LMS” unless CTMS already has a message handler that writes the DB — in that case HTTP from the LMS is still simpler and works for non-iframe launches.

## CTMS catalog version (needed for honest percent)

Percent is `completed ∩ publishedVideoIds / publishedVideoIds.length`. If admin ships a new `courses.json` with extra lessons, previously “100%” users should drop until they finish the new ids — **or** CTMS versions the course (`protocol-sit-video-v3` vs `v4`) and keeps historical completion on the old version. Pick one:

- **Same `courseId`, growing catalog** — percent can go down; `TRAINING_COMPLETED` is re-issued when they catch up.
- **New `courseId` per curriculum version** — old assignment stays complete; new assignment is a new row.

Recommend versioning `courseId` (or an explicit `catalogVersion`) when lessons that gate enrollment change.

## What this repo added

LMS client adapter:

- `VITE_PROGRESS_API_URL` in `web/.env.example` and `env.d.ts`
- `web/src/lib/progressApi.ts` — GET/PUT/POST + token from `?token=` + outbox
- `useLmsProgress` — hydrate, debounce PUT, event POST, retry queue

CTMS work (outside this repo): launch token, three routes, table, reports, enrollment check on `completedAt` / percent.

## Rollout

1. **CTMS contract** — table + GET/PUT/POST + launch token.
2. **LMS hydrate + complete events** — done in this repo.
3. **Resume positions** — done (debounced PUT + `pagehide` flush).
4. **Retry queue** — done (`lms_progress_outbox`).
5. **CTMS gates** — use server `percent` / `completedAt`, not iframe messages.
6. **Tighten complete UX** — monotonic server; optional UI change so un-complete is not implied.

## Out of scope

- Rebuilding NestJS / Moodle in this repository
- Server-side catalog or YouTube ingest
- Watch-time analytics dashboards
- LMS-managed usernames
- Using `VITE_ADMIN_KEY` as learner auth
