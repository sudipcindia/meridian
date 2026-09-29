import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Sparkles, Loader2, CheckCircle2, Mic, Square, ArrowRight } from 'lucide-react'
import { Topbar } from '../layout/Topbar.js'
import { ErrorBanner } from '../components/ErrorBanner.js'
import { inputClass } from '../components/FormField.js'
import { analysisCardClass } from '../components/analysis/AnalysisCards.js'
import { analyzeMeeting, type ProposalIntelligence } from '../modules/intelligence/index.js'
import { getIntelligence, saveIntelligence } from '../lib/intelligence.js'
import { getProposal } from '../lib/proposals.js'
import { logActivity } from '../modules/activity/logActivity.js'
import type { Proposal } from '../types/proposal.js'

/**
 * Minimal shape of the browser-native Web Speech API — not in TS's default
 * lib.dom, and this repo has no third-party STT dependency to import types
 * from. Mirrors the exact mechanism already used elsewhere in Novara Desk
 * (index.html's Quick Promise voice capture, `startQPVoice`/`stopQPVoice`):
 * `continuous` + `interimResults`, `isFinal` distinguishing interim from
 * final chunks, and an `onend` handler that restarts recognition while
 * still "recording" (Chrome ends a session after a pause in speech).
 */
interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}
interface SpeechRecognitionEventLike {
  resultIndex: number
  results: { length: number; [index: number]: { isFinal: boolean; [index: number]: { transcript: string } } }
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** Trims each list-field item and drops blank ones — applied only at Save time, so free typing (blank lines, in-progress entries) is never fought during editing. */
function cleanLists(data: ProposalIntelligence): ProposalIntelligence {
  return {
    ...data,
    goals: data.goals.map((v) => v.trim()).filter(Boolean),
    painPoints: data.painPoints.map((v) => v.trim()).filter(Boolean),
    challenges: data.challenges.map((v) => v.trim()).filter(Boolean),
    objections: data.objections.map((v) => v.trim()).filter(Boolean),
    competitors: data.competitors.map((v) => v.trim()).filter(Boolean),
    decisionMakers: data.decisionMakers.map((v) => v.trim()).filter(Boolean),
    recommendedServices: data.recommendedServices.map((v) => v.trim()).filter(Boolean),
    opportunities: data.opportunities.map((v) => v.trim()).filter(Boolean),
    missingInformation: data.missingInformation.map((v) => v.trim()).filter(Boolean),
  }
}

/**
 * Proposal Intelligence Engine — Phase 01: "Step 1" a salesperson sees
 * right after creating a proposal (from Ops Intel or directly). Paste or
 * upload a meeting transcript, Analyse Transcript performs ONE complete
 * analysis (no follow-up questions — that's a later phase), review/edit
 * the summary, then explicitly Save. Nothing here populates the Builder
 * or generates proposal content — this is a standalone record linked only
 * by proposal_id (see supabase/migrations/add_proposal_intelligence.sql).
 */
export function ProposalIntelligencePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isAutoFlow = searchParams.get('flow') === 'meetingTranscript'
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const recordingRef = useRef(false)
  const baseTranscriptRef = useRef('')
  const finalChunkRef = useRef('')

  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [transcript, setTranscript] = useState('')
  const [meetingNotes, setMeetingNotes] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [recordingError, setRecordingError] = useState<string | null>(null)

  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [intelligence, setIntelligence] = useState<ProposalIntelligence | null>(null)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    Promise.all([getProposal(id), getIntelligence(id)])
      .then(([p, record]) => {
        if (cancelled) return
        setProposal(p)
        if (record) {
          setTranscript(record.transcript)
          setIntelligence(record.intelligence)
        }
      })
      .catch((err) => !cancelled && setLoadError(err instanceof Error ? err.message : 'Failed to load proposal'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [id])

  function stopRecording() {
    recordingRef.current = false
    setIsRecording(false)
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        /* already stopped */
      }
      recognitionRef.current = null
    }
  }

  function startRecording() {
    const SR = getSpeechRecognitionCtor()
    if (!SR) {
      setRecordingError('Voice input is not supported in this browser — use Chrome or Edge.')
      return
    }
    stopRecording()
    setRecordingError(null)
    baseTranscriptRef.current = transcript
    finalChunkRef.current = ''
    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-GB'
    recognition.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalChunkRef.current += e.results[i][0].transcript + ' '
        else interim += e.results[i][0].transcript
      }
      const spoken = (finalChunkRef.current + interim).trim()
      const base = baseTranscriptRef.current
      setTranscript(spoken ? `${base}${base ? ' ' : ''}${spoken}` : base)
    }
    recognition.onerror = (e) => {
      if (e.error === 'no-speech') return
      setRecordingError(e.error)
    }
    recognition.onend = () => {
      if (recordingRef.current) {
        try {
          recognition.start()
        } catch {
          /* ignore — a stop() already in flight will have cleared recordingRef */
        }
      }
    }
    recordingRef.current = true
    setIsRecording(true)
    try {
      recognition.start()
    } catch {
      recordingRef.current = false
      setIsRecording(false)
      setRecordingError('Could not start the microphone.')
      return
    }
    recognitionRef.current = recognition
  }

  useEffect(() => stopRecording, [])

  async function handleAnalyze() {
    const combined = `${transcript.trim()}${meetingNotes.trim() ? `\n\n--- Meeting Notes ---\n${meetingNotes.trim()}` : ''}`
    if (!transcript.trim() || analyzing || !id) return
    stopRecording()
    setAnalyzing(true)
    setAnalyzeError(null)
    setSaved(false)
    void logActivity({ proposalId: id, action: 'analysis_started', actor: 'staff' })
    try {
      const result = await analyzeMeeting(combined)
      setIntelligence(result)
      void logActivity({
        proposalId: id,
        action: 'analysis_completed',
        actor: 'staff',
        detail: `Confidence: ${result.confidenceScore}%`,
      })
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : 'Failed to analyse transcript')
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleSave() {
    if (!id || !intelligence || saving) return
    setSaving(true)
    setSaveError(null)
    try {
      const cleaned = cleanLists(intelligence)
      await saveIntelligence(id, transcript, cleaned)
      setIntelligence(cleaned)
      setSaved(true)
      if (isAutoFlow) navigate(`/proposals/${id}/questions?flow=meetingTranscript`)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save analysis')
    } finally {
      setSaving(false)
    }
  }

  function updateClient(key: keyof ProposalIntelligence['client'], value: string) {
    setIntelligence((prev) => (prev ? { ...prev, client: { ...prev.client, [key]: value } } : prev))
    setSaved(false)
  }

  function updateBusiness(key: keyof ProposalIntelligence['business'], value: string) {
    setIntelligence((prev) => (prev ? { ...prev, business: { ...prev.business, [key]: value } } : prev))
    setSaved(false)
  }

  function updateList(key: 'goals' | 'painPoints' | 'recommendedServices' | 'missingInformation', rawValue: string) {
    setIntelligence((prev) => (prev ? { ...prev, [key]: rawValue.split('\n') } : prev))
    setSaved(false)
  }

  if (!id) return null
  if (loading) return <div className="px-8 py-6 text-sm font-general-sans text-novara-light/50">Loading…</div>
  if (loadError) return <div className="px-8 py-6"><ErrorBanner message={loadError} /></div>
  if (!proposal) return null

  return (
    <>
      <Topbar title={proposal.proposalName} subtitle="Step 1 — Meeting Transcript" />

      <div className="px-8 py-6 flex flex-col gap-6 max-w-[900px]">
        <Link
          to={`/proposals/${id}/studio`}
          className="self-start flex items-center gap-1.5 text-[12.5px] font-general-sans font-medium text-novara-light/50 hover:text-novara-teal transition-colors"
        >
          Prefer a guided view? Open Proposal Studio <ArrowRight size={12} />
        </Link>
        <div className={analysisCardClass}>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="meeting-transcript" className="text-[12px] font-general-sans font-medium text-novara-light/70">
              Meeting Transcript
            </label>
            <textarea
              id="meeting-transcript"
              rows={14}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Paste Meeting Transcript"
              className={`${inputClass} font-mono text-[12.5px] leading-relaxed`}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {!isRecording ? (
              <button
                onClick={startRecording}
                className="flex items-center gap-1.5 text-[12px] font-general-sans font-medium border border-novara-border text-novara-light/70 hover:text-white px-3 py-2 rounded-lg transition-colors"
              >
                <Mic size={13} /> Start Recording
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="flex items-center gap-1.5 text-[12px] font-general-sans font-medium border border-novara-orange/50 text-novara-orange px-3 py-2 rounded-lg transition-colors animate-pulse"
              >
                <Square size={13} /> Stop Recording
              </button>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="meeting-notes" className="text-[12px] font-general-sans font-medium text-novara-light/70">
              Meeting Notes <span className="text-novara-light/40 font-normal">(optional)</span>
            </label>
            <textarea
              id="meeting-notes"
              rows={4}
              value={meetingNotes}
              onChange={(e) => setMeetingNotes(e.target.value)}
              placeholder="Additional observations, client requirements, promises made, follow-up points…"
              className={`${inputClass} text-[12.5px] leading-relaxed`}
            />
          </div>

          {recordingError && <ErrorBanner heading="Voice input error" message={recordingError} />}
          {analyzeError && <ErrorBanner heading="Could not analyse transcript" message={analyzeError} />}

          <button
            onClick={() => void handleAnalyze()}
            disabled={!transcript.trim() || analyzing}
            className="self-start flex items-center gap-2 bg-novara-orange hover:bg-novara-orange/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-general-sans font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            {analyzing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {analyzing ? 'Analysing…' : 'Analyse'}
          </button>
        </div>

        {intelligence && (
          <>
            <div className={analysisCardClass}>
              <div className="flex items-center justify-between">
                <p className="font-clash-display text-[16px] text-white">Analysis Summary</p>
                <span className="text-[11px] font-general-sans font-medium text-novara-light/50">
                  Confidence: {intelligence.confidenceScore}%
                </span>
              </div>
            </div>

            <div className={analysisCardClass}>
              <p className="font-clash-display text-[16px] text-white">Client</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(
                  [
                    ['firstName', 'First Name'],
                    ['lastName', 'Last Name'],
                    ['fullName', 'Full Name'],
                    ['company', 'Company'],
                    ['website', 'Website'],
                    ['industry', 'Industry'],
                    ['businessType', 'Business Type'],
                    ['companySize', 'Company Size'],
                    ['location', 'Location'],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="flex flex-col gap-1.5">
                    <label className="text-[12px] font-general-sans font-medium text-novara-light/70">{label}</label>
                    <input className={inputClass} value={intelligence.client[key]} onChange={(e) => updateClient(key, e.target.value)} />
                  </div>
                ))}
              </div>
            </div>

            <div className={analysisCardClass}>
              <p className="font-clash-display text-[16px] text-white">Business</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(
                  [
                    ['currentSituation', 'Current Situation'],
                    ['currentMarketing', 'Current Marketing'],
                    ['currentWebsite', 'Current Website'],
                    ['existingCRM', 'Existing CRM'],
                    ['existingAds', 'Existing Ads'],
                    ['existingSEO', 'Existing SEO'],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="flex flex-col gap-1.5 sm:col-span-2">
                    <label className="text-[12px] font-general-sans font-medium text-novara-light/70">{label}</label>
                    <textarea rows={2} className={inputClass} value={intelligence.business[key]} onChange={(e) => updateBusiness(key, e.target.value)} />
                  </div>
                ))}
              </div>
            </div>

            {(
              [
                ['goals', 'Goals'],
                ['painPoints', 'Pain Points'],
                ['recommendedServices', 'Recommended Services'],
                ['missingInformation', 'Missing Information'],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className={analysisCardClass}>
                <p className="font-clash-display text-[16px] text-white">{label}</p>
                <textarea
                  rows={4}
                  className={inputClass}
                  value={intelligence[key].join('\n')}
                  placeholder="One per line"
                  onChange={(e) => updateList(key, e.target.value)}
                />
              </div>
            ))}

            {saveError && <ErrorBanner heading="Could not save analysis" message={saveError} />}

            <div className="flex items-center gap-4">
              {saved ? (
                <>
                  <div className="flex items-center gap-2 text-novara-teal text-sm font-general-sans">
                    <CheckCircle2 size={16} /> Analysis saved.
                  </div>
                  <Link
                    to={`/proposals/${id}/questions`}
                    className="flex items-center gap-1.5 text-sm font-general-sans font-medium text-novara-teal hover:text-novara-teal/80 transition-colors"
                  >
                    Continue to Smart Questions <ArrowRight size={14} />
                  </Link>
                  <Link
                    to={`/proposals/${id}/edit`}
                    className="flex items-center gap-1.5 text-sm font-general-sans font-medium text-novara-light/60 hover:text-white transition-colors"
                  >
                    Skip to Proposal Builder <ArrowRight size={14} />
                  </Link>
                </>
              ) : (
                <button
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="self-start flex items-center gap-2 bg-novara-teal hover:bg-novara-teal/90 disabled:opacity-40 disabled:cursor-not-allowed text-novara-dark text-sm font-general-sans font-medium px-4 py-2.5 rounded-lg transition-colors"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                  {saving ? 'Saving…' : 'Save Analysis'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
