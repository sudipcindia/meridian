// Shared Anthropic Claude call + JSON-extraction helper — the AI Prompt
// Manager's runtime half. Every AI route in this app (api/generate.ts,
// analyze-transcript, find-missing-info, generate-proposal-data,
// analyze-meeting, generate-questions, generate-blueprint,
// generate-content, generate-impact) duplicated this exact fetch +
// error-response-handling block. Extracted as a pure hardening/dedup
// pass — no prompt content, model choice, token limit, or error-response
// shape changes for any route; `model`/`maxTokens` stay per-call
// parameters precisely so no route's behavior is silently altered.

export class ClaudeApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** Anthropic server-side tool definition (e.g. the web_search tool) — passed through verbatim to the Messages API, never inspected here. Kept loosely typed rather than importing the SDK's types, matching this file's existing no-SDK, raw-fetch pattern. */
export type AnthropicTool = Record<string, unknown>

export interface CallClaudeOptions {
  apiKey: string
  model: string
  maxTokens: number
  system: string
  userPrompt: string
  /** Defaults to 50s — comfortably under every route's configured (or platform-default) function duration, so a slow/hung Claude response fails as a clear, catchable ClaudeApiError instead of the whole function being hard-killed by the platform with an opaque 504. Callers enabling `tools` (e.g. web search, which can run several searches in one turn) should pass a longer value. */
  timeoutMs?: number
  /** Server-side tools (e.g. web_search) — Anthropic executes these itself within the same request/response, no round-trip needed from this server. Omit for every route that doesn't need one. */
  tools?: AnthropicTool[]
}

const DEFAULT_TIMEOUT_MS = 50_000

/**
 * Calls the Anthropic Messages API and returns the raw text response.
 * Throws `ClaudeApiError` (carrying the same 502 status every route
 * already used) for an API-level failure, or a 504 if the request doesn't
 * complete within `timeoutMs` — previously there was no bound on this
 * fetch at all, so a slow response could only ever end with Vercel's own
 * runtime timeout killing the entire function invocation. Any other
 * exception (network failure, etc.) propagates as a plain Error for the
 * caller's own try/catch to turn into its existing 500 response.
 */
export async function callClaude({ apiKey, model, maxTokens, system, userPrompt, timeoutMs = DEFAULT_TIMEOUT_MS, tools }: CallClaudeOptions): Promise<string> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  let r: Response
  try {
    r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: userPrompt }],
        ...(tools ? { tools } : {}),
      }),
      signal: controller.signal,
    })
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new ClaudeApiError(504, 'Claude API did not respond in time. Please try again.')
    }
    throw e
  } finally {
    clearTimeout(timeoutId)
  }

  if (!r.ok) {
    const t = await r.text()
    let msg = `Claude API error ${r.status}`
    try {
      msg = JSON.parse(t).error?.message || msg
    } catch {
      // keep default msg
    }
    throw new ClaudeApiError(502, msg)
  }

  const data = await r.json()
  const content = Array.isArray(data.content) ? data.content : []
  // With no tools, `content` is always exactly one `text` block (this line
  // is then equivalent to the old `content?.[0]?.text`). With tools enabled
  // (e.g. web_search), Anthropic executes the tool itself and returns
  // several block types in one response — `text` (Claude's own words,
  // possibly split into multiple blocks around citation boundaries),
  // `server_tool_use` (the search query) and `web_search_tool_result` (the
  // results) — only `text` blocks carry a `.text` string, so concatenating
  // just those reconstructs Claude's actual final answer regardless of how
  // many search steps happened in between.
  return content
    .filter((block: { type?: string }) => block?.type === 'text')
    .map((block: { text?: string }) => block.text ?? '')
    .join('')
}

/**
 * Strips accidental markdown code fences before JSON.parse — every
 * JSON-returning AI route used this identically. Falls back to slicing out
 * the substring between the first `{` and the last `}` when a direct parse
 * fails, so a response with stray narration around the JSON (e.g. "I'll
 * search for X first." before a tool-enabled call's final answer, despite
 * being told not to) still parses instead of hard-failing.
 */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  const candidate = fenced ? fenced[1] : text
  try {
    return JSON.parse(candidate)
  } catch (e) {
    const start = candidate.indexOf('{')
    const end = candidate.lastIndexOf('}')
    if (start === -1 || end === -1 || end <= start) throw e
    return JSON.parse(candidate.slice(start, end + 1))
  }
}
