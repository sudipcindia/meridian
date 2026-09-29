import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Loader2, Sparkles } from 'lucide-react'
import { Topbar } from '../layout/Topbar.js'
import { ErrorBanner } from '../components/ErrorBanner.js'
import { inputClass } from '../components/FormField.js'
import { analysisCardClass } from '../components/analysis/AnalysisCards.js'
import { generateContent, type ProposalContent } from '../modules/salesContent/index.js'
import { getContent, saveContent } from '../lib/salesContent.js'
import { getBlueprint } from '../lib/blueprints.js'
import { getProposal } from '../lib/proposals.js'
import type { Proposal } from '../types/proposal.js'

function cleanContentLists(content: ProposalContent): ProposalContent {
  return {
    pages: {
      ...content.pages,
      page01: { ...content.pages.page01, tags: content.pages.page01.tags.map((v) => v.trim()).filter(Boolean) },
      page07: { ...content.pages.page07, keywords: content.pages.page07.keywords.map((v) => v.trim()).filter(Boolean) },
      page08: { ...content.pages.page08, packageDescriptions: content.pages.page08.packageDescriptions.map((v) => v.trim()).filter(Boolean) },
      page09: { ...content.pages.page09, deliverables: content.pages.page09.deliverables.map((v) => v.trim()).filter(Boolean) },
    },
  }
}

/**
 * Proposal Intelligence Engine — Phase 05: Sales Content Engine. Turns the
 * saved Proposal Blueprint's structured facts into persuasive, page-mapped
 * proposal copy — never HTML, never a rendered page, never a write to the
 * Builder. Builder Population (the next step) prefers this saved content
 * when present, falling back to the Blueprint's own page content
 * otherwise, so nothing here is required for Population to keep working.
 */
export function ProposalContentPage() {
  const { id } = useParams<{ id: string }>()

  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [hasBlueprint, setHasBlueprint] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [content, setContent] = useState<ProposalContent | null>(null)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    Promise.all([getProposal(id), getBlueprint(id), getContent(id)])
      .then(([p, blueprintRecord, contentRecord]) => {
        if (cancelled) return
        setProposal(p)
        setHasBlueprint(Boolean(blueprintRecord))
        if (contentRecord) setContent(contentRecord.content)
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
      const result = await generateContent(blueprintRecord.blueprint)
      setContent(result)
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Failed to generate content')
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave() {
    if (!id || !content || saving) return
    setSaving(true)
    setSaveError(null)
    try {
      const cleaned = cleanContentLists(content)
      await saveContent(id, cleaned)
      setContent(cleaned)
      setSaved(true)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save content')
    } finally {
      setSaving(false)
    }
  }

  function updatePage01(key: keyof ProposalContent['pages']['page01'], value: string | string[]) {
    setContent((prev) => (prev ? { ...prev, pages: { ...prev.pages, page01: { ...prev.pages.page01, [key]: value } } } : prev))
    setSaved(false)
  }
  function updatePage02(key: keyof ProposalContent['pages']['page02'], value: string) {
    setContent((prev) => (prev ? { ...prev, pages: { ...prev.pages, page02: { ...prev.pages.page02, [key]: value } } } : prev))
    setSaved(false)
  }
  function updatePageContent(key: 'page05' | 'page06', value: string) {
    setContent((prev) => (prev ? { ...prev, pages: { ...prev.pages, [key]: value } } : prev))
    setSaved(false)
  }
  function updateInsightsBusiness(key: keyof ProposalContent['pages']['insightsBusiness'], value: string) {
    setContent((prev) => (prev ? { ...prev, pages: { ...prev.pages, insightsBusiness: { ...prev.pages.insightsBusiness, [key]: value } } } : prev))
    setSaved(false)
  }
  function updateInsightsGrowth(key: keyof ProposalContent['pages']['insightsGrowth'], value: string) {
    setContent((prev) => (prev ? { ...prev, pages: { ...prev.pages, insightsGrowth: { ...prev.pages.insightsGrowth, [key]: value } } } : prev))
    setSaved(false)
  }
  function updatePage07(key: keyof ProposalContent['pages']['page07'], value: string | string[]) {
    setContent((prev) => (prev ? { ...prev, pages: { ...prev.pages, page07: { ...prev.pages.page07, [key]: value } } } : prev))
    setSaved(false)
  }
  function updatePage08(key: keyof ProposalContent['pages']['page08'], value: string | string[]) {
    setContent((prev) => (prev ? { ...prev, pages: { ...prev.pages, page08: { ...prev.pages.page08, [key]: value } } } : prev))
    setSaved(false)
  }
  function updatePage09(key: keyof ProposalContent['pages']['page09'], value: string | string[]) {
    setContent((prev) => (prev ? { ...prev, pages: { ...prev.pages, page09: { ...prev.pages.page09, [key]: value } } } : prev))
    setSaved(false)
  }
  function updatePage11(key: keyof ProposalContent['pages']['page11'], value: string) {
    setContent((prev) => (prev ? { ...prev, pages: { ...prev.pages, page11: { ...prev.pages.page11, [key]: value } } } : prev))
    setSaved(false)
  }

  if (!id) return null
  if (loading) return <div className="px-8 py-6 text-sm font-general-sans text-novara-light/50">Loading…</div>
  if (loadError) return <div className="px-8 py-6"><ErrorBanner message={loadError} /></div>
  if (!proposal) return null

  if (!hasBlueprint && !content) {
    return (
      <>
        <Topbar title={proposal.proposalName} subtitle="Sales Content Engine" />
        <div className="px-8 py-6 max-w-[700px]">
          <div className={analysisCardClass}>
            <p className="font-clash-display text-[16px] text-white">Generate a Proposal Blueprint first</p>
            <p className="text-sm font-general-sans text-novara-light/60">
              The Sales Content Engine turns the saved Proposal Blueprint's facts into persuasive, page-mapped proposal copy. Generate and save a
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
      <Topbar title={proposal.proposalName} subtitle="Sales Content Engine" />

      <div className="px-8 py-6 flex flex-col gap-6 max-w-[900px]">
        <div className={analysisCardClass}>
          <p className="font-clash-display text-[16px] text-white">{content ? 'Regenerate Sales Content' : 'Generate Sales Content'}</p>
          <p className="text-sm font-general-sans text-novara-light/60">
            Writes persuasive, client-specific proposal copy for every editable field, grounded only in the saved Blueprint's facts. Never HTML,
            never a rendered page — Builder Population is a separate, later step.
          </p>
          {generateError && <ErrorBanner heading="Could not generate content" message={generateError} />}
          <button
            onClick={() => void handleGenerate()}
            disabled={generating}
            className="self-start flex items-center gap-2 bg-novara-orange hover:bg-novara-orange/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-general-sans font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {generating ? 'Generating…' : content ? 'Regenerate Content' : 'Generate Content'}
          </button>
        </div>

        {content && (
          <>
            <div className={analysisCardClass}>
              <p className="text-[12px] font-general-sans font-semibold text-novara-light/50 uppercase tracking-wide">Page 01 — Cover</p>
              <input className={inputClass} placeholder="Title" value={content.pages.page01.title} onChange={(e) => updatePage01('title', e.target.value)} />
              <input
                className={inputClass}
                placeholder="Tags (comma separated)"
                value={content.pages.page01.tags.join(', ')}
                onChange={(e) => updatePage01('tags', e.target.value.split(',').map((v) => v.trim()))}
              />
              <textarea rows={2} className={inputClass} placeholder="Introduction" value={content.pages.page01.introduction} onChange={(e) => updatePage01('introduction', e.target.value)} />
            </div>

            <div className={analysisCardClass}>
              <p className="text-[12px] font-general-sans font-semibold text-novara-light/50 uppercase tracking-wide">Page 02 — Business Introduction</p>
              <textarea
                rows={2}
                className={inputClass}
                placeholder="Company Understanding"
                value={content.pages.page02.companyUnderstanding}
                onChange={(e) => updatePage02('companyUnderstanding', e.target.value)}
              />
              <input className={inputClass} placeholder="Welcome Message" value={content.pages.page02.welcomeMessage} onChange={(e) => updatePage02('welcomeMessage', e.target.value)} />
              <textarea rows={2} className={inputClass} placeholder="Intro Paragraph" value={content.pages.page02.introParagraph} onChange={(e) => updatePage02('introParagraph', e.target.value)} />
            </div>

            {(
              [
                ['page05', 'Page 05 — Recommended Strategy'],
                ['page06', 'Page 06 — Delivery Roadmap'],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className={analysisCardClass}>
                <p className="text-[12px] font-general-sans font-semibold text-novara-light/50 uppercase tracking-wide">{label}</p>
                <textarea rows={3} className={inputClass} value={content.pages[key]} onChange={(e) => updatePageContent(key, e.target.value)} />
              </div>
            ))}

            <div className={analysisCardClass}>
              <p className="text-[12px] font-general-sans font-semibold text-novara-light/50 uppercase tracking-wide">Page 07 — Why Novara</p>
              <textarea
                rows={3}
                className={inputClass}
                placeholder="Description"
                value={content.pages.page07.description}
                onChange={(e) => updatePage07('description', e.target.value)}
              />
              <p className="text-[11px] font-general-sans text-novara-light/40">
                Heading, situation, opportunity, keywords, and funnel steps are edited directly on the canvas in the Proposal Editor.
              </p>
            </div>

            <div className={analysisCardClass}>
              <p className="text-[12px] font-general-sans font-semibold text-novara-light/50 uppercase tracking-wide">Page 08 — Investment</p>
              <textarea
                rows={2}
                className={inputClass}
                placeholder="Investment Explanation"
                value={content.pages.page08.investmentExplanation}
                onChange={(e) => updatePage08('investmentExplanation', e.target.value)}
              />
              <textarea
                rows={2}
                className={inputClass}
                placeholder="Package Descriptions (one per line)"
                value={content.pages.page08.packageDescriptions.join('\n')}
                onChange={(e) => updatePage08('packageDescriptions', e.target.value.split('\n'))}
              />
            </div>

            <div className={analysisCardClass}>
              <p className="text-[12px] font-general-sans font-semibold text-novara-light/50 uppercase tracking-wide">Business Insights — Where You Stand Today</p>
              <textarea
                rows={3}
                className={inputClass}
                placeholder="Business Overview"
                value={content.pages.insightsBusiness.businessOverview}
                onChange={(e) => updateInsightsBusiness('businessOverview', e.target.value)}
              />
              <p className="text-[11px] font-general-sans text-novara-light/40">
                Current Position &amp; Digital Maturity scores and the Strengths/Weaknesses/Risks grid are edited directly on the canvas in the Proposal Editor.
              </p>
            </div>

            <div className={analysisCardClass}>
              <p className="text-[12px] font-general-sans font-semibold text-novara-light/50 uppercase tracking-wide">Growth Insights — The Opportunity Ahead</p>
              <textarea
                rows={3}
                className={inputClass}
                placeholder="Market, Industry &amp; Competitive Position"
                value={content.pages.insightsGrowth.marketIndustryPosition}
                onChange={(e) => updateInsightsGrowth('marketIndustryPosition', e.target.value)}
              />
              <textarea
                rows={2}
                className={inputClass}
                placeholder="Future Growth Potential"
                value={content.pages.insightsGrowth.futureGrowthPotential}
                onChange={(e) => updateInsightsGrowth('futureGrowthPotential', e.target.value)}
              />
              <p className="text-[11px] font-general-sans text-novara-light/40">
                Growth &amp; Missed Opportunity cards are edited directly on the canvas in the Proposal Editor.
              </p>
            </div>

            <div className={analysisCardClass}>
              <p className="text-[12px] font-general-sans font-semibold text-novara-light/50 uppercase tracking-wide">Page 09 — Timeline &amp; Deliverables</p>
              <input className={inputClass} placeholder="Timeline" value={content.pages.page09.timeline} onChange={(e) => updatePage09('timeline', e.target.value)} />
              <textarea
                rows={2}
                className={inputClass}
                placeholder="Deliverables (one per line)"
                value={content.pages.page09.deliverables.join('\n')}
                onChange={(e) => updatePage09('deliverables', e.target.value.split('\n'))}
              />
            </div>

            <div className={analysisCardClass}>
              <p className="text-[12px] font-general-sans font-semibold text-novara-light/50 uppercase tracking-wide">Page 11 — Closing</p>
              <textarea rows={2} className={inputClass} placeholder="Closing Message" value={content.pages.page11.closingMessage} onChange={(e) => updatePage11('closingMessage', e.target.value)} />
              <textarea rows={2} className={inputClass} placeholder="Envelope Message" value={content.pages.page11.envelopeMessage} onChange={(e) => updatePage11('envelopeMessage', e.target.value)} />
            </div>

            {saveError && <ErrorBanner heading="Could not save content" message={saveError} />}

            <div className="flex items-center gap-4">
              {saved ? (
                <>
                  <div className="flex items-center gap-2 text-novara-teal text-sm font-general-sans">
                    <CheckCircle2 size={16} /> Content saved.
                  </div>
                  <Link
                    to={`/proposals/${id}/impact`}
                    className="flex items-center gap-1.5 text-sm font-general-sans font-medium text-novara-teal hover:text-novara-teal/80 transition-colors"
                  >
                    Continue to Business Impact Engine <ArrowRight size={14} />
                  </Link>
                </>
              ) : (
                <button
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="self-start flex items-center gap-2 bg-novara-teal hover:bg-novara-teal/90 disabled:opacity-40 disabled:cursor-not-allowed text-novara-dark text-sm font-general-sans font-medium px-4 py-2.5 rounded-lg transition-colors"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                  {saving ? 'Saving…' : 'Save Content'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
