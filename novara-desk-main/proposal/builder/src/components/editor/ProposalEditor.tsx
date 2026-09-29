import { useMemo, useState } from 'react'
import { Undo2, Redo2, ArrowUp, ArrowDown, Copy, Trash2, Plus } from 'lucide-react'
import { useProposalEditor } from '../../hooks/useProposalEditor.js'
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard.js'
import {
  getContentBlocksForPage,
  getCoverFieldEntries,
  getPage02FieldEntries,
  getInsightsBusinessFieldEntries,
  getInsightsGrowthFieldEntries,
  getPage07FieldEntries,
  getPage08FieldEntries,
  parseCurrentPositionOverride,
  parseSwotOverride,
  parseGrowthOpportunitiesOverride,
  DEFAULT_PAGE08_CARDS,
  makeBlankPricingCard,
  normalizePricingCards,
  parsePriceString,
  composePriceString,
  CURRENCY_PRESETS,
  BILLING_TYPE_PRESETS,
  parseCollection,
  serializeCollection,
  makeCollectionId,
  addCollectionItem,
  removeCollectionItem,
  duplicateCollectionItem,
  reorderCollectionItem,
  parseEnrichmentOverride,
  parsePage07Keywords,
  deriveInvestmentSplit,
  parseDynamicInsightPageOverride,
  type PricingCardRecord,
  getPage10FieldEntries,
  getPage11FieldEntries,
  resolveContentBlockText,
} from '../../modules/variables/index.js'
import { updateProposal } from '../../lib/proposals.js'
import type { AIContext } from '../../modules/ai/index.js'
import { PageNavigator } from './PageNavigator.js'
import { LiveTemplatePreview } from './LiveTemplatePreview.js'
import { PageFrameErrorBoundary } from './PageFrameErrorBoundary.js'
import { resolvePageProps, resolveDynamicInsightPages } from '../../masterTemplate/resolvePageProps.js'
import { InlineEditPopover } from './InlineEditPopover.js'
import { AIAssistPanel } from './AIAssistPanel.js'
import { CollectionPanel } from './CollectionPanel.js'
import { ErrorBanner } from '../ErrorBanner.js'
import { inputClass } from '../FormField.js'
import { logActivity } from '../../modules/activity/logActivity.js'
import { computePageNumbers, type TemplatePageId } from '../../masterTemplate/index.js'
import type { Proposal } from '../../types/proposal.js'

interface ProposalEditorProps {
  proposalId: string
  pages: TemplatePageId[]
  proposal: Proposal
  /** Signed proposals cannot be modified — disables click-to-edit, autosave, and the undo/redo/save controls. */
  readOnly?: boolean
  /** Proposal Name lives on proposal metadata, not on the Cover artwork — this reports the save back up so the Topbar title stays in sync. */
  onProposalUpdate?: (proposal: Proposal) => void
}

const SAVE_STATUS_LABEL: Record<string, string> = {
  idle: '',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Save failed',
}

/** Matches the dynamically-generated per-keyword content-block keys (page07.keyword0, page07.keyword1, …). */
const PAGE07_KEYWORD_KEY_RE = /^page07\.keyword(\d+)$/

/** Matches a pricing card's simple text fields, e.g. "page08.card:abc123:title". */
const PAGE08_CARD_FIELD_RE = /^page08\.card:([^:]+):(title|price|priceSuffix|whyRecommended|expectedOutcome|roiNote|footerNote)$/
/** Matches one feature within a pricing card, e.g. "page08.card:abc123:feature:2". */
const PAGE08_CARD_FEATURE_RE = /^page08\.card:([^:]+):feature:(\d+)$/

export function ProposalEditor({ proposalId, pages, proposal, readOnly = false, onProposalUpdate }: ProposalEditorProps) {
  const editor = useProposalEditor(proposalId, readOnly)
  const [currentPageId, setCurrentPageId] = useState<TemplatePageId>(pages[0])
  const [popover, setPopover] = useState<{ blockKey: string; anchorRect: DOMRect } | null>(null)
  const [showAIPanel, setShowAIPanel] = useState(false)
  const [proposalName, setProposalName] = useState(proposal.proposalName)
  const [savingProposalName, setSavingProposalName] = useState(false)
  const [savingClientFirstName, setSavingClientFirstName] = useState(false)

  useUnsavedChangesGuard(editor.isDirty)

  const aiContext: AIContext = {
    clientName: editor.state.variables.clientName,
    clientFirstName: editor.state.variables.clientFirstName,
    companyName: editor.state.variables.companyName,
    websiteLink: editor.state.variables.websiteLink,
    industry: editor.state.variables.industry,
    businessType: editor.state.variables.businessType,
    services: editor.state.variables.services,
    budget: editor.state.variables.budget,
    goals: editor.state.variables.goals,
    targetAudience: editor.state.variables.targetAudience,
  }

  // Page 07's keywords: the one variable-length repeatable collection in scope, stored as a
  // single JSON-stringified contentOverride (still the existing generic map — no new storage).
  const page07Keywords = useMemo(
    () => parsePage07Keywords(editor.state.contentOverrides['page07.keywords']),
    [editor.state.contentOverrides]
  )

  // Page 08's pricing packages — a repeatable collection of structured records (not flat
  // strings like Page 07's keywords), each with its own nested repeatable feature list. Uses
  // the generic modules/variables/collections.ts helpers this architecture establishes for
  // Pages 09-11: still one JSON-stringified array in the existing contentOverrides map.
  const page08Cards = useMemo(
    () => normalizePricingCards(parseCollection<Partial<PricingCardRecord>>(editor.state.contentOverrides['page08.cards'], DEFAULT_PAGE08_CARDS)),
    [editor.state.contentOverrides]
  )

  // Page 07's AI-selected visual block — a structured object, not a flat
  // string, so (like page08Cards above) it must be read here and passed as a
  // real prop rather than relying on resolvedBlocks' text-only patching.
  const page07Enrichment = useMemo(
    () => parseEnrichmentOverride(editor.state.contentOverrides['page07.enrichment']),
    [editor.state.contentOverrides]
  )

  // Same reasoning as page08Cards above — always computed live from the
  // same real cards, never stored/AI-generated.
  const page07InvestmentSplit = useMemo(() => deriveInvestmentSplit(page08Cards), [page08Cards])

  // Business Intelligence structured fields (insightsBusiness/insightsGrowth
  // — premium pages inserted after Page 07, never the frozen Page 03/04) —
  // same reasoning as page08Cards/page07Enrichment above: structured data,
  // not flat strings, so must be read here and passed as real props.
  const insightsBusinessCurrentPosition = useMemo(
    () => parseCurrentPositionOverride(editor.state.contentOverrides['insightsBusiness.currentPosition']),
    [editor.state.contentOverrides]
  )
  const insightsBusinessSwot = useMemo(
    () => parseSwotOverride(editor.state.contentOverrides['insightsBusiness.swot']),
    [editor.state.contentOverrides]
  )
  const insightsGrowthOpportunities = useMemo(
    () => parseGrowthOpportunitiesOverride(editor.state.contentOverrides['insightsGrowth.growthOpportunities']),
    [editor.state.contentOverrides]
  )

  // Whichever of the 8 reserved dynamicInsight0N slots are actually present
  // in this document's own page order — see masterTemplate/index.ts.
  const dynamicInsightPages = useMemo(
    () => resolveDynamicInsightPages(pages, editor.state.contentOverrides, parseDynamicInsightPageOverride),
    [pages, editor.state.contentOverrides]
  )

  // PageNavigator's nav-rail label for whichever dynamicInsight0N pages are
  // present — their real AI-chosen title, not a generic "Page 12".
  const pageTitleOverrides = useMemo(
    () => Object.fromEntries(Object.entries(dynamicInsightPages).map(([id, page]) => [id, page.title])),
    [dynamicInsightPages]
  )

  // Never hardcoded — computed from this document's actual page order, so
  // inserting/removing a page anywhere renumbers everything after it.
  const pageNumbers = useMemo(() => computePageNumbers(pages), [pages])

  const entries = useMemo(() => {
    const generated = getContentBlocksForPage(currentPageId)
    // Prop-backed fields (title/heading/paragraph/tags/etc.) aren't literal JSX text, so
    // scanVariables.mjs can't see them — these hand-authored manifests fill the gap per page,
    // shaped identically so they flow through the same resolve/override/popover pipeline.
    if (currentPageId === 'cover') {
      return [...generated, ...getCoverFieldEntries({ clientName: proposal.clientName, preparedBy: proposal.preparedBy })]
    }
    if (currentPageId === 'page02') {
      return [...generated, ...getPage02FieldEntries()]
    }
    if (currentPageId === 'insightsBusiness') {
      return [...generated, ...getInsightsBusinessFieldEntries()]
    }
    if (currentPageId === 'insightsGrowth') {
      return [...generated, ...getInsightsGrowthFieldEntries()]
    }
    if (currentPageId === 'page07') {
      // Keyword entries are generated per current array length/content, not from a static
      // manifest — originalText IS the live value, so no separate per-keyword override key is
      // ever written (see writeEditableValue below); editing one just rewrites the whole array.
      const keywordEntries = page07Keywords.map((kw, i) => ({
        key: `page07.keyword${i}`,
        page: 'page07',
        originalText: kw,
        label: `Keyword ${i + 1}`,
        variants: ['both'],
      }))
      return [...generated, ...getPage07FieldEntries(), ...keywordEntries]
    }
    if (currentPageId === 'page08') {
      // Same principle as Page 07's keywords, generalized per card: each entry's originalText
      // IS the live value out of page08Cards, so editing one always rewrites the whole
      // 'page08.cards' array (see writeEditableValue) rather than spawning drifting override keys.
      const cardEntries = page08Cards.flatMap((card) => [
        { key: `page08.card:${card.id}:title`, page: 'page08', originalText: card.title, label: `${card.title} — Package Name`, variants: ['both'] },
        { key: `page08.card:${card.id}:price`, page: 'page08', originalText: card.price, label: `${card.title} — Price`, variants: ['both'] },
        { key: `page08.card:${card.id}:priceSuffix`, page: 'page08', originalText: card.priceSuffix, label: `${card.title} — Billing`, variants: ['both'] },
        { key: `page08.card:${card.id}:whyRecommended`, page: 'page08', originalText: card.whyRecommended, label: `${card.title} — Why Recommended`, variants: ['both'] },
        { key: `page08.card:${card.id}:expectedOutcome`, page: 'page08', originalText: card.expectedOutcome, label: `${card.title} — Expected Outcome`, variants: ['both'] },
        { key: `page08.card:${card.id}:roiNote`, page: 'page08', originalText: card.roiNote, label: `${card.title} — Estimated Value`, variants: ['both'] },
        { key: `page08.card:${card.id}:footerNote`, page: 'page08', originalText: card.footerNote, label: `${card.title} — Footer Note`, variants: ['both'] },
        ...card.features.map((f, i) => ({
          key: `page08.card:${card.id}:feature:${i}`,
          page: 'page08',
          originalText: f,
          label: `${card.title} — Feature ${i + 1}`,
          variants: ['both'],
        })),
      ])
      return [...generated, ...getPage08FieldEntries(), ...cardEntries]
    }
    if (currentPageId === 'page10') {
      // Page 10 is a legal Service Agreement — 99% static, and the legal wording (plus the
      // left-side "Novara Consult"/"Jayson Kandiah" signature) must never be editable.
      // Deliberately does NOT spread `generated` here (unlike every other page): those 23
      // blocks are already scanner-detected today, so simply excluding them from entries means
      // resolvedBlocks never includes them, and patchPreviewDom never tags or makes them
      // clickable. Only the two signature values below remain in scope.
      return getPage10FieldEntries({ companyName: proposal.companyName, clientName: proposal.clientName })
    }
    if (currentPageId === 'page11') {
      // Unlike Page 10, `generated` stays included — the "Accept the Proposal" button text and
      // "Built by Novara, specifically for [Company Name]." tagline are already scanner-detected
      // blocks and keep working exactly as they do today. Only the envelope message is new.
      return [...generated, ...getPage11FieldEntries()]
    }
    return generated
  }, [currentPageId, proposal.clientName, proposal.preparedBy, proposal.companyName, page07Keywords, page08Cards])

  // Only the raw scanner output ever needs untagged-text-matching (see domPatch.ts's
  // `matchByText` doc) — every hand-authored/dynamic field already carries an explicit
  // data-editor-key in the template JSX, so it's always found by the already-tagged pass alone.
  const generatedKeys = useMemo(() => new Set(getContentBlocksForPage(currentPageId).map((e) => e.key)), [currentPageId])

  const resolvedBlocks = useMemo(
    () =>
      entries.map((entry) => ({
        key: entry.key,
        originalText: entry.originalText,
        resolvedText: resolveContentBlockText(entry, editor.state.contentOverrides, editor.state.variables),
        matchByText: generatedKeys.has(entry.key),
      })),
    [entries, generatedKeys, editor.state.contentOverrides, editor.state.variables]
  )

  const activeEntry = popover ? entries.find((e) => e.key === popover.blockKey) : undefined

  // Single write path for every editable text node: a keyword/card/feature key rewrites its
  // slot in the relevant array and resaves the whole array under its one collection key;
  // everything else is a plain contentOverride exactly as before. Keeps each collection as the
  // one source of truth instead of also spawning per-index override keys that would drift from it.
  function writeEditableValue(blockKey: string, value: string) {
    const keywordMatch = PAGE07_KEYWORD_KEY_RE.exec(blockKey)
    if (keywordMatch) {
      const idx = Number(keywordMatch[1])
      const next = [...page07Keywords]
      next[idx] = value
      editor.setContentOverride('page07.keywords', JSON.stringify(next))
      return
    }
    const cardFieldMatch = PAGE08_CARD_FIELD_RE.exec(blockKey)
    if (cardFieldMatch) {
      const [, cardId, field] = cardFieldMatch
      const next = page08Cards.map((c) => (c.id === cardId ? { ...c, [field]: value } : c))
      editor.setContentOverride('page08.cards', serializeCollection(next))
      return
    }
    const featureMatch = PAGE08_CARD_FEATURE_RE.exec(blockKey)
    if (featureMatch) {
      const [, cardId, featureIdxStr] = featureMatch
      const featureIdx = Number(featureIdxStr)
      const next = page08Cards.map((c) => {
        if (c.id !== cardId) return c
        const features = [...c.features]
        features[featureIdx] = value
        return { ...c, features }
      })
      editor.setContentOverride('page08.cards', serializeCollection(next))
      return
    }
    editor.setContentOverride(blockKey, value)
  }

  function handleEditableClick(blockKey: string, anchorRect: DOMRect) {
    if (readOnly) return
    editor.beginEditSession()
    setPopover({ blockKey, anchorRect })
  }

  function handlePopoverClose() {
    editor.commitEditSession()
    // Page 10's signature values are the one place a click-to-edit field also syncs back to
    // proposal metadata (bi-directional, like Page 02's Client First Name) — committed here,
    // on close, rather than on every keystroke.
    if (popover?.blockKey === 'page10.companyName' || popover?.blockKey === 'page10.clientName') {
      void syncPage10SignatureField(popover.blockKey)
    }
    setPopover(null)
    setShowAIPanel(false)
  }

  async function syncPage10SignatureField(blockKey: 'page10.companyName' | 'page10.clientName') {
    const value = (editor.state.contentOverrides[blockKey] ?? '').trim()
    const field = blockKey === 'page10.companyName' ? 'companyName' : 'clientName'
    const currentMetadata = field === 'companyName' ? proposal.companyName : proposal.clientName
    if (readOnly || !value || value === currentMetadata) return
    const updated = await updateProposal(proposalId, { [field]: value })
    onProposalUpdate?.(updated)
  }

  function handleApplyAISuggestion(text: string, mode: 'replace' | 'append') {
    if (!popover) return
    const current = editor.state.contentOverrides[popover.blockKey] ?? activeEntry?.originalText ?? ''
    writeEditableValue(popover.blockKey, mode === 'replace' ? text : `${current}\n\n${text}`)
    void logActivity({
      proposalId,
      action: 'ai_content_generated',
      actor: 'staff',
      detail: `${mode === 'replace' ? 'Replaced' : 'Appended to'} "${activeEntry?.label ?? popover.blockKey}"`,
    })
  }

  // Keyword collection management (add/remove/reorder/duplicate) — all just rewrite the same
  // JSON array under the same single contentOverride key, so undo/redo/autosave/reload already
  // work with zero extra plumbing.
  function addKeyword() {
    if (readOnly) return
    editor.setContentOverride('page07.keywords', JSON.stringify([...page07Keywords, 'New keyword']))
  }
  function removeKeyword(i: number) {
    if (readOnly) return
    setPopover(null) // indices shift below i — avoid a stale popover pointing at the wrong slot
    editor.setContentOverride('page07.keywords', JSON.stringify(page07Keywords.filter((_, idx) => idx !== i)))
  }
  function duplicateKeyword(i: number) {
    if (readOnly) return
    setPopover(null)
    const next = [...page07Keywords]
    next.splice(i + 1, 0, next[i])
    editor.setContentOverride('page07.keywords', JSON.stringify(next))
  }
  function moveKeyword(i: number, direction: -1 | 1) {
    if (readOnly) return
    const target = i + direction
    if (target < 0 || target >= page07Keywords.length) return
    setPopover(null)
    const next = [...page07Keywords]
    ;[next[i], next[target]] = [next[target], next[i]]
    editor.setContentOverride('page07.keywords', JSON.stringify(next))
  }

  // Pricing package (card) collection management — mirrors the keyword functions above, generalized
  // via modules/variables/collections.ts since cards are structured records, not plain strings.
  function addPricingCard() {
    if (readOnly) return
    editor.setContentOverride('page08.cards', serializeCollection(addCollectionItem(page08Cards, makeBlankPricingCard())))
  }
  function removePricingCard(i: number) {
    if (readOnly) return
    setPopover(null)
    editor.setContentOverride('page08.cards', serializeCollection(removeCollectionItem(page08Cards, i)))
  }
  function duplicatePricingCard(i: number) {
    if (readOnly) return
    setPopover(null)
    const next = duplicateCollectionItem(page08Cards, i, (card) => ({ ...card, id: makeCollectionId(), title: `${card.title} (Copy)` }))
    editor.setContentOverride('page08.cards', serializeCollection(next))
  }
  function reorderPricingCard(i: number, direction: -1 | 1) {
    if (readOnly) return
    setPopover(null)
    editor.setContentOverride('page08.cards', serializeCollection(reorderCollectionItem(page08Cards, i, direction)))
  }

  // Feature list management — nested one level inside a specific card.
  function addFeature(cardIndex: number) {
    if (readOnly) return
    const next = page08Cards.map((c, idx) => (idx === cardIndex ? { ...c, features: addCollectionItem(c.features, 'New feature') } : c))
    editor.setContentOverride('page08.cards', serializeCollection(next))
  }
  function removeFeature(cardIndex: number, featureIndex: number) {
    if (readOnly) return
    setPopover(null)
    const next = page08Cards.map((c, idx) => (idx === cardIndex ? { ...c, features: removeCollectionItem(c.features, featureIndex) } : c))
    editor.setContentOverride('page08.cards', serializeCollection(next))
  }
  function duplicateFeature(cardIndex: number, featureIndex: number) {
    if (readOnly) return
    setPopover(null)
    const next = page08Cards.map((c, idx) => (idx === cardIndex ? { ...c, features: duplicateCollectionItem(c.features, featureIndex) } : c))
    editor.setContentOverride('page08.cards', serializeCollection(next))
  }
  function reorderFeature(cardIndex: number, featureIndex: number, direction: -1 | 1) {
    if (readOnly) return
    setPopover(null)
    const next = page08Cards.map((c, idx) => (idx === cardIndex ? { ...c, features: reorderCollectionItem(c.features, featureIndex, direction) } : c))
    editor.setContentOverride('page08.cards', serializeCollection(next))
  }

  // Structured pricing editor helpers — parse/compose live on top of the single `price` string
  // field (see parsePriceString/composePriceString) so currency/amount/prefix stay one source
  // of truth rather than duplicating into separate stored fields that could drift.
  function updateCardPrice(cardIndex: number, currency: string, amount: string, prefix: string) {
    if (readOnly) return
    const price = composePriceString({ currency, amount, prefix })
    const next = page08Cards.map((c, idx) => (idx === cardIndex ? { ...c, price } : c))
    editor.setContentOverride('page08.cards', serializeCollection(next))
  }
  function updateCardBillingType(cardIndex: number, priceSuffix: string) {
    if (readOnly) return
    const next = page08Cards.map((c, idx) => (idx === cardIndex ? { ...c, priceSuffix } : c))
    editor.setContentOverride('page08.cards', serializeCollection(next))
  }

  async function handleProposalNameBlur() {
    const trimmed = proposalName.trim()
    if (readOnly || !trimmed || trimmed === proposal.proposalName) return
    setSavingProposalName(true)
    try {
      const updated = await updateProposal(proposalId, { proposalName: trimmed })
      onProposalUpdate?.(updated)
    } finally {
      setSavingProposalName(false)
    }
  }

  // Client First Name is bound straight to editor.state (no local buffer): typing calls
  // setVariable immediately, so "Welcome, [Client First Name]" re-resolves live on every
  // keystroke via the existing applyVariables engine — same as any other variable. Blur
  // additionally writes the value back to the proposal's own metadata (bi-directional sync
  // with the document's variable), reusing the existing updateProposal() path — no new
  // storage, no new tables.
  const clientFirstName = editor.state.variables.clientFirstName ?? proposal.clientFirstName ?? ''

  async function handleClientFirstNameBlur() {
    const trimmed = clientFirstName.trim()
    if (readOnly || !trimmed || trimmed === proposal.clientFirstName) return
    setSavingClientFirstName(true)
    try {
      const updated = await updateProposal(proposalId, { clientFirstName: trimmed })
      onProposalUpdate?.(updated)
    } finally {
      setSavingClientFirstName(false)
    }
  }

  if (editor.loading) return <div className="px-8 py-6 text-sm font-general-sans text-novara-light/50">Loading…</div>
  if (editor.loadError) return <div className="px-8 py-6"><ErrorBanner message={editor.loadError} /></div>

  return (
    <div className="px-8 py-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        {readOnly ? (
          <span className="text-[12px] font-general-sans font-medium text-novara-teal bg-novara-teal/10 border border-novara-teal/30 rounded-lg px-3 py-1.5">
            Signed — read only
          </span>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={editor.undo}
              disabled={!editor.canUndo}
              title="Undo"
              className="p-2 rounded-lg text-novara-light/60 hover:text-white disabled:opacity-30 disabled:hover:text-novara-light/60 border border-novara-border transition-colors"
            >
              <Undo2 size={15} />
            </button>
            <button
              onClick={editor.redo}
              disabled={!editor.canRedo}
              title="Redo"
              className="p-2 rounded-lg text-novara-light/60 hover:text-white disabled:opacity-30 disabled:hover:text-novara-light/60 border border-novara-border transition-colors"
            >
              <Redo2 size={15} />
            </button>
          </div>
        )}

        {!readOnly && (
          <div className="flex items-center gap-3">
            {editor.saveStatus !== 'idle' && (
              <span
                className={`text-[12px] font-general-sans ${
                  editor.saveStatus === 'error' ? 'text-red-300' : 'text-novara-teal'
                }`}
              >
                {SAVE_STATUS_LABEL[editor.saveStatus]}
              </span>
            )}
            <button
              onClick={() => void editor.saveNow()}
              className="text-sm font-general-sans font-medium bg-novara-orange hover:bg-novara-orange/90 text-white px-4 py-2.5 rounded-lg transition-colors"
            >
              Save
            </button>
          </div>
        )}
      </div>

      {editor.saveStatus === 'error' && editor.saveError && <ErrorBanner message={editor.saveError} />}

      {currentPageId === 'cover' && (
        <div className="flex flex-col gap-1.5 max-w-sm">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="proposal-name" className="text-[12px] font-general-sans font-medium text-novara-light/70">
              Proposal Name
            </label>
            {savingProposalName && <span className="text-[11px] font-general-sans text-novara-light/40">Saving…</span>}
          </div>
          <input
            id="proposal-name"
            className={inputClass}
            value={proposalName}
            disabled={readOnly}
            onChange={(e) => setProposalName(e.target.value)}
            onBlur={() => void handleProposalNameBlur()}
          />
          <p className="text-[11px] font-general-sans text-novara-light/40">
            Metadata only — not rendered on the Cover artwork itself.
          </p>
        </div>
      )}

      {currentPageId === 'page02' && (
        <div className="flex flex-col gap-1.5 max-w-sm">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="client-first-name" className="text-[12px] font-general-sans font-medium text-novara-light/70">
              Client First Name
            </label>
            {savingClientFirstName && <span className="text-[11px] font-general-sans text-novara-light/40">Saving…</span>}
          </div>
          <input
            id="client-first-name"
            className={inputClass}
            value={clientFirstName}
            disabled={readOnly}
            onChange={(e) => editor.setVariable('clientFirstName', e.target.value)}
            onBlur={() => void handleClientFirstNameBlur()}
          />
          <p className="text-[11px] font-general-sans text-novara-light/40">
            Resolves automatically into "Welcome, [Client First Name]" below — syncs both ways with the proposal's own client details.
          </p>
        </div>
      )}

      {currentPageId === 'page07' && (
        <div className="flex flex-col gap-2 max-w-md border border-novara-border rounded-xl p-4 bg-white/[0.02]">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-general-sans font-medium text-novara-light/70">
              Demand Keywords ({page07Keywords.length})
            </p>
            {!readOnly && (
              <button
                onClick={addKeyword}
                className="flex items-center gap-1 text-[12px] font-general-sans font-medium text-novara-teal hover:text-novara-teal/80 transition-colors"
              >
                <Plus size={13} /> Add
              </button>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            {page07Keywords.map((kw, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="flex-1 text-[13px] font-general-sans text-white/90 truncate">{kw}</span>
                {!readOnly && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => moveKeyword(i, -1)} disabled={i === 0} title="Move up" className="p-1 rounded text-novara-light/50 hover:text-white disabled:opacity-20 transition-colors">
                      <ArrowUp size={13} />
                    </button>
                    <button onClick={() => moveKeyword(i, 1)} disabled={i === page07Keywords.length - 1} title="Move down" className="p-1 rounded text-novara-light/50 hover:text-white disabled:opacity-20 transition-colors">
                      <ArrowDown size={13} />
                    </button>
                    <button onClick={() => duplicateKeyword(i)} title="Duplicate" className="p-1 rounded text-novara-light/50 hover:text-white transition-colors">
                      <Copy size={13} />
                    </button>
                    <button onClick={() => removeKeyword(i)} title="Remove" className="p-1 rounded text-novara-light/50 hover:text-red-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="text-[11px] font-general-sans text-novara-light/40">
            Click a chip on the canvas to edit its text — use these controls to add, remove, reorder, or duplicate.
          </p>
        </div>
      )}

      {currentPageId === 'page08' && (
        <CollectionPanel
          testId="pricing-card"
          title="Pricing Packages"
          items={page08Cards}
          onAdd={addPricingCard}
          onRemove={removePricingCard}
          onDuplicate={duplicatePricingCard}
          onReorder={reorderPricingCard}
          addLabel="Add Package"
          readOnly={readOnly}
          hint="Click any card text on the canvas to edit it directly — use these controls for structural changes (add, remove, reorder, duplicate whole packages or features)."
          renderItem={(card, cardIndex) => {
            const parsedPrice = parsePriceString(card.price)
            return (
              <div className="flex flex-col gap-2 border border-novara-border/60 rounded-lg p-3">
                <input
                  className={inputClass}
                  value={card.title}
                  disabled={readOnly}
                  placeholder="Package name"
                  onChange={(e) => writeEditableValue(`page08.card:${card.id}:title`, e.target.value)}
                />
                <div className="flex gap-2">
                  <select
                    className={inputClass}
                    value={parsedPrice.currency}
                    disabled={readOnly}
                    onChange={(e) => updateCardPrice(cardIndex, e.target.value, parsedPrice.amount, parsedPrice.prefix)}
                  >
                    {CURRENCY_PRESETS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <input
                    className={inputClass}
                    value={parsedPrice.amount}
                    disabled={readOnly}
                    placeholder="Amount"
                    onChange={(e) => updateCardPrice(cardIndex, parsedPrice.currency, e.target.value, parsedPrice.prefix)}
                  />
                  <input
                    className={inputClass}
                    value={parsedPrice.prefix}
                    disabled={readOnly}
                    placeholder="Prefix (optional)"
                    onChange={(e) => updateCardPrice(cardIndex, parsedPrice.currency, parsedPrice.amount, e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    className={inputClass}
                    disabled={readOnly}
                    value=""
                    onChange={(e) => { if (e.target.value) updateCardBillingType(cardIndex, e.target.value) }}
                  >
                    <option value="">Billing preset…</option>
                    {BILLING_TYPE_PRESETS.map((p) => (
                      <option key={p.label} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                  <input
                    className={inputClass}
                    value={card.priceSuffix}
                    disabled={readOnly}
                    placeholder="Billing text"
                    onChange={(e) => writeEditableValue(`page08.card:${card.id}:priceSuffix`, e.target.value)}
                  />
                </div>
                <input
                  className={inputClass}
                  value={card.whyRecommended}
                  disabled={readOnly}
                  placeholder="Why this package fits this client (optional — leave blank to hide)"
                  onChange={(e) => writeEditableValue(`page08.card:${card.id}:whyRecommended`, e.target.value)}
                />
                <input
                  className={inputClass}
                  value={card.footerNote}
                  disabled={readOnly}
                  placeholder="Footer note (optional — leave blank to hide the box)"
                  onChange={(e) => writeEditableValue(`page08.card:${card.id}:footerNote`, e.target.value)}
                />
                <CollectionPanel
                  testId={`pricing-card-${cardIndex}-feature`}
                  title="Features"
                  items={card.features}
                  onAdd={() => addFeature(cardIndex)}
                  onRemove={(fi) => removeFeature(cardIndex, fi)}
                  onDuplicate={(fi) => duplicateFeature(cardIndex, fi)}
                  onReorder={(fi, dir) => reorderFeature(cardIndex, fi, dir)}
                  addLabel="Add Feature"
                  readOnly={readOnly}
                  renderItem={(feature, fi) => (
                    <input
                      className={inputClass}
                      value={feature}
                      disabled={readOnly}
                      onChange={(e) => writeEditableValue(`page08.card:${card.id}:feature:${fi}`, e.target.value)}
                    />
                  )}
                />
                <input
                  className={inputClass}
                  value={card.expectedOutcome}
                  disabled={readOnly}
                  placeholder="Expected outcome (optional — leave blank to hide)"
                  onChange={(e) => writeEditableValue(`page08.card:${card.id}:expectedOutcome`, e.target.value)}
                />
                <input
                  className={inputClass}
                  value={card.roiNote}
                  disabled={readOnly}
                  placeholder="Estimated value / ROI (optional — only when real figures support it)"
                  onChange={(e) => writeEditableValue(`page08.card:${card.id}:roiNote`, e.target.value)}
                />
              </div>
            )
          }}
        />
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        <PageNavigator pages={pages} currentPageId={currentPageId} onSelectPage={setCurrentPageId} pageTitleOverrides={pageTitleOverrides} />

        <div className="flex-1 min-w-0">
          <PageFrameErrorBoundary key={currentPageId} pageId={currentPageId} internal>
            <LiveTemplatePreview
              pageId={currentPageId}
              resolvedBlocks={resolvedBlocks}
              onEditableClick={handleEditableClick}
              pageNumber={pageNumbers[currentPageId]}
              pageProps={resolvePageProps(currentPageId, {
                page07Enrichment,
                page07Keywords,
                investmentSplit: page07InvestmentSplit,
                page08Cards,
                insightsBusinessCurrentPosition,
                insightsBusinessSwot,
                insightsGrowthOpportunities,
                dynamicInsightPages,
                providerIdentity: proposal.providerIdentity,
              })}
            />
          </PageFrameErrorBoundary>
        </div>
      </div>

      {popover && activeEntry && (
        <InlineEditPopover
          anchorRect={popover.anchorRect}
          label={activeEntry.label}
          value={editor.state.contentOverrides[popover.blockKey] ?? activeEntry.originalText}
          onChange={(value) => writeEditableValue(popover.blockKey, value)}
          onClose={handlePopoverClose}
          onOpenAIAssist={() => setShowAIPanel(true)}
        />
      )}

      {popover && showAIPanel && (
        <AIAssistPanel
          currentText={editor.state.contentOverrides[popover.blockKey] ?? activeEntry?.originalText ?? ''}
          context={aiContext}
          providerIdentity={proposal.providerIdentity}
          onContextFieldChange={(key, value) => editor.setVariable(key, value)}
          onApply={handleApplyAISuggestion}
          onClose={() => setShowAIPanel(false)}
        />
      )}
    </div>
  )
}
