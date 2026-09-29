import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Loader2, Sparkles } from 'lucide-react'
import { Topbar } from '../layout/Topbar.js'
import { ErrorBanner } from '../components/ErrorBanner.js'
import { inputClass } from '../components/FormField.js'
import { analysisCardClass } from '../components/analysis/AnalysisCards.js'
import { generateImpact, type BusinessImpact, type ConfidenceLevel, type DataQuality, type ImpactMetric } from '../modules/businessImpact/index.js'
import { getBusinessImpact, saveBusinessImpact } from '../lib/businessImpact.js'
import { getBlueprint } from '../lib/blueprints.js'
import { getProposal } from '../lib/proposals.js'
import type { Proposal } from '../types/proposal.js'

type MetricKey = Exclude<keyof BusinessImpact, 'overallSummary'>

const METRIC_ORDER: MetricKey[] = [
  'leadGrowth',
  'revenueGrowth',
  'lostOpportunities',
  'conversionImprovement',
  'marketingEfficiency',
  'pipelineImprovement',
  'operationalTimeSavings',
  'salesProcessImprovement',
  'customerAcquisitionImprovement',
  'potentialROI',
]

const CONFIDENCE_OPTIONS: ConfidenceLevel[] = ['high', 'medium', 'low']
const DATA_QUALITY_OPTIONS: DataQuality[] = ['known', 'estimated', 'assumed']

const confidenceBadgeClass: Record<ConfidenceLevel, string> = {
  high: 'border-novara-teal/50 text-novara-teal bg-novara-teal/10',
  medium: 'border-amber-400/50 text-amber-400 bg-amber-400/10',
  low: 'border-novara-light/30 text-novara-light/60 bg-white/5',
}

const dataQualityBadgeClass: Record<DataQuality, string> = {
  known: 'border-novara-teal/50 text-novara-teal bg-novara-teal/10',
  estimated: 'border-amber-400/50 text-amber-400 bg-amber-400/10',
  assumed: 'border-novara-light/30 text-novara-light/60 bg-white/5',
}

function cleanImpactAssumptions(impact: BusinessImpact): BusinessImpact {
  const cleaned = { ...impact }
  for (const key of METRIC_ORDER) {
    cleaned[key] = { ...cleaned[key], assumptions: cleaned[key].assumptions.map((v) => v.trim()).filter(Boolean) }
  }
  return cleaned
}

/**
 * Proposal Intelligence Engine — Phase 06: Business Impact Engine.
 * Calculates structured commercial projections from the saved Proposal
 * Blueprint's facts — never fabricated, every figure labelled Known/
 * Estimated/Assumed with a confidence level. This is a standalone,
 * reviewable record: there is no chart/table/progress-indicator
 * rendering capability anywhere in the Proposal Builder today, so
 * nothing here is written into any proposal page — Builder Population's
 * "Not Yet Available" list surfaces this gap explicitly rather than
 * forcing these figures into an unrelated text field.
 */
export function ProposalImpactPage() {
  const { id } = useParams<{ id: string }>()

  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [hasBlueprint, setHasBlueprint] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [impact, setImpact] = useState<BusinessImpact | null>(null)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    Promise.all([getProposal(id), getBlueprint(id), getBusinessImpact(id)])
      .then(([p, blueprintRecord, impactRecord]) => {
        if (cancelled) return
        setProposal(p)
        setHasBlueprint(Boolean(blueprintRecord))
        if (impactRecord) setImpact(impactRecord.impact)
      })
      .catch((err) => !cancelled && setLoadError(err instanceof Error ? err.message : 'Failed to load proposal'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [id])

  async function handleGenerate() {
    if (!id || generating) return
    setGenerating(true)
    setGenerateError(null)
    setSaved(false)
    try {
      const blueprintRecord = await getBlueprint(id)
      if (!blueprintRecord) {
        setHasBlueprint(false)
        return
      }
      const result = await generateImpact(blueprintRecord.blueprint)
      setImpact(result)
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Failed to calculate business impact')
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave() {
    if (!id || !impact || saving) return
    setSaving(true)
    setSaveError(null)
    try {
      const cleaned = cleanImpactAssumptions(impact)
      await saveBusinessImpact(id, cleaned)
      setImpact(cleaned)
      setSaved(true)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save business impact')
    } finally {
      setSaving(false)
    }
  }

  function updateMetric(key: MetricKey, field: keyof ImpactMetric, value: string | string[]) {
    setImpact((prev) => (prev ? { ...prev, [key]: { ...prev[key], [field]: value } } : prev))
    setSaved(false)
  }

  function updateSummary(value: string) {
    setImpact((prev) => (prev ? { ...prev, overallSummary: value } : prev))
    setSaved(false)
  }

  if (!id) return null
  if (loading) return <div className="px-8 py-6 text-sm font-general-sans text-novara-light/50">Loading…</div>
  if (loadError) return <div className="px-8 py-6"><ErrorBanner message={loadError} /></div>
  if (!proposal) return null

  if (!hasBlueprint && !impact) {
    return (
      <>
        <Topbar title={proposal.proposalName} subtitle="Business Impact Engine" />
        <div className="px-8 py-6 max-w-[700px]">
          <div className={analysisCardClass}>
            <p className="font-clash-display text-[16px] text-white">Generate a Proposal Blueprint first</p>
            <p className="text-sm font-general-sans text-novara-light/60">
              The Business Impact Engine calculates commercial projections from the saved Proposal Blueprint's facts. Generate and save a
              Blueprint first.
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

  return (
    <>
      <Topbar title={proposal.proposalName} subtitle="Business Impact Engine" />

      <div className="px-8 py-6 flex flex-col gap-6 max-w-[900px]">
        <div className={analysisCardClass}>
          <p className="font-clash-display text-[16px] text-white">{impact ? 'Recalculate Business Impact' : 'Calculate Business Impact'}</p>
          <p className="text-sm font-general-sans text-novara-light/60">
            Calculates commercial projections grounded only in the saved Blueprint's facts — every figure is labelled Known, Estimated, or
            Assumed with a confidence level, and nothing is ever invented. This is a reviewable record only — there is no chart/table rendering
            capability in the Builder yet, so nothing here is written into any proposal page.
          </p>
          {generateError && <ErrorBanner heading="Could not calculate business impact" message={generateError} />}
          <button
            onClick={() => void handleGenerate()}
            disabled={generating}
            className="self-start flex items-center gap-2 bg-novara-orange hover:bg-novara-orange/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-general-sans font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {generating ? 'Calculating…' : impact ? 'Recalculate' : 'Calculate Impact'}
          </button>
        </div>

        {impact && (
          <>
            {METRIC_ORDER.map((key) => {
              const metric = impact[key]
              return (
                <div key={key} className={analysisCardClass}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <p className="font-clash-display text-[16px] text-white">{metric.label}</p>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-general-sans font-medium border ${confidenceBadgeClass[metric.confidence]}`}>
                        {metric.confidence} confidence
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-general-sans font-medium border ${dataQualityBadgeClass[metric.dataQuality]}`}>
                        {metric.dataQuality}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[12px] font-general-sans font-medium text-novara-light/70">Current</label>
                      <input
                        className={inputClass}
                        placeholder="Not provided"
                        value={metric.currentValue}
                        onChange={(e) => updateMetric(key, 'currentValue', e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[12px] font-general-sans font-medium text-novara-light/70">Projected</label>
                      <input className={inputClass} value={metric.projectedValue} onChange={(e) => updateMetric(key, 'projectedValue', e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <label className="text-[12px] font-general-sans font-medium text-novara-light/70">Estimated Change</label>
                      <input className={inputClass} value={metric.estimatedChange} onChange={(e) => updateMetric(key, 'estimatedChange', e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[12px] font-general-sans font-medium text-novara-light/70">Confidence</label>
                      <select className={inputClass} value={metric.confidence} onChange={(e) => updateMetric(key, 'confidence', e.target.value)}>
                        {CONFIDENCE_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[12px] font-general-sans font-medium text-novara-light/70">Data Quality</label>
                      <select className={inputClass} value={metric.dataQuality} onChange={(e) => updateMetric(key, 'dataQuality', e.target.value)}>
                        {DATA_QUALITY_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <label className="text-[12px] font-general-sans font-medium text-novara-light/70">Assumptions</label>
                      <textarea
                        rows={2}
                        className={inputClass}
                        placeholder="One per line"
                        value={metric.assumptions.join('\n')}
                        onChange={(e) => updateMetric(key, 'assumptions', e.target.value.split('\n'))}
                      />
                    </div>
                  </div>
                </div>
              )
            })}

            <div className={analysisCardClass}>
              <p className="font-clash-display text-[16px] text-white">Overall Summary</p>
              <textarea rows={3} className={inputClass} value={impact.overallSummary} onChange={(e) => updateSummary(e.target.value)} />
            </div>

            {saveError && <ErrorBanner heading="Could not save business impact" message={saveError} />}

            <div className="flex items-center gap-4">
              {saved ? (
                <>
                  <div className="flex items-center gap-2 text-novara-teal text-sm font-general-sans">
                    <CheckCircle2 size={16} /> Business impact saved.
                  </div>
                  <Link
                    to={`/proposals/${id}/preview`}
                    className="flex items-center gap-1.5 text-sm font-general-sans font-medium text-novara-teal hover:text-novara-teal/80 transition-colors"
                  >
                    Continue to Proposal Preview <ArrowRight size={14} />
                  </Link>
                </>
              ) : (
                <button
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="self-start flex items-center gap-2 bg-novara-teal hover:bg-novara-teal/90 disabled:opacity-40 disabled:cursor-not-allowed text-novara-dark text-sm font-general-sans font-medium px-4 py-2.5 rounded-lg transition-colors"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                  {saving ? 'Saving…' : 'Save Business Impact'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
