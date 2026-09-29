import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Loader2 } from 'lucide-react'
import { Topbar } from '../layout/Topbar.js'
import { ErrorBanner } from '../components/ErrorBanner.js'
import { analysisCardClass } from '../components/analysis/AnalysisCards.js'
import {
  buildPopulationSections,
  getNotAvailableItems,
  hasFieldConflict,
  hasSectionConflict,
  type ConflictResolution,
  type PopulationSection,
  type SectionDecision,
} from '../modules/blueprintPopulate/index.js'
import { getBlueprint } from '../lib/blueprints.js'
import { getContent } from '../lib/salesContent.js'
import { getDocumentByProposalId } from '../lib/documents.js'
import { applyPopulation } from '../lib/populateBuilder.js'
import { getProposal } from '../lib/proposals.js'
import { logActivity } from '../modules/activity/logActivity.js'
import type { ProposalDocument } from '../types/document.js'
import type { Proposal } from '../types/proposal.js'

const decisionBadgeClass: Record<SectionDecision, string> = {
  pending: 'border-novara-border text-novara-light/50',
  accept: 'border-novara-teal/50 text-novara-teal bg-novara-teal/10',
  reject: 'border-red-500/40 text-red-400 bg-red-500/10',
}

const decisionLabel: Record<SectionDecision, string> = {
  pending: 'Pending',
  accept: 'Accepted',
  reject: 'Rejected',
}

/**
 * Proposal Intelligence Engine — Phase 04: Builder Population. The first
 * integration point between the AI Proposal Engine and the EXISTING
 * Proposal Builder. This page never edits the template, never redesigns
 * the Builder, and never writes anything by itself — it only shows an AI
 * Preview (Current vs AI Suggested per section), lets the user Accept/
 * Reject per section or all at once, resolves any conflict with already-
 * edited content (Replace / Merge / Cancel), and then writes ONLY the
 * accepted content through the Builder's own existing save mechanism
 * (src/lib/populateBuilder.ts -> updateDocumentContent). Manual editing
 * in the real Builder afterward is completely unaffected.
 */
export function ProposalPopulatePage() {
  const { id } = useParams<{ id: string }>()

  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [document, setDocument] = useState<ProposalDocument | null>(null)
  const [hasBlueprint, setHasBlueprint] = useState(false)
  const [sections, setSections] = useState<PopulationSection[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [decisions, setDecisions] = useState<Record<string, SectionDecision>>({})
  const [resolutions, setResolutions] = useState<Record<string, ConflictResolution>>({})
  const [conflictQueue, setConflictQueue] = useState<string[]>([])

  const [applying, setApplying] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [applied, setApplied] = useState(false)

  const notAvailable = useMemo(() => getNotAvailableItems(), [])
  const currentConflictSection = sections.find((s) => s.id === conflictQueue[0]) ?? null

  useEffect(() => {
    if (!id) return
    let cancelled = false
    Promise.all([getProposal(id), getBlueprint(id), getContent(id), getDocumentByProposalId(id)])
      .then(([p, blueprintRecord, contentRecord, doc]) => {
        if (cancelled) return
        setProposal(p)
        setDocument(doc)
        setHasBlueprint(Boolean(blueprintRecord))
        if (blueprintRecord && doc && p) {
          const built = buildPopulationSections(blueprintRecord.blueprint, contentRecord?.content ?? null, doc, {
            clientName: p.clientName,
            companyName: p.companyName,
            preparedBy: p.preparedBy,
          })
          setSections(built)
          setDecisions(Object.fromEntries(built.map((s) => [s.id, 'pending' as SectionDecision])))
        }
      })
      .catch((err) => !cancelled && setLoadError(err instanceof Error ? err.message : 'Failed to load proposal'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [id])

  function acceptSection(sectionId: string) {
    const section = sections.find((s) => s.id === sectionId)
    if (!section) return
    if (hasSectionConflict(section) && !resolutions[sectionId]) {
      setConflictQueue((prev) => (prev.includes(sectionId) ? prev : [...prev, sectionId]))
      return
    }
    setDecisions((prev) => ({ ...prev, [sectionId]: 'accept' }))
    setApplied(false)
  }

  function rejectSection(sectionId: string) {
    setDecisions((prev) => ({ ...prev, [sectionId]: 'reject' }))
    setConflictQueue((prev) => prev.filter((id_) => id_ !== sectionId))
    setApplied(false)
  }

  function acceptAll() {
    const conflicting = sections.filter((s) => hasSectionConflict(s) && !resolutions[s.id])
    const nonConflicting = sections.filter((s) => !conflicting.includes(s))
    setDecisions((prev) => {
      const next = { ...prev }
      for (const s of nonConflicting) next[s.id] = 'accept'
      return next
    })
    setConflictQueue(conflicting.map((s) => s.id))
    setApplied(false)
  }

  function rejectAll() {
    setDecisions(Object.fromEntries(sections.map((s) => [s.id, 'reject' as SectionDecision])))
    setConflictQueue([])
    setApplied(false)
  }

  function resolveConflict(resolution: ConflictResolution | 'cancel') {
    const sectionId = conflictQueue[0]
    if (!sectionId) return
    if (resolution === 'cancel') {
      setDecisions((prev) => ({ ...prev, [sectionId]: 'reject' }))
    } else {
      setResolutions((prev) => ({ ...prev, [sectionId]: resolution }))
      setDecisions((prev) => ({ ...prev, [sectionId]: 'accept' }))
    }
    setConflictQueue((prev) => prev.slice(1))
  }

  async function handleApply() {
    if (!document || applying || !id) return
    const acceptedSections = sections.filter((s) => decisions[s.id] === 'accept')
    if (acceptedSections.length === 0) return
    setApplying(true)
    setApplyError(null)
    try {
      const updated = await applyPopulation(document, acceptedSections, resolutions)
      setDocument(updated)
      setApplied(true)
      void logActivity({
        proposalId: id,
        action: 'builder_populated',
        actor: 'staff',
        detail: `${acceptedSections.length} section(s) accepted: ${acceptedSections.map((s) => s.label).join(', ')}`,
      })
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : 'Failed to populate the Builder')
    } finally {
      setApplying(false)
    }
  }

  if (!id) return null
  if (loading) return <div className="px-8 py-6 text-sm font-general-sans text-novara-light/50">Loading…</div>
  if (loadError) return <div className="px-8 py-6"><ErrorBanner message={loadError} /></div>
  if (!proposal) return null

  if (!hasBlueprint || !document) {
    return (
      <>
        <Topbar title={proposal.proposalName} subtitle="Builder Population" />
        <div className="px-8 py-6 max-w-[700px]">
          <div className={analysisCardClass}>
            <p className="font-clash-display text-[16px] text-white">Generate a Proposal Blueprint first</p>
            <p className="text-sm font-general-sans text-novara-light/60">
              Builder Population reads from the saved Proposal Blueprint. Generate and save a Blueprint before populating the Builder.
            </p>
            <Link
              to={`/proposals/${id}/blueprint`}
              className="self-start flex items-center gap-1.5 text-sm font-general-sans font-medium text-novara-teal hover:text-novara-teal/80 transition-colors"
            >
              Go to Proposal Blueprint <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </>
    )
  }

  const acceptedCount = sections.filter((s) => decisions[s.id] === 'accept').length

  return (
    <>
      <Topbar title={proposal.proposalName} subtitle="Builder Population" />

      <div className="px-8 py-6 flex flex-col gap-6 max-w-[900px]">
        <div className={analysisCardClass}>
          <p className="font-clash-display text-[16px] text-white">AI Preview</p>
          <p className="text-sm font-general-sans text-novara-light/60">
            Review the AI Suggested content against what the Builder already shows for each section. Only sections you accept are written into
            the Builder — everything remains fully editable there afterward, exactly as it is today.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={acceptAll}
              className="text-sm font-general-sans font-medium bg-novara-teal hover:bg-novara-teal/90 text-novara-dark px-4 py-2 rounded-lg transition-colors"
            >
              Accept All
            </button>
            <button
              onClick={rejectAll}
              className="text-sm font-general-sans font-medium border border-novara-border text-novara-light/70 hover:text-white px-4 py-2 rounded-lg transition-colors"
            >
              Reject All
            </button>
          </div>
        </div>

        {notAvailable.length > 0 && (
          <div className={analysisCardClass}>
            <p className="font-clash-display text-[15px] text-white">Not Yet Available in Builder</p>
            <p className="text-[12px] font-general-sans text-novara-light/50">
              The Blueprint has content for these, but no safe existing field exists in the Builder yet — nothing is written for them.
            </p>
            <div className="flex flex-col gap-2">
              {notAvailable.map((item) => (
                <div key={item.page} className="flex flex-col gap-0.5">
                  <span className="text-[12px] font-general-sans font-medium text-novara-light/70">{item.page}</span>
                  <span className="text-[11.5px] font-general-sans text-novara-light/45">{item.reason}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {sections.map((section) => {
          const decision = decisions[section.id] ?? 'pending'
          const conflicted = hasSectionConflict(section)
          return (
            <div key={section.id} className={analysisCardClass}>
              <div className="flex items-center justify-between">
                <p className="font-clash-display text-[16px] text-white">{section.label}</p>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-general-sans font-medium border ${decisionBadgeClass[decision]}`}>
                  {decisionLabel[decision]}
                </span>
              </div>

              <div className="flex flex-col gap-3">
                {section.fields.map((field) => (
                  <div key={field.key} className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-novara-border pt-3 first:border-t-0 first:pt-0">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10.5px] font-general-sans font-medium text-novara-light/50 uppercase tracking-wide">
                        {field.label} — Current
                        {hasFieldConflict(field) && <span className="ml-1.5 text-amber-400 normal-case font-normal">⚠ existing content differs</span>}
                      </span>
                      <span className="text-[12.5px] font-general-sans text-white/70 whitespace-pre-wrap">{field.currentValue || '—'}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10.5px] font-general-sans font-medium text-novara-teal/70 uppercase tracking-wide">AI Suggested</span>
                      <span className="text-[12.5px] font-general-sans text-white whitespace-pre-wrap">{field.suggestedValue}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => acceptSection(section.id)}
                  className="text-sm font-general-sans font-medium text-novara-teal hover:text-novara-teal/80 transition-colors"
                >
                  Accept Section
                </button>
                <button
                  onClick={() => rejectSection(section.id)}
                  className="text-sm font-general-sans font-medium text-novara-light/60 hover:text-white transition-colors"
                >
                  Reject Section
                </button>
                {conflicted && !resolutions[section.id] && decision === 'pending' && (
                  <span className="text-[11px] font-general-sans text-amber-400">Existing content found — Accept will ask how to resolve it.</span>
                )}
              </div>
            </div>
          )
        })}

        {applyError && <ErrorBanner heading="Could not populate the Builder" message={applyError} />}

        <div className="flex items-center gap-4">
          {applied ? (
            <>
              <div className="flex items-center gap-2 text-novara-teal text-sm font-general-sans">
                <CheckCircle2 size={16} /> Builder populated.
              </div>
              <Link
                to={`/proposals/${id}/edit`}
                className="flex items-center gap-1.5 text-sm font-general-sans font-medium text-novara-teal hover:text-novara-teal/80 transition-colors"
              >
                Continue to Proposal Builder <ArrowRight size={14} />
              </Link>
            </>
          ) : (
            <button
              onClick={() => void handleApply()}
              disabled={applying || acceptedCount === 0}
              className="self-start flex items-center gap-2 bg-novara-orange hover:bg-novara-orange/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-general-sans font-medium px-4 py-2.5 rounded-lg transition-colors"
            >
              {applying ? <Loader2 size={16} className="animate-spin" /> : null}
              {applying ? 'Applying…' : `Apply to Builder (${acceptedCount} accepted)`}
            </button>
          )}
        </div>
      </div>

      {currentConflictSection && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-novara-dark border border-novara-border rounded-xl max-w-[600px] w-full p-6 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
            <div>
              <p className="font-clash-display text-[16px] text-white">Existing content found</p>
              <p className="text-sm font-general-sans text-novara-light/60 mt-1">
                “{currentConflictSection.label}” already has content that differs from the AI suggestion. Replace existing content? Merge content?
                Cancel?
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {currentConflictSection.fields.filter(hasFieldConflict).map((field) => (
                <div key={field.key} className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-novara-border pt-3 first:border-t-0 first:pt-0">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10.5px] font-general-sans font-medium text-novara-light/50 uppercase tracking-wide">{field.label} — Current</span>
                    <span className="text-[12px] font-general-sans text-white/70 whitespace-pre-wrap">{field.currentValue}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10.5px] font-general-sans font-medium text-novara-teal/70 uppercase tracking-wide">AI Suggested</span>
                    <span className="text-[12px] font-general-sans text-white whitespace-pre-wrap">{field.suggestedValue}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => resolveConflict('replace')}
                className="text-sm font-general-sans font-medium bg-novara-teal hover:bg-novara-teal/90 text-novara-dark px-4 py-2 rounded-lg transition-colors"
              >
                Replace
              </button>
              <button
                onClick={() => resolveConflict('merge')}
                className="text-sm font-general-sans font-medium border border-novara-border text-white hover:bg-white/5 px-4 py-2 rounded-lg transition-colors"
              >
                Merge
              </button>
              <button
                onClick={() => resolveConflict('cancel')}
                className="text-sm font-general-sans font-medium text-novara-light/60 hover:text-white px-4 py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
