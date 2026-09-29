import { useEffect } from 'react'

/**
 * Warns before the user loses unsaved changes. Handles tab close/refresh via
 * `beforeunload`. In-app navigation (switching pages, clicking Back, etc.)
 * is guarded separately by callers using a `window.confirm` check against
 * `isDirty` before navigating — the app currently uses a plain
 * `BrowserRouter` with no data-router blocker API, and adding one is a
 * bigger change than this phase needs.
 */
export function useUnsavedChangesGuard(isDirty: boolean): void {
  useEffect(() => {
    if (!isDirty) return
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])
}

/** Shared confirmation check for in-app navigation away from unsaved changes. */
export function confirmDiscardUnsavedChanges(isDirty: boolean): boolean {
  if (!isDirty) return true
  return window.confirm('You have unsaved changes. Leave without saving?')
}
