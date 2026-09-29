/**
 * ProposalPageInsightsGrowth — "The Opportunity Ahead" page.
 *
 * A premium, AI-generated Business Intelligence page inserted after Page 07
 * (see ProposalPageInsightsBusiness.tsx for the sibling page and the
 * standing pagination rationale in masterTemplate/index.ts). Covers Growth
 * & Missed Opportunities (card grid), Market Potential / Industry Trends /
 * Competitive Position (a real, web-research-grounded paragraph), and
 * Future Growth Potential — all grounded in real client intelligence data;
 * an empty section simply doesn't render.
 *
 * This page was originally built directly on top of Page04's frozen
 * template (repurposing its layout) — moved here so Page04 could be
 * restored exactly as the core design system defines it. Visual language
 * intentionally matches ProposalPageInsightsBusiness.tsx for consistency,
 * using Page04's own icon asset set.
 */

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ProposalBackground } from './ProposalBackground'
import { MobileWrapper } from './ProposalLayout'
import { PageNumber } from './ProposalLogo'
import icon01 from '../../src/assets/p04/icon-01.png'
import icon02 from '../../src/assets/p04/icon-02.png'
import icon03 from '../../src/assets/p04/icon-03.png'

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

// ─── Tokens ───────────────────────────────────────────────────────────────────

const FONT_CLASH = 'Clash Display, sans-serif'
const FONT_GS    = 'General Sans, sans-serif'
const WHITE      = '#FFFFFF'
const ORANGE     = '#FF5B04'

// Same card tokens as ProposalPageInsightsBusiness.tsx — kept consistent
// across both Business Intelligence pages.
const CARD_BG = 'rgba(228,238,240,0.02)'
const CARD_BORDER = '0.585px solid #FF5B04'
const CARD_PADDING = 'clamp(18px, 2.44vw, 46.83px)'
const CARD_GAP = 'clamp(12px, 1.52vw, 29.27px)'
const ICON_SIZE = 'clamp(32px, 2.74vw, 52.68px)'
const CARD_TITLE_STYLE = {
  fontFamily: FONT_GS, fontWeight: 500, fontSize: 'clamp(13px, 1.5625vw, 30px)',
  letterSpacing: '-0.3px', lineHeight: 1.5, color: WHITE, margin: 0,
} as const

// Page04's original 3-icon set, reused round-robin per opportunity card.
const OPPORTUNITY_ICONS = [icon01, icon02, icon03]

// ─── Public types ─────────────────────────────────────────────────────────────

export interface InsightsOpportunityCard {
  title: string
  description: string
}

export interface ProposalPageInsightsGrowthProps {
  growthOpportunities?: InsightsOpportunityCard[]
  marketIndustryPosition?: string
  futureGrowthPotential?: string
  pageNumber?: number
}

const DEFAULT_GROWTH_OPPORTUNITIES: InsightsOpportunityCard[] = []
// Rendered unconditionally (like page07.description) so these two scalar
// fields can be patched via the existing resolvedBlocks/patchPreviewDom
// text-replacement mechanism rather than needing to be threaded as explicit
// props in all four render call sites — growthOpportunities below is
// genuinely structured data and DOES need a real prop, same as Page07's cards.
const DEFAULT_MARKET_INDUSTRY_POSITION =
  'The market context, competitive landscape, and growth potential for this business.'
const DEFAULT_FUTURE_GROWTH_POTENTIAL =
  'Where this business could be in the next 12 to 24 months, with the right foundations in place.'

// ─── Shared sub-components ────────────────────────────────────────────────────

function IconCard({
  icon,
  title,
  full,
  delay,
  children,
}: {
  icon: string
  title: string
  full?: boolean
  delay: number
  children: React.ReactNode
}) {
  return (
    <motion.div
      style={{
        flex: full ? '1 1 100%' : '1 1 0',
        minWidth: full ? undefined : 'clamp(220px, 26vw, 340px)',
        background: CARD_BG,
        border: CARD_BORDER,
        padding: CARD_PADDING,
        display: 'flex',
        flexDirection: 'column',
        gap: CARD_GAP,
        boxSizing: 'border-box',
      }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
    >
      <img src={icon} alt="" aria-hidden draggable={false} style={{ width: ICON_SIZE, height: ICON_SIZE, objectFit: 'contain', flexShrink: 0 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(6px, 0.61vw, 11.71px)' }}>
        <p style={CARD_TITLE_STYLE}>{title}</p>
        {children}
      </div>
    </motion.div>
  )
}

function GrowthOpportunityCards({ cards }: { cards: InsightsOpportunityCard[] }) {
  if (cards.length === 0) return null
  return (
    <>
      {cards.map((card, i) => (
        <IconCard key={i} icon={OPPORTUNITY_ICONS[i % OPPORTUNITY_ICONS.length]} delay={0.25 + 0.08 * i} title={card.title}>
          <p data-editor-key={`insightsGrowth.opportunity${i}.description`} style={{
            fontFamily: FONT_GS, fontWeight: 300, fontSize: 'clamp(11px, 1.15vw, 22px)', lineHeight: 1.5, color: WHITE, opacity: 0.9, margin: 0,
          }}>
            {card.description}
          </p>
        </IconCard>
      ))}
    </>
  )
}

// ─── Desktop + Tablet (≥768px) ────────────────────────────────────────────────

function DesktopTabletInsightsGrowth({ growthOpportunities, marketIndustryPosition, futureGrowthPotential, pageNumber }: Required<ProposalPageInsightsGrowthProps>) {
  return (
    <div className="relative w-full" style={{ aspectRatio: '16 / 9' }}>
      <ProposalBackground />

      <div className="absolute" style={{ left: '90.625%', top: '8.33%' }}>
        <PageNumber pageNumber={pageNumber} width="clamp(30px, 4.69vw, 90px)" />
      </div>

      <div
        className="relative flex flex-col"
        style={{
          paddingLeft: '4.6875%',
          paddingRight: '4.6875%',
          paddingTop: '8.33%',
          paddingBottom: 'clamp(24px, 3vw, 58px)',
          gap: 'clamp(28px, 3.4vw, 66px)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <motion.h2
            style={{
              fontFamily: FONT_CLASH, fontWeight: 600, fontSize: 'clamp(36px, 3.75vw, 72px)',
              lineHeight: 1.1, color: WHITE, margin: 0,
            }}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
          >
            The Opportunity <span style={{ color: ORANGE }}>Ahead.</span>
          </motion.h2>

          <motion.p
            style={{
              fontFamily: FONT_GS, fontWeight: 300, fontSize: 'clamp(12px, 0.94vw, 18px)',
              lineHeight: 1.5, color: WHITE, opacity: 0.9, margin: 0,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.9 }}
            transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
          >
            Real signals, not a wishlist. Here's where the growth actually sits.
          </motion.p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(16px, 2vw, 38px)' }}>
          <GrowthOpportunityCards cards={growthOpportunities} />

          <IconCard icon={icon01} title="Market, Industry & Competitive Position." full delay={0.4}>
            <p data-editor-key="insightsGrowth.marketIndustryPosition" style={{
              fontFamily: FONT_GS, fontWeight: 300, fontSize: 'clamp(11px, 1.15vw, 22px)', lineHeight: 1.5, color: WHITE, opacity: 0.9, margin: 0,
            }}>
              {marketIndustryPosition}
            </p>
          </IconCard>

          <IconCard icon={icon02} title="Future Growth Potential." full delay={0.5}>
            <p data-editor-key="insightsGrowth.futureGrowthPotential" style={{
              fontFamily: FONT_GS, fontWeight: 300, fontSize: 'clamp(11px, 1.15vw, 22px)', lineHeight: 1.5, color: WHITE, opacity: 0.9, margin: 0,
            }}>
              {futureGrowthPotential}
            </p>
          </IconCard>
        </div>
      </div>
    </div>
  )
}

// ─── Mobile (<768px) ──────────────────────────────────────────────────────────

function MobileIconCard({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: CARD_BG, border: CARD_BORDER, padding: 20,
      display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16, boxSizing: 'border-box',
    }}>
      <img src={icon} alt="" aria-hidden draggable={false} style={{ width: 44, height: 44, objectFit: 'contain', flexShrink: 0 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{ fontFamily: FONT_GS, fontWeight: 500, fontSize: 16, lineHeight: 1.4, color: WHITE, margin: 0 }}>{title}</p>
        {children}
      </div>
    </div>
  )
}

function MobileGrowthOpportunityCards({ cards }: { cards: InsightsOpportunityCard[] }) {
  if (cards.length === 0) return null
  return (
    <>
      {cards.map((card, i) => (
        <MobileIconCard key={i} icon={OPPORTUNITY_ICONS[i % OPPORTUNITY_ICONS.length]} title={card.title}>
          <p data-editor-key={`insightsGrowth.opportunity${i}.description`} style={{ fontFamily: FONT_GS, fontWeight: 300, fontSize: 14, lineHeight: 1.5, color: WHITE, opacity: 0.9, margin: 0 }}>
            {card.description}
          </p>
        </MobileIconCard>
      ))}
    </>
  )
}

function MobileInsightsGrowth({ growthOpportunities, marketIndustryPosition, futureGrowthPotential, pageNumber }: Required<ProposalPageInsightsGrowthProps>) {
  return (
    <MobileWrapper>
      <ProposalBackground />
      <div className="relative z-10 flex flex-col w-full" style={{ minHeight: '100dvh', padding: '24px 22px 48px' }}>
        <div className="flex items-center justify-end" style={{ marginBottom: 20 }}>
          <PageNumber pageNumber={pageNumber} width="30px" />
        </div>

        <motion.h2
          style={{ fontFamily: FONT_CLASH, fontWeight: 600, fontSize: 'clamp(30px, 9vw, 48px)', lineHeight: 1.1, color: WHITE, margin: '0 0 10px' }}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          The Opportunity <span style={{ color: ORANGE }}>Ahead.</span>
        </motion.h2>

        <motion.p
          style={{ fontFamily: FONT_GS, fontWeight: 300, fontSize: 15, lineHeight: 1.5, color: WHITE, opacity: 0.9, margin: '0 0 20px' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.9 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          Real signals, not a wishlist. Here's where the growth actually sits.
        </motion.p>

        <MobileGrowthOpportunityCards cards={growthOpportunities} />

        <MobileIconCard icon={icon01} title="Market, Industry & Competitive Position.">
          <p data-editor-key="insightsGrowth.marketIndustryPosition" style={{ fontFamily: FONT_GS, fontWeight: 300, fontSize: 14, lineHeight: 1.5, color: WHITE, opacity: 0.9, margin: 0 }}>
            {marketIndustryPosition}
          </p>
        </MobileIconCard>

        <MobileIconCard icon={icon02} title="Future Growth Potential.">
          <p data-editor-key="insightsGrowth.futureGrowthPotential" style={{ fontFamily: FONT_GS, fontWeight: 300, fontSize: 14, lineHeight: 1.5, color: WHITE, opacity: 0.9, margin: 0 }}>
            {futureGrowthPotential}
          </p>
        </MobileIconCard>
      </div>
    </MobileWrapper>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function ProposalPageInsightsGrowth({
  growthOpportunities = DEFAULT_GROWTH_OPPORTUNITIES,
  marketIndustryPosition = DEFAULT_MARKET_INDUSTRY_POSITION,
  futureGrowthPotential = DEFAULT_FUTURE_GROWTH_POTENTIAL,
  pageNumber = 9,
}: ProposalPageInsightsGrowthProps) {
  const isDesktopTablet = useIsDesktopTablet()
  const [animKey, setAnimKey] = useState(0)
  useEffect(() => {
    setAnimKey(k => k + 1)
  }, [isDesktopTablet])

  return isDesktopTablet
    ? <DesktopTabletInsightsGrowth key={`dt-${animKey}`} growthOpportunities={growthOpportunities} marketIndustryPosition={marketIndustryPosition} futureGrowthPotential={futureGrowthPotential} pageNumber={pageNumber} />
    : <MobileInsightsGrowth key={`m-${animKey}`} growthOpportunities={growthOpportunities} marketIndustryPosition={marketIndustryPosition} futureGrowthPotential={futureGrowthPotential} pageNumber={pageNumber} />
}
