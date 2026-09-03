import { useEffect } from 'react'
import {
  isEmbedded,
  isTrustedParentOrigin,
  parseIncomingLmsMessage,
  postToParent,
} from '../lib/iframeBridge'

interface UseIframeBridgeOptions {
  courseId: string | null
  completedVideoIds: string[]
  lastWatchedVideoId: string | null
  percent: number
  onSelectVideo: (videoId: string) => void
  onMarkComplete: (videoId: string) => void
}

export function useIframeBridge({
  courseId,
  completedVideoIds,
  lastWatchedVideoId,
  percent,
  onSelectVideo,
  onMarkComplete,
}: UseIframeBridgeOptions): void {
  useEffect(() => {
    if (!courseId || !isEmbedded()) return
    postToParent({ event: 'LMS_READY', courseId })
  }, [courseId])

  useEffect(() => {
    if (!isEmbedded()) return

    const onMessage = (event: MessageEvent) => {
      if (!isTrustedParentOrigin(event.origin)) return
      const message = parseIncomingLmsMessage(event.data)
      if (!message) return

      if (message.event === 'SELECT_VIDEO') {
        onSelectVideo(message.videoId)
        return
      }
      if (message.event === 'MARK_COMPLETE') {
        onMarkComplete(message.videoId)
        return
      }
      if (message.event === 'REQUEST_PROGRESS' && courseId) {
        postToParent({
          event: 'PROGRESS_SNAPSHOT',
          courseId,
          completedVideoIds,
          lastWatchedVideoId,
          percent,
        })
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [
    completedVideoIds,
    courseId,
    lastWatchedVideoId,
    onMarkComplete,
    onSelectVideo,
    percent,
  ])
}

export function emitVideoCompleted(videoId: string, options?: {
  courseId?: string | null
  courseComplete?: boolean
}): void {
  postToParent({ event: 'VIDEO_COMPLETED', videoId })
  if (options?.courseComplete && options.courseId) {
    postToParent({ event: 'TRAINING_COMPLETED', courseId: options.courseId })
  }
}
