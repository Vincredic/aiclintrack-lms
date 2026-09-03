import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  drainProgressOutbox,
  fetchRemoteProgress,
  isProgressSyncEnabled,
  postRemoteProgressEvent,
  putRemoteProgress,
} from '../lib/progressApi'
import {
  mergeProgress,
  readProgress,
  writeProgress,
} from '../lib/lmsProgress'
import type { LmsUserProgress } from '../types/lms'

const POSITION_PERSIST_MS = 1200
const SERVER_PUT_MS = 8000

export function useLmsProgress(totalVideoIds: string[], courseId: string | null) {
  const [progress, setProgress] = useState<LmsUserProgress>(readProgress)
  const persistTimer = useRef<number | null>(null)
  const serverTimer = useRef<number | null>(null)
  const latestRef = useRef(progress)
  const courseIdRef = useRef(courseId)
  const hydratingRef = useRef(false)
  latestRef.current = progress
  courseIdRef.current = courseId

  const flushLocal = useCallback((next: LmsUserProgress) => {
    writeProgress(next)
  }, [])

  const flushServer = useCallback((next: LmsUserProgress, keepalive = false) => {
    const id = courseIdRef.current
    if (!id || hydratingRef.current || !isProgressSyncEnabled()) return
    void putRemoteProgress(id, next, { keepalive })
  }, [])

  const scheduleServerPut = useCallback(() => {
    if (!courseIdRef.current || !isProgressSyncEnabled()) return
    if (serverTimer.current) window.clearTimeout(serverTimer.current)
    serverTimer.current = window.setTimeout(() => {
      flushServer(latestRef.current)
    }, SERVER_PUT_MS)
  }, [flushServer])

  const commit = useCallback(
    (updater: (current: LmsUserProgress) => LmsUserProgress, immediate = true) => {
      setProgress((current) => {
        const next = {
          ...updater(current),
          updatedAt: new Date().toISOString(),
        }
        latestRef.current = next
        if (immediate) {
          if (persistTimer.current) window.clearTimeout(persistTimer.current)
          if (serverTimer.current) window.clearTimeout(serverTimer.current)
          flushLocal(next)
          flushServer(next)
        } else {
          if (persistTimer.current) window.clearTimeout(persistTimer.current)
          persistTimer.current = window.setTimeout(() => {
            flushLocal(latestRef.current)
          }, POSITION_PERSIST_MS)
          scheduleServerPut()
        }
        return next
      })
    },
    [flushLocal, flushServer, scheduleServerPut],
  )

  useEffect(() => {
    if (!courseId || !isProgressSyncEnabled()) return
    hydratingRef.current = true
    let cancelled = false
    void fetchRemoteProgress(courseId)
      .then((remote) => {
        if (cancelled || !remote) return
        const merged = mergeProgress(latestRef.current, remote)
        latestRef.current = merged
        setProgress(merged)
        writeProgress(merged)
      })
      .finally(() => {
        hydratingRef.current = false
        if (cancelled) return
        void drainProgressOutbox()
        const local = latestRef.current
        const hasWork =
          local.completedVideoIds.length > 0 ||
          Boolean(local.lastWatchedVideoId) ||
          Object.keys(local.positions).length > 0
        if (hasWork) void putRemoteProgress(courseId, local)
      })
    return () => {
      cancelled = true
    }
  }, [courseId])

  useEffect(() => {
    const onHidden = () => {
      if (persistTimer.current) window.clearTimeout(persistTimer.current)
      if (serverTimer.current) window.clearTimeout(serverTimer.current)
      writeProgress(latestRef.current)
      flushServer(latestRef.current, true)
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') onHidden()
    }
    const onOnline = () => {
      void drainProgressOutbox()
    }
    window.addEventListener('pagehide', onHidden)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('pagehide', onHidden)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('online', onOnline)
      if (persistTimer.current) window.clearTimeout(persistTimer.current)
      if (serverTimer.current) window.clearTimeout(serverTimer.current)
      writeProgress(latestRef.current)
    }
  }, [flushServer])

  const completedIds = useMemo(
    () => new Set(progress.completedVideoIds),
    [progress.completedVideoIds],
  )

  const knownCompleted = useMemo(
    () => totalVideoIds.filter((id) => completedIds.has(id)).length,
    [completedIds, totalVideoIds],
  )

  const emitCompletionEvents = useCallback(
    (videoId: string, completedNow: string[]) => {
      const id = courseIdRef.current
      if (!id || !isProgressSyncEnabled()) return
      const occurredAt = new Date().toISOString()
      void postRemoteProgressEvent({
        type: 'VIDEO_COMPLETED',
        courseId: id,
        videoId,
        occurredAt,
      })
      if (
        totalVideoIds.length > 0 &&
        totalVideoIds.every((item) => completedNow.includes(item))
      ) {
        void postRemoteProgressEvent({
          type: 'TRAINING_COMPLETED',
          courseId: id,
          occurredAt,
        })
      }
    },
    [totalVideoIds],
  )

  const isComplete = useCallback(
    (videoId: string) => completedIds.has(videoId),
    [completedIds],
  )

  const markComplete = useCallback(
    (videoId: string) => {
      if (!videoId || latestRef.current.completedVideoIds.includes(videoId)) {
        return false
      }
      commit((current) => ({
        ...current,
        completedVideoIds: [...current.completedVideoIds, videoId],
        lastWatchedVideoId: videoId,
      }))
      emitCompletionEvents(videoId, [
        ...latestRef.current.completedVideoIds,
      ])
      return true
    },
    [commit, emitCompletionEvents],
  )

  const toggleComplete = useCallback(
    (videoId: string) => {
      const currentlyComplete = latestRef.current.completedVideoIds.includes(videoId)
      commit((current) => ({
        ...current,
        completedVideoIds: currentlyComplete
          ? current.completedVideoIds.filter((id) => id !== videoId)
          : [...current.completedVideoIds, videoId],
        lastWatchedVideoId: videoId,
      }))
      if (!currentlyComplete) {
        emitCompletionEvents(videoId, latestRef.current.completedVideoIds)
      }
      return !currentlyComplete
    },
    [commit, emitCompletionEvents],
  )

  const setLastWatched = useCallback(
    (videoId: string) => {
      if (latestRef.current.lastWatchedVideoId === videoId) return
      commit((current) => ({ ...current, lastWatchedVideoId: videoId }))
    },
    [commit],
  )

  const setPosition = useCallback(
    (videoId: string, seconds: number) => {
      if (!Number.isFinite(seconds) || seconds < 0) return
      const rounded = Math.round(seconds * 10) / 10
      commit(
        (current) => ({
          ...current,
          lastWatchedVideoId: videoId,
          positions: { ...current.positions, [videoId]: rounded },
        }),
        false,
      )
    },
    [commit],
  )

  const getPosition = useCallback(
    (videoId: string) => progress.positions[videoId] ?? 0,
    [progress.positions],
  )

  return {
    progress,
    completedIds,
    completedCount: knownCompleted,
    totalCount: totalVideoIds.length,
    percent:
      totalVideoIds.length <= 0
        ? 0
        : Math.round((knownCompleted / totalVideoIds.length) * 100),
    isComplete,
    toggleComplete,
    markComplete,
    setLastWatched,
    setPosition,
    getPosition,
  }
}
