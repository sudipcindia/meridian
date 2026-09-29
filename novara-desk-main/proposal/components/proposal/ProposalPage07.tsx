/**
 * ProposalPage07 — "Your Custom Proposal" page.
 * Figma source: node 4836:139 (1920×1366 frame; slide canvas 1920×1080).
 *
 * Five sections:
 *  1. Heading: "Your Custom Proposal, [Client First Name]" + page badge
 *  2. Description sub-text
 *  3. Proposal meta: service type, client fields, "Where You Stand" body
 *  4. Keywords: demand search terms rendered as chips
 *  5. Bottom funnel banner: Increase visibility → enquiries → contracts
 */

import { useEffect, useState, Fragment } from 'react'
import { motion } from 'framer-motion'
import { ProposalBackground } from './ProposalBackground'
import { MobileWrapper } from './ProposalLayout'
import { PageNumber } from './ProposalLogo'
import {
  FONT_CLASH, FONT_GS, WHITE, ORANGE, DARK, TEAL, SEGMENT_COLORS,
  BannerArrow, renderEnrichmentBlockDesktop, renderEnrichmentBlockMobile,
  type Page07Stat, type Page07RoadmapStep, type Page07OpportunityCard, type Page07BlockLayout,
  type Page07ComparisonBar, type Page07FunnelStage, type Page07StackedBarSegment, type Page07TreemapItem,
  type Page07EnrichmentBlock, type Page07Enrichment,
} from './blocks/enrichmentBlockRenderers'

// Re-exported for backward compatibility — these types/tokens now live in
// blocks/enrichmentBlockRenderers.tsx (shared with ProposalPageDynamicInsight)
// but this remains the canonical place other files import them from.
export {
  FONT_CLASH, FONT_GS, WHITE, ORANGE, DARK, TEAL, SEGMENT_COLORS,
  type Page07Stat, type Page07RoadmapStep, type Page07OpportunityCard, type Page07BlockLayout,
  type Page07ComparisonBar, type Page07FunnelStage, type Page07StackedBarSegment, type Page07TreemapItem,
  type Page07EnrichmentBlock, type Page07Enrichment,
}

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
// FONT_CLASH/FONT_GS/WHITE/ORANGE/DARK/TEAL/SEGMENT_COLORS now imported from
// blocks/enrichmentBlockRenderers.tsx (single source of truth, shared with
// ProposalPageDynamicInsight) — TAG_BG stays here, it's Page07-specific
// (keyword chip background).

const TAG_BG = '#E4EEF0'

// ─── Public types ─────────────────────────────────────────────────────────────
// Page07Stat/RoadmapStep/OpportunityCard/BlockLayout/ComparisonBar/
// FunnelStage/StackedBarSegment/TreemapItem/EnrichmentBlock/Enrichment now
// imported (and re-exported above) from blocks/enrichmentBlockRenderers.tsx.

/** One real package's share of the total investment — always computed live from the actual Page 08 cards (see deriveInvestmentSplit in modules/variables/page08Fields.ts), never AI-generated, so it can never drift out of sync with whatever pricing is actually shown on Page 08. */
export interface Page07InvestmentSegment {
  id: string
  title: string
  price: string
  percent: number
}

export interface ProposalPage07Props {
  /** Demand search-term chips — variable length, Builder-editable (add/remove/reorder/duplicate). */
  keywords?: string[]
  enrichment?: Page07Enrichment
  /** Omitted/short (<2 segments) renders nothing — a single-package proposal has nothing to split. */
  investmentSplit?: Page07InvestmentSegment[]
  pageNumber?: number
  /** Who this proposal represents as the provider/brand — see ProposalPage10's identical prop for the full rationale. Only affects the "With Novara"/"With Jayson" comparison-chart legend label here; defaults to 'novara' so every existing render is unchanged. */
  providerIdentity?: 'novara' | 'upwork'
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const DEFAULT_KEYWORDS = [
  'Security company Bristol',
  'Event security Bristol',
  'Static guarding Bristol',
  'Security company Bath',
  'Security company Weston-super-Mare',
  'Security company South Gloucestershire',
  'Security company North Somerset',
]

const FUNNEL_STEPS = ['Increase visibility', 'Increase enquiries', 'Increase contracts.']

const DEFAULT_ENRICHMENT: Page07Enrichment = { blocks: [] }

const DEFAULT_INVESTMENT_SPLIT: Page07InvestmentSegment[] = []

// ─── Enrichment blocks (desktop/tablet) ───────────────────────────────────────
// One of these renders between "Where You Stand Right Now." and the demand
// keywords, chosen per-client by the AI based on what the intelligence data
// actually supports — never all four, never invented data. Rendering itself
// (all 8 layouts, BannerArrow, etc.) lives in blocks/enrichmentBlockRenderers.tsx,
// shared with ProposalPageDynamicInsight — this is just the thin wrapper that
// stacks Page07's own 0-2 blocks with this page's spacing/animation.

function EnrichmentBlock({ enrichment, providerIdentity }: { enrichment: Page07Enrichment; providerIdentity: 'novara' | 'upwork' }) {
  if (enrichment.blocks.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(28px, 3.2vw, 62px)' }}>
      {enrichment.blocks.map((block, i) => (
        <motion.div
          key={i}
          style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(8px, 0.96vw, 18px)' }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 + i * 0.1, ease: 'easeOut' }}
        >
          {renderEnrichmentBlockDesktop(block, `page07.enrichment.b${i}`, providerIdentity)}
        </motion.div>
      ))}
    </div>
  )
}

// ─── Investment split donut (desktop) ─────────────────────────────────────────
// Always shown (independent of the AI-selected enrichment block above) when
// 2+ real Page 08 packages exist — deterministic, computed from live pricing,
// so unlike everything else on this page it is never AI-authored text.

function InvestmentSplitDonut({ segments }: { segments: Page07InvestmentSegment[] }) {
  if (segments.length < 2) return null
  const size = 180
  const strokeWidth = 26
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  let cumulative = 0

  return (
    <motion.div
      style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(14px, 1.6vw, 30px)' }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.32, ease: 'easeOut' }}
    >
      <p style={{
        fontFamily: FONT_GS, fontWeight: 500, fontSize: 'clamp(15px, 1.5625vw, 30px)',
        lineHeight: 1.5, letterSpacing: '-0.3px', color: WHITE, margin: 0,
      }}>
        Where Your Investment Goes.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(24px, 2.8vw, 54px)', flexWrap: 'wrap' }}>
        <svg viewBox={`0 0 ${size} ${size}`} style={{ width: 'clamp(120px, 10.4vw, 200px)', height: 'auto', flexShrink: 0, transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth} />
          {segments.map((seg, i) => {
            const len = (seg.percent / 100) * circumference
            const dashOffset = -cumulative
            cumulative += len
            return (
              <circle
                key={seg.id}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={SEGMENT_COLORS[i % SEGMENT_COLORS.length]}
                strokeWidth={strokeWidth}
                strokeDasharray={`${len} ${circumference - len}`}
                strokeDashoffset={dashOffset}
              />
            )
          })}
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(10px, 1.1vw, 20px)' }}>
          {segments.map((seg, i) => (
            <div key={seg.id} style={{ display: 'flex', alignItems: 'center', gap: 'clamp(8px, 0.9vw, 16px)' }}>
              <span style={{
                width: 'clamp(9px, 0.8vw, 14px)', height: 'clamp(9px, 0.8vw, 14px)', borderRadius: '50%',
                background: SEGMENT_COLORS[i % SEGMENT_COLORS.length], flexShrink: 0,
              }} />
              <span style={{ fontFamily: FONT_GS, fontWeight: 500, fontSize: 'clamp(13px, 1.25vw, 24px)', color: WHITE }}>
                {seg.title}
              </span>
              <span style={{ fontFamily: FONT_GS, fontWeight: 400, fontSize: 'clamp(12px, 1.1vw, 21px)', color: 'rgba(255,255,255,0.5)' }}>
                {seg.percent}% · {seg.price}
              </span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Desktop + Tablet (≥768px) ────────────────────────────────────────────────

function DesktopTabletPage07({ keywords, enrichment, investmentSplit, pageNumber, providerIdentity }: Required<ProposalPage07Props>) {
  return (
    // aspectRatio behaves as a MINIMUM here now that overflow is no longer
    // hidden and every section below is in normal flow: it sets the page's
    // natural height for typical content, but a section that genuinely needs
    // more room grows the box taller instead of being clipped.
    <div className="relative w-full" style={{ aspectRatio: '1920 / 1366' }}>
      <ProposalBackground />

      {/* Page number badge — decorative chrome, stays pinned to its own corner regardless of page height */}
      <div className="absolute" style={{ left: '90.625%', top: '6.59%' }}>
        <PageNumber pageNumber={pageNumber} width="clamp(30px, 4.427vw, 85px)" />
      </div>

      {/* Content stack — all 5 sections below used to be independently
          absolute-positioned at hardcoded percentage offsets of the frame's
          fixed 1366px height. Now a normal flex-column so each section
          starts wherever the previous one's real rendered height ends,
          instead of a fixed slot that clips or overlaps. */}
      <div
        className="relative flex flex-col"
        style={{
          paddingLeft: '4.6875%',
          paddingRight: '4.6875%',
          paddingTop: '6.59%',
          paddingBottom: 'clamp(24px, 3vw, 58px)',
          gap: 'clamp(32px, 4vw, 77px)',
        }}
      >
        {/* Heading: "Your Custom Proposal, [Client First Name]" */}
        <motion.h2
          style={{
            fontFamily: FONT_CLASH,
            fontWeight: 600,
            fontSize: 'clamp(28px, 3.75vw, 72px)',
            lineHeight: 1.1,
            color: WHITE,
            margin: 0,
          }}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
        >
          <motion.span data-editor-key="page07.heading">Your Custom Proposal,</motion.span>{' '}
          <span data-editor-key="page07.clientFirstNameHeading" style={{ color: ORANGE }}>[Client First Name]</span>
        </motion.h2>

        {/* Description */}
        <motion.p
          data-editor-key="page07.description"
          style={{
            fontFamily: FONT_GS,
            fontWeight: 300,
            fontSize: 'clamp(13px, 1.25vw, 24px)',
            lineHeight: 1.5,
            color: WHITE,
            margin: 0,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
        >
          Built around your pipeline, not a template. Here is exactly where revenue is leaking and how we close it.
        </motion.p>

        {/* ── Main content: service type + client fields + "Where You Stand" ── */}
        <motion.div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'clamp(20px, 2.4vw, 46px)',
          }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
        >
        {/* Service type + client fields */}
        {/* Figma: node 4836:314, GS Medium 30px + GS Light/Regular 24px, gap=30px / 15px */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(14px, 1.6vw, 31px)' }}>
          <p style={{
            fontFamily: FONT_GS,
            fontWeight: 500,
            fontSize: 'clamp(15px, 1.5625vw, 30px)',
            lineHeight: 1.5,
            letterSpacing: '-0.3px',
            color: WHITE,
            margin: 0,
          }}>
            SEO &amp; Website Growth Proposal
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(6px, 0.8vw, 15px)' }}>
            {[
              ['Prepared for:', '[Client Name]', 'page07.clientNameValue'],
              ['Business:', '[Business Name]', 'page07.businessNameValue'],
              ['Website:', '[Website Link]', 'page07.websiteLinkValue'],
            ].map(([label, value, editorKey]) => (
              <p key={label} style={{
                fontFamily: FONT_GS,
                fontWeight: 500,
                fontSize: 'clamp(13px, 1.25vw, 24px)',
                lineHeight: 1.5,
                color: WHITE,
                margin: 0,
              }}>
                {label}{' '}
                <span data-editor-key={editorKey} style={{ fontWeight: 400, color: ORANGE }}>{value}</span>
              </p>
            ))}
          </div>
        </div>

        {/* "Where You Stand Right Now." */}
        {/* Figma: node 4836:320, GS Medium 30px heading + GS Light 24px body, gap=18px */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(8px, 0.96vw, 18px)' }}>
          <p style={{
            fontFamily: FONT_GS,
            fontWeight: 500,
            fontSize: 'clamp(15px, 1.5625vw, 30px)',
            lineHeight: 1.5,
            letterSpacing: '-0.3px',
            color: WHITE,
            margin: 0,
          }}>
            Where You Stand Right Now.
          </p>
          <div style={{
            fontFamily: FONT_GS,
            fontWeight: 300,
            fontSize: 'clamp(13px, 1.25vw, 24px)',
            lineHeight: 1.5,
            color: WHITE,
          }}>
            <p style={{ margin: '0 0 1.5em' }}>
              [Business Name] has the demand. What it does not have is a system built to capture all of it.
              Right now revenue is sitting on the table because the website, the funnel, or the search presence is not pulling its weight.
            </p>
            <p style={{ margin: 0 }}>
              When buyers search for [service type] in [location], they go with whoever shows up first and converts fastest.
              That is the gap this proposal closes.
            </p>
          </div>
        </div>
      </motion.div>

        <EnrichmentBlock enrichment={enrichment} providerIdentity={providerIdentity} />

        {/* ── Keywords section ── */}
        <motion.div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'clamp(8px, 0.96vw, 18px)',
          }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease: 'easeOut' }}
        >
        <p style={{
          fontFamily: FONT_GS,
          fontWeight: 500,
          fontSize: 'clamp(15px, 1.5625vw, 30px)',
          lineHeight: 1.5,
          letterSpacing: '-0.3px',
          color: WHITE,
          margin: 0,
        }}>
          The demand already exists. Here is where it is searching:
        </p>

        {/* Keyword chips */}
        {/* Figma: bg=#E4EEF0, border rgba(255,255,255,0.2), rounded=7.692px, p=16px, GS Medium 24px dark */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(10px, 1.2vw, 23px)' }}>
          {keywords.map((kw, i) => (
            <div
              key={i}
              style={{
                background: TAG_BG,
                border: '0.769px solid rgba(255,255,255,0.2)',
                borderRadius: 'clamp(4px, 0.4vw, 8px)',
                padding: 'clamp(8px, 0.833vw, 16px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                // Was a hard nowrap pill — a real location-qualified keyword
                // phrase ("commercial property developers Manchester")
                // needs more than one short-word's width. Wraps to at most
                // two lines instead of being truncated to fit one.
                maxWidth: 'clamp(160px, 15vw, 290px)',
              }}
            >
              <span data-editor-key={`page07.keyword${i}`} style={{
                fontFamily: FONT_GS,
                fontWeight: 500,
                fontSize: 'clamp(13px, 1.25vw, 24px)',
                lineHeight: 1.5,
                color: DARK,
                whiteSpace: 'normal',
                textAlign: 'center',
              }}>
                {kw}
              </span>
            </div>
          ))}
        </div>
      </motion.div>

        <InvestmentSplitDonut segments={investmentSplit} />

        {/* ── Bottom funnel banner ── */}
        {/* bg=rgba(228,238,240,0.02), border rgba(255,255,255,0.2), rounded=7.692px, p=23px, gap=38px */}
        <motion.div
          className="flex items-center justify-center"
          style={{
            background: 'rgba(228,238,240,0.02)',
            border: '0.769px solid rgba(255,255,255,0.2)',
            borderRadius: 'clamp(4px, 0.4vw, 8px)',
            padding: 'clamp(12px, 1.2vw, 23px)',
            gap: 'clamp(16px, 2vw, 38px)',
            boxSizing: 'border-box',
          }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45, ease: 'easeOut' }}
        >
          {FUNNEL_STEPS.map((item, i) => (
            <Fragment key={item}>
              {i > 0 && <BannerArrow />}
              <span
                data-editor-key={`page07.funnelStep${i}`}
                style={{
                  fontFamily: FONT_GS,
                  fontWeight: 500,
                  fontSize: 'clamp(13px, 1.354vw, 26px)',
                  lineHeight: 1.5,
                  letterSpacing: '-0.26px',
                  color: ORANGE,
                  whiteSpace: 'nowrap',
                }}
              >
                {item}
              </span>
            </Fragment>
          ))}
        </motion.div>
      </div>
    </div>
  )
}

// ─── Enrichment blocks (mobile) ────────────────────────────────────────────────
// Same rationale as the desktop wrapper above — rendering lives in
// blocks/enrichmentBlockRenderers.tsx (fixed px sizing to match this page's
// existing mobile convention), this is just Page07's own stacking/spacing.

function MobileEnrichmentBlock({ enrichment, providerIdentity }: { enrichment: Page07Enrichment; providerIdentity: 'novara' | 'upwork' }) {
  if (enrichment.blocks.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, marginBottom: 24 }}>
      {enrichment.blocks.map((block, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.32 + i * 0.08 }}
        >
          {renderEnrichmentBlockMobile(block, `page07.enrichment.b${i}`, providerIdentity)}
        </motion.div>
      ))}
    </div>
  )
}

// ─── Investment split donut (mobile) ──────────────────────────────────────────

function MobileInvestmentSplitDonut({ segments }: { segments: Page07InvestmentSegment[] }) {
  if (segments.length < 2) return null
  const size = 140
  const strokeWidth = 20
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  let cumulative = 0

  return (
    <motion.div
      style={{ marginBottom: 24 }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.34 }}
    >
      <p style={{ fontFamily: FONT_GS, fontWeight: 500, fontSize: 17, lineHeight: 1.5, letterSpacing: '-0.3px', color: WHITE, margin: '0 0 14px' }}>
        Where Your Investment Goes.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <svg viewBox={`0 0 ${size} ${size}`} style={{ width: 100, height: 100, flexShrink: 0, transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth} />
          {segments.map((seg, i) => {
            const len = (seg.percent / 100) * circumference
            const dashOffset = -cumulative
            cumulative += len
            return (
              <circle
                key={seg.id}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={SEGMENT_COLORS[i % SEGMENT_COLORS.length]}
                strokeWidth={strokeWidth}
                strokeDasharray={`${len} ${circumference - len}`}
                strokeDashoffset={dashOffset}
              />
            )
          })}
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {segments.map((seg, i) => (
            <div key={seg.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: SEGMENT_COLORS[i % SEGMENT_COLORS.length], flexShrink: 0 }} />
              <span style={{ fontFamily: FONT_GS, fontWeight: 500, fontSize: 13, color: WHITE }}>{seg.title}</span>
              <span style={{ fontFamily: FONT_GS, fontWeight: 400, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{seg.percent}% · {seg.price}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Mobile (<768px) ──────────────────────────────────────────────────────────

function MobilePage07({ keywords, enrichment, investmentSplit, pageNumber, providerIdentity }: Required<ProposalPage07Props>) {
  return (
    <MobileWrapper>
      <ProposalBackground />
      <div
        className="relative z-10 flex flex-col w-full"
        style={{ padding: '24px 22px 48px' }}
      >
        {/* Page number */}
        <div className="flex items-center justify-end" style={{ marginBottom: 20 }}>
          <PageNumber pageNumber={pageNumber} width="30px" />
        </div>

        {/* Heading */}
        <motion.h2
          style={{
            fontFamily: FONT_CLASH,
            fontWeight: 600,
            fontSize: 'clamp(26px, 8vw, 42px)',
            lineHeight: 1.1,
            color: WHITE,
            margin: '0 0 12px',
          }}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          <motion.span data-editor-key="page07.heading">Your Custom Proposal,</motion.span>{' '}
          <span data-editor-key="page07.clientFirstNameHeading" style={{ color: ORANGE }}>[Client First Name]</span>
        </motion.h2>

        {/* Description */}
        <motion.p
          data-editor-key="page07.description"
          style={{
            fontFamily: FONT_GS,
            fontWeight: 300,
            fontSize: 15,
            lineHeight: 1.5,
            color: WHITE,
            margin: '0 0 24px',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          Built around your pipeline, not a template. Here is exactly where revenue is leaking and how we close it.
        </motion.p>

        {/* Service type + client fields */}
        <motion.div
          style={{ marginBottom: 24 }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
        >
          <p style={{
            fontFamily: FONT_GS, fontWeight: 500, fontSize: 17,
            lineHeight: 1.5, letterSpacing: '-0.3px', color: WHITE, margin: '0 0 12px',
          }}>
            SEO &amp; Website Growth Proposal
          </p>
          {[
            ['Prepared for:', '[Client Name]', 'page07.clientNameValue'],
            ['Business:', '[Business Name]', 'page07.businessNameValue'],
            ['Website:', '[Website Link]', 'page07.websiteLinkValue'],
          ].map(([label, value, editorKey]) => (
            <p key={label} style={{
              fontFamily: FONT_GS, fontWeight: 500, fontSize: 15,
              lineHeight: 1.5, color: WHITE, margin: '0 0 6px',
            }}>
              {label} <span data-editor-key={editorKey} style={{ fontWeight: 400, color: ORANGE }}>{value}</span>
            </p>
          ))}
        </motion.div>

        {/* Where you stand */}
        <motion.div
          style={{ marginBottom: 28 }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <p style={{
            fontFamily: FONT_GS, fontWeight: 500, fontSize: 17,
            lineHeight: 1.5, letterSpacing: '-0.3px', color: WHITE, margin: '0 0 10px',
          }}>
            Where You Stand Right Now.
          </p>
          <p style={{ fontFamily: FONT_GS, fontWeight: 300, fontSize: 15, lineHeight: 1.5, color: WHITE, margin: '0 0 12px' }}>
            [Business Name] has the demand. What it does not have is a system built to capture all of it.
            Right now revenue is sitting on the table because the website, the funnel, or the search presence is not pulling its weight.
          </p>
          <p style={{ fontFamily: FONT_GS, fontWeight: 300, fontSize: 15, lineHeight: 1.5, color: WHITE, margin: 0 }}>
            When buyers search for [service type] in [location], they go with whoever shows up first and converts fastest.
            That is the gap this proposal closes.
          </p>
        </motion.div>

        <MobileEnrichmentBlock enrichment={enrichment} providerIdentity={providerIdentity} />

        {/* Keywords */}
        <motion.div
          style={{ marginBottom: 24 }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35 }}
        >
          <p style={{
            fontFamily: FONT_GS, fontWeight: 500, fontSize: 17,
            lineHeight: 1.5, letterSpacing: '-0.3px', color: WHITE, margin: '0 0 12px',
          }}>
            The demand already exists. Here is where it is searching:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {keywords.map((kw, i) => (
              <div
                key={i}
                style={{
                  background: TAG_BG,
                  border: '0.769px solid rgba(255,255,255,0.2)',
                  borderRadius: 6,
                  padding: '8px 12px',
                }}
              >
                <span data-editor-key={`page07.keyword${i}`} style={{
                  fontFamily: FONT_GS, fontWeight: 500, fontSize: 13,
                  lineHeight: 1.5, color: DARK,
                }}>
                  {kw}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        <MobileInvestmentSplitDonut segments={investmentSplit} />

        {/* Bottom funnel banner */}
        <motion.div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px 16px',
            background: 'rgba(228,238,240,0.02)',
            border: '0.769px solid rgba(255,255,255,0.2)',
            borderRadius: 8,
            padding: '16px 12px',
          }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          {FUNNEL_STEPS.map((item, i) => (
            <Fragment key={item}>
              {i > 0 && (
                <span style={{ fontFamily: FONT_GS, fontWeight: 500, fontSize: 13, color: ORANGE }}>→</span>
              )}
              <span data-editor-key={`page07.funnelStep${i}`} style={{ fontFamily: FONT_GS, fontWeight: 500, fontSize: 14, lineHeight: 1.5, color: ORANGE, whiteSpace: 'nowrap' }}>
                {item}
              </span>
            </Fragment>
          ))}
        </motion.div>
      </div>
    </MobileWrapper>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function ProposalPage07({
  keywords = DEFAULT_KEYWORDS,
  enrichment = DEFAULT_ENRICHMENT,
  investmentSplit = DEFAULT_INVESTMENT_SPLIT,
  pageNumber = 7,
  providerIdentity = 'novara',
}: ProposalPage07Props) {
  const isDesktopTablet = useIsDesktopTablet()
  const [animKey, setAnimKey] = useState(0)
  useEffect(() => {
    setAnimKey(k => k + 1)
  }, [isDesktopTablet])

  return isDesktopTablet
    ? <DesktopTabletPage07 key={`dt-${animKey}`} keywords={keywords} enrichment={enrichment} investmentSplit={investmentSplit} pageNumber={pageNumber} providerIdentity={providerIdentity} />
    : <MobilePage07 key={`m-${animKey}`} keywords={keywords} enrichment={enrichment} investmentSplit={investmentSplit} pageNumber={pageNumber} providerIdentity={providerIdentity} />
}
