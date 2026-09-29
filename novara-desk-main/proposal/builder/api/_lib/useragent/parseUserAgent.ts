/**
 * Structured, dependency-free User-Agent parsing for the audit trail —
 * written ONCE, server-side, at accept time (api/client/accept.ts), unlike
 * src/lib/acceptances.ts's parseUserAgent(), which only ever produces a
 * display string ("Chrome on macOS") recomputed at render time with no
 * version or device-type classification. That function stays in place as
 * the fallback for acceptance rows recorded before this parser existed.
 *
 * Same "hand-rolled, good enough" posture as the existing parser rather
 * than pulling in a UA-parsing library — this only needs to be accurate
 * enough for evidence purposes, and the raw user_agent string is always
 * stored alongside these derived fields as the ground truth.
 */

export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'unknown'

export interface ParsedUserAgent {
  browserName: string | null
  browserVersion: string | null
  osName: string | null
  osVersion: string | null
  deviceType: DeviceType
}

function match(ua: string, pattern: RegExp): string | null {
  const m = ua.match(pattern)
  return m ? m[1] : null
}

/** Windows NT kernel version -> the marketing name people actually recognise. Windows 10 and 11 share NT 10.0 — there's no reliable UA signal to tell them apart, so both read "Windows 10/11" rather than guessing. */
const WINDOWS_NT_NAMES: Record<string, string> = {
  '10.0': '10/11',
  '6.3': '8.1',
  '6.2': '8',
  '6.1': '7',
}

function parseBrowser(ua: string): { name: string | null; version: string | null } {
  // Order matters: several browsers embed "Safari/" or "Chrome/" tokens in
  // their own UA string for compatibility, so the more specific match must
  // run first — same precedence already established by acceptances.ts's parseUserAgent.
  if (/Edg\//.test(ua)) return { name: 'Edge', version: match(ua, /Edg\/([\d.]+)/) }
  if (/OPR\//.test(ua)) return { name: 'Opera', version: match(ua, /OPR\/([\d.]+)/) }
  if (/CriOS\//.test(ua)) return { name: 'Chrome', version: match(ua, /CriOS\/([\d.]+)/) }
  if (/FxiOS\//.test(ua)) return { name: 'Firefox', version: match(ua, /FxiOS\/([\d.]+)/) }
  if (/Chrome\//.test(ua) && !/Chromium\//.test(ua)) return { name: 'Chrome', version: match(ua, /Chrome\/([\d.]+)/) }
  if (/Firefox\//.test(ua)) return { name: 'Firefox', version: match(ua, /Firefox\/([\d.]+)/) }
  if (/Safari\//.test(ua) && /Version\//.test(ua)) return { name: 'Safari', version: match(ua, /Version\/([\d.]+)/) }
  return { name: null, version: null }
}

function parseOs(ua: string): { name: string | null; version: string | null } {
  if (/iPhone|iPad|iPod/.test(ua)) {
    const raw = match(ua, /OS ([\d_]+) like Mac OS X/)
    return { name: 'iOS', version: raw ? raw.replace(/_/g, '.') : null }
  }
  if (/Android/.test(ua)) return { name: 'Android', version: match(ua, /Android ([\d.]+)/) }
  if (/Mac OS X/.test(ua)) {
    const raw = match(ua, /Mac OS X ([\d_]+)/)
    return { name: 'macOS', version: raw ? raw.replace(/_/g, '.') : null }
  }
  if (/Windows NT/.test(ua)) {
    const nt = match(ua, /Windows NT ([\d.]+)/)
    return { name: 'Windows', version: nt ? (WINDOWS_NT_NAMES[nt] ?? nt) : null }
  }
  if (/Linux/.test(ua)) return { name: 'Linux', version: null }
  return { name: null, version: null }
}

function parseDeviceType(ua: string): DeviceType {
  if (/iPad/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))) return 'tablet'
  if (/iPhone|iPod/.test(ua) || (/Android/.test(ua) && /Mobile/.test(ua)) || /Mobile/.test(ua)) return 'mobile'
  if (/Windows NT|Macintosh|Mac OS X|X11|Linux/.test(ua)) return 'desktop'
  return 'unknown'
}

export function parseUserAgentStructured(userAgent: string): ParsedUserAgent {
  const browser = parseBrowser(userAgent)
  const os = parseOs(userAgent)
  return {
    browserName: browser.name,
    browserVersion: browser.version,
    osName: os.name,
    osVersion: os.version,
    deviceType: parseDeviceType(userAgent),
  }
}
