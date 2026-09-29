/**
 * Best-effort browser-reported context captured right before a client
 * submits their acceptance (AcceptanceForm.tsx) — every field is optional
 * and this must never throw or block submission: a browser that can't
 * provide one of these (or has it spoofed/blocked by an extension) just
 * sends undefined for that field, same posture as every other piece of
 * audit-trail data in this app never being required to complete signing.
 */
export interface DeviceContext {
  screenResolution?: string
  viewportSize?: string
  preferredLanguage?: string
  browserTimezone?: string
}

export function captureDeviceContext(): DeviceContext {
  const context: DeviceContext = {}
  try {
    if (typeof window !== 'undefined' && window.screen) {
      context.screenResolution = `${window.screen.width}x${window.screen.height}`
    }
  } catch {
    // ignore — best-effort only
  }
  try {
    if (typeof window !== 'undefined') {
      context.viewportSize = `${window.innerWidth}x${window.innerHeight}`
    }
  } catch {
    // ignore
  }
  try {
    if (typeof navigator !== 'undefined' && navigator.language) {
      context.preferredLanguage = navigator.language
    }
  } catch {
    // ignore
  }
  try {
    context.browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    // ignore
  }
  return context
}
