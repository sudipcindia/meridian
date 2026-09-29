import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, Loader2 } from 'lucide-react'
import { Topbar } from '../layout/Topbar.js'
import { ErrorBanner } from '../components/ErrorBanner.js'
import { analysisCardClass } from '../components/analysis/AnalysisCards.js'
import { assemblePreviewSections, type PreviewSection, type PreviewSectionDecision } from '../modules/proposalPreview/index.js'
import { generateBlueprint, type ProposalBlueprint } from '../modules/blueprint/index.js'
import { generateContent, type ProposalContent } from '../modules/salesContent/index.js'
import { generateImpact, type BusinessImpact } from '../modules/businessImpact/index.js'
import { getIntelligence } from '../lib/intelligence.js'
import { getBlueprint, saveBlueprint } from '../lib/blueprints.js'
import { getContent, saveContent } from '../lib/salesContent.js'
import { getBusinessImpact, saveBusinessImpact } from '../lib/businessImpact.js'
import { getProposal } from '../lib/proposals.js'
import type { ProposalIntelligence } from '../modules/intelligence/index.js'
import type { Proposal } from '../types/proposal.js'

const decisionBadgeClass: Record<PreviewSectionDecision, string> = {
  pending: 'border-novara-border text-novara-light/50',
  approved: 'border-novara-teal/50 text-novara-teal bg-novara-teal/10',
  skipped: 'border-red-500/40 text-red-400 bg-red-500/10',
}

const decisionLabel: Record<PreviewSectionDecision, string> = {
  pending: 'Pending',
  approved: 'Approved',
  skipped: 'Skipped',
}

/**
 * Proposal Intelligence Engine — Phase 07: Proposal Orchestrator. The
 * Proposal Preview — the "User Review" step between Business Impact and
 * Builder Population. Assembled live from the four existing AI records
 * (never its own stored object — see modules/proposalPreview/assemble.ts),
 * with per-section Approve/Skip, "Approve Entire Proposal", and
 * "Regenerate Section" (re-runs the exact existing generation call for
 * whichever phase supplied that section, never a new/duplicated AI
 * capability). Intelligence-sourced sections show "Go Back" instead of
 * Regenerate — there is no per-field regeneration endpoint for a single
 * Intelligence fact, so editing happens on that page directly.
 */
export function ProposalPreviewPage() {
  const { id } = useParams<{ id: string }>()

  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [intelligence, setIntelligence] = useState<ProposalIntelligence | null>(null)
  const [blueprint, setBlueprint] = useState<ProposalBlueprint | null>(null)
  const [content, setContent] = useState<ProposalContent | null>(null)
  const [impact, setImpact] = useState<BusinessImpact | null>(null)
  const [missingStep, setMissingStep] = useState<{ label: string; path: string } | null>(null)

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [sections, setSections] = useState<PreviewSection[]>([])
  const [decisions, setDecisions] = useState<Record<string, PreviewSectionDecision>>({})
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)
  const [regenerateError, setRegenerateError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    Promise.all([getProposal(id), getIntelligence(id), getBlueprint(id), getContent(id), getBusinessImpact(id)])
      .then(([p, intelligenceRecord, blueprintRecord, contentRecord, impactRecord]) => {
        if (cancelled) return
        setProposal(p)
        if (!intelligenceRecord) return setMissingStep({ label: 'Meeting Transcript & Analysis', path: `/proposals/${id}/intelligence` })
        if (!blueprintRecord) return setMissingStep({ label: 'Proposal Blueprint', path: `/proposals/${id}/blueprint` })
        if (!impactRecord) return setMissingStep({ label: 'Business Impact Engine', path: `/proposals/${id}/impact` })

        setIntelligence(intelligenceRecord.intelligence)
        setBlueprint(blueprintRecord.blueprint)
        setContent(contentRecord?.content ?? null)
        setImpact(impactRecord.impact)

        const built = assemblePreviewSections(intelligenceRecord.intelligence, blueprintRecord.blueprint, contentRecord?.content ?? null, impactRecord.impact)
        setSections(built)
        setDecisions(Object.fromEntries(built.map((s) => [s.id, 'pending' as PreviewSectionDecision])))
      })
      .catch((err) => !cancelled && setLoadError(err instanceof Error ? err.message : 'Failed to load proposal'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [id])

  function setDecision(sectionId: string, decision: PreviewSectionDecision) {
    setDecisions((prev) => ({ ...prev, [sectionId]: decision }))
  }

  function approveAll() {
    setDecisions(Object.fromEntries(sections.map((s) => [s.id, 'approved' as PreviewSectionDecision])))
  }

  /** Re-runs the EXISTING generation call for whichever phase sourced this section, saves it through that phase's own save function, then re-assembles — only sections still sourced from the regenerated phase pick up new content and are reset to pending; every other section's already-recorded decision is preserved untouched. */
  async function regenerateSection(section: PreviewSection) {
    if (!id || !proposal || !intelligence || !blueprint || regeneratingId) return
    setRegeneratingId(section.id)
    setRegenerateError(null)
    try {
      let nextBlueprint = blueprint
      let nextContent = content
      let nextImpact = impact as BusinessImpact

      if (section.sourcePhase === 'blueprint') {
        nextBlueprint = await generateBlueprint(
          {
            clientName: proposal.clientName,
            clientFirstName: proposal.clientFirstName,
            companyName: proposal.companyName,
            proposalName: proposal.proposalName,
            proposalType: proposal.proposalType,
            preparedBy: proposal.preparedBy,
            providerIdentity: proposal.providerIdentity,
          },
          intelligence
        )
        await saveBlueprint(id, nextBlueprint)
        setBlueprint(nextBlueprint)
      } else if (section.sourcePhase === 'content') {
        nextContent = await generateContent(blueprint)
        await saveContent(id, nextContent)
        setContent(nextContent)
      } else if (section.sourcePhase === 'impact') {
        nextImpact = await generateImpact(blueprint)
        await saveBusinessImpact(id, nextImpact)
        setImpact(nextImpact)
      }

      const refreshed = assemblePreviewSections(intelligence, nextBlueprint, nextContent, nextImpact)
      setSections(refreshed)
      setDecisions((prev) => {
        const next = { ...prev }
        for (const s of refreshed) {
          if (s.sourcePhase === section.sourcePhase) next[s.id] = 'pending'
        }
        return next
      })
    } catch (err) {
      setRegenerateError(err instanceof Error ? err.message : 'Failed to regenerate section')
    } finally {
      setRegeneratingId(null)
    }
  }

  if (!id) return null
  if (loading) return <div className="px-8 py-6 text-sm font-general-sans text-novara-light/50">Loading…</div>
  if (loadError) return <div className="px-8 py-6"><ErrorBanner message={loadError} /></div>
  if (!proposal) return null

  if (missingStep) {
    return (
      <>
        <Topbar title={proposal.proposalName} subtitle="Proposal Preview" />
        <div className="px-8 py-6 max-w-[700px]">
          <div className={analysisCardClass}>
            <p className="font-clash-display text-[16px] text-white">Complete "{missingStep.label}" first</p>
            <p className="text-sm font-general-sans text-novara-light/60">
              The Proposal Preview combines Proposal Intelligence, the Blueprint, and Business Impact — complete every earlier step first.
            </p>
            <Link
              to={missingStep.path}
              className="self-start flex items-center gap-1.5 text-sm font-general-sans font-medium text-novara-teal hover:text-novara-teal/80 transition-colors"
            >
              Go to {missingStep.label} <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </>
    )
  }

  const allResolved = sections.length > 0 && sections.every((s) => decisions[s.id] !== 'pending')

  return (
    <>
      <Topbar title={proposal.proposalName} subtitle="Proposal Preview" />

      <div className="px-8 py-6 flex flex-col gap-6 max-w-[900px]">
        <div className={analysisCardClass}>
          <p className="font-clash-display text-[16px] text-white">Review before populating the Builder</p>
          <p className="text-sm font-general-sans text-novara-light/60">
            Everything below is assembled from Proposal Intelligence, the Blueprint, Sales Content, and Business Impact. Approve each section,
            regenerate one if it's off, or go back to fix it at the source — nothing is written into the Builder until you approve it here.
          </p>
          <button
            onClick={approveAll}
            className="self-start text-sm font-general-sans font-medium bg-novara-teal hover:bg-novara-teal/90 text-novara-dark px-4 py-2 rounded-lg transition-colors"
          >
            Approve Entire Proposal
          </button>
        </div>

        {regenerateError && <ErrorBanner heading="Could not regenerate section" message={regenerateError} />}

        {sections.map((section) => {
          const decision = decisions[section.id] ?? 'pending'
          const regenerating = regeneratingId === section.id
          return (
            <div key={section.id} className={analysisCardClass}>
              <div className="flex items-center justify-between">
                <p className="font-clash-display text-[16px] text-white">{section.label}</p>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-general-sans font-medium border ${decisionBadgeClass[decision]}`}>
                  {decisionLabel[decision]}
                </span>
              </div>
              <p className="text-[13px] font-general-sans text-white/80 whitespace-pre-wrap">{section.value}</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setDecision(section.id, 'approved')}
                  className="text-sm font-general-sans font-medium text-novara-teal hover:text-novara-teal/80 transition-colors"
                >
                  Approve
                </button>
                <button
                  onClick={() => setDecision(section.id, 'skipped')}
                  className="text-sm font-general-sans font-medium text-novara-light/60 hover:text-white transition-colors"
                >
                  Skip
                </button>
                {section.canRegenerate ? (
                  <button
                    onClick={() => void regenerateSection(section)}
                    disabled={regenerating}
                    className="flex items-center gap-1.5 text-sm font-general-sans font-medium text-novara-light/60 hover:text-white disabled:opacity-40 transition-colors"
                  >
                    {regenerating ? <Loader2 size={13} className="animate-spin" /> : null}
                    {regenerating ? 'Regenerating…' : 'Regenerate'}
                  </button>
                ) : (
                  <Link
                    to={`/proposals/${id}/intelligence`}
                    className="text-sm font-general-sans font-medium text-novara-light/60 hover:text-white transition-colors"
                  >
                    Go Back to Edit
                  </Link>
                )}
              </div>
            </div>
          )
        })}

        <div className="flex items-center gap-4">
          <Link
            to={allResolved ? `/proposals/${id}/populate` : '#'}
            aria-disabled={!allResolved}
            onClick={(e) => !allResolved && e.preventDefault()}
            className={`flex items-center gap-1.5 text-sm font-general-sans font-medium px-4 py-2.5 rounded-lg transition-colors ${
              allResolved
                ? 'bg-novara-orange hover:bg-novara-orange/90 text-white'
                : 'bg-white/5 text-novara-light/40 cursor-not-allowed'
            }`}
          >
            Continue to Builder Population <ArrowRight size={14} />
          </Link>
          {!allResolved && (
            <span className="text-[12px] font-general-sans text-novara-light/50">Resolve every section (Approve or Skip) to continue.</span>
          )}
        </div>
      </div>
    </>
  )
}
