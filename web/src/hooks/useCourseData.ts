import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { YOUTUBE_FEED_PATH } from '../config/youtubeChannel'
import { flattenVideos, parseCourseCatalog } from '../lib/courseCatalog'
import { readInlineCatalog } from '../lib/inlineCatalog'
import { catalogFromChannelFeed } from '../lib/youtubeChannelFeed'
import type { CourseCatalog } from '../types/lms'

const FALLBACK_URL = `${import.meta.env.BASE_URL}courses.json`

type CourseDataStatus = 'loading' | 'ready' | 'error'

async function loadChannelCatalog(signal: AbortSignal): Promise<CourseCatalog | null> {
  const feedUrl = `${import.meta.env.BASE_URL}${YOUTUBE_FEED_PATH.replace(/^\//, '')}`
  const response = await fetch(feedUrl, {
    signal,
    headers: { Accept: 'application/atom+xml, application/xml, text/xml' },
  })
  if (!response.ok) return null
  return catalogFromChannelFeed(await response.text())
}

async function loadSnapshotCatalog(signal: AbortSignal): Promise<CourseCatalog> {
  const response = await fetch(FALLBACK_URL, {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`Unable to load course catalog (${response.status})`)
  }
  return parseCourseCatalog(await response.json())
}

export function useCourseData() {
  const [course, setCourse] = useState<CourseCatalog | null>(readInlineCatalog)
  const [status, setStatus] = useState<CourseDataStatus>(() =>
    readInlineCatalog() ? 'ready' : 'loading',
  )
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)
  const courseRef = useRef(course)
  courseRef.current = course

  useEffect(() => {
    const controller = new AbortController()
    if (!courseRef.current) {
      setStatus('loading')
      setError(null)
    }

    loadChannelCatalog(controller.signal)
      .then((fromChannel) => {
        if (fromChannel) return fromChannel
        return loadSnapshotCatalog(controller.signal)
      })
      .then((catalog) => {
        setCourse(catalog)
        setStatus('ready')
        setError(null)
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return
        if (courseRef.current) return
        setCourse(null)
        setStatus('error')
        setError(caught instanceof Error ? caught.message : 'Unable to load course catalog')
      })

    return () => controller.abort()
  }, [nonce])

  const reload = useCallback(() => {
    setNonce((current) => current + 1)
  }, [])

  const videos = useMemo(() => (course ? flattenVideos(course) : []), [course])

  return { course, videos, status, error, reload }
}
