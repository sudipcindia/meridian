// Shared Vercel request/response shapes — every AI route in this app
// (and several non-AI ones) declared this identical pair locally. Pure
// deduplication: the shape is unchanged, so no route's behavior changes
// by importing it from here instead.

export interface VercelRequest {
  method?: string
  body?: unknown
  headers?: Record<string, string | string[] | undefined>
}

export interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
  end: () => void
}
