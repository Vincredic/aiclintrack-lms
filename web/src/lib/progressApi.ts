import { getProgressApiUrl } from '../config/lms'
import {
  LMS_LAUNCH_TOKEN_KEY,
  LMS_PROGRESS_OUTBOX_KEY,
  type LmsUserProgress,
} from '../types/lms'
import { parseProgress } from './lmsProgress'

export type ProgressEventType = 'VIDEO_COMPLETED' | 'TRAINING_COMPLETED'

export interface ProgressEventBody {
  type: ProgressEventType
  courseId: string
  videoId?: string
  occurredAt: string
}

interface OutboxPut {
  courseId: string
  progress: LmsUserProgress
  attempts: number
}

interface OutboxEvent {
  event: ProgressEventBody
  attempts: number
}

interface Outbox {
  puts: OutboxPut[]
  events: OutboxEvent[]
}

const MAX_ATTEMPTS = 8

let authBlocked = false

function tokenFromLocation(): string {
  if (typeof window === 'undefined') return ''
  const search = new URLSearchParams(window.location.search).get('token')
  if (search?.trim()) return search.trim()
  const hash = window.location.hash.replace(/^#/, '')
  const fromHash = new URLSearchParams(hash).get('token')
  return fromHash?.trim() ?? ''
}

export function getLaunchToken(): string {
  const fromUrl = tokenFromLocation()
  if (fromUrl) {
    try {
      window.sessionStorage.setItem(LMS_LAUNCH_TOKEN_KEY, fromUrl)
    } catch {
      // Private mode should not block playback.
    }
    return fromUrl
  }
  try {
    return window.sessionStorage.getItem(LMS_LAUNCH_TOKEN_KEY)?.trim() ?? ''
  } catch {
    return ''
  }
}

export function isProgressSyncEnabled(): boolean {
  return Boolean(getProgressApiUrl() && getLaunchToken()) && !authBlocked
}

function headers(): HeadersInit {
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${getLaunchToken()}`,
    'Content-Type': 'application/json',
  }
}

function progressUrl(path: string): string {
  return `${getProgressApiUrl()}${path}`
}

function emptyOutbox(): Outbox {
  return { puts: [], events: [] }
}

function readOutbox(): Outbox {
  if (typeof window === 'undefined') return emptyOutbox()
  try {
    const raw = window.localStorage.getItem(LMS_PROGRESS_OUTBOX_KEY)
    if (!raw) return emptyOutbox()
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return emptyOutbox()
    const record = parsed as { puts?: unknown; events?: unknown }
    return {
      puts: Array.isArray(record.puts) ? (record.puts as OutboxPut[]) : [],
      events: Array.isArray(record.events) ? (record.events as OutboxEvent[]) : [],
    }
  } catch {
    return emptyOutbox()
  }
}

function writeOutbox(outbox: Outbox): void {
  if (typeof window === 'undefined') return
  try {
    if (outbox.puts.length === 0 && outbox.events.length === 0) {
      window.localStorage.removeItem(LMS_PROGRESS_OUTBOX_KEY)
      return
    }
    window.localStorage.setItem(LMS_PROGRESS_OUTBOX_KEY, JSON.stringify(outbox))
  } catch {
    // Quota failures should not break playback.
  }
}

function enqueuePut(courseId: string, progress: LmsUserProgress): void {
  const outbox = readOutbox()
  outbox.puts = outbox.puts.filter((item) => item.courseId !== courseId)
  outbox.puts.push({ courseId, progress, attempts: 0 })
  writeOutbox(outbox)
}

function enqueueEvent(event: ProgressEventBody): void {
  const outbox = readOutbox()
  outbox.events.push({ event, attempts: 0 })
  writeOutbox(outbox)
}

async function parseErrorStatus(response: Response): Promise<number> {
  if (response.status === 401 || response.status === 403) {
    authBlocked = true
  }
  return response.status
}

export async function fetchRemoteProgress(
  courseId: string,
): Promise<LmsUserProgress | null> {
  if (!isProgressSyncEnabled()) return null
  try {
    const response = await fetch(
      `${progressUrl('/progress')}?courseId=${encodeURIComponent(courseId)}`,
      { headers: headers() },
    )
    if (response.status === 404) return null
    if (!response.ok) {
      await parseErrorStatus(response)
      return null
    }
    return parseProgress(await response.json())
  } catch {
    return null
  }
}

type SendResult = 'ok' | 'auth' | 'retry'

async function sendPut(
  courseId: string,
  progress: LmsUserProgress,
  keepalive: boolean,
): Promise<SendResult> {
  if (!isProgressSyncEnabled()) return 'auth'
  const body = JSON.stringify({
    courseId,
    completedVideoIds: progress.completedVideoIds,
    lastWatchedVideoId: progress.lastWatchedVideoId,
    positions: progress.positions,
    clientUpdatedAt: progress.updatedAt,
  })
  try {
    const response = await fetch(progressUrl('/progress'), {
      method: 'PUT',
      headers: headers(),
      body,
      keepalive,
    })
    if (response.ok) return 'ok'
    const status = await parseErrorStatus(response)
    return status === 401 || status === 403 ? 'auth' : 'retry'
  } catch {
    return 'retry'
  }
}

async function sendEvent(event: ProgressEventBody): Promise<SendResult> {
  if (!isProgressSyncEnabled()) return 'auth'
  try {
    const response = await fetch(progressUrl('/progress/events'), {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(event),
    })
    if (response.ok) return 'ok'
    const status = await parseErrorStatus(response)
    return status === 401 || status === 403 ? 'auth' : 'retry'
  } catch {
    return 'retry'
  }
}

export async function putRemoteProgress(
  courseId: string,
  progress: LmsUserProgress,
  options?: { keepalive?: boolean },
): Promise<void> {
  if (!courseId || !isProgressSyncEnabled()) return
  const result = await sendPut(courseId, progress, Boolean(options?.keepalive))
  if (result === 'retry') enqueuePut(courseId, progress)
}

export async function postRemoteProgressEvent(
  event: ProgressEventBody,
): Promise<void> {
  if (!isProgressSyncEnabled()) return
  const result = await sendEvent(event)
  if (result === 'retry') enqueueEvent(event)
}

export async function drainProgressOutbox(): Promise<void> {
  if (!isProgressSyncEnabled()) return
  const outbox = readOutbox()
  const events: OutboxEvent[] = []
  for (const item of outbox.events) {
    const result = await sendEvent(item.event)
    if (result === 'retry' && item.attempts + 1 < MAX_ATTEMPTS) {
      events.push({ ...item, attempts: item.attempts + 1 })
    }
  }
  const puts: OutboxPut[] = []
  for (const item of outbox.puts) {
    const result = await sendPut(item.courseId, item.progress, false)
    if (result === 'retry' && item.attempts + 1 < MAX_ATTEMPTS) {
      puts.push({ ...item, attempts: item.attempts + 1 })
    }
  }
  writeOutbox({ puts, events })
}
