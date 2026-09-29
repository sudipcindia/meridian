import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Search, Sparkles, Loader2, CheckCircle2 } from 'lucide-react'
import { Topbar } from '../layout/Topbar.js'
import { ErrorBanner } from '../components/ErrorBanner.js'
import { inputClass } from '../components/FormField.js'
import { AnalysisCards, analysisCardClass } from '../components/analysis/AnalysisCards.js'
import {
  findMissingInfo,
  generateProposalData,
  getFollowUpFieldLabel,
  cleanListFields,
  PROPOSAL_DATA_FIELDS,
  type FollowUpAnswers,
  type FollowUpQuestion,
  type ProposalData,
} from '../modules/analysis/index.js'
import { getAnalysis, saveFollowUpAnswer, saveProposalData, type AnalysisRecord } from '../lib/analyses.js'
import { createProposalFromProposalData } from '../lib/createProposalFromAnalysis.js'

/** True once at least one field has real content — distinguishes "never generated yet" (show nothing until Generate is clicked) from "generated/saved, possibly with some fields left blank". */
function hasProposalData(data: ProposalData): boolean {
  return Object.values(data).some((v) => (Array.isArray(v) ? v.length > 0 : v.trim() !== ''))
}

/**
 * Phase 02 of the AI Proposal Generator: opens one saved analysis (Phase
 * 01), then lets staff run "Find Missing Information" — Claude compares the
 * saved data against a fixed list of details and returns only the ones
 * genuinely missing, shown here one at a time. Each answer is saved
 * immediately (updates this same row's follow_up_answers) so progress is
 * never lost and a detail already answered is never asked again, even
 * across separate visits to this page.
 */
export function ProposalAnalysisDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [record, setRecord] = useState<AnalysisRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [questions, setQuestions] = useState<FollowUpQuestion[] | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answerDraft, setAnswerDraft] = useState('')

  const [finding, setFinding] = useState(false)
  const [findError, setFindError] = useState<string | null>(null)
  const [savingAnswer, setSavingAnswer] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [proposalDataDraft, setProposalDataDraft] = useState<ProposalData | null>(null)
  const [generatingData, setGeneratingData] = useState(false)
  const [generateDataError, setGenerateDataError] = useState<string | null>(null)
  const [savingData, setSavingData] = useState(false)
  const [saveDataError, setSaveDataError] = useState<string | null>(null)
  const [dataSaved, setDataSaved] = useState(false)

  const [creatingProposal, setCreatingProposal] = useState(false)
  const [createProposalError, setCreateProposalError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    getAnalysis(id)
      .then((r) => {
        if (cancelled) return
        setRecord(r)
        if (hasProposalData(r.proposalData)) setProposalDataDraft(r.proposalData)
      })
      .catch((err) => !cancelled && setLoadError(err instanceof Error ? err.message : 'Failed to load analysis'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [id])

  async function handleFindMissingInfo() {
    if (!record || finding) return
    setFinding(true)
    setFindError(null)
    try {
      const result = await findMissingInfo(record.analysis, record.followUpAnswers)
      setQuestions(result)
      setCurrentIndex(0)
      setAnswerDraft('')
    } catch (err) {
      setFindError(err instanceof Error ? err.message : 'Failed to check for missing information')
    } finally {
      setFinding(false)
    }
  }

  async function handleSaveAnswer() {
    if (!record || !questions || savingAnswer) return
    const current = questions[currentIndex]
    if (!answerDraft.trim()) return
    setSavingAnswer(true)
    setSaveError(null)
    try {
      const updatedAnswers: FollowUpAnswers = await saveFollowUpAnswer(record.id, record.followUpAnswers, current.key, answerDraft.trim())
      setRecord({ ...record, followUpAnswers: updatedAnswers })
      setCurrentIndex((i) => i + 1)
      setAnswerDraft('')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save answer')
    } finally {
      setSavingAnswer(false)
    }
  }

  async function handleGenerateProposalData() {
    if (!record || generatingData) return
    setGeneratingData(true)
    setGenerateDataError(null)
    setDataSaved(false)
    try {
      const result = await generateProposalData(record.transcript, record.analysis, record.followUpAnswers)
      setProposalDataDraft(result)
    } catch (err) {
      setGenerateDataError(err instanceof Error ? err.message : 'Failed to generate proposal data')
    } finally {
      setGeneratingData(false)
    }
  }

  async function handleSaveProposalData() {
    if (!record || !proposalDataDraft || savingData) return
    setSavingData(true)
    setSaveDataError(null)
    try {
      const cleaned = cleanListFields(proposalDataDraft)
      await saveProposalData(record.id, cleaned)
      setProposalDataDraft(cleaned)
      setDataSaved(true)
    } catch (err) {
      setSaveDataError(err instanceof Error ? err.message : 'Failed to save proposal data')
    } finally {
      setSavingData(false)
    }
  }

  async function handleCreateProposal() {
    if (!record || creatingProposal) return
    setCreatingProposal(true)
    setCreateProposalError(null)
    try {
      const proposalId = await createProposalFromProposalData(record.id, record.proposalData)
      navigate(`/proposals/${proposalId}/edit`)
    } catch (err) {
      setCreateProposalError(err instanceof Error ? err.message : 'Failed to create proposal')
      setCreatingProposal(false)
    }
  }

  function updateProposalDataText(key: keyof ProposalData, value: string) {
    setProposalDataDraft((prev) => (prev ? { ...prev, [key]: value } : prev))
    setDataSaved(false)
  }

  function updateProposalDataList(key: keyof ProposalData, rawValue: string) {
    setProposalDataDraft((prev) => (prev ? { ...prev, [key]: rawValue.split('\n') } : prev))
    setDataSaved(false)
  }

  if (loading) return <div className="px-8 py-6 text-sm font-general-sans text-novara-light/50">Loading…</div>
  if (loadError) return <div className="px-8 py-6"><ErrorBanner message={loadError} /></div>
  if (!record) return null

  const wizardActive = questions !== null && questions.length > 0
  const wizardDone = questions !== null && currentIndex >= questions.length
  const currentQuestion = wizardActive && !wizardDone ? questions[currentIndex] : null

  return (
    <>
      <Topbar title={record.clientName || record.companyName || 'Proposal Analysis'} subtitle="Saved analysis — find and fill in any genuinely missing information." />

      <div className="px-8 py-6 flex flex-col gap-6 max-w-[900px]">
        <Link
          to="/ai-analysis"
          className="flex items-center gap-1.5 text-[13px] font-general-sans text-novara-light/50 hover:text-white transition-colors w-fit"
        >
          <ArrowLeft size={14} /> Back to AI Analysis
        </Link>

        <AnalysisCards analysis={record.analysis} />

        <div className={analysisCardClass}>
          <p className="font-clash-display text-[16px] text-white">Missing Information</p>

          {findError && <ErrorBanner heading="Could not check for missing information" message={findError} />}

          {questions === null && (
            <button
              onClick={() => void handleFindMissingInfo()}
              disabled={finding}
              className="self-start flex items-center gap-2 bg-novara-orange hover:bg-novara-orange/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-general-sans font-medium px-4 py-2.5 rounded-lg transition-colors"
            >
              {finding ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              {finding ? 'Checking…' : 'Find Missing Information'}
            </button>
          )}

          {questions !== null && questions.length === 0 && (
            <div className="flex items-center gap-2 text-novara-teal text-sm font-general-sans">
              <CheckCircle2 size={16} /> No missing information — this analysis looks complete.
            </div>
          )}

          {currentQuestion && (
            <div className="flex flex-col gap-3">
              <p className="text-[11px] font-general-sans font-medium text-novara-light/50 uppercase tracking-wide">
                Question {currentIndex + 1} of {questions!.length} · {getFollowUpFieldLabel(currentQuestion.key)}
              </p>
              <p className="text-sm font-general-sans text-white/90">{currentQuestion.question}</p>

              {saveError && <ErrorBanner heading="Could not save answer" message={saveError} />}

              <input
                className={inputClass}
                value={answerDraft}
                onChange={(e) => setAnswerDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleSaveAnswer()
                }}
                placeholder="Type the answer…"
                autoFocus
              />
              <button
                onClick={() => void handleSaveAnswer()}
                disabled={!answerDraft.trim() || savingAnswer}
                className="self-start flex items-center gap-2 bg-novara-teal hover:bg-novara-teal/90 disabled:opacity-40 disabled:cursor-not-allowed text-novara-dark text-sm font-general-sans font-medium px-4 py-2.5 rounded-lg transition-colors"
              >
                {savingAnswer ? <Loader2 size={16} className="animate-spin" /> : null}
                {savingAnswer ? 'Saving…' : currentIndex === questions!.length - 1 ? 'Save & Finish' : 'Save & Next'}
              </button>
            </div>
          )}

          {wizardDone && (
            <div className="flex items-center gap-2 text-novara-teal text-sm font-general-sans">
              <CheckCircle2 size={16} /> All questions answered.
            </div>
          )}
        </div>

        {Object.keys(record.followUpAnswers).length > 0 && (
          <div className={analysisCardClass}>
            <p className="font-clash-display text-[16px] text-white">Follow-Up Answers</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Object.entries(record.followUpAnswers).map(([key, value]) => (
                <div key={key} className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-general-sans font-medium text-novara-light/70">{getFollowUpFieldLabel(key)}</label>
                  <p className="text-sm font-general-sans text-white/90">{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={analysisCardClass}>
          <div className="flex items-center justify-between">
            <p className="font-clash-display text-[16px] text-white">Proposal Data</p>
            <button
              onClick={() => void handleGenerateProposalData()}
              disabled={generatingData}
              className="flex items-center gap-2 bg-novara-orange hover:bg-novara-orange/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-general-sans font-medium px-4 py-2.5 rounded-lg transition-colors"
            >
              {generatingData ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {generatingData ? 'Generating…' : 'Generate Proposal Data'}
            </button>
          </div>

          {generateDataError && <ErrorBanner heading="Could not generate proposal data" message={generateDataError} />}

          {proposalDataDraft && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {PROPOSAL_DATA_FIELDS.map((field) => {
                  const value = proposalDataDraft[field.key]
                  const fullWidth = field.kind !== 'text'
                  return (
                    <div key={field.key} className={`flex flex-col gap-1.5 ${fullWidth ? 'sm:col-span-2' : ''}`}>
                      <label className="text-[12px] font-general-sans font-medium text-novara-light/70">{field.label}</label>
                      {field.kind === 'text' ? (
                        <input className={inputClass} value={value as string} onChange={(e) => updateProposalDataText(field.key, e.target.value)} />
                      ) : field.kind === 'textarea' ? (
                        <textarea rows={3} className={inputClass} value={value as string} onChange={(e) => updateProposalDataText(field.key, e.target.value)} />
                      ) : (
                        <textarea
                          rows={4}
                          className={inputClass}
                          value={(value as string[]).join('\n')}
                          placeholder="One per line"
                          onChange={(e) => updateProposalDataList(field.key, e.target.value)}
                        />
                      )}
                    </div>
                  )
                })}
              </div>

              {saveDataError && <ErrorBanner heading="Could not save proposal data" message={saveDataError} />}

              {dataSaved ? (
                <div className="flex items-center gap-2 text-novara-teal text-sm font-general-sans">
                  <CheckCircle2 size={16} /> Proposal data saved.
                </div>
              ) : (
                <button
                  onClick={() => void handleSaveProposalData()}
                  disabled={savingData}
                  className="self-start flex items-center gap-2 bg-novara-teal hover:bg-novara-teal/90 disabled:opacity-40 disabled:cursor-not-allowed text-novara-dark text-sm font-general-sans font-medium px-4 py-2.5 rounded-lg transition-colors"
                >
                  {savingData ? <Loader2 size={16} className="animate-spin" /> : null}
                  {savingData ? 'Saving…' : 'Save Proposal Data'}
                </button>
              )}
            </>
          )}
        </div>

        {hasProposalData(record.proposalData) && (
          <div className={analysisCardClass}>
            <p className="font-clash-display text-[16px] text-white">Create Proposal in Builder</p>
            <p className="text-[12px] font-general-sans text-novara-light/50">
              Creates a new proposal in the Builder, pre-filling Cover, Page 07, Page 08, Page 10 and Page 11's
              existing editable fields from the saved Proposal Data above. Everything stays fully editable, and
              nothing about the approved template layout changes.
            </p>

            {createProposalError && <ErrorBanner heading="Could not create proposal" message={createProposalError} />}

            <button
              onClick={() => void handleCreateProposal()}
              disabled={creatingProposal}
              className="self-start flex items-center gap-2 bg-novara-orange hover:bg-novara-orange/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-general-sans font-medium px-4 py-2.5 rounded-lg transition-colors"
            >
              {creatingProposal ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              {creatingProposal ? 'Creating…' : 'Create Proposal in Builder'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
