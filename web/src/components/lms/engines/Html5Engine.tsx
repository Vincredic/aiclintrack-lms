import { useEffect, useRef } from 'react'
import type { VideoEngineProps } from './types'

export function Html5Engine({
  sourceUrlOrId,
  title,
  thumbnailUrl,
  startSeconds = 0,
  onTimeUpdate,
  onEnded,
}: VideoEngineProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const endedOnceRef = useRef(false)
  const startRef = useRef(startSeconds)
  const onTimeUpdateRef = useRef(onTimeUpdate)
  const onEndedRef = useRef(onEnded)

  startRef.current = startSeconds
  onTimeUpdateRef.current = onTimeUpdate
  onEndedRef.current = onEnded

  useEffect(() => {
    endedOnceRef.current = false
    const node = videoRef.current
    if (!node) return

    const handleLoaded = () => {
      const resumeAt = startRef.current
      if (resumeAt > 0 && Math.abs(node.currentTime - resumeAt) > 1) {
        node.currentTime = resumeAt
      }
    }
    const handleTime = () => onTimeUpdateRef.current?.(node.currentTime)
    const handleEnded = () => {
      if (endedOnceRef.current) return
      endedOnceRef.current = true
      onEndedRef.current?.()
    }

    node.addEventListener('loadedmetadata', handleLoaded)
    node.addEventListener('timeupdate', handleTime)
    node.addEventListener('pause', handleTime)
    node.addEventListener('ended', handleEnded)

    return () => {
      node.removeEventListener('loadedmetadata', handleLoaded)
      node.removeEventListener('timeupdate', handleTime)
      node.removeEventListener('pause', handleTime)
      node.removeEventListener('ended', handleEnded)
    }
  }, [sourceUrlOrId])

  return (
    <video
      ref={videoRef}
      title={title}
      controls
      playsInline
      preload="metadata"
      poster={thumbnailUrl || undefined}
      controlsList="nodownload"
      className="absolute inset-0 h-full w-full bg-black object-contain"
    >
      <source src={sourceUrlOrId} />
    </video>
  )
}
