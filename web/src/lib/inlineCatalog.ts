import { parseCourseCatalog } from './courseCatalog'
import { LMS_INLINE_CATALOG_ID, type CourseCatalog } from '../types/lms'

export function readInlineCatalog(): CourseCatalog | null {
  if (typeof document === 'undefined') return null
  const node = document.getElementById(LMS_INLINE_CATALOG_ID)
  const raw = node?.textContent?.trim()
  if (!raw) return null
  try {
    return parseCourseCatalog(JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}
