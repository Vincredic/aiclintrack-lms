export type VideoSourceType = 'youtube' | 'vimeo' | 'html5'

export interface CourseVideo {
  id: string
  title: string
  description: string
  duration: string
  category: string
  sourceType: VideoSourceType
  sourceUrlOrId: string
  thumbnailUrl: string
  tags?: string[]
}

export interface CourseModule {
  id: string
  title: string
  summary?: string
  videos: CourseVideo[]
}

export interface CourseCatalog {
  id: string
  title: string
  subtitle?: string
  description: string
  modules: CourseModule[]
}

export interface LmsUserProgress {
  completedVideoIds: string[]
  lastWatchedVideoId: string | null
  positions: Record<string, number>
  updatedAt: string
}

export type LmsOutgoingMessage =
  | { event: 'VIDEO_COMPLETED'; videoId: string }
  | { event: 'LMS_READY'; courseId: string }
  | {
      event: 'PROGRESS_SNAPSHOT'
      courseId: string
      completedVideoIds: string[]
      lastWatchedVideoId: string | null
      percent: number
    }
  | { event: 'TRAINING_COMPLETED'; courseId: string }

export type LmsIncomingMessage =
  | { event: 'SELECT_VIDEO'; videoId: string }
  | { event: 'REQUEST_PROGRESS' }
  | { event: 'MARK_COMPLETE'; videoId: string }

export const LMS_PROGRESS_STORAGE_KEY = 'lms_user_progress'
export const LMS_PROGRESS_OUTBOX_KEY = 'lms_progress_outbox'
export const LMS_LAUNCH_TOKEN_KEY = 'lms_launch_token'
export const LMS_ADMIN_DRAFT_KEY = 'lms_admin_draft'
export const LMS_INLINE_CATALOG_ID = 'lms-catalog'
