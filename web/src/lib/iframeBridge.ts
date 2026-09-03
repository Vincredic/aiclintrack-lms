import { getCtmsOrigin } from '../config/lms'
import type { LmsIncomingMessage, LmsOutgoingMessage } from '../types/lms'
import { asRecord } from './json'

export function isEmbedded(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.parent !== window
  } catch {
    return true
  }
}

function trustedParentOrigins(): string[] {
  const origins = new Set<string>([getCtmsOrigin()])
  if (typeof window !== 'undefined') {
    origins.add(window.location.origin)
  }
  if (import.meta.env.DEV) {
    origins.add('http://localhost:5173')
    origins.add('http://127.0.0.1:5173')
  }
  return [...origins]
}

export function isTrustedParentOrigin(origin: string): boolean {
  return trustedParentOrigins().includes(origin)
}

export function parseIncomingLmsMessage(data: unknown): LmsIncomingMessage | null {
  const record = asRecord(data)
  if (!record || typeof record.event !== 'string') return null

  if (record.event === 'SELECT_VIDEO' && typeof record.videoId === 'string') {
    return { event: 'SELECT_VIDEO', videoId: record.videoId }
  }
  if (record.event === 'MARK_COMPLETE' && typeof record.videoId === 'string') {
    return { event: 'MARK_COMPLETE', videoId: record.videoId }
  }
  if (record.event === 'REQUEST_PROGRESS') {
    return { event: 'REQUEST_PROGRESS' }
  }
  return null
}

export function postToParent(message: LmsOutgoingMessage): void {
  if (typeof window === 'undefined' || !isEmbedded()) return
  const origins = trustedParentOrigins()
  for (const origin of origins) {
    try {
      window.parent.postMessage(message, origin)
    } catch {
      // Invalid origin strings are ignored.
    }
  }
}
