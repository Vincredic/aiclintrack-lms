import { useEffect, useRef } from 'react'
import { asRecord } from '../../../lib/json'
import { buildYouTubeEmbedUrl } from '../../../lib/videoSource'
import type { VideoEngineProps } from './types'

const YT_ORIGINS = new Set([
  'https://www.youtube-nocookie.com',
  'https://www.youtube.com',
])

const YT_ENDED = 0
const YT_PLAYING = 1
const YT_PAUSED = 2

function command(
  frame: HTMLIFrameElement,
  func: string,
  args: unknown[] = [],
): void {
  frame.contentWindow?.postMessage(
    JSON.stringify({ event: 'command', func, args }),
    '*',
  )
}

export function YouTubeEngine({
  videoId,
  sourceUrlOrId,
  title,
  startSeconds = 0,
  onTimeUpdate,
  onEnded,
}: VideoEngineProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const onTimeUpdateRef = useRef(onTimeUpdate)
  const onEndedRef = useRef(onEnded)
  const endedOnceRef = useRef(false)
  const playingRef = useRef(false)
  const startRef = useRef(startSeconds)

  onTimeUpdateRef.current = onTimeUpdate
  onEndedRef.current = onEnded

  const src = buildYouTubeEmbedUrl(sourceUrlOrId, {
    startSeconds: startRef.current,
    origin: typeof window === 'undefined' ? undefined : window.location.origin,
  })

  useEffect(() => {
    endedOnceRef.current = false
    playingRef.current = false
  }, [src])

  useEffect(() => {
    const frame = iframeRef.current
    if (!frame) return

    const onMessage = (event: MessageEvent) => {
      if (!YT_ORIGINS.has(event.origin)) return
      if (event.source !== frame.contentWindow) return
      const payload = asRecord(event.data)
      if (!payload) return

      if (payload.event === 'onStateChange' && typeof payload.info === 'number') {
        if (payload.info === YT_ENDED && !endedOnceRef.current) {
          endedOnceRef.current = true
          playingRef.current = false
          onEndedRef.current?.()
        }
        playingRef.current = payload.info === YT_PLAYING
        if (payload.info === YT_PAUSED || payload.info === YT_ENDED) {
          command(frame, 'getCurrentTime')
        }
      }

      const info = asRecord(payload.info)
      if (payload.event === 'infoDelivery' && info) {
        if (typeof info.currentTime === 'number') {
          onTimeUpdateRef.current?.(info.currentTime)
        }
        if (typeof info.playerState === 'number') {
          playingRef.current = info.playerState === YT_PLAYING
          if (info.playerState === YT_ENDED && !endedOnceRef.current) {
            endedOnceRef.current = true
            onEndedRef.current?.()
          }
        }
      }
    }

    const poll = window.setInterval(() => {
      if (playingRef.current) command(frame, 'getCurrentTime')
    }, 2500)

    window.addEventListener('message', onMessage)

    return () => {
      window.removeEventListener('message', onMessage)
      window.clearInterval(poll)
    }
  }, [src])

  return (
    <iframe
      ref={iframeRef}
      title={title}
      src={src}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
      className="absolute inset-0 h-full w-full border-0"
      onLoad={() => {
        const frame = iframeRef.current
        if (!frame) return
        frame.contentWindow?.postMessage(
          JSON.stringify({ event: 'listening', id: videoId }),
          '*',
        )
        command(frame, 'addEventListener', ['onStateChange'])
        command(frame, 'addEventListener', ['onReady'])
      }}
    />
  )
}
