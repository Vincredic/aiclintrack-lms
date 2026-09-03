import type { ComponentType } from 'react'

export interface VideoEngineProps {
  videoId: string
  sourceUrlOrId: string
  title: string
  thumbnailUrl?: string
  startSeconds?: number
  onTimeUpdate?: (seconds: number) => void
  onEnded?: () => void
}

export type VideoEngineComponent = ComponentType<VideoEngineProps>
