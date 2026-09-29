import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, Loader2, Sparkles, XCircle } from 'lucide-react'
import { Topbar } from '../layout/Topbar.js'
import { ErrorBanner } from '../components/ErrorBanner.js'
import { inputClass } from '../components/FormField.js'
import { analysisCardClass } from '../components/analysis/AnalysisCards.js'
import {
  emptyQuestionsProgress,
  generateQuestions,
  getMissingEssentials,
  isArrayTargetField,
  mergeAnswersIntoIntelligence,
  synthesizeEssentialQuestion,
  ESSENTIAL_TARGET_FIELDS,
  CONDITIONAL_ESSENTIAL_TARGET_FIELDS,
  type AnswerValue,
  type GeneratedQuestion,
  type ProposalIntelligence,
  type QuestionsProgress,
} from '../modules/intelligence/index.js'
import { autoGenerateProposal, type PageGenerationStatus } from '../modules/intelligence/autoGenerate.js'
import { AUTO_GENERATE_PAGE_ORDER, AUTO_GENERATE_PAGE_LABELS, type AutoGeneratePageId } from '../modules/blueprintPopulate/index.js'
import { getIntelligence, saveAnsweredIntelligence, saveQuestionsProgress } from '../lib/intelligence.js'
import { getProposal } from '../lib/proposals.js'
import { logActivity } from '../modules/activity/logActivity.js'
import type { Proposal } from '../types/proposal.js'

const INITIAL_PAGE_PROGRESS: Record<AutoGeneratePageId, PageGenerationStatus> = Object.fromEntries(
  AUTO_GENERATE_PAGE_ORDER.map((id) => [id, 'pending'])
) as Record<AutoGeneratePageId, PageGenerationStatus>

// Dynamic (AI-decided) pages have no static label — real display labels
// (base + dynamic) are populated from autoGenerateProposal's own onProgress
// callback as pages are reached, since a dynamic page's title is only known
// once the Content Architect step resolves.
const INITIAL_PAGE_LABELS: Record<AutoGeneratePageId, string> = Object.fromEntries(
  AUTO_GENERATE_PAGE_ORDER.map((id) => [id, AUTO_GENERATE_PAGE_LABELS[id]])
) as Record<AutoGeneratePageId, string>

const CATEGORY_LABELS: Record<GeneratedQuestion['category'], string> = {
  business: 'Business',
  marketing: 'Marketing',
  sales: 'Sales',
  proposal: 'Proposal',
  commercial: 'Commercial',
}

const categoryPillClass =
  'inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-general-sans font-medium border border-novara-border text-novara-light/70'

const SUMMARY_ROWS: { label: string; get: (i: ProposalIntelligence) => string }[] = [
  { label: 'Website', get: (i) => i.client.website },
  { label: 'Company Size', get: (i) => i.client.companySize },
  { label: 'Location', get: (i) => i.client.location },
  { label: 'Existing CRM', get: (i) => i.business.existingCRM },
  { label: 'Existing Ads', get: (i) => i.business.existingAds },
  { label: 'Existing SEO', get: (i) => i.business.existingSEO },
  { label: 'Budget', get: (i) => i.budget },
  { label: 'Timeline', get: (i) => i.timeline },
  { label: 'Decision Makers', get: (i) => i.decisionMakers.join(', ') },
  { label: 'Recommended Services', get: (i) => i.recommendedServices.join(', ') },
  { label: 'Goals', get: (i) => i.goals.join(', ') },
]

/**
 * Proposal Intelligence Engine — Phase 02: Smart Follow-up Questions.
 * Reads the Phase 01 record (fails gracefully back to it if missing),
 * generates the minimum set of questions for whatever is genuinely
 * missing, walks through them one at a time, and only merges answers into
 * the ProposalIntelligence object on explicit completion. Never touches
 * the Builder, the 11-page template, or Proposal Variables — this stays
 * entirely within the same isolated proposal_intelligence record as
 * Phase 01.
 */
export function ProposalQuestionsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isAutoFlow = searchParams.get('flow') === 'meetingTranscript'
  const autoGenerateTriggered = useRef(false)

  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [baseIntelligence, setBaseIntelligence] = useState<ProposalIntelligence | null>(null)
  const [progress, setProgress] = useState<QuestionsProgress>(emptyQuestionsProgress())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [noRecord, setNoRecord] = useState(false)

  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

  const [savingProgress, setSavingProgress] = useState(false)
  const [progressSaved, setProgressSaved] = useState(false)

  const [finishing, setFinishing] = useState(false)
  const [finishError, setFinishError] = useState<string | null>(null)
  const [essentialsWarning, setEssentialsWarning] = useState<string | null>(null)

  const [autoGenerating, setAutoGenerating] = useState(false)
  const [autoGenerateError, setAutoGenerateError] = useState<string | null>(null)
  const [pageProgress, setPageProgress] = useState<Record<AutoGeneratePageId, PageGenerationStatus>>(INITIAL_PAGE_PROGRESS)
  const [pageLabels, setPageLabels] = useState<Record<AutoGeneratePageId, string>>(INITIAL_PAGE_LABELS)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    Promise.all([getProposal(id), getIntelligence(id)])
      .then(([p, record]) => {
        if (cancelled) return
        setProposal(p)
        if (!record) {
          setNoRecord(true)
          return
        }
        setBaseIntelligence(record.intelligence)
        setProgress(record.questionsProgress)
      })
      .catch((err) => !cancelled && setLoadError(err instanceof Error ? err.message : 'Failed to load proposal'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [id])

  const liveIntelligence = useMemo(
    () => (baseIntelligence ? mergeAnswersIntoIntelligence(baseIntelligence, progress) : null),
    [baseIntelligence, progress]
  )

  // Static essentials (name/company/email/commercial.*) plus whichever
  // CONDITIONAL_ESSENTIAL_TARGET_FIELDS currently apply (e.g. industry/
  // business type once it's clear this client has no website) — recomputed
  // as answers come in so the "Required" badge and skip-blocking below stay
  // in sync with getMissingEssentials, which this same set is meant to mirror.
  const essentialFieldSet = useMemo(() => {
    const fields = new Set(ESSENTIAL_TARGET_FIELDS.map((e) => e.field))
    if (liveIntelligence) {
      for (const { field, requiredIf } of CONDITIONAL_ESSENTIAL_TARGET_FIELDS) {
        if (requiredIf(liveIntelligence)) fields.add(field)
      }
    }
    return fields
  }, [liveIntelligence])

  const currentQuestion = progress.questions[progress.currentIndex] ?? null
  const isLastQuestion = progress.currentIndex >= progress.questions.length - 1

  async function handleGenerate() {
    if (!baseIntelligence || !proposal || generating || !id) return
    setGenerating(true)
    setGenerateError(null)
    try {
      let questions = await generateQuestions(baseIntelligence)
      // Guarantee every essential is always askable — never depend on Claude
      // having thought to ask about it — but only in the auto-flow, where
      // completion is actually gated on these three fields.
      if (isAutoFlow) {
        const missing = getMissingEssentials(proposal, baseIntelligence)
        const covered = new Set(questions.map((q) => q.targetField))
        const synthesized = missing.filter(({ field }) => !covered.has(field)).map(({ field, label }) => synthesizeEssentialQuestion(field, label))
        questions = [...synthesized, ...questions]
      }
      setProgress({ questions, answers: {}, skipped: [], currentIndex: 0, completedAt: null })
      setProgressSaved(false)
      void logActivity({
        proposalId: id,
        action: 'questions_generated',
        actor: 'staff',
        detail: questions.length === 0 ? 'No gaps found — nothing to ask' : `${questions.length} question(s) generated`,
      })
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Failed to generate questions')
    } finally {
      setGenerating(false)
    }
  }

  // Meeting Transcript auto-flow: generate questions the instant intelligence
  // is loaded, with no manual "Generate Questions" click. Normal entry
  // (no flag) keeps requiring the existing manual button, unchanged.
  useEffect(() => {
    if (!isAutoFlow || autoGenerateTriggered.current) return
    if (!baseIntelligence || !proposal || progress.questions.length > 0) return
    autoGenerateTriggered.current = true
    void handleGenerate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAutoFlow, baseIntelligence, proposal])

  function setAnswer(value: AnswerValue) {
    if (!currentQuestion) return
    setProgress((prev) => ({
      ...prev,
      answers: { ...prev.answers, [currentQuestion.id]: value },
      skipped: prev.skipped.filter((qid) => qid !== currentQuestion.id),
    }))
    setProgressSaved(false)
  }

  function goBack() {
    setProgress((prev) => ({ ...prev, currentIndex: Math.max(0, prev.currentIndex - 1) }))
    setProgressSaved(false)
  }

  function goNext() {
    setProgress((prev) => ({ ...prev, currentIndex: Math.min(prev.questions.length - 1, prev.currentIndex + 1) }))
    setProgressSaved(false)
  }

  /** Shared by the "Finish & Save" button and by skipping the last question — both mean "merge whatever's answered and save." */
  async function finishWith(finalProgress: QuestionsProgress) {
    if (!id || !proposal || !baseIntelligence || finishing) return
    const completedProgress: QuestionsProgress = { ...finalProgress, completedAt: new Date().toISOString() }
    const merged = mergeAnswersIntoIntelligence(baseIntelligence, completedProgress)

    if (isAutoFlow) {
      const missing = getMissingEssentials(proposal, merged)
      if (missing.length > 0) {
        const targetIndex = finalProgress.questions.findIndex((q) => q.targetField === missing[0].field)
        setEssentialsWarning(`${missing[0].label} is required before this proposal can be generated.`)
        setProgress({ ...finalProgress, currentIndex: targetIndex >= 0 ? targetIndex : finalProgress.currentIndex })
        return
      }
    }

    setEssentialsWarning(null)
    setFinishing(true)
    setFinishError(null)
    try {
      await saveAnsweredIntelligence(id, merged, completedProgress)
      setBaseIntelligence(merged)
      setProgress(completedProgress)
      if (isAutoFlow) await runAutoGenerate(merged)
    } catch (err) {
      setFinishError(err instanceof Error ? err.message : 'Failed to save answers')
    } finally {
      setFinishing(false)
    }
  }

  async function runAutoGenerate(intelligence: ProposalIntelligence) {
    if (!id) return
    setAutoGenerating(true)
    setAutoGenerateError(null)
    try {
      await autoGenerateProposal(id, intelligence, (pageId, status, label) => {
        setPageProgress((prev) => ({ ...prev, [pageId]: status }))
        setPageLabels((prev) => ({ ...prev, [pageId]: label }))
      })
      navigate(`/proposals/${id}/review`)
    } catch (err) {
      setAutoGenerateError(err instanceof Error ? err.message : 'Failed to generate the proposal')
    } finally {
      setAutoGenerating(false)
    }
  }

  function skipQuestion() {
    if (!currentQuestion) return
    if (isAutoFlow && essentialFieldSet.has(currentQuestion.targetField)) return
    const updated: QuestionsProgress = {
      ...progress,
      skipped: progress.skipped.includes(currentQuestion.id) ? progress.skipped : [...progress.skipped, currentQuestion.id],
    }
    setProgressSaved(false)
    if (isLastQuestion) {
      setProgress(updated)
      void finishWith(updated)
      return
    }
    setProgress({ ...updated, currentIndex: Math.min(updated.questions.length - 1, updated.currentIndex + 1) })
  }

  async function handleSaveProgress() {
    if (!id || savingProgress) return
    setSavingProgress(true)
    try {
      await saveQuestionsProgress(id, progress)
      setProgressSaved(true)
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Failed to save progress')
    } finally {
      setSavingProgress(false)
    }
  }

  async function handleFinish() {
    await finishWith(progress)
  }

  function renderAnswerInput() {
    if (!currentQuestion) return null
    const isArray = isArrayTargetField(currentQuestion.targetField)
    const raw = progress.answers[currentQuestion.id]

    if (currentQuestion.answerType === 'yes_no') {
      const value = typeof raw === 'string' ? raw : ''
      return (
        <div className="flex gap-2">
          {['Yes', 'No'].map((opt) => (
            <button
              key={opt}
              onClick={() => setAnswer(opt)}
              className={`px-4 py-2.5 rounded-lg text-sm font-general-sans font-medium border transition-colors ${
                value === opt ? 'bg-novara-teal text-novara-dark border-novara-teal' : 'border-novara-border text-novara-light/70 hover:text-white'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )
    }

    if (currentQuestion.answerType === 'dropdown') {
      const value = typeof raw === 'string' ? raw : ''
      return (
        <select className={inputClass} value={value} onChange={(e) => setAnswer(e.target.value)}>
          <option value="">Select…</option>
          {currentQuestion.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )
    }

    if (currentQuestion.answerType === 'multi_select') {
      const values = Array.isArray(raw) ? raw : []
      return (
        <div className="flex flex-wrap gap-2">
          {currentQuestion.options.map((opt) => {
            const selected = values.includes(opt)
            return (
              <button
                key={opt}
                onClick={() => setAnswer(selected ? values.filter((v) => v !== opt) : [...values, opt])}
                className={`px-3 py-2 rounded-lg text-[13px] font-general-sans font-medium border transition-colors ${
                  selected ? 'bg-novara-teal text-novara-dark border-novara-teal' : 'border-novara-border text-novara-light/70 hover:text-white'
                }`}
              >
                {opt}
              </button>
            )
          })}
        </div>
      )
    }

    if (currentQuestion.answerType === 'paragraph') {
      const value = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw.join('\n') : ''
      return (
        <textarea
          rows={4}
          className={inputClass}
          value={value}
          placeholder={isArray ? 'One per line' : undefined}
          onChange={(e) => setAnswer(e.target.value)}
        />
      )
    }

    const value = typeof raw === 'string' ? raw : ''
    if (currentQuestion.answerType === 'number') {
      return <input type="number" className={inputClass} value={value} onChange={(e) => setAnswer(e.target.value)} />
    }
    if (currentQuestion.answerType === 'currency') {
      return <input type="text" placeholder="e.g. £5,000/month" className={inputClass} value={value} onChange={(e) => setAnswer(e.target.value)} />
    }
    if (currentQuestion.answerType === 'date') {
      return <input type="date" className={inputClass} value={value} onChange={(e) => setAnswer(e.target.value)} />
    }
    return <input type="text" className={inputClass} value={value} onChange={(e) => setAnswer(e.target.value)} />
  }

  if (!id) return null
  if (loading) return <div className="px-8 py-6 text-sm font-general-sans text-novara-light/50">Loading…</div>
  if (loadError) return <div className="px-8 py-6"><ErrorBanner message={loadError} /></div>
  if (!proposal) return null

  if (noRecord) {
    return (
      <>
        <Topbar title={proposal.proposalName} subtitle="Smart Questions" />
        <div className="px-8 py-6 max-w-[700px]">
          <div className={analysisCardClass}>
            <p className="font-clash-display text-[16px] text-white">Complete AI Analysis first</p>
            <p className="text-sm font-general-sans text-novara-light/60">
              Smart Questions builds on the Proposal Intelligence saved in Step 1. Analyse and save the meeting transcript before asking follow-up questions.
            </p>
            <Link
              to={`/proposals/${id}/intelligence`}
              className="self-start flex items-center gap-1.5 text-sm font-general-sans font-medium text-novara-teal hover:text-novara-teal/80 transition-colors"
            >
              Go to Meeting Transcript <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Topbar title={proposal.proposalName} subtitle="Smart Questions" />

      <div className="px-8 py-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
        <div className="flex flex-col gap-6 max-w-[700px]">
          {progress.questions.length === 0 && (
            <div className={analysisCardClass}>
              <p className="font-clash-display text-[16px] text-white">Generate Smart Questions</p>
              <p className="text-sm font-general-sans text-novara-light/60">
                Claude will inspect the saved Proposal Intelligence and ask only about what's genuinely missing — a maximum of 10 quick questions.
              </p>
              {generateError && <ErrorBanner heading="Could not generate questions" message={generateError} />}
              <button
                onClick={() => void handleGenerate()}
                disabled={generating}
                className="self-start flex items-center gap-2 bg-novara-orange hover:bg-novara-orange/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-general-sans font-medium px-4 py-2.5 rounded-lg transition-colors"
              >
                {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {generating ? 'Generating…' : 'Generate Questions'}
              </button>
            </div>
          )}

          {progress.questions.length > 0 && !progress.completedAt && currentQuestion && (
            <div className={analysisCardClass}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={categoryPillClass}>{CATEGORY_LABELS[currentQuestion.category]}</span>
                  {isAutoFlow && essentialFieldSet.has(currentQuestion.targetField) && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-general-sans font-medium border border-novara-orange/40 text-novara-orange">
                      Required
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-general-sans font-medium text-novara-light/50">
                  Question {progress.currentIndex + 1} of {progress.questions.length}
                </span>
              </div>

              <p className="font-clash-display text-[18px] text-white">{currentQuestion.question}</p>

              {renderAnswerInput()}

              {essentialsWarning && <ErrorBanner heading="Required information missing" message={essentialsWarning} />}

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={goBack}
                  disabled={progress.currentIndex === 0}
                  className="flex items-center gap-1.5 text-sm font-general-sans font-medium text-novara-light/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ArrowLeft size={14} /> Back
                </button>
                {!(isAutoFlow && essentialFieldSet.has(currentQuestion.targetField)) && (
                  <button
                    onClick={skipQuestion}
                    className="text-sm font-general-sans font-medium text-novara-light/70 hover:text-white transition-colors"
                  >
                    Skip
                  </button>
                )}
                <div className="flex-1" />
                {isLastQuestion ? (
                  <button
                    onClick={() => void handleFinish()}
                    disabled={finishing}
                    className="flex items-center gap-2 bg-novara-teal hover:bg-novara-teal/90 disabled:opacity-40 disabled:cursor-not-allowed text-novara-dark text-sm font-general-sans font-medium px-4 py-2.5 rounded-lg transition-colors"
                  >
                    {finishing ? <Loader2 size={16} className="animate-spin" /> : null}
                    {finishing ? 'Saving…' : 'Finish & Save'}
                  </button>
                ) : (
                  <button
                    onClick={goNext}
                    className="flex items-center gap-1.5 bg-novara-orange hover:bg-novara-orange/90 text-white text-sm font-general-sans font-medium px-4 py-2.5 rounded-lg transition-colors"
                  >
                    Next <ArrowRight size={14} />
                  </button>
                )}
                <button
                  onClick={() => void handleSaveProgress()}
                  disabled={savingProgress}
                  className="flex items-center gap-1.5 text-sm font-general-sans font-medium text-novara-light/70 hover:text-white disabled:opacity-40 transition-colors"
                >
                  {savingProgress ? <Loader2 size={14} className="animate-spin" /> : null}
                  {progressSaved ? 'Progress saved' : 'Save Progress'}
                </button>
              </div>
              {finishError && <ErrorBanner heading="Could not save answers" message={finishError} />}
            </div>
          )}

          {progress.questions.length > 0 && progress.completedAt && isAutoFlow && (
            <div className={analysisCardClass}>
              <div className="flex items-center gap-2 text-novara-teal text-sm font-general-sans">
                <CheckCircle2 size={16} /> Questions completed — answers merged into Proposal Intelligence.
              </div>

              <div className="flex flex-col gap-2">
                {/* Object.keys preserves insertion order for string keys — base
                    pages are present from mount, dynamic (AI-decided) pages
                    are appended here in their real generation order as
                    autoGenerateProposal's onProgress first reports each one,
                    since the exact count/order is only known once the
                    Content Architect step resolves. */}
                {(Object.keys(pageProgress) as AutoGeneratePageId[]).map((pageId) => {
                  const status = pageProgress[pageId]
                  const label = pageLabels[pageId] ?? 'Additional Insight Page'
                  return (
                    <div key={pageId} className="flex items-center gap-2.5 text-[13px] font-general-sans">
                      {status === 'generating' && <Loader2 size={15} className="animate-spin text-novara-light/70 shrink-0" />}
                      {status === 'done' && <CheckCircle2 size={15} className="text-novara-teal shrink-0" />}
                      {status === 'failed' && <XCircle size={15} className="text-red-400 shrink-0" />}
                      {status === 'pending' && <Circle size={15} className="text-novara-light/30 shrink-0" />}
                      <span
                        className={
                          status === 'done'
                            ? 'text-novara-light/60'
                            : status === 'failed'
                              ? 'text-red-400 font-medium'
                              : status === 'generating'
                                ? 'text-white font-medium'
                                : 'text-novara-light/40'
                        }
                      >
                        {status === 'generating' ? `Generating ${label}…` : label}
                        {status === 'done' && ' — completed'}
                      </span>
                    </div>
                  )
                })}
              </div>

              {autoGenerateError && baseIntelligence ? (
                <>
                  <ErrorBanner
                    heading={(() => {
                      const failedId = (Object.keys(pageProgress) as AutoGeneratePageId[]).find((id) => pageProgress[id] === 'failed')
                      return failedId ? `Failed on ${pageLabels[failedId] ?? 'Additional Insight Page'}` : 'Could not generate the proposal'
                    })()}
                    message={autoGenerateError}
                  />
                  <button
                    onClick={() => void runAutoGenerate(baseIntelligence)}
                    disabled={autoGenerating}
                    className="self-start flex items-center gap-2 bg-novara-orange hover:bg-novara-orange/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-general-sans font-medium px-4 py-2.5 rounded-lg transition-colors"
                  >
                    {autoGenerating ? <Loader2 size={16} className="animate-spin" /> : null}
                    {autoGenerating ? 'Retrying…' : 'Retry'}
                  </button>
                </>
              ) : (
                !(Object.keys(pageProgress) as AutoGeneratePageId[]).every((id) => pageProgress[id] === 'done') && (
                  <div className="flex items-center gap-2 text-sm font-general-sans text-novara-light/70">
                    <Loader2 size={16} className="animate-spin" /> Generating the complete proposal — Cover through Page 11…
                  </div>
                )
              )}
            </div>
          )}

          {progress.questions.length > 0 && progress.completedAt && !isAutoFlow && (
            <div className={analysisCardClass}>
              <div className="flex items-center gap-2 text-novara-teal text-sm font-general-sans">
                <CheckCircle2 size={16} /> Questions completed — answers merged into Proposal Intelligence.
              </div>
              <div className="flex items-center gap-4">
                <Link
                  to={`/proposals/${id}/blueprint`}
                  className="flex items-center gap-1.5 text-sm font-general-sans font-medium text-novara-teal hover:text-novara-teal/80 transition-colors"
                >
                  Continue to Proposal Blueprint <ArrowRight size={14} />
                </Link>
                <Link
                  to={`/proposals/${id}/edit`}
                  className="flex items-center gap-1.5 text-sm font-general-sans font-medium text-novara-light/60 hover:text-white transition-colors"
                >
                  Skip to Proposal Builder <ArrowRight size={14} />
                </Link>
                <button
                  onClick={() => void handleGenerate()}
                  disabled={generating}
                  className="text-sm font-general-sans font-medium text-novara-light/70 hover:text-white disabled:opacity-40 transition-colors"
                >
                  {generating ? 'Checking…' : 'Ask more questions'}
                </button>
              </div>
              {generateError && <ErrorBanner heading="Could not generate questions" message={generateError} />}
            </div>
          )}
        </div>

        {liveIntelligence && (
          <div className={`${analysisCardClass} h-fit sticky top-6`}>
            <p className="font-clash-display text-[15px] text-white">Proposal Intelligence Summary</p>
            <div className="flex flex-col gap-2.5">
              {SUMMARY_ROWS.map((row) => {
                const value = row.get(liveIntelligence)
                return (
                  <div key={row.label} className="flex flex-col gap-0.5">
                    <span className="text-[10.5px] font-general-sans font-medium text-novara-light/50 uppercase tracking-wide">{row.label}</span>
                    <span className="text-[12.5px] font-general-sans text-white/90">{value || '—'}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
