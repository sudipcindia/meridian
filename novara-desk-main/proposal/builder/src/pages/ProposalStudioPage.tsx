import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Loader2, Sparkles } from 'lucide-react'
import { Topbar } from '../layout/Topbar.js'
import { ErrorBanner } from '../components/ErrorBanner.js'
import { analysisCardClass } from '../components/analysis/AnalysisCards.js'
import { generateBlueprint, type ProposalBlueprint } from '../modules/blueprint/index.js'
import { generateContent, type ProposalContent } from '../modules/salesContent/index.js'
import { generateImpact, type BusinessImpact } from '../modules/businessImpact/index.js'
import { getIntelligence, type IntelligenceRecord } from '../lib/intelligence.js'
import { getBlueprint, saveBlueprint } from '../lib/blueprints.js'
import { getContent, saveContent } from '../lib/salesContent.js'
import { getBusinessImpact, saveBusinessImpact } from '../lib/businessImpact.js'
import { getProposal } from '../lib/proposals.js'
import type { Proposal } from '../types/proposal.js'

type StepStatus = 'not_started' | 'action_needed' | 'not_required' | 'done'

const statusBadgeClass: Record<StepStatus, string> = {
  not_started: 'border-novara-border text-novara-light/50',
  action_needed: 'border-amber-400/50 text-amber-400 bg-amber-400/10',
  not_required: 'border-novara-light/30 text-novara-light/60 bg-white/5',
  done: 'border-novara-teal/50 text-novara-teal bg-novara-teal/10',
}

const statusLabel: Record<StepStatus, string> = {
  not_started: 'Not started',
  action_needed: 'Action needed',
  not_required: 'Not required',
  done: 'Done',
}

/**
 * Proposal Intelligence Engine — Phase 07: Proposal Orchestrator. A single
 * hub connecting every earlier AI phase into one seamless workflow —
 * Meeting Transcript -> AI Analysis -> Smart Questions (only if required)
 * -> Blueprint -> Sales Content -> Business Impact -> Proposal Preview ->
 * Builder Population. This page does NOT duplicate any phase's own
 * generation logic — it only sequences and links to the exact same
 * generate/save functions each dedicated page already uses, skipping any
 * step whose record already exists (never a repeated AI call for
 * something already saved), and surfacing a clear, isolated error/retry
 * for whichever single step fails without touching the others.
 */
export function ProposalStudioPage() {
  const { id } = useParams<{ id: string }>()

  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [intelligenceRecord, setIntelligenceRecord] = useState<IntelligenceRecord | null>(null)
  const [blueprint, setBlueprint] = useState<ProposalBlueprint | null>(null)
  const [content, setContent] = useState<ProposalContent | null>(null)
  const [impact, setImpact] = useState<BusinessImpact | null>(null)

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [runningStep, setRunningStep] = useState<string | null>(null)
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!id) return
    let cancelled = false
    load()
    return () => {
      cancelled = true
    }

    function load() {
      Promise.all([getProposal(id!), getIntelligence(id!), getBlueprint(id!), getContent(id!), getBusinessImpact(id!)])
        .then(([p, intel, bp, ct, im]) => {
          if (cancelled) return
          setProposal(p)
          setIntelligenceRecord(intel)
          setBlueprint(bp?.blueprint ?? null)
          setContent(ct?.content ?? null)
          setImpact(im?.impact ?? null)
        })
        .catch((err) => !cancelled && setLoadError(err instanceof Error ? err.message : 'Failed to load proposal'))
        .finally(() => !cancelled && setLoading(false))
    }
  }, [id])

  const analysisDone = Boolean(intelligenceRecord)
  const questionsRequired = intelligenceRecord ? intelligenceRecord.intelligence.missingInformation.length > 0 : false
  const questionsDone = Boolean(intelligenceRecord?.questionsProgress.completedAt)
  const blueprintDone = Boolean(blueprint)
  const contentDone = Boolean(content)
  const impactDone = Boolean(impact)
  const previewReady = analysisDone && blueprintDone && impactDone

  const analysisStatus: StepStatus = analysisDone ? 'done' : 'not_started'
  const questionsStatus: StepStatus = !analysisDone ? 'not_started' : !questionsRequired ? 'not_required' : questionsDone ? 'done' : 'action_needed'
  const blueprintStatus: StepStatus = blueprintDone ? 'done' : 'not_started'
  const contentStatus: StepStatus = contentDone ? 'done' : 'not_started'
  const impactStatus: StepStatus = impactDone ? 'done' : 'not_started'

  async function runBlueprint(): Promise<ProposalBlueprint | null> {
    if (!id || !proposal || !intelligenceRecord) return null
    setRunningStep('blueprint')
    setStepErrors((prev) => ({ ...prev, blueprint: '' }))
    try {
      const result = await generateBlueprint(
        {
          clientName: proposal.clientName,
          clientFirstName: proposal.clientFirstName,
          companyName: proposal.companyName,
          proposalName: proposal.proposalName,
          proposalType: proposal.proposalType,
          preparedBy: proposal.preparedBy,
          providerIdentity: proposal.providerIdentity,
        },
        intelligenceRecord.intelligence
      )
      await saveBlueprint(id, result)
      setBlueprint(result)
      return result
    } catch (err) {
      setStepErrors((prev) => ({ ...prev, blueprint: err instanceof Error ? err.message : 'Failed to generate Blueprint' }))
      return null
    } finally {
      setRunningStep(null)
    }
  }

  async function runContent(blueprintForContent: ProposalBlueprint): Promise<ProposalContent | null> {
    if (!id) return null
    setRunningStep('content')
    setStepErrors((prev) => ({ ...prev, content: '' }))
    try {
      const result = await generateContent(blueprintForContent)
      await saveContent(id, result)
      setContent(result)
      return result
    } catch (err) {
      setStepErrors((prev) => ({ ...prev, content: err instanceof Error ? err.message : 'Failed to generate Sales Content' }))
      return null
    } finally {
      setRunningStep(null)
    }
  }

  async function runImpact(blueprintForImpact: ProposalBlueprint): Promise<BusinessImpact | null> {
    if (!id) return null
    setRunningStep('impact')
    setStepErrors((prev) => ({ ...prev, impact: '' }))
    try {
      const result = await generateImpact(blueprintForImpact)
      await saveBusinessImpact(id, result)
      setImpact(result)
      return result
    } catch (err) {
      setStepErrors((prev) => ({ ...prev, impact: err instanceof Error ? err.message : 'Failed to calculate Business Impact' }))
      return null
    } finally {
      setRunningStep(null)
    }
  }

  /** Runs whichever of Blueprint/Content/Impact aren't done yet, in order — stops immediately on the first failure (leaving already-completed steps untouched) rather than restarting the whole workflow. Each step's own return value (not React state, which hasn't re-rendered yet) is what the next step reads. */
  async function runRemaining() {
    let currentBlueprint = blueprint
    if (!blueprintDone) {
      currentBlueprint = await runBlueprint()
      if (!currentBlueprint) return
    }
    if (!currentBlueprint) return
    if (!contentDone) {
      const result = await runContent(currentBlueprint)
      if (!result) return
    }
    if (!impactDone) {
      await runImpact(currentBlueprint)
    }
  }

  if (!id) return null
  if (loading) return <div className="px-8 py-6 text-sm font-general-sans text-novara-light/50">Loading…</div>
  if (loadError) return <div className="px-8 py-6"><ErrorBanner message={loadError} /></div>
  if (!proposal) return null

  const anyRemaining = !blueprintDone || !contentDone || !impactDone

  return (
    <>
      <Topbar title={proposal.proposalName} subtitle="Proposal Studio" />

      <div className="px-8 py-6 flex flex-col gap-4 max-w-[800px]">
        <div className={analysisCardClass}>
          <p className="font-clash-display text-[16px] text-white">AI Proposal Engine</p>
          <p className="text-sm font-general-sans text-novara-light/60">
            One place to run the complete AI workflow. Each step reuses the exact same generation the dedicated page uses — nothing here is
            regenerated if it's already saved. If a step fails, only that step needs retrying.
          </p>
          {anyRemaining && (
            <button
              onClick={() => void runRemaining()}
              disabled={runningStep !== null || !analysisDone}
              className="self-start flex items-center gap-2 bg-novara-orange hover:bg-novara-orange/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-general-sans font-medium px-4 py-2.5 rounded-lg transition-colors"
            >
              {runningStep ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {runningStep ? 'Running…' : 'Run Remaining Steps'}
            </button>
          )}
        </div>

        {/* Step 1 — Meeting Transcript & Analysis */}
        <div className={analysisCardClass}>
          <div className="flex items-center justify-between">
            <p className="font-clash-display text-[15px] text-white">1. Meeting Transcript &amp; Analysis</p>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-general-sans font-medium border ${statusBadgeClass[analysisStatus]}`}>
              {statusLabel[analysisStatus]}
            </span>
          </div>
          <Link to={`/proposals/${id}/intelligence`} className="self-start flex items-center gap-1.5 text-sm font-general-sans font-medium text-novara-teal hover:text-novara-teal/80 transition-colors">
            {analysisDone ? 'Review' : 'Start'} <ArrowRight size={14} />
          </Link>
        </div>

        {/* Step 2 — Smart Questions */}
        <div className={analysisCardClass}>
          <div className="flex items-center justify-between">
            <p className="font-clash-display text-[15px] text-white">2. Smart Questions</p>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-general-sans font-medium border ${statusBadgeClass[questionsStatus]}`}>
              {statusLabel[questionsStatus]}
            </span>
          </div>
          {questionsStatus === 'not_required' && (
            <p className="text-[12px] font-general-sans text-novara-light/50">The analysis found no missing information — nothing to ask.</p>
          )}
          {(questionsStatus === 'action_needed' || questionsStatus === 'done') && (
            <Link to={`/proposals/${id}/questions`} className="self-start flex items-center gap-1.5 text-sm font-general-sans font-medium text-novara-teal hover:text-novara-teal/80 transition-colors">
              {questionsDone ? 'Review' : 'Answer Questions'} <ArrowRight size={14} />
            </Link>
          )}
        </div>

        {/* Step 3 — Blueprint */}
        <div className={analysisCardClass}>
          <div className="flex items-center justify-between">
            <p className="font-clash-display text-[15px] text-white">3. Proposal Blueprint</p>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-general-sans font-medium border ${statusBadgeClass[blueprintStatus]}`}>
              {statusLabel[blueprintStatus]}
            </span>
          </div>
          {stepErrors.blueprint && <ErrorBanner heading="Could not generate Blueprint" message={stepErrors.blueprint} />}
          <div className="flex items-center gap-3">
            {!blueprintDone && (
              <button
                onClick={() => void runBlueprint()}
                disabled={runningStep !== null || !analysisDone}
                className="flex items-center gap-1.5 text-sm font-general-sans font-medium bg-novara-orange hover:bg-novara-orange/90 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                {runningStep === 'blueprint' ? <Loader2 size={13} className="animate-spin" /> : null}
                {runningStep === 'blueprint' ? 'Generating…' : 'Generate & Save'}
              </button>
            )}
            <Link to={`/proposals/${id}/blueprint`} className="flex items-center gap-1.5 text-sm font-general-sans font-medium text-novara-teal hover:text-novara-teal/80 transition-colors">
              {blueprintDone ? 'Review' : 'Open full page'} <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {/* Step 4 — Sales Content */}
        <div className={analysisCardClass}>
          <div className="flex items-center justify-between">
            <p className="font-clash-display text-[15px] text-white">4. Sales Content Engine</p>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-general-sans font-medium border ${statusBadgeClass[contentStatus]}`}>
              {statusLabel[contentStatus]}
            </span>
          </div>
          {stepErrors.content && <ErrorBanner heading="Could not generate Sales Content" message={stepErrors.content} />}
          <div className="flex items-center gap-3">
            {!contentDone && (
              <button
                onClick={() => blueprint && void runContent(blueprint)}
                disabled={runningStep !== null || !blueprintDone}
                className="flex items-center gap-1.5 text-sm font-general-sans font-medium bg-novara-orange hover:bg-novara-orange/90 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                {runningStep === 'content' ? <Loader2 size={13} className="animate-spin" /> : null}
                {runningStep === 'content' ? 'Generating…' : 'Generate & Save'}
              </button>
            )}
            <Link to={`/proposals/${id}/content`} className="flex items-center gap-1.5 text-sm font-general-sans font-medium text-novara-teal hover:text-novara-teal/80 transition-colors">
              {contentDone ? 'Review' : 'Open full page'} <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {/* Step 5 — Business Impact */}
        <div className={analysisCardClass}>
          <div className="flex items-center justify-between">
            <p className="font-clash-display text-[15px] text-white">5. Business Impact Engine</p>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-general-sans font-medium border ${statusBadgeClass[impactStatus]}`}>
              {statusLabel[impactStatus]}
            </span>
          </div>
          {stepErrors.impact && <ErrorBanner heading="Could not calculate Business Impact" message={stepErrors.impact} />}
          <div className="flex items-center gap-3">
            {!impactDone && (
              <button
                onClick={() => blueprint && void runImpact(blueprint)}
                disabled={runningStep !== null || !blueprintDone}
                className="flex items-center gap-1.5 text-sm font-general-sans font-medium bg-novara-orange hover:bg-novara-orange/90 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                {runningStep === 'impact' ? <Loader2 size={13} className="animate-spin" /> : null}
                {runningStep === 'impact' ? 'Calculating…' : 'Generate & Save'}
              </button>
            )}
            <Link to={`/proposals/${id}/impact`} className="flex items-center gap-1.5 text-sm font-general-sans font-medium text-novara-teal hover:text-novara-teal/80 transition-colors">
              {impactDone ? 'Review' : 'Open full page'} <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {/* Step 6 — Preview */}
        <div className={analysisCardClass}>
          <div className="flex items-center justify-between">
            <p className="font-clash-display text-[15px] text-white">6. Proposal Preview</p>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-general-sans font-medium border ${statusBadgeClass[previewReady ? 'done' : 'not_started']}`}>
              {previewReady ? 'Ready' : 'Waiting on earlier steps'}
            </span>
          </div>
          {previewReady ? (
            <Link to={`/proposals/${id}/preview`} className="self-start flex items-center gap-1.5 text-sm font-general-sans font-medium text-novara-teal hover:text-novara-teal/80 transition-colors">
              Review Proposal Preview <ArrowRight size={14} />
            </Link>
          ) : (
            <p className="text-[12px] font-general-sans text-novara-light/50">Complete Analysis, Blueprint, and Business Impact first.</p>
          )}
        </div>

        {/* Step 7 — Populate */}
        <div className={analysisCardClass}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="font-clash-display text-[15px] text-white">7. Populate Existing Builder</p>
              {blueprintDone && <CheckCircle2 size={14} className="text-novara-teal" />}
            </div>
          </div>
          <Link to={`/proposals/${id}/populate`} className="self-start flex items-center gap-1.5 text-sm font-general-sans font-medium text-novara-teal hover:text-novara-teal/80 transition-colors">
            Go to Builder Population <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </>
  )
}
