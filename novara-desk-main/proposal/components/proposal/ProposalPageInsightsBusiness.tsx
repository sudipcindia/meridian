/**
 * ProposalPageInsightsBusiness — "Where You Stand Today" page.
 *
 * A premium, AI-generated Business Intelligence page inserted after Page 07
 * (never squeezed into the frozen core template pages — see the standing
 * pagination requirement in masterTemplate/index.ts). Covers Business
 * Overview, Current Position & Digital Maturity (a radar/spider chart,
 * current vs. "With Novara" — deliberately not a progress bar, since
 * Page07's own AI-selected enrichment can independently land on a
 * "comparisonBars" layout for similar dimension data; two bar charts back
 * to back would read as duplicated content), and a Strengths/Weaknesses/
 * Risks grid — all grounded in real client intelligence data (transcript +
 * questionnaire + research); never fabricated. An empty section simply
 * doesn't render.
 *
 * This page was originally built directly on top of Page03's frozen
 * template (repurposing its layout) — moved here so Page03 could be
 * restored exactly as the core design system defines it. Visual language
 * (icon-badge, orange-bordered cards) intentionally reuses the same
 * ICON_SIZE/CARD_* tokens as the original template pages for brand
 * consistency, using Page03's own icon asset set.
 */

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ProposalBackground } from './ProposalBackground'
import { MobileWrapper } from './ProposalLayout'
import { PageNumber } from './ProposalLogo'
import icon01 from '../../src/assets/p03/icon-01.png'
import icon02 from '../../src/assets/p03/icon-02.png'
import icon03 from '../../src/assets/p03/icon-03.png'
import icon04 from '../../src/assets/p03/icon-04.png'
import icon05 from '../../src/assets/p03/icon-05.png'

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
const TEAL       = '#0FAFBC'

// Same card tokens as the frozen template's own icon-card pages (Page03/04's
// original design language) — kept visually consistent even though this page
// itself is not part of the frozen roster.
const CARD_BG = 'rgba(228,238,240,0.02)'
const CARD_BORDER = '0.585px solid #FF5B04'
const CARD_PADDING = 'clamp(18px, 2.44vw, 46.83px)'
const CARD_GAP = 'clamp(12px, 1.52vw, 29.27px)'
const ICON_SIZE = 'clamp(32px, 2.74vw, 52.68px)'
const CARD_TITLE_STYLE = {
  fontFamily: FONT_GS, fontWeight: 500, fontSize: 'clamp(13px, 1.5625vw, 30px)',
  letterSpacing: '-0.3px', lineHeight: 1.5, color: WHITE, margin: 0,
} as const

// ─── Public types ─────────────────────────────────────────────────────────────

export interface InsightsPositionDimension {
  label: string
  currentScore: number
  targetScore: number
}

export interface InsightsSwot {
  strengths: string[]
  weaknesses: string[]
  risks: string[]
}

export interface ProposalPageInsightsBusinessProps {
  businessOverview?: string
  currentPosition?: InsightsPositionDimension[]
  swot?: InsightsSwot
  pageNumber?: number
  /** Who this proposal represents as the provider/brand — see ProposalPage10's identical prop for the full rationale. Only affects the "With Novara"/"With Jayson" radar-chart legend label here; defaults to 'novara' so every existing render is unchanged. */
  providerIdentity?: 'novara' | 'upwork'
}

const DEFAULT_CURRENT_POSITION: InsightsPositionDimension[] = []
const DEFAULT_SWOT: InsightsSwot = { strengths: [], weaknesses: [], risks: [] }
// Rendered unconditionally (like page07.description) so this scalar field can
// be patched via the existing resolvedBlocks/patchPreviewDom text-replacement
// mechanism rather than needing to be threaded as an explicit prop in all
// four render call sites — currentPosition/swot below are genuinely
// structured data and DO need real props, same as Page07's cards/enrichment.
const DEFAULT_BUSINESS_OVERVIEW =
  "A closer look at where this business stands today — before we talk about where it's going."

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

// Greedy word-wrap into short lines — used for radar axis labels, which are
// full phrases (up to insightsBusiness.currentPositionLabel's 40-char
// budget) that would otherwise overrun a single SVG <text> line (SVG text
// never wraps on its own). No line cap here — silently truncating a label
// (e.g. dropping a trailing word) is worse than one extra wrapped line.
function wrapLabel(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= maxCharsPerLine) {
      current = candidate
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

/**
 * Radar/spider chart — deliberately NOT a progress bar. Page07's own
 * AI-selected enrichment can independently choose a "comparisonBars"
 * layout (also a current-vs-target bar chart) for the same kind of
 * dimension data; if this page also rendered bars, the two pages would
 * routinely look identical back to back. A radar chart reads as a genuine
 * "maturity assessment across dimensions" visual — the standard
 * consultancy way to show this exact shape of data — and can never
 * collide with whatever Page07 happens to pick.
 */
function RadarChart({ dimensions, size = 340 }: { dimensions: InsightsPositionDimension[]; size?: number }) {
  const n = dimensions.length
  const center = size / 2
  const maxRadius = size * 0.32
  const angleStep = (2 * Math.PI) / n
  const angleFor = (i: number) => -Math.PI / 2 + i * angleStep
  const pointFor = (i: number, value: number): [number, number] => {
    const r = (Math.max(0, Math.min(10, value)) / 10) * maxRadius
    const a = angleFor(i)
    return [center + r * Math.cos(a), center + r * Math.sin(a)]
  }
  const toPath = (pts: [number, number][]) => pts.map((p) => p.join(',')).join(' ')

  const currentPoints = dimensions.map((d, i) => pointFor(i, d.currentScore))
  const targetPoints = dimensions.map((d, i) => pointFor(i, d.targetScore))
  const ringLevels = [2, 4, 6, 8, 10]

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: size, display: 'block', margin: '0 auto', overflow: 'visible' }}>
      {ringLevels.map((level) => {
        const r = (level / 10) * maxRadius
        const pts: [number, number][] = dimensions.map((_, i) => {
          const a = angleFor(i)
          return [center + r * Math.cos(a), center + r * Math.sin(a)]
        })
        return <polygon key={level} points={toPath(pts)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
      })}
      {dimensions.map((_, i) => {
        const a = angleFor(i)
        return (
          <line
            key={i}
            x1={center}
            y1={center}
            x2={center + maxRadius * Math.cos(a)}
            y2={center + maxRadius * Math.sin(a)}
            stroke="rgba(255,255,255,0.12)"
            strokeWidth={1}
          />
        )
      })}
      <motion.polygon
        points={toPath(currentPoints)}
        fill="rgba(255,255,255,0.10)"
        stroke="rgba(255,255,255,0.5)"
        strokeWidth={1.5}
        style={{ transformOrigin: `${center}px ${center}px` }}
        initial={{ opacity: 0, scale: 0.75 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
      <motion.polygon
        points={toPath(targetPoints)}
        fill="rgba(15,175,188,0.16)"
        stroke={TEAL}
        strokeWidth={2}
        style={{ transformOrigin: `${center}px ${center}px` }}
        initial={{ opacity: 0, scale: 0.75 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, delay: 0.1, ease: 'easeOut' }}
      />
      {dimensions.map((d, i) => {
        const [cx, cy] = pointFor(i, d.currentScore)
        const [tx, ty] = pointFor(i, d.targetScore)
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={3} fill="rgba(255,255,255,0.7)" />
            <circle cx={tx} cy={ty} r={3.5} fill={TEAL} />
          </g>
        )
      })}
      {dimensions.map((d, i) => {
        const a = angleFor(i)
        const cos = Math.cos(a)
        const lx = center + (maxRadius + 22) * cos
        const ly = center + (maxRadius + 22) * Math.sin(a)
        const anchor = cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle'
        const lineHeight = 12
        const lines = wrapLabel(d.label, 16)
        return (
          <text
            key={i}
            data-editor-key={`insightsBusiness.position${i}.label`}
            x={lx}
            y={ly}
            textAnchor={anchor}
            fontFamily={FONT_GS}
            fontSize={size < 300 ? 9 : 11}
            fill={WHITE}
            opacity={0.85}
          >
            {lines.map((line, li) => (
              <tspan key={li} x={lx} dy={li === 0 ? -((lines.length - 1) * lineHeight) / 2 : lineHeight}>
                {line}
              </tspan>
            ))}
          </text>
        )
      })}
    </svg>
  )
}

function CurrentPositionRadar({ dimensions, providerIdentity = 'novara' }: { dimensions: InsightsPositionDimension[]; providerIdentity?: 'novara' | 'upwork' }) {
  if (dimensions.length < 3) return null
  const withProviderLabel = providerIdentity === 'upwork' ? 'With Jayson' : 'With Novara'
  return (
    <IconCard icon={icon02} title="Current Position & Digital Maturity." full delay={0.3}>
      <div style={{ display: 'flex', gap: 'clamp(16px, 1.8vw, 34px)', flexWrap: 'wrap' }}>
        {([['rgba(255,255,255,0.5)', 'Current position'], [TEAL, withProviderLabel]] as const).map(([color, label]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 'clamp(6px, 0.6vw, 10px)' }}>
            <span style={{ width: 'clamp(8px, 0.7vw, 12px)', height: 'clamp(8px, 0.7vw, 12px)', borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontFamily: FONT_GS, fontWeight: 500, fontSize: 'clamp(11px, 1vw, 19px)', color: 'rgba(255,255,255,0.6)' }}>{label}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 'clamp(8px, 1.2vw, 20px)', padding: '0 clamp(20px, 4vw, 60px)' }}>
        <RadarChart dimensions={dimensions} size={380} />
      </div>
    </IconCard>
  )
}

const SWOT_COLUMNS = [
  { key: 'strengths' as const, label: 'Strengths', icon: icon03 },
  { key: 'weaknesses' as const, label: 'Weaknesses', icon: icon04 },
  { key: 'risks' as const, label: 'Risks', icon: icon05, warn: true },
]

function SwotCards({ swot }: { swot: InsightsSwot }) {
  return (
    <>
      {SWOT_COLUMNS.map((col, ci) => {
        const items = swot[col.key]
        if (items.length === 0) return null
        return (
          <IconCard key={col.key} icon={col.icon} title={`${col.warn ? '⚠ ' : ''}${col.label}`} delay={0.45 + ci * 0.08}>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'clamp(6px, 0.7vw, 12px)' }}>
              {items.map((item, i) => (
                <li
                  key={i}
                  data-editor-key={`insightsBusiness.swot.${col.key}${i}`}
                  style={{
                    fontFamily: FONT_GS, fontWeight: 300, fontSize: 'clamp(11px, 1.15vw, 22px)',
                    lineHeight: 1.5, color: WHITE, opacity: 0.9,
                  }}
                >
                  • {item}
                </li>
              ))}
            </ul>
          </IconCard>
        )
      })}
    </>
  )
}

// ─── Desktop + Tablet (≥768px) ────────────────────────────────────────────────

function DesktopTabletInsightsBusiness({ businessOverview, currentPosition, swot, pageNumber, providerIdentity }: Required<ProposalPageInsightsBusinessProps>) {
  return (
    <div className="relative w-full" style={{ aspectRatio: '16 / 9' }}>
      <ProposalBackground />

      <div className="absolute" style={{ left: '90.88%', top: '8.36%' }}>
        <PageNumber pageNumber={pageNumber} width="clamp(30px, 4.479vw, 86px)" />
      </div>

      <div
        className="relative flex flex-col"
        style={{
          paddingLeft: '4.6875%',
          paddingRight: '4.6875%',
          paddingTop: '8.32%',
          paddingBottom: 'clamp(24px, 3vw, 58px)',
          gap: 'clamp(28px, 3.4vw, 66px)',
        }}
      >
        <motion.h2
          style={{
            fontFamily: FONT_CLASH, fontWeight: 600, fontSize: 'clamp(36px, 3.75vw, 72px)',
            lineHeight: 1.1, color: WHITE, margin: 0,
          }}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
        >
          Where You Stand <span style={{ color: ORANGE }}>Today.</span>
        </motion.h2>

        <motion.p
          style={{
            fontFamily: FONT_GS, fontWeight: 300, fontSize: 'clamp(14px, 1.15vw, 22px)',
            lineHeight: 1.5, color: WHITE, opacity: 0.9, margin: 0, maxWidth: '60%',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.9 }}
          transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
        >
          A clear, honest read on where things stand — before we talk about where they're going.
        </motion.p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(16px, 2vw, 38px)' }}>
          <IconCard icon={icon01} title="Business Overview" full delay={0.25}>
            <p data-editor-key="insightsBusiness.businessOverview" style={{
              fontFamily: FONT_GS, fontWeight: 300, fontSize: 'clamp(11px, 1.15vw, 22px)',
              lineHeight: 1.5, color: WHITE, opacity: 0.9, margin: 0,
            }}>
              {businessOverview}
            </p>
          </IconCard>

          <CurrentPositionRadar dimensions={currentPosition} providerIdentity={providerIdentity} />
          <SwotCards swot={swot} />
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

function MobileCurrentPositionRadar({ dimensions, providerIdentity = 'novara' }: { dimensions: InsightsPositionDimension[]; providerIdentity?: 'novara' | 'upwork' }) {
  if (dimensions.length < 3) return null
  const withProviderLabel = providerIdentity === 'upwork' ? 'With Jayson' : 'With Novara'
  return (
    <MobileIconCard icon={icon02} title="Current Position & Digital Maturity.">
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {([['rgba(255,255,255,0.5)', 'Current position'], [TEAL, withProviderLabel]] as const).map(([color, label]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontFamily: FONT_GS, fontWeight: 500, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{label}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, padding: '0 8px' }}>
        <RadarChart dimensions={dimensions} size={260} />
      </div>
    </MobileIconCard>
  )
}

function MobileSwotCards({ swot }: { swot: InsightsSwot }) {
  return (
    <>
      {SWOT_COLUMNS.map((col) => {
        const items = swot[col.key]
        if (items.length === 0) return null
        return (
          <MobileIconCard key={col.key} icon={col.icon} title={`${col.warn ? '⚠ ' : ''}${col.label}`}>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {items.map((item, i) => (
                <li key={i} data-editor-key={`insightsBusiness.swot.${col.key}${i}`} style={{ fontFamily: FONT_GS, fontWeight: 300, fontSize: 13, lineHeight: 1.5, color: WHITE, opacity: 0.9 }}>
                  • {item}
                </li>
              ))}
            </ul>
          </MobileIconCard>
        )
      })}
    </>
  )
}

function MobileInsightsBusiness({ businessOverview, currentPosition, swot, pageNumber, providerIdentity }: Required<ProposalPageInsightsBusinessProps>) {
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
          Where You Stand <span style={{ color: ORANGE }}>Today.</span>
        </motion.h2>

        <motion.p
          style={{ fontFamily: FONT_GS, fontWeight: 300, fontSize: 15, lineHeight: 1.5, color: WHITE, opacity: 0.9, margin: '0 0 20px' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.9 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          A clear, honest read on where things stand — before we talk about where they're going.
        </motion.p>

        <MobileIconCard icon={icon01} title="Business Overview">
          <p data-editor-key="insightsBusiness.businessOverview" style={{ fontFamily: FONT_GS, fontWeight: 300, fontSize: 14, lineHeight: 1.5, color: WHITE, opacity: 0.9, margin: 0 }}>
            {businessOverview}
          </p>
        </MobileIconCard>

        <MobileCurrentPositionRadar dimensions={currentPosition} providerIdentity={providerIdentity} />
        <MobileSwotCards swot={swot} />
      </div>
    </MobileWrapper>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function ProposalPageInsightsBusiness({
  businessOverview = DEFAULT_BUSINESS_OVERVIEW,
  currentPosition = DEFAULT_CURRENT_POSITION,
  swot = DEFAULT_SWOT,
  pageNumber = 8,
  providerIdentity = 'novara',
}: ProposalPageInsightsBusinessProps) {
  const isDesktopTablet = useIsDesktopTablet()
  const [animKey, setAnimKey] = useState(0)
  useEffect(() => {
    setAnimKey(k => k + 1)
  }, [isDesktopTablet])

  return isDesktopTablet
    ? <DesktopTabletInsightsBusiness key={`dt-${animKey}`} businessOverview={businessOverview} currentPosition={currentPosition} swot={swot} pageNumber={pageNumber} providerIdentity={providerIdentity} />
    : <MobileInsightsBusiness key={`m-${animKey}`} businessOverview={businessOverview} currentPosition={currentPosition} swot={swot} pageNumber={pageNumber} providerIdentity={providerIdentity} />
}
