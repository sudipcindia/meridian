import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Loader2, Sparkles } from 'lucide-react'
import { Topbar } from '../layout/Topbar.js'
import { ErrorBanner } from '../components/ErrorBanner.js'
import { inputClass } from '../components/FormField.js'
import { analysisCardClass } from '../components/analysis/AnalysisCards.js'
import { generateBlueprint, type ProposalBlueprint } from '../modules/blueprint/index.js'
import { getBlueprint, saveBlueprint } from '../lib/blueprints.js'
import { getIntelligence } from '../lib/intelligence.js'
import { getProposal } from '../lib/proposals.js'
import type { Proposal } from '../types/proposal.js'

type ListField = 'painPoints' | 'businessGoals' | 'challenges' | 'opportunities' | 'competitors' | 'recommendedServices' | 'deliverables' | 'kpis' | 'roiOpportunities'

const LIST_FIELDS: { key: ListField; label: string }[] = [
  ['painPoints', 'Pain Points'],
  ['businessGoals', 'Business Goals'],
  ['challenges', 'Challenges'],
  ['opportunities', 'Opportunities'],
  ['competitors', 'Competitors'],
  ['recommendedServices', 'Recommended Services'],
  ['deliverables', 'Deliverables'],
  ['kpis', 'KPIs'],
  ['roiOpportunities', 'ROI Opportunities'],
].map(([key, label]) => ({ key: key as ListField, label }))

function cleanBlueprintLists(blueprint: ProposalBlueprint): ProposalBlueprint {
  const cleaned = { ...blueprint }
  for (const { key } of LIST_FIELDS) {
    cleaned[key] = cleaned[key].map((v) => v.trim()).filter(Boolean)
  }
  cleaned.pages = {
    ...cleaned.pages,
    page01: { ...cleaned.pages.page01, tags: cleaned.pages.page01.tags.map((v) => v.trim()).filter(Boolean) },
    page08: { ...cleaned.pages.page08, packages: cleaned.pages.page08.packages.map((v) => v.trim()).filter(Boolean) },
    page09: { ...cleaned.pages.page09, deliverables: cleaned.pages.page09.deliverables.map((v) => v.trim()).filter(Boolean) },
  }
  return cleaned
}

/**
 * Proposal Intelligence Engine — Phase 03: Proposal Blueprint. Converts
 * verified Proposal Intelligence into the structured, page-mapped
 * "brain" of the proposal — never a rendered page, never HTML, never a
 * write to the Builder. A future Builder-population phase is what will
 * actually consume this; this screen only generates, edits, and saves it.
 */
export function ProposalBlueprintPage() {
  const { id } = useParams<{ id: string }>()

  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [hasIntelligence, setHasIntelligence] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [blueprint, setBlueprint] = useState<ProposalBlueprint | null>(null)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    Promise.all([getProposal(id), getIntelligence(id), getBlueprint(id)])
      .then(([p, intelligenceRecord, blueprintRecord]) => {
        if (cancelled) return
        setProposal(p)
        setHasIntelligence(Boolean(intelligenceRecord))
        if (blueprintRecord) setBlueprint(blueprintRecord.blueprint)
      })
      .catch((err) => !cancelled && setLoadError(err instanceof Error ? err.message : 'Failed to load proposal'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [id])

  async function handleGenerate() {
    if (!id || !proposal || generating) return
    setGenerating(true)
    setGenerateError(null)
    setSaved(false)
    try {
      const intelligenceRecord = await getIntelligence(id)
      if (!intelligenceRecord) {
        setHasIntelligence(false)
        return
      }
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
      setBlueprint(result)
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Failed to generate blueprint')
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave() {
    if (!id || !blueprint || saving) return
    setSaving(true)
    setSaveError(null)
    try {
      const cleaned = cleanBlueprintLists(blueprint)
      await saveBlueprint(id, cleaned)
      setBlueprint(cleaned)
      setSaved(true)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save blueprint')
    } finally {
      setSaving(false)
    }
  }

  function updateField<K extends keyof ProposalBlueprint>(key: K, value: ProposalBlueprint[K]) {
    setBlueprint((prev) => (prev ? { ...prev, [key]: value } : prev))
    setSaved(false)
  }

  function updateClientField(key: keyof ProposalBlueprint['client'], value: string) {
    setBlueprint((prev) => (prev ? { ...prev, client: { ...prev.client, [key]: value } } : prev))
    setSaved(false)
  }

  function updateList(key: ListField, rawValue: string) {
    updateField(key, rawValue.split('\n') as ProposalBlueprint[typeof key])
  }

  function updatePage01(key: keyof ProposalBlueprint['pages']['page01'], value: string | string[]) {
    setBlueprint((prev) => (prev ? { ...prev, pages: { ...prev.pages, page01: { ...prev.pages.page01, [key]: value } } } : prev))
    setSaved(false)
  }

  function updatePageContent(key: 'page02' | 'page03' | 'page04' | 'page05' | 'page06' | 'page07', value: string) {
    setBlueprint((prev) => (prev ? { ...prev, pages: { ...prev.pages, [key]: value } } : prev))
    setSaved(false)
  }

  function updatePage08(key: keyof ProposalBlueprint['pages']['page08'], value: string | string[]) {
    setBlueprint((prev) => (prev ? { ...prev, pages: { ...prev.pages, page08: { ...prev.pages.page08, [key]: value } } } : prev))
    setSaved(false)
  }

  function updatePage09(key: keyof ProposalBlueprint['pages']['page09'], value: string | string[]) {
    setBlueprint((prev) => (prev ? { ...prev, pages: { ...prev.pages, page09: { ...prev.pages.page09, [key]: value } } } : prev))
    setSaved(false)
  }

  function updatePage10(key: keyof ProposalBlueprint['pages']['page10'], value: string) {
    setBlueprint((prev) => (prev ? { ...prev, pages: { ...prev.pages, page10: { ...prev.pages.page10, [key]: value } } } : prev))
    setSaved(false)
  }

  function updatePage11(key: keyof ProposalBlueprint['pages']['page11'], value: string) {
    setBlueprint((prev) => (prev ? { ...prev, pages: { ...prev.pages, page11: { ...prev.pages.page11, [key]: value } } } : prev))
    setSaved(false)
  }

  if (!id) return null
  if (loading) return <div className="px-8 py-6 text-sm font-general-sans text-novara-light/50">Loading…</div>
  if (loadError) return <div className="px-8 py-6"><ErrorBanner message={loadError} /></div>
  if (!proposal) return null

  if (!hasIntelligence && !blueprint) {
    return (
      <>
        <Topbar title={proposal.proposalName} subtitle="Proposal Blueprint" />
        <div className="px-8 py-6 max-w-[700px]">
          <div className={analysisCardClass}>
            <p className="font-clash-display text-[16px] text-white">Complete AI Analysis first</p>
            <p className="text-sm font-general-sans text-novara-light/60">
              The Proposal Blueprint is built from verified Proposal Intelligence. Analyse and save the meeting transcript before generating a blueprint.
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
      <Topbar title={proposal.proposalName} subtitle="Proposal Blueprint" />

      <div className="px-8 py-6 flex flex-col gap-6 max-w-[900px]">
        <div className={analysisCardClass}>
          <p className="font-clash-display text-[16px] text-white">
            {blueprint ? 'Regenerate Proposal Blueprint' : 'Generate Proposal Blueprint'}
          </p>
          <p className="text-sm font-general-sans text-novara-light/60">
            Converts verified Proposal Intelligence into structured, page-mapped content and resolved variables. This never generates HTML or a
            rendered page — it only prepares the Blueprint for a future Builder-population phase.
          </p>
          {generateError && <ErrorBanner heading="Could not generate blueprint" message={generateError} />}
          <button
            onClick={() => void handleGenerate()}
            disabled={generating}
            className="self-start flex items-center gap-2 bg-novara-orange hover:bg-novara-orange/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-general-sans font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {generating ? 'Generating…' : blueprint ? 'Regenerate Blueprint' : 'Generate Blueprint'}
          </button>
        </div>

        {blueprint && (
          <>
            <div className={analysisCardClass}>
              <p className="font-clash-display text-[16px] text-white">Client</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-general-sans font-medium text-novara-light/70">Company</label>
                  <input className={inputClass} value={blueprint.client.company} onChange={(e) => updateClientField('company', e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-general-sans font-medium text-novara-light/70">Industry</label>
                  <input className={inputClass} value={blueprint.client.industry} onChange={(e) => updateClientField('industry', e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label className="text-[12px] font-general-sans font-medium text-novara-light/70">Business Summary</label>
                  <textarea rows={3} className={inputClass} value={blueprint.client.businessSummary} onChange={(e) => updateClientField('businessSummary', e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label className="text-[12px] font-general-sans font-medium text-novara-light/70">Current Situation</label>
                  <textarea rows={3} className={inputClass} value={blueprint.currentSituation} onChange={(e) => updateField('currentSituation', e.target.value)} />
                </div>
              </div>
            </div>

            {LIST_FIELDS.map(({ key, label }) => (
              <div key={key} className={analysisCardClass}>
                <p className="font-clash-display text-[16px] text-white">{label}</p>
                <textarea rows={3} className={inputClass} placeholder="One per line" value={blueprint[key].join('\n')} onChange={(e) => updateList(key, e.target.value)} />
              </div>
            ))}

            <div className={analysisCardClass}>
              <p className="font-clash-display text-[16px] text-white">Recommended Strategy &amp; Investment</p>
              <div className="grid grid-cols-1 gap-4">
                {(
                  [
                    ['recommendedStrategy', 'Recommended Strategy'],
                    ['timeline', 'Timeline'],
                    ['pricingStrategy', 'Pricing Strategy'],
                    ['investmentRecommendation', 'Investment Recommendation'],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="flex flex-col gap-1.5">
                    <label className="text-[12px] font-general-sans font-medium text-novara-light/70">{label}</label>
                    <textarea rows={2} className={inputClass} value={blueprint[key]} onChange={(e) => updateField(key, e.target.value)} />
                  </div>
                ))}
              </div>
            </div>

            <div className={analysisCardClass}>
              <p className="font-clash-display text-[16px] text-white">Closing</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label className="text-[12px] font-general-sans font-medium text-novara-light/70">Closing Message</label>
                  <textarea rows={2} className={inputClass} value={blueprint.closingMessage} onChange={(e) => updateField('closingMessage', e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-general-sans font-medium text-novara-light/70">Call To Action</label>
                  <input className={inputClass} value={blueprint.callToAction} onChange={(e) => updateField('callToAction', e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-general-sans font-medium text-novara-light/70">Proposal Tone</label>
                  <input className={inputClass} value={blueprint.proposalTone} onChange={(e) => updateField('proposalTone', e.target.value)} />
                </div>
              </div>
            </div>

            <div className={analysisCardClass}>
              <p className="font-clash-display text-[16px] text-white">Page Mapping</p>

              <div className="flex flex-col gap-3">
                <p className="text-[12px] font-general-sans font-semibold text-novara-light/50 uppercase tracking-wide">Page 01 — Cover</p>
                <input className={inputClass} placeholder="Heading" value={blueprint.pages.page01.heading} onChange={(e) => updatePage01('heading', e.target.value)} />
                <input className={inputClass} placeholder="Sub Heading" value={blueprint.pages.page01.subHeading} onChange={(e) => updatePage01('subHeading', e.target.value)} />
                <input
                  className={inputClass}
                  placeholder="Tags (comma separated)"
                  value={blueprint.pages.page01.tags.join(', ')}
                  onChange={(e) => updatePage01('tags', e.target.value.split(',').map((v) => v.trim()))}
                />
                <textarea rows={2} className={inputClass} placeholder="Introduction" value={blueprint.pages.page01.introduction} onChange={(e) => updatePage01('introduction', e.target.value)} />
              </div>

              {(
                [
                  ['page02', 'Page 02 — Business Introduction'],
                  ['page03', 'Page 03 — Client Challenges'],
                  ['page04', 'Page 04 — Current Situation'],
                  ['page05', 'Page 05 — Recommended Strategy'],
                  ['page06', 'Page 06 — Implementation Roadmap'],
                  ['page07', 'Page 07 — Why Novara'],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="flex flex-col gap-1.5">
                  <p className="text-[12px] font-general-sans font-semibold text-novara-light/50 uppercase tracking-wide">{label}</p>
                  <textarea rows={3} className={inputClass} value={blueprint.pages[key]} onChange={(e) => updatePageContent(key, e.target.value)} />
                </div>
              ))}

              <div className="flex flex-col gap-3">
                <p className="text-[12px] font-general-sans font-semibold text-novara-light/50 uppercase tracking-wide">Page 08 — Investment</p>
                <textarea
                  rows={2}
                  className={inputClass}
                  placeholder="Packages (one per line)"
                  value={blueprint.pages.page08.packages.join('\n')}
                  onChange={(e) => updatePage08('packages', e.target.value.split('\n'))}
                />
                <textarea rows={2} className={inputClass} placeholder="Pricing Notes" value={blueprint.pages.page08.pricingNotes} onChange={(e) => updatePage08('pricingNotes', e.target.value)} />
              </div>

              <div className="flex flex-col gap-3">
                <p className="text-[12px] font-general-sans font-semibold text-novara-light/50 uppercase tracking-wide">Page 09 — Timeline &amp; Deliverables</p>
                <input className={inputClass} placeholder="Timeline" value={blueprint.pages.page09.timeline} onChange={(e) => updatePage09('timeline', e.target.value)} />
                <textarea
                  rows={2}
                  className={inputClass}
                  placeholder="Deliverables (one per line)"
                  value={blueprint.pages.page09.deliverables.join('\n')}
                  onChange={(e) => updatePage09('deliverables', e.target.value.split('\n'))}
                />
              </div>

              <div className="flex flex-col gap-3">
                <p className="text-[12px] font-general-sans font-semibold text-novara-light/50 uppercase tracking-wide">Page 10 — Agreement Metadata</p>
                <input className={inputClass} placeholder="Company" value={blueprint.pages.page10.company} onChange={(e) => updatePage10('company', e.target.value)} />
                <input className={inputClass} placeholder="Client" value={blueprint.pages.page10.client} onChange={(e) => updatePage10('client', e.target.value)} />
              </div>

              <div className="flex flex-col gap-3">
                <p className="text-[12px] font-general-sans font-semibold text-novara-light/50 uppercase tracking-wide">Page 11 — Acceptance</p>
                <textarea rows={2} className={inputClass} placeholder="Acceptance Message" value={blueprint.pages.page11.acceptanceMessage} onChange={(e) => updatePage11('acceptanceMessage', e.target.value)} />
                <input className={inputClass} placeholder="Closing CTA" value={blueprint.pages.page11.closingCTA} onChange={(e) => updatePage11('closingCTA', e.target.value)} />
                <textarea rows={2} className={inputClass} placeholder="Envelope Message" value={blueprint.pages.page11.envelopeMessage} onChange={(e) => updatePage11('envelopeMessage', e.target.value)} />
              </div>
            </div>

            <div className={analysisCardClass}>
              <p className="font-clash-display text-[16px] text-white">Resolved Variables</p>
              <p className="text-[12px] font-general-sans text-novara-light/50">
                A preview only — these will feed Builder population in a future phase and are not written to Proposal Variables yet.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                {(
                  [
                    ['clientName', 'Client Name'],
                    ['clientFirstName', 'Client First Name'],
                    ['clientLastName', 'Client Last Name'],
                    ['companyName', 'Company Name'],
                    ['proposalName', 'Proposal Name'],
                    ['preparedBy', 'Prepared By'],
                    ['proposalType', 'Proposal Type'],
                    ['industry', 'Industry'],
                    ['location', 'Location'],
                    ['website', 'Website'],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="flex flex-col gap-0.5">
                    <span className="text-[10.5px] font-general-sans font-medium text-novara-light/50 uppercase tracking-wide">{label}</span>
                    <span className="text-[12.5px] font-general-sans text-white/90">{blueprint.variables[key] || '—'}</span>
                  </div>
                ))}
                <div className="flex flex-col gap-0.5 sm:col-span-2">
                  <span className="text-[10.5px] font-general-sans font-medium text-novara-light/50 uppercase tracking-wide">Services</span>
                  <span className="text-[12.5px] font-general-sans text-white/90">{blueprint.variables.services.join(', ') || '—'}</span>
                </div>
              </div>
            </div>

            {saveError && <ErrorBanner heading="Could not save blueprint" message={saveError} />}

            <div className="flex items-center gap-4">
              {saved ? (
                <>
                  <div className="flex items-center gap-2 text-novara-teal text-sm font-general-sans">
                    <CheckCircle2 size={16} /> Blueprint saved.
                  </div>
                  <Link
                    to={`/proposals/${id}/content`}
                    className="flex items-center gap-1.5 text-sm font-general-sans font-medium text-novara-teal hover:text-novara-teal/80 transition-colors"
                  >
                    Continue to Sales Content Engine <ArrowRight size={14} />
                  </Link>
                </>
              ) : (
                <button
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="self-start flex items-center gap-2 bg-novara-teal hover:bg-novara-teal/90 disabled:opacity-40 disabled:cursor-not-allowed text-novara-dark text-sm font-general-sans font-medium px-4 py-2.5 rounded-lg transition-colors"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                  {saving ? 'Saving…' : 'Save Blueprint'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
