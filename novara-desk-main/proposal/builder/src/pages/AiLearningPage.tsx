import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Loader2, Sparkles } from 'lucide-react'
import { Topbar } from '../layout/Topbar.js'
import { ErrorBanner } from '../components/ErrorBanner.js'
import { inputClass } from '../components/FormField.js'
import { analysisCardClass } from '../components/analysis/AnalysisCards.js'
import {
  INDUSTRY_TAXONOMY,
  SINGLETON_PROMPT_CONFIG_TYPES,
  deriveLearningSignal,
  type LearningSignal,
  type PromptConfigEntry,
  type PromptConfigType,
} from '../modules/learning/index.js'
import { captureLearningSignal, deletePromptConfigEntry, isSignalCaptured, listLearningSignals, listPromptConfig, savePromptConfigEntry } from '../lib/learning.js'
import { listProposals } from '../lib/proposals.js'
import { getIntelligence } from '../lib/intelligence.js'
import { getBlueprint } from '../lib/blueprints.js'
import { getContent } from '../lib/salesContent.js'
import type { Proposal } from '../types/proposal.js'

const SINGLETON_LABELS: Record<string, string> = {
  master: 'Master Prompt',
  style_guide: 'Proposal Style Guide',
  british_english: 'British English Rules',
  sales_psychology: 'Sales Psychology Rules',
}

function findEntry(entries: PromptConfigEntry[], type: PromptConfigType, key = ''): PromptConfigEntry | undefined {
  return entries.find((e) => e.configType === type && e.configKey === key)
}

/**
 * Proposal Intelligence Learning Engine. NOT another proposal generator —
 * this page only (1) lets staff maintain the central prompt configuration
 * (Master Prompt, Industry Prompts, Service Prompts, Style Guide, British
 * English Rules, Sales Psychology Rules) for a FUTURE generation phase to
 * consume, and (2) captures anonymised, structural learning signals from
 * won/approved proposals — never verbatim proposal text, never wired
 * into any existing generation route. Nothing here touches the Builder,
 * the template, Review, Send, Acceptance, eSign, or any existing AI
 * phase's files.
 */
export function AiLearningPage() {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [configEntries, setConfigEntries] = useState<PromptConfigEntry[]>([])
  const [draftSingletons, setDraftSingletons] = useState<Record<string, string>>({})
  const [draftIndustry, setDraftIndustry] = useState<Record<string, string>>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)

  const [newServiceName, setNewServiceName] = useState('')
  const [newServiceGuidance, setNewServiceGuidance] = useState('')

  const [signals, setSignals] = useState<LearningSignal[]>([])
  const [eligibleProposals, setEligibleProposals] = useState<Proposal[]>([])
  const [selectedProposalId, setSelectedProposalId] = useState('')
  const [capturing, setCapturing] = useState(false)
  const [captureError, setCaptureError] = useState<string | null>(null)
  const [captureSuccess, setCaptureSuccess] = useState<string | null>(null)

  useEffect(() => {
    void loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    setLoadError(null)
    try {
      const [entries, capturedSignals, allProposals] = await Promise.all([listPromptConfig(), listLearningSignals(), listProposals()])
      setConfigEntries(entries)
      setDraftSingletons(Object.fromEntries(SINGLETON_PROMPT_CONFIG_TYPES.map((t) => [t, findEntry(entries, t)?.content ?? ''])))
      setDraftIndustry(Object.fromEntries(INDUSTRY_TAXONOMY.map((i) => [i, findEntry(entries, 'industry', i)?.content ?? ''])))
      setSignals(capturedSignals)
      const capturedIds = new Set(capturedSignals.map((s) => s.proposalId))
      setEligibleProposals(allProposals.filter((p) => (p.status === 'approved' || p.status === 'signed') && !capturedIds.has(p.id)))
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load AI Learning data')
    } finally {
      setLoading(false)
    }
  }

  const serviceEntries = useMemo(() => configEntries.filter((e) => e.configType === 'service'), [configEntries])

  async function saveSingleton(type: PromptConfigType) {
    setSavingKey(type)
    setConfigError(null)
    try {
      await savePromptConfigEntry(type, '', draftSingletons[type] ?? '')
      setSavedKey(type)
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSavingKey(null)
    }
  }

  async function saveIndustry(industry: string) {
    const key = `industry:${industry}`
    setSavingKey(key)
    setConfigError(null)
    try {
      await savePromptConfigEntry('industry', industry, draftIndustry[industry] ?? '')
      setSavedKey(key)
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSavingKey(null)
    }
  }

  async function addServicePrompt() {
    if (!newServiceName.trim()) return
    setSavingKey('new-service')
    setConfigError(null)
    try {
      await savePromptConfigEntry('service', newServiceName.trim(), newServiceGuidance)
      setNewServiceName('')
      setNewServiceGuidance('')
      await loadAll()
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : 'Failed to add service prompt')
    } finally {
      setSavingKey(null)
    }
  }

  async function updateServicePrompt(key: string, content: string) {
    setSavingKey(`service:${key}`)
    setConfigError(null)
    try {
      await savePromptConfigEntry('service', key, content)
      setSavedKey(`service:${key}`)
      setConfigEntries((prev) => prev.map((e) => (e.configType === 'service' && e.configKey === key ? { ...e, content } : e)))
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSavingKey(null)
    }
  }

  async function removeServicePrompt(key: string) {
    setSavingKey(`service-delete:${key}`)
    setConfigError(null)
    try {
      await deletePromptConfigEntry('service', key)
      setConfigEntries((prev) => prev.filter((e) => !(e.configType === 'service' && e.configKey === key)))
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : 'Failed to remove service prompt')
    } finally {
      setSavingKey(null)
    }
  }

  async function handleCapture() {
    if (!selectedProposalId || capturing) return
    setCapturing(true)
    setCaptureError(null)
    setCaptureSuccess(null)
    try {
      const proposal = eligibleProposals.find((p) => p.id === selectedProposalId)
      if (!proposal) return
      const [intelligenceRecord, blueprintRecord, contentRecord] = await Promise.all([
        getIntelligence(selectedProposalId),
        getBlueprint(selectedProposalId),
        getContent(selectedProposalId),
      ])
      if (!intelligenceRecord || !blueprintRecord) {
        setCaptureError('This proposal has no saved Proposal Intelligence / Blueprint yet — nothing to learn from.')
        return
      }
      const alreadyCaptured = await isSignalCaptured(selectedProposalId)
      const signal = deriveLearningSignal({
        outcome: proposal.status === 'signed' ? 'signed' : 'approved',
        intelligence: intelligenceRecord.intelligence,
        blueprint: blueprintRecord.blueprint,
        content: contentRecord?.content ?? null,
      })
      await captureLearningSignal(selectedProposalId, signal)
      setCaptureSuccess(alreadyCaptured ? 'Learning signal re-captured.' : 'Learning signal captured.')
      setSelectedProposalId('')
      await loadAll()
    } catch (err) {
      setCaptureError(err instanceof Error ? err.message : 'Failed to capture learning signal')
    } finally {
      setCapturing(false)
    }
  }

  const industryBreakdown = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of signals) counts.set(s.industry, (counts.get(s.industry) ?? 0) + 1)
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
  }, [signals])

  const strategyTagBreakdown = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of signals) for (const tag of s.strategyTags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [signals])

  const avgLength = signals.length ? Math.round(signals.reduce((sum, s) => sum + s.proposalLength, 0) / signals.length) : 0
  const urgencyRate = signals.length ? Math.round((signals.filter((s) => s.ctaHasUrgency).length / signals.length) * 100) : 0

  if (loading) return <div className="px-8 py-6 text-sm font-general-sans text-novara-light/50">Loading…</div>
  if (loadError) return <div className="px-8 py-6"><ErrorBanner message={loadError} /></div>

  return (
    <>
      <Topbar title="AI Learning" subtitle="Proposal Intelligence Learning Engine" />

      <div className="px-8 py-6 flex flex-col gap-6 max-w-[900px]">
        <div className={analysisCardClass}>
          <p className="font-clash-display text-[16px] text-white">About this page</p>
          <p className="text-sm font-general-sans text-novara-light/60">
            This is not another proposal generator. It captures anonymised, structural patterns from won proposals — industry, services,
            strategy category, tone, length, pricing structure — never verbatim proposal text or confidential client detail. Prompt
            configuration below is the central AI configuration for a future generation phase; nothing here changes today's AI output.
          </p>
        </div>

        {configError && <ErrorBanner heading="Could not save configuration" message={configError} />}

        {SINGLETON_PROMPT_CONFIG_TYPES.map((type) => (
          <div key={type} className={analysisCardClass}>
            <p className="font-clash-display text-[16px] text-white">{SINGLETON_LABELS[type]}</p>
            <textarea
              rows={4}
              className={inputClass}
              value={draftSingletons[type] ?? ''}
              onChange={(e) => {
                setDraftSingletons((prev) => ({ ...prev, [type]: e.target.value }))
                setSavedKey(null)
              }}
            />
            <button
              onClick={() => void saveSingleton(type)}
              disabled={savingKey === type}
              className="self-start flex items-center gap-2 bg-novara-teal hover:bg-novara-teal/90 disabled:opacity-40 text-novara-dark text-sm font-general-sans font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {savingKey === type ? <Loader2 size={14} className="animate-spin" /> : savedKey === type ? <CheckCircle2 size={14} /> : null}
              {savingKey === type ? 'Saving…' : savedKey === type ? 'Saved' : 'Save'}
            </button>
          </div>
        ))}

        <div className={analysisCardClass}>
          <p className="font-clash-display text-[16px] text-white">Industry Prompts</p>
          <p className="text-[12px] font-general-sans text-novara-light/50">One guidance block per supported industry — the AI adapts automatically.</p>
          <div className="flex flex-col gap-4">
            {INDUSTRY_TAXONOMY.filter((i) => i !== 'Other').map((industry) => (
              <div key={industry} className="flex flex-col gap-1.5 border-t border-novara-border pt-3 first:border-t-0 first:pt-0">
                <label className="text-[12px] font-general-sans font-medium text-novara-light/70">{industry}</label>
                <textarea
                  rows={2}
                  className={inputClass}
                  value={draftIndustry[industry] ?? ''}
                  onChange={(e) => {
                    setDraftIndustry((prev) => ({ ...prev, [industry]: e.target.value }))
                    setSavedKey(null)
                  }}
                />
                <button
                  onClick={() => void saveIndustry(industry)}
                  disabled={savingKey === `industry:${industry}`}
                  className="self-start text-sm font-general-sans font-medium text-novara-teal hover:text-novara-teal/80 disabled:opacity-40 transition-colors"
                >
                  {savingKey === `industry:${industry}` ? 'Saving…' : savedKey === `industry:${industry}` ? 'Saved' : 'Save'}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className={analysisCardClass}>
          <p className="font-clash-display text-[16px] text-white">Service Prompts</p>
          {serviceEntries.map((entry) => (
            <div key={entry.configKey} className="flex flex-col gap-1.5 border-t border-novara-border pt-3">
              <label className="text-[12px] font-general-sans font-medium text-novara-light/70">{entry.configKey}</label>
              <textarea
                rows={2}
                className={inputClass}
                value={entry.content}
                onChange={(e) => setConfigEntries((prev) => prev.map((x) => (x === entry ? { ...x, content: e.target.value } : x)))}
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={() => void updateServicePrompt(entry.configKey, entry.content)}
                  disabled={savingKey === `service:${entry.configKey}`}
                  className="text-sm font-general-sans font-medium text-novara-teal hover:text-novara-teal/80 disabled:opacity-40 transition-colors"
                >
                  {savingKey === `service:${entry.configKey}` ? 'Saving…' : savedKey === `service:${entry.configKey}` ? 'Saved' : 'Save'}
                </button>
                <button
                  onClick={() => void removeServicePrompt(entry.configKey)}
                  className="text-sm font-general-sans font-medium text-novara-light/50 hover:text-red-400 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          <div className="flex flex-col gap-1.5 border-t border-novara-border pt-3">
            <input className={inputClass} placeholder="New service name" value={newServiceName} onChange={(e) => setNewServiceName(e.target.value)} />
            <textarea rows={2} className={inputClass} placeholder="Guidance" value={newServiceGuidance} onChange={(e) => setNewServiceGuidance(e.target.value)} />
            <button
              onClick={() => void addServicePrompt()}
              disabled={!newServiceName.trim() || savingKey === 'new-service'}
              className="self-start text-sm font-general-sans font-medium bg-novara-teal hover:bg-novara-teal/90 disabled:opacity-40 text-novara-dark px-3 py-1.5 rounded-lg transition-colors"
            >
              Add Service Prompt
            </button>
          </div>
        </div>

        <div className={analysisCardClass}>
          <p className="font-clash-display text-[16px] text-white">Capture Learning Signal</p>
          <p className="text-[12px] font-general-sans text-novara-light/50">
            Manually capture an anonymised pattern from a won/approved proposal. Never automatic — always an explicit action.
          </p>
          {captureError && <ErrorBanner heading="Could not capture learning signal" message={captureError} />}
          {captureSuccess && (
            <div className="flex items-center gap-2 text-novara-teal text-sm font-general-sans">
              <CheckCircle2 size={16} /> {captureSuccess}
            </div>
          )}
          <div className="flex items-center gap-3">
            <select className={inputClass} value={selectedProposalId} onChange={(e) => setSelectedProposalId(e.target.value)}>
              <option value="">Select a won/approved proposal…</option>
              {eligibleProposals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.proposalName} ({p.status})
                </option>
              ))}
            </select>
            <button
              onClick={() => void handleCapture()}
              disabled={!selectedProposalId || capturing}
              className="flex items-center gap-2 bg-novara-orange hover:bg-novara-orange/90 disabled:opacity-40 text-white text-sm font-general-sans font-medium px-4 py-2.5 rounded-lg transition-colors whitespace-nowrap"
            >
              {capturing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {capturing ? 'Capturing…' : 'Capture Learning Signal'}
            </button>
          </div>
          {eligibleProposals.length === 0 && (
            <p className="text-[12px] font-general-sans text-novara-light/40">No un-captured won/approved proposals right now.</p>
          )}
        </div>

        <div className={analysisCardClass}>
          <p className="font-clash-display text-[16px] text-white">Learning Insights</p>
          <p className="text-[12px] font-general-sans text-novara-light/50">Aggregated only — {signals.length} signal(s) captured.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-[10.5px] font-general-sans font-medium text-novara-light/50 uppercase tracking-wide">By Industry</span>
              {industryBreakdown.length === 0 && <span className="text-[12.5px] text-novara-light/40">—</span>}
              {industryBreakdown.map(([industry, count]) => (
                <span key={industry} className="text-[12.5px] font-general-sans text-white/85">
                  {industry}: {count}
                </span>
              ))}
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10.5px] font-general-sans font-medium text-novara-light/50 uppercase tracking-wide">Top Strategy Tags</span>
              {strategyTagBreakdown.length === 0 && <span className="text-[12.5px] text-novara-light/40">—</span>}
              {strategyTagBreakdown.map(([tag, count]) => (
                <span key={tag} className="text-[12.5px] font-general-sans text-white/85">
                  {tag}: {count}
                </span>
              ))}
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10.5px] font-general-sans font-medium text-novara-light/50 uppercase tracking-wide">Avg. Proposal Length</span>
              <span className="text-[12.5px] font-general-sans text-white/85">{avgLength} characters</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10.5px] font-general-sans font-medium text-novara-light/50 uppercase tracking-wide">CTAs With Urgency</span>
              <span className="text-[12.5px] font-general-sans text-white/85">{urgencyRate}%</span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
