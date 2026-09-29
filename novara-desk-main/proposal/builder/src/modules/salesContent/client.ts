import { apiFetch } from '../../lib/apiFetch.js'
import type { BlueprintProposalContext, ProposalBlueprint, DynamicPagePlan } from '../blueprint/index.js'
import type { ProposalIntelligence } from '../intelligence/index.js'
import type { AutoGeneratePageId } from '../blueprintPopulate/index.js'
import type { GenerateContentResponse, ProposalContent, ProposalContentPages } from './types.js'

/**
 * Calls the server-side content-generation route — never Claude directly.
 * No Anthropic API key is ever present in this file (mirrors
 * modules/blueprint/client.ts). Longer than apiFetch's 60s default: the
 * server runs two Claude calls (compact pages + pages 07/08) in parallel,
 * under a 120s function budget (see vercel.json) — the client must wait at
 * least that long before giving up.
 */
export async function generateContent(blueprint: ProposalBlueprint): Promise<ProposalContent> {
  const res = await apiFetch('/api/ai/generate-content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    authenticated: true,
    body: JSON.stringify({ blueprint }),
    timeoutMs: 110_000,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Content generation request failed (${res.status})`)
  return (data as GenerateContentResponse).content
}

/**
 * Sequential per-page generation (Meeting Transcript auto-flow — see
 * modules/intelligence/autoGenerate.ts). Same route, `action: 'generatePage'`
 * discriminator — the manual /proposals/:id/content page's call above is
 * completely unaffected. No custom timeoutMs: each page's request is tiny
 * (1-4 fields), well within apiFetch's default timeout.
 */
export async function generateContentForPage(
  pageId: AutoGeneratePageId,
  intelligence: ProposalIntelligence,
  proposal: BlueprintProposalContext,
  // dynamicInsight0N pages only — the layout/title the Content Architect
  // already decided (see planDynamicPages below), pre-told to the server
  // rather than re-decided per-page.
  dynamicPage?: { layout: string; title: string },
  // page07 only — visual layouts the Content Architect already committed
  // to other pages in this same proposal, so page07's own independent
  // layout pick (from the same 11-layout menu) can never collide with one
  // of them and produce two near-duplicate visual blocks.
  excludeLayouts?: string[]
): Promise<{ content: Partial<ProposalContentPages>; subHeading?: string }> {
  const res = await apiFetch('/api/ai/generate-content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    authenticated: true,
    body: JSON.stringify({ action: 'generatePage', pageId, intelligence, proposal, ...dynamicPage, ...(excludeLayouts ? { excludeLayouts } : {}) }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Page generation request failed (${res.status})`)
  return data as { content: Partial<ProposalContentPages>; subHeading?: string }
}

/**
 * Content Architect — decides whether this proposal earns additional
 * dynamic insight pages beyond the fixed template (see
 * blueprint/types.ts's DynamicPagePlan), and if so, how many + what type.
 * Optional value-add: never throws on a decision failure, since the
 * server-side route itself always resolves 200 with a plan (possibly
 * empty) — see api/ai/generate-content.ts's handlePlanDynamicPages. A
 * genuine network/auth failure (non-JSON body, request never reaching the
 * server) still degrades to an empty plan here rather than failing the
 * whole Meeting-Transcript auto-flow over an optional step.
 */
export async function planDynamicPages(intelligence: ProposalIntelligence, proposal: BlueprintProposalContext): Promise<DynamicPagePlan> {
  try {
    const res = await apiFetch('/api/ai/generate-content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      authenticated: true,
      body: JSON.stringify({ action: 'planDynamicPages', intelligence, proposal }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || `Dynamic page plan request failed (${res.status})`)
    return (data.dynamicPagePlan ?? { pages: [] }) as DynamicPagePlan
  } catch (err) {
    console.error('planDynamicPages: failed, defaulting to no extra pages:', err instanceof Error ? err.message : err)
    return { pages: [] }
  }
}
