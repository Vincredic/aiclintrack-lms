import { useEffect, useRef } from 'react'
import { asRecord } from '../../../lib/json'
import { buildVimeoEmbedUrl } from '../../../lib/videoSource'
import type { VideoEngineProps } from './types'

const VIMEO_ORIGINS = new Set(['https://player.vimeo.com', 'https://vimeo.com'])

function vimeoCommand(frame: HTMLIFrameElement, method: string, value?: unknown) {
  const payload: Record<string, unknown> = { method }
  if (value !== undefined) payload.value = value
  frame.contentWindow?.postMessage(JSON.stringify(payload), '*')
}

export function VimeoEngine({
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

  onTimeUpdateRef.current = onTimeUpdate
  onEndedRef.current = onEnded

  const startRef = useRef(startSeconds)
  const src = buildVimeoEmbedUrl(sourceUrlOrId, { startSeconds: startRef.current })

  useEffect(() => {
    endedOnceRef.current = false
  }, [src])

  useEffect(() => {
    const frame = iframeRef.current
    if (!frame) return

    const subscribe = () => {
      vimeoCommand(frame, 'addEventListener', 'ready')
      vimeoCommand(frame, 'addEventListener', 'playProgress')
      vimeoCommand(frame, 'addEventListener', 'timeupdate')
      vimeoCommand(frame, 'addEventListener', 'finish')
      vimeoCommand(frame, 'addEventListener', 'ended')
    }

    const onMessage = (event: MessageEvent) => {
      if (!VIMEO_ORIGINS.has(event.origin)) return
      if (event.source !== frame.contentWindow) return
      const payload = asRecord(event.data)
      if (!payload) return

      const eventName = typeof payload.event === 'string' ? payload.event : ''
      if (eventName === 'ready') {
        subscribe()
      }
      if (eventName === 'finish' || eventName === 'ended') {
        if (!endedOnceRef.current) {
          endedOnceRef.current = true
          onEndedRef.current?.()
        }
      }
      if (eventName === 'playProgress' || eventName === 'timeupdate') {
        const seconds = asRecord(payload.data)?.seconds
        if (typeof seconds === 'number') onTimeUpdateRef.current?.(seconds)
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [src])

  return (
    <iframe
      ref={iframeRef}
      title={title}
      src={src}
      allow="autoplay; fullscreen; picture-in-picture"
      allowFullScreen
      className="absolute inset-0 h-full w-full border-0"
      onLoad={() => {
        const frame = iframeRef.current
        if (!frame) return
        vimeoCommand(frame, 'addEventListener', 'ready')
        vimeoCommand(frame, 'addEventListener', 'playProgress')
        vimeoCommand(frame, 'addEventListener', 'finish')
      }}
    />
  )
}
