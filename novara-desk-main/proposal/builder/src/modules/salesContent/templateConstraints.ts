/**
 * Design-derived length budgets for every AI-generated field, measured
 * directly off the frozen master template (proposal/components/proposal/*.tsx
 * — read, never edited) rather than assumed. For each field this records the
 * actual container width, font-size (the clamp() ceiling — the size the
 * template renders at once the canvas is full design width, 1920px), line-
 * height, and the vertical gap to whatever sits below it, then derives a
 * character/word/line budget from that geometry. The philosophy this
 * encodes: content adapts to the template's fixed design, not the other way
 * around — every number here is a ceiling the AI is asked to write within,
 * not a target to fill.
 *
 * Character-width heuristic: average glyph width ≈ 0.5× font-size for
 * General Sans (the body font) and ≈ 0.55× for Clash Display (the display/
 * heading font, slightly wider letterforms) — a standard approximation for
 * proportional sans-serif text, deliberately rounded down (i.e. assumes
 * slightly wider glyphs than average) so the resulting budget stays a safe
 * ceiling rather than an optimistic one.
 *
 * `page05` looks unusually short compared to its old "Recommended Strategy"
 * framing. That's not a mistake: verified directly in the template source,
 * the ONLY scanner-detected, editable text in that page's heading is a
 * single accent word ("Sectors.") — there is no paragraph-sized content
 * block anywhere else on the page (the 3-card grid below it is static,
 * mapped from a fixed array, never scanner-detected). No amount of
 * compressing a paragraph makes it fit a one-word heading slot gracefully,
 * so this field is redefined to ask for what the template actually has room
 * for: a short, evocative phrase completing the heading, not a paragraph.
 *
 * Page03/Page04 are the frozen core template's static "Our Approach in
 * Practice."/"Support That Scales." pages — never AI-generated, no entries
 * here. Their Business Intelligence content lives instead on the
 * `insightsBusiness`/`insightsGrowth` pages below, inserted after Page 07.
 */

export interface FieldConstraint {
  /** Hard ceiling — the AI is told this number directly. */
  maxChars: number
  /** Hard ceiling on word count — a second, coarser guard against run-on sentences that pack many short words. */
  maxWords: number
  /** Max lines the field's container can hold at full design size before crowding whatever is next to or below it. */
  maxLines: number
  /** A soft floor so short fields still read as deliberate copy, not a fragment — only enforced as prompt guidance, never padded programmatically. */
  minChars?: number
  /** Where these numbers came from — the exact template file/CSS this was measured against, so they can be re-derived if the template ever changes. */
  source: string
}

export const FIELD_CONSTRAINTS: Record<string, FieldConstraint> = {
  // ── Cover ──────────────────────────────────────────────────────────────
  // Big two-line poster title: ProposalCover.tsx — centred, whiteSpace:
  // nowrap, fontSize clamp(60px,11.72vw,225px). Meant to hold a SHORT
  // punchy phrase (default "RevOps" / "Proposal"), not a descriptive
  // sentence — at 225px Clash Display, even 20 characters is already a
  // full-width line.
  'cover.title': { maxChars: 20, maxWords: 3, maxLines: 1, source: 'ProposalCover.tsx cover.title — 225px Clash Display, nowrap' },
  'cover.subHeading': { maxChars: 20, maxWords: 3, maxLines: 1, source: 'ProposalCover.tsx cover.heading — 225px Clash Display, nowrap' },
  // Description paragraph: width 45.37% of 1920px ≈ 871px, fontSize
  // clamp(13px,1.25vw,24px), lineHeight 1.5, centred, wraps freely, no
  // fixed element directly below it. Original default ≈190 chars/35 words
  // across ~3 lines — kept close to that.
  'cover.introduction': { maxChars: 220, maxWords: 40, maxLines: 4, minChars: 100, source: 'ProposalCover.tsx cover.paragraph — 871px wide, 24px, lineHeight 1.5' },
  // Floating capability tags: small pill labels, one word or a very short pair.
  'cover.tag': { maxChars: 18, maxWords: 2, maxLines: 1, source: 'ProposalCover.tsx FloatingTag — pill label, nowrap' },

  // ── Page 02 — Who We Are ──────────────────────────────────────────────
  // Right-column text block: width 48.7% of 1920px ≈ 935px, fontSize
  // clamp(13-15px, ~1.25vw, 24px).
  'page02.welcomeMessage': { maxChars: 70, maxWords: 12, maxLines: 1, source: 'ProposalPage02.tsx page02.welcomeHeading — 935px wide, 24px' },
  'page02.introParagraph': { maxChars: 220, maxWords: 40, maxLines: 3, minChars: 100, source: 'ProposalPage02.tsx page02.introParagraph — 935px wide, 24px, lineHeight 1.6' },
  // companyDescription supports \n\n paragraph breaks (whiteSpace:
  // pre-line) and has generous room below it to the canvas edge.
  'page02.companyUnderstanding': { maxChars: 500, maxWords: 85, maxLines: 8, minChars: 200, source: 'ProposalPage02.tsx page02.companyDescription — 935px wide, 24px, lineHeight 1.6, pre-line' },

  // ── Page 05 — heading accent word (see module doc) ───────────────────
  // Verified: the ONLY editable text on this page is a single accent word
  // inside a nowrap 72px Clash Display heading ("Experience Across
  // Sectors.").
  'page05': { maxChars: 22, maxWords: 3, maxLines: 1, source: 'ProposalPage05.tsx "Sectors." accent word — 72px Clash Display, nowrap, maxWidth 63.49%, only editable block on the page' },

  // ── Insights Business — "Where You Stand Today" (premium page inserted
  // after Page 07 — see masterTemplate/index.ts; NOT the frozen Page 03,
  // which is static core template content) ─────────────────────────────
  // Natural flex-column flow (same scoped exception already applied to
  // Page07/08) — these are generous paragraph-style budgets, not tight
  // single-line ones.
  'insightsBusiness.businessOverview': { maxChars: 480, maxWords: 80, maxLines: 6, minChars: 120, source: 'ProposalPageInsightsBusiness.tsx insightsBusiness.businessOverview — 24px, page grows to fit content' },
  'insightsBusiness.currentPositionLabel': { maxChars: 40, maxWords: 6, maxLines: 1, minChars: 5, source: 'ProposalPageInsightsBusiness.tsx insightsBusiness.position{i}.label — 24px, one dimension name e.g. "Website & Digital Presence"' },
  'insightsBusiness.swotItem': { maxChars: 140, maxWords: 22, maxLines: 3, minChars: 8, source: 'ProposalPageInsightsBusiness.tsx insightsBusiness.swot.{column}{i} — 21px bullet item inside a SWOT column card, card grows to fit content' },

  // ── Insights Growth — "The Opportunity Ahead" (premium page inserted
  // after Page 07 — NOT the frozen Page 04) ────────────────────────────
  'insightsGrowth.opportunityTitle': { maxChars: 60, maxWords: 8, maxLines: 2, minChars: 10, source: 'ProposalPageInsightsGrowth.tsx insightsGrowth.opportunity{i}.title — 29px' },
  'insightsGrowth.opportunityDescription': { maxChars: 220, maxWords: 38, maxLines: 4, minChars: 30, source: 'ProposalPageInsightsGrowth.tsx insightsGrowth.opportunity{i}.description — 23px, card grows to fit content' },
  'insightsGrowth.marketIndustryPosition': { maxChars: 650, maxWords: 110, maxLines: 8, minChars: 150, source: 'ProposalPageInsightsGrowth.tsx insightsGrowth.marketIndustryPosition — 24px, page grows to fit content' },
  'insightsGrowth.futureGrowthPotential': { maxChars: 480, maxWords: 80, maxLines: 6, minChars: 100, source: 'ProposalPageInsightsGrowth.tsx insightsGrowth.futureGrowthPotential — 24px, page grows to fit content' },

  // ── Page 07 — Why Novara ──────────────────────────────────────────────
  // Heading: shares one nowrap H2 line with the client's first name span
  // (a separate, unpredictable-length element) — the one genuinely fixed
  // slot on this page even after it was converted to a flowing layout, so
  // this ceiling stays hard.
  'page07.heading': { maxChars: 24, maxWords: 4, maxLines: 1, source: 'ProposalPage07.tsx page07.heading — 72px Clash Display, nowrap, shares its line with the client first-name span' },
  // Kicker label: replaces "SEO & Website Growth Proposal". 30px GS Medium,
  // ~1732px wide container — plenty of width, but this reads as a short label.
  'page07.kicker': { maxChars: 45, maxWords: 7, maxLines: 1, minChars: 15, source: 'ProposalPage07.tsx page07.block1 — 30px GS Medium label, ~1732px wide' },
  // Page07's outer container is no longer a fixed-height slide (see
  // ProposalPage07.tsx) — its sections now flow, so the description
  // paragraph can run longer without crowding whatever sits below it.
  // Ceiling raised generously; still bounded so a runaway response can't
  // produce an unreasonably long "paragraph" out of proportion with the
  // rest of the page.
  'page07.description': { maxChars: 500, maxWords: 85, maxLines: 6, minChars: 70, source: 'ProposalPage07.tsx page07.description — 1740px wide, 24px, page now grows to fit content' },
  // "Where You Stand" body — shares a flowing flex-col section with the
  // heading + 3 value lines above it; no longer bounded by a fixed section
  // below it, so raised well past the old fixed-frame budget.
  'page07.situation': { maxChars: 650, maxWords: 110, maxLines: 8, minChars: 120, source: 'ProposalPage07.tsx page07.block3 — 1732px wide, 24px, lineHeight 1.5, page now grows to fit content' },
  'page07.opportunity': { maxChars: 550, maxWords: 95, maxLines: 7, minChars: 90, source: 'ProposalPage07.tsx page07.block4 — 1732px wide, 24px, lineHeight 1.5, page now grows to fit content' },
  // Demand-section label, same style/width as the kicker.
  'page07.demandIntro': { maxChars: 150, maxWords: 24, maxLines: 2, minChars: 20, source: 'ProposalPage07.tsx page07.block5 — 30px GS Medium label above the keyword chips' },
  // Keyword/positioning chips: the pill now wraps to two lines instead of a
  // hard nowrap (see ProposalPage07.tsx), so a genuine location-qualified
  // phrase ("commercial property developers Manchester") has room to exist
  // without being cut — still a chip, not a sentence, so kept well short of
  // the paragraph fields above.
  'page07.keyword': { maxChars: 48, maxWords: 6, maxLines: 2, source: 'ProposalPage07.tsx page07.keyword{i} — wrapping pill chip, 24px' },
  // Funnel banner steps: always exactly 3, nowrap, sharing one row with 2
  // arrow glyphs — ~513px available per slot at full design width.
  'page07.funnelStep': { maxChars: 28, maxWords: 4, maxLines: 1, source: 'ProposalPage07.tsx page07.funnelStep{i} — nowrap, 26px, ~513px per slot in a fixed 3-item row' },

  // ── Page 07 — Enrichment block (Phase 3) ──────────────────────────────
  // One of these renders between "Where You Stand" and the demand keywords
  // — see EnrichmentBlock in ProposalPage07.tsx. The card/box itself grows
  // to fit content (no fixed height), so these are generous paragraph-style
  // budgets, not tight single-line ones, except where the design genuinely
  // wants a short punchy number/label.
  'page07.enrichment.statValue': { maxChars: 12, maxWords: 3, maxLines: 1, source: 'ProposalPage07.tsx page07.enrichment.stat{i}.value — 56px Clash Display, short punchy figure e.g. "45%", "£12k"' },
  'page07.enrichment.statLabel': { maxChars: 60, maxWords: 10, maxLines: 2, minChars: 10, source: 'ProposalPage07.tsx page07.enrichment.stat{i}.label — 22px, card grows to fit content' },
  'page07.enrichment.beforeAfterLabel': { maxChars: 30, maxWords: 4, maxLines: 1, minChars: 5, source: 'ProposalPage07.tsx page07.enrichment.beforeLabel/afterLabel — 21px uppercase label' },
  'page07.enrichment.beforeAfterText': { maxChars: 260, maxWords: 45, maxLines: 5, minChars: 40, source: 'ProposalPage07.tsx page07.enrichment.beforeText/afterText — 24px, box grows to fit content' },
  'page07.enrichment.roadmapTitle': { maxChars: 60, maxWords: 8, maxLines: 2, minChars: 10, source: 'ProposalPage07.tsx page07.enrichment.step{i}.title — 29px' },
  'page07.enrichment.roadmapDescription': { maxChars: 220, maxWords: 38, maxLines: 4, minChars: 30, source: 'ProposalPage07.tsx page07.enrichment.step{i}.description — 23px, page grows to fit content' },
  'page07.enrichment.opportunityCardTitle': { maxChars: 60, maxWords: 8, maxLines: 2, minChars: 10, source: 'ProposalPage07.tsx page07.enrichment.card{i}.title — 29px' },
  'page07.enrichment.opportunityCardDescription': { maxChars: 220, maxWords: 38, maxLines: 4, minChars: 30, source: 'ProposalPage07.tsx page07.enrichment.card{i}.description — 23px, card grows to fit content' },
  'page07.enrichment.comparisonBarLabel': { maxChars: 40, maxWords: 6, maxLines: 1, minChars: 5, source: 'ProposalPage07.tsx page07.enrichment.bar{i}.label — 24px, one dimension name e.g. "Website & Digital Presence"' },
  'page07.enrichment.funnelStageLabel': { maxChars: 32, maxWords: 5, maxLines: 1, minChars: 5, source: 'ProposalPage07.tsx page07.enrichment.stage{i}.label — 22px inside a tapering trapezoid, short stage name' },
  'page07.enrichment.stackedBarTitle': { maxChars: 60, maxWords: 9, maxLines: 1, minChars: 8, source: 'ProposalPage07.tsx page07.enrichment.stackedBarTitle — 24px, one line above the bar' },
  'page07.enrichment.stackedBarSegmentLabel': { maxChars: 30, maxWords: 5, maxLines: 1, minChars: 3, source: 'ProposalPage07.tsx page07.enrichment.segment{i}.label — 21px legend entry' },
  'page07.enrichment.treemapItemLabel': { maxChars: 30, maxWords: 5, maxLines: 1, minChars: 3, source: 'ProposalPage07.tsx page07.enrichment.item{i}.label — 22px inside a proportionally-sized tile' },
  'page07.enrichment.projectionTitle': { maxChars: 60, maxWords: 9, maxLines: 1, minChars: 8, source: 'ProposalPage07.tsx page07.enrichment.projectionTitle — 24px, one line above the chart' },
  'page07.enrichment.projectionUnit': { maxChars: 6, maxWords: 1, maxLines: 1, source: 'ProposalPage07.tsx page07.enrichment.projectionUnit — 13px suffix on each value label, e.g. "%", "k", "£"' },
  'page07.enrichment.projectionPointLabel': { maxChars: 16, maxWords: 3, maxLines: 1, minChars: 2, source: 'ProposalPage07.tsx page07.enrichment.projectionPoint{i}.label — 11px X-axis tick, short time label e.g. "Month 3"' },
  'page07.enrichment.priorityMatrixAxisLabel': { maxChars: 24, maxWords: 3, maxLines: 1, minChars: 3, source: 'ProposalPage07.tsx page07.enrichment.priorityMatrixXLabel/YLabel — 19px axis caption, e.g. "Effort", "Impact"' },
  'page07.enrichment.priorityMatrixItemLabel': { maxChars: 24, maxWords: 4, maxLines: 1, minChars: 2, source: 'ProposalPage07.tsx page07.enrichment.priorityMatrixItem{i}.label — 12px dot label plotted on the grid' },
  'page07.enrichment.comparisonTableTitle': { maxChars: 60, maxWords: 9, maxLines: 1, minChars: 8, source: 'ProposalPage07.tsx page07.enrichment.comparisonTableTitle — 24px, one line above the table' },
  'page07.enrichment.comparisonTableColumn': { maxChars: 22, maxWords: 3, maxLines: 1, minChars: 2, source: 'ProposalPage07.tsx page07.enrichment.comparisonTableColumn{i} — 21px header cell, short column name' },
  'page07.enrichment.comparisonTableRowLabel': { maxChars: 30, maxWords: 5, maxLines: 1, minChars: 2, source: 'ProposalPage07.tsx page07.enrichment.comparisonTableRow{i}.label — 21px first-column cell, the feature/item name' },
  'page07.enrichment.comparisonTableCell': { maxChars: 20, maxWords: 4, maxLines: 1, source: 'ProposalPage07.tsx page07.enrichment.comparisonTableRow{i}.value{j} — 21px data cell, short value not a sentence' },

  // ── Page 08 — Investment ──────────────────────────────────────────────
  // Investment explanation: Page08's outer container now grows to fit its
  // content (see ProposalPage08.tsx) rather than a fixed-height slide, so
  // this no longer shares a hard budget with a fixed section below it.
  'page08.investmentExplanation': { maxChars: 700, maxWords: 120, maxLines: 8, minChars: 150, source: 'ProposalPage08.tsx page08.recommendedIntro — 1740px wide, 24px, lineHeight 1.5, page now grows to fit content' },
  // Pricing cards: 3-up flex row inside a 1736px-wide section, each card
  // flex:1 with clamp(14,1.605vw,31px) padding — ~486px of usable content
  // width per card at full design size. Card title/price/suffix stay
  // single-line design elements even though the card itself can now grow
  // taller, so these three remain genuinely hard ceilings.
  'page08.card.title': { maxChars: 30, maxWords: 4, maxLines: 1, source: 'ProposalPage08.tsx page08.card:{id}:title — ~486px card width, 32px, single-line card name' },
  'page08.card.price': { maxChars: 10, maxWords: 2, maxLines: 1, source: 'ProposalPage08.tsx page08.card:{id}:price — 50px Orange price figure, e.g. "£1,200"' },
  // priceSuffix is whiteSpace:nowrap in the frozen template — no wrap fallback exists, so this ceiling is a hard one.
  'page08.card.priceSuffix': { maxChars: 26, maxWords: 4, maxLines: 1, source: 'ProposalPage08.tsx page08.card:{id}:priceSuffix — 26px, explicit nowrap, ~486px card width' },
  // Feature rows and the footer note wrap freely and the card itself no
  // longer has a fixed height (see PricingCard in ProposalPage08.tsx) — raised
  // well past the old fixed-card-height budget so a genuinely detailed
  // feature ("why/how/expected outcome" style) isn't squeezed into one line.
  'page08.card.feature': { maxChars: 220, maxWords: 38, maxLines: 4, minChars: 20, source: 'ProposalPage08.tsx page08.card:{id}:feature:{i} — ~442px (card width minus tick icon), 24px, lineHeight 1.5, card now grows to fit content' },
  // Why-recommended / expected-outcome / ROI note: new card sections, same
  // full card width, wrap freely, card has no fixed height — same generous
  // paragraph budget as a feature row, since these are meant to carry real
  // reasoning (why/how/outcome), not a one-line label.
  'page08.card.whyRecommended': { maxChars: 220, maxWords: 38, maxLines: 4, minChars: 30, source: 'ProposalPage08.tsx page08.card:{id}:whyRecommended — ~486px card width, 22px italic, card grows to fit content' },
  'page08.card.expectedOutcome': { maxChars: 260, maxWords: 44, maxLines: 4, minChars: 30, source: 'ProposalPage08.tsx page08.card:{id}:expectedOutcome — ~486px card width, 24px, card grows to fit content' },
  'page08.card.roiNote': { maxChars: 260, maxWords: 44, maxLines: 4, source: 'ProposalPage08.tsx page08.card:{id}:roiNote — ~486px card width, 24px, card grows to fit content — no minChars, since an empty string is the correct value whenever no real figures exist' },
  'page08.card.footerNote': { maxChars: 220, maxWords: 38, maxLines: 4, minChars: 15, source: 'ProposalPage08.tsx page08.card:{id}:footerNote — ~454px footer box, 24px, lineHeight 1.5, card now grows to fit content' },
  // Combination box's two free-text lines — the two package slots either side are always copied verbatim from real card data, never generated (see ProposalContentPricingCard.recommendedCardId/complementaryCardId).
  'page08.comboOutcome': { maxChars: 200, maxWords: 34, maxLines: 4, minChars: 25, source: 'ProposalPage08.tsx combination-box outcome line — flexible remaining width of a 1648px box, 30px, fontWeight 500' },
  'page08.comboResults': { maxChars: 350, maxWords: 60, maxLines: 5, minChars: 50, source: 'ProposalPage08.tsx combination-box results line — same column, 26px, fontWeight 300' },

  // ── Page 11 — Thank You ───────────────────────────────────────────────
  // Envelope message: width clamp(260px, 33.49vw, 643px), fontSize 24px,
  // lineHeight 1.54, centred. Fixed gap to the CTA button below (34.02% →
  // 47.09% of the 1080px canvas) budgets ≈141px — about 3 lines.
  'page11.envelopeMessage': { maxChars: 190, maxWords: 32, maxLines: 3, minChars: 90, source: 'ProposalPage11.tsx page11.envelopeMessage — 643px wide, 24px, lineHeight 1.54, ~141px vertical budget before the CTA button' },
}

export function getFieldConstraint(key: string): FieldConstraint | undefined {
  return FIELD_CONSTRAINTS[key]
}

/** Renders a constraint as a short, explicit instruction fragment to embed directly in a field's schema description. */
export function constraintInstruction(c: FieldConstraint): string {
  const floor = c.minChars ? `${c.minChars}-` : 'up to '
  return `${floor}${c.maxChars} characters, max ${c.maxWords} words, max ${c.maxLines} line${c.maxLines === 1 ? '' : 's'}`
}

/**
 * Deterministic last-resort safety net for generated field text. The prompt
 * already asks the model to self-edit to these limits (see
 * LENGTH_DISCIPLINE_RULE in prompts.ts), but nothing guarantees compliance
 * on every call — this runs after every generation, before content ever
 * reaches the template, so a rare over-length response still can't overflow
 * the page. Deliberately NOT another AI round-trip: this codebase has
 * repeatedly fought Blueprint-generation timeouts (see git history), so
 * adding a second model call per field to "rewrite tighter" would reintroduce
 * that fragility for a case that's already rare given the prompt-level fix.
 *
 * Prefers cutting at the last sentence boundary that still fits, so a trim
 * reads as an intentional ending rather than a mid-thought truncation; only
 * falls back to a word-boundary cut with an ellipsis when no sentence
 * boundary exists within the limit at all.
 */
/** Bare connectors/articles that read as an unfinished thought if left dangling right before an ellipsis (e.g. "Interiors &…") — stripped so the trim backs up to the last complete, standalone word instead. */
const DANGLING_TRAILING_WORD = /\s+(?:&|and|or|of|the|a|an|to|for|in|on|at|with|by)$/i
/** A bare separator/punctuation mark left dangling right before an ellipsis (e.g. "Milestone 1 ·…") reads as broken rather than an intentional trim — stripped the same way as a dangling word. */
const DANGLING_TRAILING_PUNCTUATION = /\s*[·\-:,]$/

export function enforceMaxChars(text: string, c: FieldConstraint): string {
  const trimmed = text.trim()
  if (trimmed.length <= c.maxChars) return trimmed

  const window = trimmed.slice(0, c.maxChars + 1)
  const lastSentenceEnd = Math.max(window.lastIndexOf('. '), window.lastIndexOf('! '), window.lastIndexOf('? '))
  // Only accept a sentence-boundary cut if it doesn't throw away the bulk of
  // the text (e.g. a stray "e.g." near the start shouldn't win over a real
  // ending later on) — otherwise fall through to the word-boundary cut.
  if (lastSentenceEnd > c.maxChars * 0.4) return trimmed.slice(0, lastSentenceEnd + 1).trim()

  const lastSpace = trimmed.slice(0, c.maxChars).lastIndexOf(' ')
  const cut = lastSpace > 0 ? lastSpace : c.maxChars
  let head = trimmed.slice(0, cut).trim()
  // Keep backing up past dangling connectors/punctuation so the visible
  // fragment always ends on a real word (e.g. "Interiors" rather than
  // "Interiors &", and "Milestone 1" rather than "Milestone 1 ·").
  let stripped = head.replace(DANGLING_TRAILING_WORD, '').replace(DANGLING_TRAILING_PUNCTUATION, '')
  while (stripped !== head) {
    head = stripped
    stripped = head.replace(DANGLING_TRAILING_WORD, '').replace(DANGLING_TRAILING_PUNCTUATION, '')
  }
  return `${head}…`
}

/** Applies enforceMaxChars only when a constraint is registered for `key`; passes text through unchanged otherwise (e.g. fields with no measured template budget, like page06/page09). */
export function fitToConstraint(key: string, text: string): string {
  const c = FIELD_CONSTRAINTS[key]
  return c ? enforceMaxChars(text, c) : text
}
