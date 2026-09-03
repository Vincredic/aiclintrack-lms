import {
  LMS_PROGRESS_STORAGE_KEY,
  type LmsUserProgress,
} from '../types/lms'
import { asRecord } from './json'

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))]
}

export function emptyProgress(): LmsUserProgress {
  return {
    completedVideoIds: [],
    lastWatchedVideoId: null,
    positions: {},
    updatedAt: new Date(0).toISOString(),
  }
}

export function parseProgress(value: unknown): LmsUserProgress | null {
  const record = asRecord(value)
  if (!record) return null
  const completedVideoIds = Array.isArray(record.completedVideoIds)
    ? uniqueIds(record.completedVideoIds.filter((id): id is string => typeof id === 'string'))
    : []
  const lastWatchedVideoId =
    typeof record.lastWatchedVideoId === 'string' ? record.lastWatchedVideoId : null
  const positions: Record<string, number> = {}
  const storedPositions = asRecord(record.positions)
  if (storedPositions) {
    for (const [key, seconds] of Object.entries(storedPositions)) {
      if (typeof seconds === 'number' && Number.isFinite(seconds) && seconds >= 0) {
        positions[key] = seconds
      }
    }
  }
  return {
    completedVideoIds,
    lastWatchedVideoId,
    positions,
    updatedAt:
      typeof record.updatedAt === 'string'
        ? record.updatedAt
        : new Date().toISOString(),
  }
}

export function mergeProgress(
  local: LmsUserProgress,
  remote: LmsUserProgress,
): LmsUserProgress {
  const positions: Record<string, number> = { ...local.positions }
  for (const [id, seconds] of Object.entries(remote.positions)) {
    const current = positions[id]
    positions[id] = current === undefined ? seconds : Math.max(current, seconds)
  }

  const localTime = Date.parse(local.updatedAt)
  const remoteTime = Date.parse(remote.updatedAt)
  const remoteNewer =
    Number.isFinite(remoteTime) &&
    (!Number.isFinite(localTime) || remoteTime >= localTime)

  return {
    completedVideoIds: uniqueIds([
      ...local.completedVideoIds,
      ...remote.completedVideoIds,
    ]),
    lastWatchedVideoId: remoteNewer
      ? remote.lastWatchedVideoId ?? local.lastWatchedVideoId
      : local.lastWatchedVideoId ?? remote.lastWatchedVideoId,
    positions,
    updatedAt: remoteNewer ? remote.updatedAt : local.updatedAt,
  }
}

export function readProgress(): LmsUserProgress {
  if (typeof window === 'undefined') return emptyProgress()
  try {
    const raw = window.localStorage.getItem(LMS_PROGRESS_STORAGE_KEY)
    if (!raw) return emptyProgress()
    const parsed = parseProgress(JSON.parse(raw) as unknown)
    return parsed ?? emptyProgress()
  } catch {
    return emptyProgress()
  }
}

export function writeProgress(progress: LmsUserProgress): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      LMS_PROGRESS_STORAGE_KEY,
      JSON.stringify(progress),
    )
  } catch {
    // Quota or private-mode failures should not break playback.
  }
}
