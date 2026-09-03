import { isVideoSourceType } from '../../lib/videoSource'
import type { VideoSourceType } from '../../types/lms'
import { Html5Engine } from './engines/Html5Engine'
import type { VideoEngineComponent, VideoEngineProps } from './engines/types'
import { VimeoEngine } from './engines/VimeoEngine'
import { YouTubeEngine } from './engines/YouTubeEngine'

const engines: Record<VideoSourceType, VideoEngineComponent> = {
  youtube: YouTubeEngine,
  vimeo: VimeoEngine,
  html5: Html5Engine,
}

function UnsupportedEngine({ title, sourceUrlOrId }: VideoEngineProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950 px-6 text-center">
      <p className="text-sm font-medium text-white">No player registered</p>
      <p className="max-w-sm text-xs text-slate-400">
        {title} uses an unknown source. Register an engine for this sourceType
        or check <span className="font-mono">{sourceUrlOrId}</span>.
      </p>
    </div>
  )
}

interface VideoPlayerWrapperProps extends VideoEngineProps {
  sourceType: VideoSourceType | string
}

export function VideoPlayerWrapper({
  sourceType,
  ...engineProps
}: VideoPlayerWrapperProps) {
  const Engine = isVideoSourceType(sourceType)
    ? engines[sourceType]
    : UnsupportedEngine

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-slate-950 shadow-inner">
      <Engine key={`${sourceType}:${engineProps.videoId}`} {...engineProps} />
    </div>
  )
}
