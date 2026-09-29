import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, Loader2, CheckCircle2, ArrowRight } from 'lucide-react'
import { Topbar } from '../layout/Topbar.js'
import { ErrorBanner } from '../components/ErrorBanner.js'
import { inputClass } from '../components/FormField.js'
import { AnalysisCards, analysisCardClass } from '../components/analysis/AnalysisCards.js'
import { analyzeTranscript, cleanListFields, type TranscriptAnalysisFields } from '../modules/analysis/index.js'
import { saveAnalysis, listAnalyses, type AnalysisSummary } from '../lib/analyses.js'

function SavedAnalysesList() {
  const [analyses, setAnalyses] = useState<AnalysisSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listAnalyses()
      .then((rows) => !cancelled && setAnalyses(rows))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Failed to load saved analyses'))
    return () => {
      cancelled = true
    }
  }, [])

  if (error) return <ErrorBanner heading="Could not load saved analyses" message={error} />
  if (!analyses || analyses.length === 0) return null

  return (
    <div className={analysisCardClass}>
      <p className="font-clash-display text-[16px] text-white">Saved Analyses</p>
      <div className="flex flex-col divide-y divide-novara-border">
        {analyses.map((a) => (
          <Link
            key={a.id}
            to={`/ai-analysis/${a.id}`}
            className="flex items-center justify-between py-3 first:pt-0 last:pb-0 group"
          >
            <div>
              <p className="text-sm font-general-sans text-white/90">{a.clientName || a.companyName || 'Untitled analysis'}</p>
              <p className="text-[12px] font-general-sans text-novara-light/50">
                {a.companyName && a.clientName ? `${a.companyName} · ` : ''}
                {new Date(a.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            </div>
            <ArrowRight size={15} className="text-novara-light/40 group-hover:text-novara-teal transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  )
}

export function ProposalAiAnalysis() {
  const [transcript, setTranscript] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<TranscriptAnalysisFields | null>(null)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function handleAnalyze() {
    if (!transcript.trim() || analyzing) return
    setAnalyzing(true)
    setAnalyzeError(null)
    setSaved(false)
    try {
      const result = await analyzeTranscript(transcript)
      setAnalysis(result)
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : 'Failed to analyse transcript')
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleSave() {
    if (!analysis || saving) return
    setSaving(true)
    setSaveError(null)
    try {
      await saveAnalysis({ transcript, analysis: cleanListFields(analysis) })
      setSaved(true)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save analysis')
    } finally {
      setSaving(false)
    }
  }

  function handleStartNew() {
    setTranscript('')
    setAnalysis(null)
    setAnalyzeError(null)
    setSaveError(null)
    setSaved(false)
  }

  function updateTextField(key: keyof TranscriptAnalysisFields, value: string) {
    setAnalysis((prev) => (prev ? { ...prev, [key]: value } : prev))
    setSaved(false)
  }

  function updateListField(key: keyof TranscriptAnalysisFields, rawValue: string) {
    setAnalysis((prev) => (prev ? { ...prev, [key]: rawValue.split('\n') } : prev))
    setSaved(false)
  }

  return (
    <>
      <Topbar title="Proposal AI Analysis" subtitle="Paste a meeting transcript to extract structured business information — nothing is generated, only analysed." />

      <div className="px-8 py-6 flex flex-col gap-6 max-w-[900px]">
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

          {analyzeError && <ErrorBanner heading="Could not analyse transcript" message={analyzeError} />}

          <button
            onClick={() => void handleAnalyze()}
            disabled={!transcript.trim() || analyzing}
            className="self-start flex items-center gap-2 bg-novara-orange hover:bg-novara-orange/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-general-sans font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            {analyzing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {analyzing ? 'Analysing…' : 'Analyse Transcript'}
          </button>
        </div>

        {analysis && (
          <>
            <AnalysisCards analysis={analysis} onChangeText={updateTextField} onChangeList={updateListField} />

            {saveError && <ErrorBanner heading="Could not save analysis" message={saveError} />}

            {saved ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-novara-teal text-sm font-general-sans">
                  <CheckCircle2 size={16} /> Analysis saved.
                </div>
                <button
                  onClick={handleStartNew}
                  className="text-sm font-general-sans font-medium text-novara-light/70 hover:text-white transition-colors"
                >
                  Start New Analysis
                </button>
              </div>
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
          </>
        )}

        <SavedAnalysesList />
      </div>
    </>
  )
}
