import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ProposalBackground } from './ProposalBackground'
import { MobileWrapper } from './ProposalLayout'
import { PageNumber } from './ProposalLogo'
import tickIcon from '../../src/assets/p08/tick-icon.svg'

// ─── Tokens ───────────────────────────────────────────────────────────────────

const FONT_CLASH = 'Clash Display, sans-serif'
const FONT_GS    = 'General Sans, sans-serif'
const WHITE      = '#FFFFFF'
const ORANGE     = '#FF5B04'

// ─── Breakpoint hook ──────────────────────────────────────────────────────────

function useIsDesktopTablet(): boolean {
  const [is, setIs] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(min-width: 768px)').matches
      : true
  )
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)')
    const handler = (e: MediaQueryListEvent) => setIs(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])
  return is
}

// ─── Public types ─────────────────────────────────────────────────────────────

export interface PricingCardData {
  id: string
  title: string
  price: string
  priceSuffix: string
  /** '' = section not shown. Why this specific package fits this client, not a generic sales line. */
  whyRecommended: string
  features: string[]
  /** '' = section not shown. What changes for the client once this package is delivered. */
  expectedOutcome: string
  /** '' = section not shown. Only ever populated when real client-provided figures support a genuine calculation — never a fabricated statistic. */
  roiNote: string
  /** '' = no footer box shown. */
  footerNote: string
}

export interface ProposalPage08Props {
  /** Repeatable, Builder-editable (add/remove/reorder/duplicate packages, and each card's feature list independently). */
  cards?: PricingCardData[]
  pageNumber?: number
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const DEFAULT_CARDS: PricingCardData[] = [
  {
    id: 'card-website-refresh',
    title: 'Website Refresh',
    price: '£999',
    priceSuffix: 'one-time payment',
    whyRecommended: 'Your current site is the first thing every prospect checks before they call — right now it is costing you enquiries, not winning them.',
    features: [
      'Fully custom design (not template-based)',
      'Built for mobile, desktop & tablet',
      'Faster performance & improved structure',
      'Clear service pages for each offering',
      'Improved contact pathways for leads',
      'SEO-ready page structure',
    ],
    expectedOutcome: 'A site that converts visitors into enquiries instead of losing them, with a foundation the SEO work below can actually build on.',
    roiNote: '',
    footerNote: '£499 deposit to begin · £500 on completion',
  },
  {
    id: 'card-local-seo-foundation',
    title: 'Local SEO Foundation',
    price: '£499',
    priceSuffix: 'per month · 30 days notice',
    whyRecommended: 'Being fast to find matters as much as being fast to load — this is what gets you found by the people already searching for what you do.',
    features: [
      'Technical SEO improvements',
      'Meta title & description optimisation',
      'Google Search Console & analytics setup',
      'Google My Business optimisation',
      'Directory and citation listings',
      'Monthly ranking & visibility reporting',
    ],
    expectedOutcome: 'Steadily climbing rankings for the searches your customers actually use, with visibility you can track month over month.',
    roiNote: '',
    footerNote: '',
  },
  {
    id: 'card-local-authority-seo-growth',
    title: 'Local Authority SEO Growth',
    price: '£899',
    priceSuffix: 'per month · 30 days notice',
    whyRecommended: 'Once the foundation is live, this is what turns local visibility into the dominant local presence in your market.',
    features: [
      'Everything in Local SEO Foundation',
      'Location-based landing pages (5 areas)',
      'Schema markup implementation',
      'Structured service pages per offering',
      'Authority & citation expansion',
      'Conversion-focused page improvements',
    ],
    expectedOutcome: 'Consistent top-of-page visibility across every area you serve, with enquiry volume that compounds rather than plateaus.',
    roiNote: '',
    footerNote: '',
  },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function FeatureRow({ text, editorKey }: { text: string; editorKey?: string }) {
  return (
    <div style={{ display: 'flex', gap: 'clamp(6px, 0.602vw, 12px)', alignItems: 'flex-start', width: '100%' }}>
      <img
        src={tickIcon}
        alt=""
        aria-hidden
        draggable={false}
        style={{
          display: 'block',
          width: 'clamp(18px, 1.685vw, 32px)',
          height: 'clamp(18px, 1.685vw, 32px)',
          flexShrink: 0,
        }}
      />
      <p data-editor-key={editorKey} style={{
        fontFamily: FONT_GS,
        fontWeight: 400,
        fontSize: 'clamp(13px, 1.25vw, 24px)',
        lineHeight: 1.5,
        color: WHITE,
        margin: 0,
        flex: '1 0 0',
        minWidth: 0,
      }}>
        {text}
      </p>
    </div>
  )
}

function PricingCard({ card, delay }: { card: PricingCardData; delay: number }) {
  return (
    <motion.div
      style={{
        flex: '1 1 0',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: card.footerNote ? 'space-between' : 'flex-start',
        // `gap` alongside `justify-content: space-between` — space-between
        // alone guarantees the content stack and the footer box sit at
        // opposite ends of the card, but nothing stops them from landing
        // right next to each other with zero breathing room once the
        // content is tall enough to nearly fill the card (exactly what
        // happened here — the "Estimated Value" paragraph was touching the
        // white box below it). `gap` sets the floor space-between doesn't.
        gap: 'clamp(20px, 2.2vw, 42px)',
        // Was a fixed height regardless of content — a card with a longer
        // feature list would overflow past its own border. Now a floor only
        // (matching the row's alignItems:stretch, every card in the row
        // still equalises to the tallest one), so a card genuinely grows
        // with its content instead of being compressed or clipped.
        minHeight: 'clamp(400px, 47.083vw, 904px)',
        background: 'rgba(228,238,240,0.02)',
        border: '0.77px solid rgba(255,255,255,0.2)',
        borderRadius: 'clamp(4px, 0.401vw, 7.7px)',
        padding: 'clamp(14px, 1.605vw, 31px)',
        boxSizing: 'border-box',
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay, ease: 'easeOut' }}
    >
      {/* Title + price + why-recommended + features + expected-outcome + roi */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(20px, 2.2vw, 42px)', width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(9px, 0.923vw, 18px)', width: '100%' }}>
          <p data-editor-key={`page08.card:${card.id}:title`} style={{
            fontFamily: FONT_GS,
            fontWeight: 500,
            fontSize: 'clamp(18px, 1.667vw, 32px)',
            lineHeight: 1.5,
            color: WHITE,
            margin: 0,
          }}>
            {card.title}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <p data-editor-key={`page08.card:${card.id}:price`} style={{
              // Clash Display, not General Sans — matches the "hero number"
              // treatment used everywhere else a big figure is the point
              // (stat values, page numbers): a price is exactly that kind of
              // figure, and rendering it in the body typeface made it read
              // as ordinary text next to those other numbers instead of the
              // headline of the card.
              fontFamily: FONT_CLASH,
              fontWeight: 600,
              fontSize: 'clamp(32px, 2.9vw, 56px)',
              lineHeight: 1.1,
              color: ORANGE,
              margin: 0,
            }}>
              {card.price}
            </p>
            <p data-editor-key={`page08.card:${card.id}:priceSuffix`} style={{
              fontFamily: FONT_GS,
              fontWeight: 300,
              fontSize: 'clamp(14px, 1.354vw, 26px)',
              lineHeight: 1.5,
              color: WHITE,
              margin: 0,
              whiteSpace: 'nowrap',
            }}>
              {card.priceSuffix}
            </p>
          </div>
        </div>

        {/* Why this package — short, client-specific reasoning, not a generic sales line. */}
        {card.whyRecommended && (
          <p data-editor-key={`page08.card:${card.id}:whyRecommended`} style={{
            fontFamily: FONT_GS,
            fontWeight: 300,
            fontStyle: 'italic',
            fontSize: 'clamp(12px, 1.146vw, 22px)',
            lineHeight: 1.5,
            color: 'rgba(255,255,255,0.65)',
            margin: 0,
          }}>
            {card.whyRecommended}
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(12px, 1.204vw, 23px)', width: '100%' }}>
          {card.features.map((f, i) => <FeatureRow key={i} text={f} editorKey={`page08.card:${card.id}:feature:${i}`} />)}
        </div>

        {/* Expected outcome — what changes for the client, not just what's delivered. */}
        {card.expectedOutcome && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(8px, 0.8vw, 16px)', width: '100%' }}>
            <p style={{
              fontFamily: FONT_GS, fontWeight: 500, fontSize: 'clamp(11px, 1.04vw, 20px)',
              letterSpacing: '0.03em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', margin: 0,
            }}>
              Expected Outcome
            </p>
            <p data-editor-key={`page08.card:${card.id}:expectedOutcome`} style={{
              fontFamily: FONT_GS,
              fontWeight: 300,
              fontSize: 'clamp(13px, 1.25vw, 24px)',
              lineHeight: 1.5,
              color: WHITE,
              margin: 0,
            }}>
              {card.expectedOutcome}
            </p>
          </div>
        )}

        {/* ROI/value note — only ever rendered when the AI had real client figures to compute from (see prompts.ts). */}
        {card.roiNote && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(8px, 0.8vw, 16px)', width: '100%' }}>
            <p style={{
              fontFamily: FONT_GS, fontWeight: 500, fontSize: 'clamp(11px, 1.04vw, 20px)',
              letterSpacing: '0.03em', textTransform: 'uppercase', color: ORANGE, margin: 0,
            }}>
              Estimated Value
            </p>
            <p data-editor-key={`page08.card:${card.id}:roiNote`} style={{
              fontFamily: FONT_GS,
              fontWeight: 400,
              fontSize: 'clamp(13px, 1.25vw, 24px)',
              lineHeight: 1.5,
              color: WHITE,
              margin: 0,
            }}>
              {card.roiNote}
            </p>
          </div>
        )}
      </div>

      {/* Footer note box (only rendered when non-empty) */}
      {card.footerNote && (
        <div style={{
          width: '100%',
          background: '#E4EEF0',
          borderRadius: 'clamp(4px, 0.401vw, 7.7px)',
          // Single value = identical padding on all four sides — was two
          // different (and quite tight) values for vertical/horizontal,
          // which read as the text sitting too close to the top edge
          // specifically since vertical padding was the smaller of the two.
          padding: 'clamp(16px, 1.6vw, 30px)',
          boxSizing: 'border-box',
        }}>
          <p data-editor-key={`page08.card:${card.id}:footerNote`} style={{
            fontFamily: FONT_GS,
            fontWeight: 500,
            fontSize: 'clamp(13px, 1.25vw, 24px)',
            lineHeight: 1.5,
            color: '#0D1A1F',
            margin: 0,
          }}>
            {card.footerNote}
          </p>
        </div>
      )}
    </motion.div>
  )
}

// ─── Desktop + Tablet (≥768px) ────────────────────────────────────────────────
// Frame: 1920×1774px — use custom aspectRatio wrapper (not DesktopTabletWrapper)
// calc() top values reference the 1774px frame height via the aspectRatio container.

function DesktopTabletPage08({ cards, pageNumber }: Required<ProposalPage08Props>) {
  return (
    // aspectRatio behaves as a MINIMUM here now that overflow is no longer
    // hidden and every section below is in normal flow: it sets the page's
    // natural height for typical content, but a section that genuinely needs
    // more room (e.g. a long pricing-card feature list) grows the box taller
    // instead of being clipped — never truncated to fit a fixed slide size.
    <div className="relative w-full" style={{ aspectRatio: '1920 / 1774' }}>
      <ProposalBackground />

      {/* Page badge — decorative chrome, stays pinned to its own corner regardless of page height */}
      <div className="absolute" style={{ left: '90.625%', top: 'clamp(40px, 4.688vw, 90px)' }}>
        <PageNumber pageNumber={pageNumber} width="clamp(30px, 4.54vw, 87px)" />
      </div>

      {/* Content stack — Section 1 (pricing) and Section 2 (Recommended
          Approach) used to be independently absolute-positioned at hardcoded
          offsets of the frame's fixed height, which is exactly why Section 2
          could overlap Section 1 whenever the cards rendered taller than the
          offset assumed. Now both are normal flex-column siblings, so
          Section 2 always starts wherever Section 1's real rendered height
          ends. */}
      <div
        className="relative flex flex-col"
        style={{
          paddingLeft: '4.6875%',
          paddingRight: '4.6875%',
          paddingTop: 'clamp(40px, 4.688vw, 90px)',
          paddingBottom: 'clamp(40px, 4.688vw, 90px)',
          gap: 'clamp(60px, 7vw, 135px)',
        }}
      >
        {/* Section 1 — heading + description + 3 pricing cards */}
        <motion.div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'clamp(20px, 2.083vw, 40px)',
          }}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
        >
          {/* Heading */}
          <h2 style={{
            fontFamily: FONT_CLASH,
            fontWeight: 600,
            fontSize: 'clamp(36px, 3.75vw, 72px)',
            lineHeight: 1.1,
            color: WHITE,
            margin: 0,
            maxWidth: '63.49%',
          }}>
            <motion.span data-editor-key="page08.heading">Your</motion.span> <span style={{ color: ORANGE }}>Investment.</span>
          </h2>

          {/* Description + cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(16px, 1.5625vw, 30px)' }}>
            <p data-editor-key="page08.description" style={{
              fontFamily: FONT_GS,
              fontWeight: 300,
              fontSize: 'clamp(13px, 1.25vw, 24px)',
              lineHeight: 1.5,
              color: WHITE,
              margin: 0,
            }}>
              Three ways to close the gap. We will tell you which one actually moves the needle.
            </p>

            {/* Cards row */}
            <div style={{ display: 'flex', gap: 'clamp(20px, 2.407vw, 46px)', alignItems: 'stretch' }}>
              {cards.map((card, i) => (
                <PricingCard key={card.id} card={card} delay={0.2 + i * 0.1} />
              ))}
            </div>
          </div>
        </motion.div>

        {/* Section 2 — Recommended Approach */}
        <motion.div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'clamp(20px, 2.083vw, 40px)',
          }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5, ease: 'easeOut' }}
        >
        <h3 style={{
          fontFamily: FONT_CLASH,
          fontWeight: 500,
          fontSize: 'clamp(26px, 2.604vw, 50px)',
          lineHeight: 1.5,
          color: WHITE,
          margin: 0,
          letterSpacing: '-0.5px',
          whiteSpace: 'nowrap',
        }}>
          <motion.span data-editor-key="page08.recommendedHeading">Recommended</motion.span> <span style={{ color: ORANGE }}>Approach.</span>
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(16px, 1.5625vw, 30px)' }}>
          <p data-editor-key="page08.recommendedIntro" style={{
            fontFamily: FONT_GS,
            fontWeight: 300,
            fontSize: 'clamp(13px, 1.25vw, 24px)',
            lineHeight: 1.5,
            color: WHITE,
            margin: 0,
          }}>
            A fast website and strong SEO only work as a system. Run them separately and you are optimising half a funnel.
            We recommend combining the Website Refresh with Local Authority SEO Growth so the foundation and the traffic
            strategy are built together from day one, not patched together after the fact.
          </p>

          {/* Combination box */}
          {/* Figma: node 4836:556, flex, justify-between, p=46.205px */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'clamp(16px, 2vw, 40px)',
            background: 'rgba(228,238,240,0.02)',
            border: '0.77px solid rgba(255,255,255,0.2)',
            borderRadius: 'clamp(4px, 0.401vw, 7.7px)',
            padding: 'clamp(20px, 2.406vw, 46px)',
            boxSizing: 'border-box',
          }}>
            {/* Recommended package — data-editor-key added: this box was
                pure hardcoded text with no binding to any real card, so it
                showed this same generic "Website Refresh £999" example on
                every proposal regardless of client. combo.block5/6/7 are
                already correctly computed from the real recommended card
                (see page08Fields.ts's deriveComboBoxFields) — they just had
                nowhere in the DOM to land. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(8px, 0.802vw, 15px)', alignItems: 'center', flexShrink: 0 }}>
              <p data-editor-key="page08.block5" style={{
                fontFamily: FONT_GS,
                fontWeight: 500,
                fontSize: 'clamp(16px, 1.5625vw, 30px)',
                lineHeight: 1.5,
                color: WHITE,
                margin: 0,
                whiteSpace: 'nowrap',
              }}>
                Website Refresh
              </p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span data-editor-key="page08.block6" style={{
                  fontFamily: FONT_GS,
                  fontWeight: 600,
                  fontSize: 'clamp(28px, 2.604vw, 50px)',
                  color: ORANGE,
                  lineHeight: 1.5,
                }}>
                  £999
                </span>
                <span data-editor-key="page08.block7" style={{
                  fontFamily: FONT_GS,
                  fontWeight: 300,
                  fontSize: 'clamp(14px, 1.354vw, 26px)',
                  color: WHITE,
                  lineHeight: 1.5,
                  whiteSpace: 'nowrap',
                }}>
                  one-time
                </span>
              </div>
            </div>

            {/* + */}
            <p style={{
              fontFamily: FONT_GS,
              fontWeight: 300,
              fontSize: 'clamp(24px, 2.567vw, 49px)',
              lineHeight: 1.5,
              color: WHITE,
              margin: 0,
              flexShrink: 0,
            }}>
              +
            </p>

            {/* Complementary package — same data-editor-key fix as the recommended package above. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(8px, 0.802vw, 15px)', alignItems: 'center', flexShrink: 0 }}>
              <p data-editor-key="page08.block9" style={{
                fontFamily: FONT_GS,
                fontWeight: 500,
                fontSize: 'clamp(16px, 1.5625vw, 30px)',
                lineHeight: 1.5,
                color: WHITE,
                margin: 0,
                whiteSpace: 'nowrap',
              }}>
                Authority SEO
              </p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span data-editor-key="page08.block10" style={{
                  fontFamily: FONT_GS,
                  fontWeight: 600,
                  fontSize: 'clamp(28px, 2.604vw, 50px)',
                  color: ORANGE,
                  lineHeight: 1.5,
                }}>
                  £899
                </span>
                <span data-editor-key="page08.block11" style={{
                  fontFamily: FONT_GS,
                  fontWeight: 300,
                  fontSize: 'clamp(14px, 1.354vw, 26px)',
                  color: WHITE,
                  lineHeight: 1.5,
                  whiteSpace: 'nowrap',
                }}>
                  /month
                </span>
              </div>
            </div>

            {/* = */}
            <p style={{
              fontFamily: FONT_GS,
              fontWeight: 300,
              fontSize: 'clamp(24px, 2.567vw, 49px)',
              lineHeight: 1.5,
              color: WHITE,
              margin: 0,
              flexShrink: 0,
            }}>
              =
            </p>

            {/* Result text — flex-1 takes remaining width. Outcome/results
                lines ARE AI-generated (page08.outcomeLine/resultsLine —
                see prompts.ts), unlike the algorithmically-copied card
                fields above, but were equally missing their editor keys. */}
            <div style={{
              flex: '1 0 0',
              display: 'flex',
              flexDirection: 'column',
              gap: 'clamp(16px, 1.765vw, 34px)',
              minWidth: 0,
            }}>
              <p data-editor-key="page08.block13" style={{
                fontFamily: FONT_GS,
                fontWeight: 500,
                fontSize: 'clamp(16px, 1.5625vw, 30px)',
                lineHeight: 1.5,
                color: WHITE,
                margin: 0,
              }}>
                Maximum visibility across Bristol &amp; South West
              </p>
              <p data-editor-key="page08.block14" style={{
                fontFamily: FONT_GS,
                fontWeight: 300,
                fontSize: 'clamp(14px, 1.354vw, 26px)',
                lineHeight: 1.5,
                color: WHITE,
                margin: 0,
              }}>
                Expected within 60 to 90 days: more impressions, stronger rankings, more enquiries converting to revenue.
              </p>
            </div>
          </div>
        </div>
        </motion.div>
      </div>
    </div>
  )
}

// ─── Mobile (<768px) ──────────────────────────────────────────────────────────

function MobilePage08({ cards, pageNumber }: Required<ProposalPage08Props>) {
  return (
    <MobileWrapper>
      <ProposalBackground />
      <div className="relative z-10 flex flex-col w-full" style={{ padding: '24px 22px 48px' }}>

        {/* Page badge */}
        <div className="flex items-center justify-end" style={{ marginBottom: 20 }}>
          <PageNumber pageNumber={pageNumber} width="30px" />
        </div>

        {/* Heading */}
        <motion.h2
          style={{ fontFamily: FONT_CLASH, fontWeight: 600, fontSize: 'clamp(30px, 9vw, 48px)', lineHeight: 1.1, color: WHITE, margin: '0 0 10px' }}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          <motion.span data-editor-key="page08.heading">Your</motion.span> <span style={{ color: ORANGE }}>Investment.</span>
        </motion.h2>

        {/* Description */}
        <motion.p
          data-editor-key="page08.description"
          style={{ fontFamily: FONT_GS, fontWeight: 300, fontSize: 15, lineHeight: 1.5, color: WHITE, margin: '0 0 24px' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          Three ways to close the gap. We will tell you which one actually moves the needle.
        </motion.p>

        {/* Pricing cards stacked */}
        {cards.map((card, i) => (
          <motion.div
            key={card.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              background: 'rgba(228,238,240,0.02)',
              border: '0.77px solid rgba(255,255,255,0.2)',
              borderRadius: 8,
              padding: 20,
              marginBottom: 16,
              boxSizing: 'border-box',
            }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 + i * 0.1 }}
          >
            <p data-editor-key={`page08.card:${card.id}:title`} style={{ fontFamily: FONT_GS, fontWeight: 500, fontSize: 20, color: WHITE, margin: '0 0 4px', lineHeight: 1.4 }}>
              {card.title}
            </p>
            <p data-editor-key={`page08.card:${card.id}:price`} style={{ fontFamily: FONT_CLASH, fontWeight: 600, fontSize: 36, color: ORANGE, margin: 0, lineHeight: 1.1 }}>
              {card.price}
            </p>
            <p data-editor-key={`page08.card:${card.id}:priceSuffix`} style={{ fontFamily: FONT_GS, fontWeight: 300, fontSize: 15, color: WHITE, margin: '0 0 16px', lineHeight: 1.5 }}>
              {card.priceSuffix}
            </p>
            {card.whyRecommended && (
              <p data-editor-key={`page08.card:${card.id}:whyRecommended`} style={{ fontFamily: FONT_GS, fontWeight: 300, fontStyle: 'italic', fontSize: 13, lineHeight: 1.5, color: 'rgba(255,255,255,0.65)', margin: '0 0 16px' }}>
                {card.whyRecommended}
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: (card.expectedOutcome || card.roiNote || card.footerNote) ? 20 : 0 }}>
              {card.features.map((f, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <img src={tickIcon} alt="" aria-hidden draggable={false}
                    style={{ display: 'block', width: 20, height: 20, flexShrink: 0, marginTop: 2 }} />
                  <p data-editor-key={`page08.card:${card.id}:feature:${i}`} style={{ fontFamily: FONT_GS, fontWeight: 400, fontSize: 14, lineHeight: 1.5, color: WHITE, margin: 0 }}>
                    {f}
                  </p>
                </div>
              ))}
            </div>
            {card.expectedOutcome && (
              <div style={{ marginBottom: (card.roiNote || card.footerNote) ? 20 : 0 }}>
                <p style={{ fontFamily: FONT_GS, fontWeight: 500, fontSize: 11, letterSpacing: '0.03em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', margin: '0 0 8px' }}>
                  Expected Outcome
                </p>
                <p data-editor-key={`page08.card:${card.id}:expectedOutcome`} style={{ fontFamily: FONT_GS, fontWeight: 300, fontSize: 14, lineHeight: 1.5, color: WHITE, margin: 0 }}>
                  {card.expectedOutcome}
                </p>
              </div>
            )}
            {card.roiNote && (
              <div style={{ marginBottom: card.footerNote ? 20 : 0 }}>
                <p style={{ fontFamily: FONT_GS, fontWeight: 500, fontSize: 11, letterSpacing: '0.03em', textTransform: 'uppercase', color: ORANGE, margin: '0 0 8px' }}>
                  Estimated Value
                </p>
                <p data-editor-key={`page08.card:${card.id}:roiNote`} style={{ fontFamily: FONT_GS, fontWeight: 400, fontSize: 14, lineHeight: 1.5, color: WHITE, margin: 0 }}>
                  {card.roiNote}
                </p>
              </div>
            )}
            {card.footerNote && (
              <div style={{ background: '#E4EEF0', borderRadius: 6, padding: 18, boxSizing: 'border-box' }}>
                <p data-editor-key={`page08.card:${card.id}:footerNote`} style={{ fontFamily: FONT_GS, fontWeight: 500, fontSize: 14, lineHeight: 1.5, color: '#0D1A1F', margin: 0 }}>
                  {card.footerNote}
                </p>
              </div>
            )}
          </motion.div>
        ))}

        {/* Recommended Approach */}
        <motion.h3
          style={{ fontFamily: FONT_CLASH, fontWeight: 500, fontSize: 'clamp(24px, 7vw, 36px)', lineHeight: 1.1, color: WHITE, margin: '8px 0 10px' }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.55 }}
        >
          <motion.span data-editor-key="page08.recommendedHeading">Recommended</motion.span> <span style={{ color: ORANGE }}>Approach.</span>
        </motion.h3>

        <motion.p
          data-editor-key="page08.recommendedIntro"
          style={{ fontFamily: FONT_GS, fontWeight: 300, fontSize: 14, lineHeight: 1.5, color: WHITE, margin: '0 0 16px' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          A fast website and strong SEO only work as a system. Run them separately and you are optimising half a funnel.
          We recommend combining the Website Refresh with Local Authority SEO Growth so the foundation and the traffic
          strategy are built together from day one, not patched together after the fact.
        </motion.p>

        <motion.div
          style={{
            background: 'rgba(228,238,240,0.02)',
            border: '0.77px solid rgba(255,255,255,0.2)',
            borderRadius: 8,
            padding: 20,
            boxSizing: 'border-box',
          }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.65 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <div>
              <p data-editor-key="page08.block5" style={{ fontFamily: FONT_GS, fontWeight: 500, fontSize: 15, color: WHITE, margin: '0 0 2px' }}>Website Refresh</p>
              <span data-editor-key="page08.block6" style={{ fontFamily: FONT_GS, fontWeight: 600, fontSize: 28, color: ORANGE }}>£999</span>
              <span data-editor-key="page08.block7" style={{ fontFamily: FONT_GS, fontWeight: 300, fontSize: 13, color: WHITE, marginLeft: 4 }}>one-time</span>
            </div>
            <span style={{ fontFamily: FONT_GS, fontWeight: 300, fontSize: 28, color: WHITE }}>+</span>
            <div>
              <p data-editor-key="page08.block9" style={{ fontFamily: FONT_GS, fontWeight: 500, fontSize: 15, color: WHITE, margin: '0 0 2px' }}>Authority SEO</p>
              <span data-editor-key="page08.block10" style={{ fontFamily: FONT_GS, fontWeight: 600, fontSize: 28, color: ORANGE }}>£899</span>
              <span data-editor-key="page08.block11" style={{ fontFamily: FONT_GS, fontWeight: 300, fontSize: 13, color: WHITE, marginLeft: 4 }}>/month</span>
            </div>
          </div>
          <p data-editor-key="page08.block13" style={{ fontFamily: FONT_GS, fontWeight: 500, fontSize: 15, lineHeight: 1.5, color: WHITE, margin: '0 0 6px' }}>
            Maximum visibility across Bristol &amp; South West
          </p>
          <p data-editor-key="page08.block14" style={{ fontFamily: FONT_GS, fontWeight: 300, fontSize: 14, lineHeight: 1.5, color: WHITE, margin: 0 }}>
            Expected within 60 to 90 days: more impressions, stronger rankings, more enquiries converting to revenue.
          </p>
        </motion.div>
      </div>
    </MobileWrapper>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function ProposalPage08({ cards = DEFAULT_CARDS, pageNumber = 8 }: ProposalPage08Props) {
  const isDesktopTablet = useIsDesktopTablet()
  const [animKey, setAnimKey] = useState(0)
  useEffect(() => {
    setAnimKey(k => k + 1)
  }, [isDesktopTablet])

  return isDesktopTablet
    ? <DesktopTabletPage08 key={`dt-${animKey}`} cards={cards} pageNumber={pageNumber} />
    : <MobilePage08 key={`m-${animKey}`} cards={cards} pageNumber={pageNumber} />
}
