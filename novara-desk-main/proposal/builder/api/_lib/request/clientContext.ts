/**
 * Shared IP/UA/geolocation header extraction for every client-facing
 * endpoint that records audit-trail evidence (api/client/accept.ts,
 * api/client/resolve.ts). Geolocation comes from Vercel's own automatic
 * request headers (x-vercel-ip-*) — no third-party service, no extra
 * cost, and inherently coarse (city/region level, never GPS-precise).
 * Only populated on real Vercel deployments; every field is null in local
 * dev, where none of these headers exist.
 */

interface HeaderSource {
  headers?: Record<string, string | string[] | undefined>
}

export interface ClientRequestContext {
  ipAddress: string | null
  userAgent: string | null
  geoCountry: string | null
  geoRegion: string | null
  geoCity: string | null
  geoTimezone: string | null
}

function readHeader(req: HeaderSource, name: string): string | null {
  const raw = req.headers?.[name]
  const value = Array.isArray(raw) ? raw[0] : raw
  return value?.trim() || null
}

export function extractClientRequestContext(req: HeaderSource): ClientRequestContext {
  const forwardedFor = readHeader(req, 'x-forwarded-for')
  const ipAddress = forwardedFor ? forwardedFor.split(',')[0]?.trim() || null : null
  const userAgent = readHeader(req, 'user-agent')

  const geoCountry = readHeader(req, 'x-vercel-ip-country')
  const geoRegion = readHeader(req, 'x-vercel-ip-country-region')
  const rawGeoCity = readHeader(req, 'x-vercel-ip-city')
  let geoCity: string | null = null
  if (rawGeoCity) {
    try {
      geoCity = decodeURIComponent(rawGeoCity)
    } catch {
      geoCity = rawGeoCity
    }
  }
  const geoTimezone = readHeader(req, 'x-vercel-ip-timezone')

  return { ipAddress, userAgent, geoCountry, geoRegion, geoCity, geoTimezone }
}
