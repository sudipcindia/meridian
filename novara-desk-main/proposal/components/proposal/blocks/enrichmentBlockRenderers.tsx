/**
 * Shared "AI-selected visual block" renderers — extracted verbatim out of
 * ProposalPage07.tsx (pure refactor, no visual change) so the same 8 (soon
 * 11) block layouts can be reused by both Page07's own 0-2 block enrichment
 * slot and the generic ProposalPageDynamicInsight component (see
 * masterTemplate/index.ts's DYNAMIC_INSIGHT_PAGE_IDS), instead of forking
 * this ~650-line rendering system a second time.
 *
 * Two renderers per layout (desktop/tablet clamp()-sized + mobile fixed-px)
 * because the mobile convention across this whole template is fixed px,
 * never vw-relative clamp() — see ProposalPage07.tsx's own module doc.
 * `renderEnrichmentBlockDesktop`/`renderEnrichmentBlockMobile` are the two
 * entry points (the former EnrichmentBlockContent/MobileEnrichmentBlockContent
 * switches) — called as plain functions, not JSX components, purely so the
 * exported names can stay lowercase/descriptive rather than needing a
 * PascalCase alias at every call site.
 */

import { motion } from 'framer-motion'
import arrowIcon from '../../../src/assets/p07/arrow.png'

// ─── Tokens ───────────────────────────────────────────────────────────────────
// Single source of truth for the whole Business Intelligence block system —
// ProposalPage07.tsx imports these back rather than redeclaring them.

export const FONT_CLASH = 'Clash Display, sans-serif'
export const FONT_GS = 'General Sans, sans-serif'
export const WHITE = '#FFFFFF'
export const ORANGE = '#FF5B04'
export const DARK = '#0D1A1F'
export const TEAL = '#0FAFBC'

// Shared multi-segment palette (donut, stacked bar, treemap), in draw order —
// teal and orange are Novara's own established accents; the remaining two
// are muted neutrals for a 3rd/4th item rather than new brand colours.
export const SEGMENT_COLORS = [ORANGE, TEAL, 'rgba(255,255,255,0.45)', 'rgba(255,145,80,0.55)', 'rgba(15,175,188,0.4)', 'rgba(255,255,255,0.25)']

// ─── Public types ─────────────────────────────────────────────────────────────

export interface Page07Stat {
  value: string
  label: string
}

export interface Page07RoadmapStep {
  title: string
  description: string
}

export interface Page07OpportunityCard {
  title: string
  description: string
}

export type Page07BlockLayout =
  | 'stats'
  | 'beforeAfter'
  | 'roadmap'
  | 'opportunityCards'
  | 'comparisonBars'
  | 'funnel'
  | 'stackedBar'
  | 'treemap'
  | 'projection'
  | 'priorityMatrix'
  | 'comparisonTable'

/** One point on a time-series projection/forecast (revenue, growth, ROI, etc. over time) — the one layout with a genuine time dimension; every other chart here is a single-snapshot comparison. */
export interface Page07ProjectionPoint {
  label: string
  value: number
}

/** One item plotted on a 2x2 priority matrix — x/y each 0-10, axis meaning defined per-block (e.g. Effort vs Impact). */
export interface Page07PriorityMatrixItem {
  label: string
  x: number
  y: number
}

/** One row of a feature/commercial comparison table — `values` has exactly one entry per column after the label column. */
export interface Page07ComparisonTableRow {
  label: string
  values: string[]
}

/** One "current vs with Novara" dimension, each scored 0-10 — Novara's own expert assessment (explicitly labelled as such), never presented as measured analytics data. */
export interface Page07ComparisonBar {
  label: string
  currentScore: number
  targetScore: number
}

/** One funnel stage — `value` is a relative weight (widest = 100), not a claimed literal measured count unless the client's own figures genuinely support one. */
export interface Page07FunnelStage {
  label: string
  value: number
}

export interface Page07StackedBarSegment {
  label: string
  percent: number
}

export interface Page07TreemapItem {
  label: string
  weight: number
}

/**
 * One AI-selected visual block. `layout` picks which shape this block
 * takes; only the matching field is populated, the rest sit at their
 * empty default. Mirrors the flat-shape convention already established by
 * the frozen template's other structured content (e.g. PricingCardData).
 */
export interface Page07EnrichmentBlock {
  layout: Page07BlockLayout
  stats: Page07Stat[]
  beforeLabel: string
  beforeText: string
  afterLabel: string
  afterText: string
  roadmapSteps: Page07RoadmapStep[]
  opportunityCards: Page07OpportunityCard[]
  comparisonBars: Page07ComparisonBar[]
  funnelStages: Page07FunnelStage[]
  stackedBarTitle: string
  stackedBarSegments: Page07StackedBarSegment[]
  treemapItems: Page07TreemapItem[]
  projectionTitle: string
  projectionUnit: string
  projectionPoints: Page07ProjectionPoint[]
  priorityMatrixXLabel: string
  priorityMatrixYLabel: string
  priorityMatrixItems: Page07PriorityMatrixItem[]
  comparisonTableTitle: string
  comparisonTableColumns: string[]
  comparisonTableRows: Page07ComparisonTableRow[]
}

/**
 * 0-2 AI-selected visual blocks — additive enrichment on top of whatever
 * guaranteed paragraph content sits around it, never a replacement. An
 * empty array means no extra block. Never two blocks of the same layout,
 * and never invented numbers/phases to fill a shape the client's actual
 * data doesn't support.
 */
export interface Page07Enrichment {
  blocks: Page07EnrichmentBlock[]
}

// ─── Shared chrome ──────────────────────────────────────────────────────────

// Arrow used in the bottom funnel banner and the beforeAfter block.
// Figma: w-[33.845px] h-0 container, inset-[-5.66px_-2.27%_-5.66px_0]
export function BannerArrow() {
  return (
    <div style={{ width: 'clamp(18px, 1.762vw, 34px)', height: 0, position: 'relative', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: '-5.66px', right: '-2.27%', bottom: '-5.66px', left: 0 }}>
        <img src={arrowIcon} alt="" aria-hidden draggable={false}
          style={{ display: 'block', width: '100%', height: '100%' }} />
      </div>
    </div>
  )
}

// ─── Desktop/tablet layout renderers ───────────────────────────────────────────
// Same design tokens/bordered-box language already used elsewhere on this
// page; no new component library, no new colours beyond Novara's own
// established teal.

function StatsStrip({ stats }: { stats: Page07Stat[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(16px, 2vw, 38px)' }}>
      {stats.map((stat, i) => (
        <div key={i} style={{
          flex: '1 1 0',
          minWidth: 'clamp(120px, 18vw, 220px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'clamp(4px, 0.5vw, 10px)',
          background: 'rgba(228,238,240,0.02)',
          border: '0.769px solid rgba(255,255,255,0.2)',
          borderRadius: 'clamp(4px, 0.4vw, 8px)',
          padding: 'clamp(16px, 1.8vw, 34px)',
          boxSizing: 'border-box',
        }}>
          <p data-editor-key={`page07.enrichment.stat${i}.value`} style={{
            fontFamily: FONT_CLASH, fontWeight: 600, fontSize: 'clamp(28px, 2.9vw, 56px)', lineHeight: 1.1, color: ORANGE, margin: 0,
          }}>
            {stat.value}
          </p>
          <p data-editor-key={`page07.enrichment.stat${i}.label`} style={{
            fontFamily: FONT_GS, fontWeight: 400, fontSize: 'clamp(12px, 1.15vw, 22px)', lineHeight: 1.4, color: WHITE, margin: 0,
          }}>
            {stat.label}
          </p>
        </div>
      ))}
    </div>
  )
}

function BeforeAfterPanel({ beforeLabel, beforeText, afterLabel, afterText }: {
  beforeLabel: string; beforeText: string; afterLabel: string; afterText: string
}) {
  const boxBase = {
    flex: '1 1 0',
    minWidth: 240,
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: 'clamp(8px, 0.9vw, 16px)',
    borderRadius: 'clamp(4px, 0.4vw, 8px)',
    padding: 'clamp(16px, 1.8vw, 34px)',
    boxSizing: 'border-box' as const,
  }
  return (
    <div style={{ display: 'flex', gap: 'clamp(16px, 2vw, 38px)', alignItems: 'stretch', flexWrap: 'wrap' }}>
      <div style={{ ...boxBase, background: 'rgba(228,238,240,0.02)', border: '0.769px solid rgba(255,255,255,0.2)' }}>
        <p data-editor-key="page07.enrichment.beforeLabel" style={{
          fontFamily: FONT_GS, fontWeight: 500, fontSize: 'clamp(12px, 1.1vw, 21px)', letterSpacing: '0.03em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', margin: 0,
        }}>
          {beforeLabel}
        </p>
        <p data-editor-key="page07.enrichment.beforeText" style={{
          fontFamily: FONT_GS, fontWeight: 300, fontSize: 'clamp(13px, 1.25vw, 24px)', lineHeight: 1.5, color: WHITE, margin: 0,
        }}>
          {beforeText}
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <BannerArrow />
      </div>
      <div style={{ ...boxBase, background: 'rgba(15,175,188,0.06)', border: '0.769px solid rgba(15,175,188,0.3)' }}>
        <p data-editor-key="page07.enrichment.afterLabel" style={{
          fontFamily: FONT_GS, fontWeight: 500, fontSize: 'clamp(12px, 1.1vw, 21px)', letterSpacing: '0.03em', textTransform: 'uppercase', color: TEAL, margin: 0,
        }}>
          {afterLabel}
        </p>
        <p data-editor-key="page07.enrichment.afterText" style={{
          fontFamily: FONT_GS, fontWeight: 300, fontSize: 'clamp(13px, 1.25vw, 24px)', lineHeight: 1.5, color: WHITE, margin: 0,
        }}>
          {afterText}
        </p>
      </div>
    </div>
  )
}

function RoadmapSteps({ steps }: { steps: Page07RoadmapStep[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(16px, 1.8vw, 34px)' }}>
      {steps.map((step, i) => (
        <div key={i} style={{ display: 'flex', gap: 'clamp(16px, 2vw, 38px)', alignItems: 'flex-start' }}>
          <p aria-hidden style={{
            fontFamily: FONT_CLASH, fontWeight: 600, fontSize: 'clamp(32px, 3.4vw, 66px)', lineHeight: 1,
            color: 'rgba(255,255,255,0.12)', margin: 0, flexShrink: 0, minWidth: 'clamp(50px, 4.5vw, 88px)',
          }}>
            {String(i + 1).padStart(2, '0')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(4px, 0.5vw, 10px)', paddingTop: 'clamp(4px, 0.5vw, 10px)' }}>
            <p data-editor-key={`page07.enrichment.step${i}.title`} style={{
              fontFamily: FONT_GS, fontWeight: 500, fontSize: 'clamp(15px, 1.5vw, 29px)', lineHeight: 1.4, color: WHITE, margin: 0,
            }}>
              {step.title}
            </p>
            <p data-editor-key={`page07.enrichment.step${i}.description`} style={{
              fontFamily: FONT_GS, fontWeight: 300, fontSize: 'clamp(13px, 1.2vw, 23px)', lineHeight: 1.5, color: 'rgba(255,255,255,0.7)', margin: 0,
            }}>
              {step.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

function OpportunityCardsBlock({ cards }: { cards: Page07OpportunityCard[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(16px, 2vw, 38px)' }}>
      {cards.map((card, i) => (
        <div key={i} style={{
          flex: '1 1 0',
          minWidth: 'clamp(200px, 26vw, 340px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'clamp(6px, 0.7vw, 14px)',
          background: 'rgba(228,238,240,0.02)',
          border: '0.769px solid rgba(255,255,255,0.2)',
          borderRadius: 'clamp(4px, 0.4vw, 8px)',
          padding: 'clamp(16px, 1.8vw, 34px)',
          boxSizing: 'border-box',
        }}>
          <p data-editor-key={`page07.enrichment.card${i}.title`} style={{
            fontFamily: FONT_GS, fontWeight: 500, fontSize: 'clamp(15px, 1.5vw, 29px)', lineHeight: 1.4, color: WHITE, margin: 0,
          }}>
            {card.title}
          </p>
          <p data-editor-key={`page07.enrichment.card${i}.description`} style={{
            fontFamily: FONT_GS, fontWeight: 300, fontSize: 'clamp(13px, 1.2vw, 23px)', lineHeight: 1.5, color: 'rgba(255,255,255,0.7)', margin: 0,
          }}>
            {card.description}
          </p>
        </div>
      ))}
    </div>
  )
}

function ScoreBarTrack({ value, color }: { value: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (value / 10) * 100))
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(8px, 0.9vw, 16px)' }}>
      <div style={{
        flex: 1, height: 'clamp(6px, 0.6vw, 11px)', borderRadius: 999,
        background: 'rgba(255,255,255,0.08)', overflow: 'hidden',
      }}>
        <motion.div
          style={{ height: '100%', borderRadius: 999, background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      </div>
      <span style={{
        fontFamily: FONT_GS, fontWeight: 500, fontSize: 'clamp(11px, 1vw, 19px)',
        color: 'rgba(255,255,255,0.6)', minWidth: '2.4em', textAlign: 'right', flexShrink: 0,
      }}>
        {value}/10
      </span>
    </div>
  )
}

function ComparisonBars({ bars, keyPrefix, providerIdentity = 'novara' }: { bars: Page07ComparisonBar[]; keyPrefix: string; providerIdentity?: 'novara' | 'upwork' }) {
  const withProviderLabel = providerIdentity === 'upwork' ? 'With Jayson' : 'With Novara'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(18px, 2vw, 38px)' }}>
      <div style={{ display: 'flex', gap: 'clamp(16px, 1.8vw, 34px)', flexWrap: 'wrap' }}>
        {([['rgba(255,255,255,0.35)', 'Current position'], [TEAL, withProviderLabel]] as const).map(([color, label]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 'clamp(6px, 0.6vw, 10px)' }}>
            <span style={{ width: 'clamp(8px, 0.7vw, 12px)', height: 'clamp(8px, 0.7vw, 12px)', borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontFamily: FONT_GS, fontWeight: 500, fontSize: 'clamp(11px, 1vw, 19px)', color: 'rgba(255,255,255,0.6)' }}>{label}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(16px, 1.8vw, 32px)' }}>
        {bars.map((bar, i) => (
          <motion.div
            key={i}
            style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(8px, 0.8vw, 14px)' }}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.08 * i, ease: 'easeOut' }}
          >
            <p data-editor-key={`${keyPrefix}.bar${i}.label`} style={{
              fontFamily: FONT_GS, fontWeight: 500, fontSize: 'clamp(13px, 1.25vw, 24px)', color: WHITE, margin: 0,
            }}>
              {bar.label}
            </p>
            <ScoreBarTrack value={bar.currentScore} color="rgba(255,255,255,0.35)" />
            <ScoreBarTrack value={bar.targetScore} color={TEAL} />
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// Descending trapezoid funnel — `value` is a relative weight (widest stage
// normalized to 100% width), narrowing toward the bottom to read as a
// classic conversion/pipeline funnel.
function FunnelChart({ stages, keyPrefix }: { stages: Page07FunnelStage[]; keyPrefix: string }) {
  const maxValue = Math.max(...stages.map((s) => s.value), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'clamp(6px, 0.7vw, 12px)' }}>
      {stages.map((stage, i) => {
        const widthPct = Math.max(18, (stage.value / maxValue) * 100)
        const taper = 6 + i * 2
        return (
          <motion.div
            key={i}
            style={{ width: `${widthPct}%`, display: 'flex', flexDirection: 'column', alignItems: 'center' }}
            initial={{ opacity: 0, scaleX: 0.85 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.5, delay: 0.1 * i, ease: 'easeOut' }}
          >
            <div
              style={{
                width: '100%',
                clipPath: `polygon(${taper}% 0%, ${100 - taper}% 0%, 100% 100%, 0% 100%)`,
                background: i === 0 ? ORANGE : SEGMENT_COLORS[(i - 1) % SEGMENT_COLORS.length],
                padding: 'clamp(12px, 1.3vw, 24px) clamp(16px, 1.8vw, 34px)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 'clamp(2px, 0.3vw, 5px)',
                boxSizing: 'border-box',
              }}
            >
              <span data-editor-key={`${keyPrefix}.stage${i}.label`} style={{
                fontFamily: FONT_GS, fontWeight: 600, fontSize: 'clamp(12px, 1.15vw, 22px)', color: DARK, textAlign: 'center',
              }}>
                {stage.label}
              </span>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

function StackedBarChart({ title, segments, keyPrefix }: { title: string; segments: Page07StackedBarSegment[]; keyPrefix: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(12px, 1.3vw, 24px)' }}>
      {title && (
        <p data-editor-key={`${keyPrefix}.stackedBarTitle`} style={{
          fontFamily: FONT_GS, fontWeight: 500, fontSize: 'clamp(13px, 1.25vw, 24px)', color: WHITE, margin: 0,
        }}>
          {title}
        </p>
      )}
      <div style={{
        display: 'flex', width: '100%', height: 'clamp(20px, 2vw, 38px)', borderRadius: 999, overflow: 'hidden',
        background: 'rgba(255,255,255,0.06)',
      }}>
        {segments.map((seg, i) => (
          <motion.div
            key={i}
            style={{ height: '100%', background: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }}
            initial={{ width: 0 }}
            animate={{ width: `${seg.percent}%` }}
            transition={{ duration: 0.7, delay: 0.1 * i, ease: 'easeOut' }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(12px, 1.4vw, 26px)' }}>
        {segments.map((seg, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'clamp(6px, 0.6vw, 10px)' }}>
            <span style={{
              width: 'clamp(8px, 0.7vw, 12px)', height: 'clamp(8px, 0.7vw, 12px)', borderRadius: '50%',
              background: SEGMENT_COLORS[i % SEGMENT_COLORS.length], flexShrink: 0,
            }} />
            <span data-editor-key={`${keyPrefix}.segment${i}.label`} style={{
              fontFamily: FONT_GS, fontWeight: 500, fontSize: 'clamp(12px, 1.1vw, 21px)', color: 'rgba(255,255,255,0.7)',
            }}>
              {seg.label}
            </span>
            <span style={{ fontFamily: FONT_GS, fontWeight: 400, fontSize: 'clamp(12px, 1.1vw, 21px)', color: 'rgba(255,255,255,0.45)' }}>
              {seg.percent}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Simple proportional mosaic (not a true squarified treemap) — items sorted
// descending by weight, laid out in a wrapping flex row where each tile's
// width share matches its weight's share of the total. Reads as a treemap
// at this item count (3-6) without needing a full layout algorithm.
function TreemapChart({ items, keyPrefix }: { items: Page07TreemapItem[]; keyPrefix: string }) {
  const total = items.reduce((sum, it) => sum + it.weight, 0) || 1
  const sorted = [...items].sort((a, b) => b.weight - a.weight)
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(6px, 0.7vw, 12px)' }}>
      {sorted.map((item, i) => {
        const share = item.weight / total
        return (
          <motion.div
            key={i}
            style={{
              flex: `${Math.max(share * 100, 12)} 1 0`,
              minWidth: 'clamp(100px, 12vw, 180px)',
              height: 'clamp(70px, 7.5vw, 145px)',
              background: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
              borderRadius: 'clamp(4px, 0.4vw, 8px)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              padding: 'clamp(10px, 1vw, 18px)',
              boxSizing: 'border-box',
            }}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.45, delay: 0.06 * i, ease: 'easeOut' }}
          >
            <span data-editor-key={`${keyPrefix}.item${i}.label`} style={{
              fontFamily: FONT_GS, fontWeight: 600, fontSize: 'clamp(12px, 1.15vw, 22px)',
              color: i % 2 === 0 ? DARK : WHITE,
            }}>
              {item.label}
            </span>
          </motion.div>
        )
      })}
    </div>
  )
}

// Time-series forecast — the one layout with a genuine time dimension (every
// other chart here is a single-snapshot comparison). Hand-rolled SVG line +
// filled area, same technique as the other charts on this page (no charting
// library) — points evenly spaced on X, value range mapped to Y with a
// small headroom margin so the highest point's label never clips the top edge.
function ProjectionChart({ title, unit, points, keyPrefix }: { title: string; unit: string; points: Page07ProjectionPoint[]; keyPrefix: string }) {
  const width = 640
  const height = 220
  const padX = 8
  const padTop = 34
  const padBottom = 28
  const values = points.map((p) => p.value)
  const minValue = Math.min(0, ...values)
  const maxValue = Math.max(...values, minValue + 1)
  const range = maxValue - minValue || 1
  const plotWidth = width - padX * 2
  const plotHeight = height - padTop - padBottom
  const xFor = (i: number) => padX + (points.length > 1 ? (i / (points.length - 1)) * plotWidth : plotWidth / 2)
  const yFor = (v: number) => padTop + plotHeight - ((v - minValue) / range) * plotHeight
  const linePoints = points.map((p, i) => `${xFor(i)},${yFor(p.value)}`).join(' ')
  const areaPoints = `${xFor(0)},${yFor(minValue)} ${linePoints} ${xFor(points.length - 1)},${yFor(minValue)}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(10px, 1.1vw, 20px)' }}>
      {title && (
        <p data-editor-key={`${keyPrefix}.projectionTitle`} style={{
          fontFamily: FONT_GS, fontWeight: 500, fontSize: 'clamp(13px, 1.25vw, 24px)', color: WHITE, margin: 0,
        }}>
          {title}
        </p>
      )}
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}>
        <motion.polygon
          points={areaPoints}
          fill="rgba(15,175,188,0.14)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
        <motion.polyline
          points={linePoints}
          fill="none"
          stroke={TEAL}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={xFor(i)} cy={yFor(p.value)} r={4} fill={TEAL} />
            <text x={xFor(i)} y={yFor(p.value) - 12} textAnchor="middle" fontFamily={FONT_GS} fontWeight={600} fontSize={13} fill={WHITE}>
              {p.value}{unit}
            </text>
            <text x={xFor(i)} y={height - 6} textAnchor="middle" fontFamily={FONT_GS} fontWeight={400} fontSize={11} fill="rgba(255,255,255,0.5)">
              {p.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}

// 2x2 priority matrix — items plotted by (x, y), each 0-10, axis meaning
// defined per-block (e.g. Effort vs Impact). A cross through the plot's
// midpoint divides it into the classic four quadrants.
function PriorityMatrix({ xLabel, yLabel, items, keyPrefix }: { xLabel: string; yLabel: string; items: Page07PriorityMatrixItem[]; keyPrefix: string }) {
  const size = 360
  const pad = 20
  const plot = size - pad * 2
  const xFor = (v: number) => pad + (Math.max(0, Math.min(10, v)) / 10) * plot
  const yFor = (v: number) => pad + plot - (Math.max(0, Math.min(10, v)) / 10) * plot

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(10px, 1.1vw, 20px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(8px, 0.9vw, 16px)' }}>
        <span data-editor-key={`${keyPrefix}.priorityMatrixYLabel`} style={{
          fontFamily: FONT_GS, fontWeight: 500, fontSize: 'clamp(11px, 1vw, 19px)', color: 'rgba(255,255,255,0.6)',
          writingMode: 'vertical-rl', transform: 'rotate(180deg)',
        }}>
          {yLabel}
        </span>
        <svg viewBox={`0 0 ${size} ${size}`} style={{ width: '100%', maxWidth: 340, height: 'auto', display: 'block' }}>
          <rect x={pad} y={pad} width={plot} height={plot} fill="rgba(228,238,240,0.02)" stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
          <line x1={pad} y1={pad + plot / 2} x2={pad + plot} y2={pad + plot / 2} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
          <line x1={pad + plot / 2} y1={pad} x2={pad + plot / 2} y2={pad + plot} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
          {items.map((item, i) => (
            <motion.g
              key={i}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.06 * i, ease: 'easeOut' }}
            >
              <circle cx={xFor(item.x)} cy={yFor(item.y)} r={6} fill={ORANGE} />
              <text
                data-editor-key={`${keyPrefix}.priorityMatrixItem${i}.label`}
                x={xFor(item.x)}
                y={yFor(item.y) - 12}
                textAnchor="middle"
                fontFamily={FONT_GS}
                fontWeight={500}
                fontSize={12}
                fill={WHITE}
              >
                {item.label}
              </text>
            </motion.g>
          ))}
        </svg>
      </div>
      <p data-editor-key={`${keyPrefix}.priorityMatrixXLabel`} style={{
        fontFamily: FONT_GS, fontWeight: 500, fontSize: 'clamp(11px, 1vw, 19px)', color: 'rgba(255,255,255,0.6)', margin: '0 0 0 clamp(20px, 2.2vw, 42px)',
      }}>
        {xLabel}
      </p>
    </div>
  )
}

function ComparisonTable({ title, columns, rows, keyPrefix }: { title: string; columns: string[]; rows: Page07ComparisonTableRow[]; keyPrefix: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(10px, 1.1vw, 20px)' }}>
      {title && (
        <p data-editor-key={`${keyPrefix}.comparisonTableTitle`} style={{
          fontFamily: FONT_GS, fontWeight: 500, fontSize: 'clamp(13px, 1.25vw, 24px)', color: WHITE, margin: 0,
        }}>
          {title}
        </p>
      )}
      <div style={{ overflowX: 'auto', border: '0.769px solid rgba(255,255,255,0.2)', borderRadius: 'clamp(4px, 0.4vw, 8px)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {columns.map((col, i) => (
                <th
                  key={i}
                  data-editor-key={`${keyPrefix}.comparisonTableColumn${i}`}
                  style={{
                    fontFamily: FONT_GS, fontWeight: 600, fontSize: 'clamp(12px, 1.1vw, 21px)', color: WHITE, textAlign: i === 0 ? 'left' : 'center',
                    padding: 'clamp(10px, 1vw, 18px)', background: 'rgba(228,238,240,0.04)', borderBottom: '0.769px solid rgba(255,255,255,0.2)',
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                <td data-editor-key={`${keyPrefix}.comparisonTableRow${ri}.label`} style={{
                  fontFamily: FONT_GS, fontWeight: 500, fontSize: 'clamp(12px, 1.1vw, 21px)', color: WHITE,
                  padding: 'clamp(10px, 1vw, 18px)', borderBottom: ri < rows.length - 1 ? '0.769px solid rgba(255,255,255,0.1)' : 'none',
                }}>
                  {row.label}
                </td>
                {row.values.map((val, ci) => (
                  <td
                    key={ci}
                    data-editor-key={`${keyPrefix}.comparisonTableRow${ri}.value${ci}`}
                    style={{
                      fontFamily: FONT_GS, fontWeight: 400, fontSize: 'clamp(12px, 1.1vw, 21px)', color: 'rgba(255,255,255,0.75)', textAlign: 'center',
                      padding: 'clamp(10px, 1vw, 18px)', borderBottom: ri < rows.length - 1 ? '0.769px solid rgba(255,255,255,0.1)' : 'none',
                    }}
                  >
                    {val}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** The desktop/tablet entry point — dispatches one block to its layout's renderer. `keyPrefix` scopes this block's data-editor-key attributes uniquely within whatever page it's rendered on (Page07 uses `page07.enrichment.b${index}`; a dynamic-insight page uses its own page id the same way). */
export function renderEnrichmentBlockDesktop(block: Page07EnrichmentBlock, keyPrefix: string, providerIdentity: 'novara' | 'upwork' = 'novara') {
  switch (block.layout) {
    case 'stats':
      return <StatsStrip stats={block.stats} />
    case 'beforeAfter':
      return (
        <BeforeAfterPanel
          beforeLabel={block.beforeLabel}
          beforeText={block.beforeText}
          afterLabel={block.afterLabel}
          afterText={block.afterText}
        />
      )
    case 'roadmap':
      return <RoadmapSteps steps={block.roadmapSteps} />
    case 'opportunityCards':
      return <OpportunityCardsBlock cards={block.opportunityCards} />
    case 'comparisonBars':
      return <ComparisonBars bars={block.comparisonBars} keyPrefix={keyPrefix} providerIdentity={providerIdentity} />
    case 'funnel':
      return <FunnelChart stages={block.funnelStages} keyPrefix={keyPrefix} />
    case 'stackedBar':
      return <StackedBarChart title={block.stackedBarTitle} segments={block.stackedBarSegments} keyPrefix={keyPrefix} />
    case 'treemap':
      return <TreemapChart items={block.treemapItems} keyPrefix={keyPrefix} />
    case 'projection':
      return <ProjectionChart title={block.projectionTitle} unit={block.projectionUnit} points={block.projectionPoints} keyPrefix={keyPrefix} />
    case 'priorityMatrix':
      return <PriorityMatrix xLabel={block.priorityMatrixXLabel} yLabel={block.priorityMatrixYLabel} items={block.priorityMatrixItems} keyPrefix={keyPrefix} />
    case 'comparisonTable':
      return <ComparisonTable title={block.comparisonTableTitle} columns={block.comparisonTableColumns} rows={block.comparisonTableRows} keyPrefix={keyPrefix} />
    default:
      return null
  }
}

// ─── Mobile layout renderers ────────────────────────────────────────────────
// Same data, fixed px sizing to match this page's existing mobile convention
// (vw-relative sizing resolves against the real viewport, not this panel —
// see ProposalPage07.tsx's module doc — so mobile always uses plain
// numbers, not clamp()).

function MobileStatsStrip({ stats }: { stats: Page07Stat[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      {stats.map((stat, i) => (
        <div key={i} style={{
          flex: '1 1 0', minWidth: 100, display: 'flex', flexDirection: 'column', gap: 4,
          background: 'rgba(228,238,240,0.02)', border: '0.769px solid rgba(255,255,255,0.2)',
          borderRadius: 6, padding: 14, boxSizing: 'border-box',
        }}>
          <p data-editor-key={`page07.enrichment.stat${i}.value`} style={{ fontFamily: FONT_CLASH, fontWeight: 600, fontSize: 28, lineHeight: 1.1, color: ORANGE, margin: 0 }}>
            {stat.value}
          </p>
          <p data-editor-key={`page07.enrichment.stat${i}.label`} style={{ fontFamily: FONT_GS, fontWeight: 400, fontSize: 13, lineHeight: 1.4, color: WHITE, margin: 0 }}>
            {stat.label}
          </p>
        </div>
      ))}
    </div>
  )
}

function MobileBeforeAfterPanel({ beforeLabel, beforeText, afterLabel, afterText }: {
  beforeLabel: string; beforeText: string; afterLabel: string; afterText: string
}) {
  const boxBase = { display: 'flex' as const, flexDirection: 'column' as const, gap: 8, borderRadius: 6, padding: 14, boxSizing: 'border-box' as const }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ ...boxBase, background: 'rgba(228,238,240,0.02)', border: '0.769px solid rgba(255,255,255,0.2)' }}>
        <p data-editor-key="page07.enrichment.beforeLabel" style={{ fontFamily: FONT_GS, fontWeight: 500, fontSize: 11, letterSpacing: '0.03em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', margin: 0 }}>
          {beforeLabel}
        </p>
        <p data-editor-key="page07.enrichment.beforeText" style={{ fontFamily: FONT_GS, fontWeight: 300, fontSize: 14, lineHeight: 1.5, color: WHITE, margin: 0 }}>
          {beforeText}
        </p>
      </div>
      <div style={{ ...boxBase, background: 'rgba(15,175,188,0.06)', border: '0.769px solid rgba(15,175,188,0.3)' }}>
        <p data-editor-key="page07.enrichment.afterLabel" style={{ fontFamily: FONT_GS, fontWeight: 500, fontSize: 11, letterSpacing: '0.03em', textTransform: 'uppercase', color: TEAL, margin: 0 }}>
          {afterLabel}
        </p>
        <p data-editor-key="page07.enrichment.afterText" style={{ fontFamily: FONT_GS, fontWeight: 300, fontSize: 14, lineHeight: 1.5, color: WHITE, margin: 0 }}>
          {afterText}
        </p>
      </div>
    </div>
  )
}

function MobileScoreBarTrack({ value, color }: { value: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (value / 10) * 100))
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <motion.div
          style={{ height: '100%', borderRadius: 999, background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      </div>
      <span style={{ fontFamily: FONT_GS, fontWeight: 500, fontSize: 12, color: 'rgba(255,255,255,0.6)', minWidth: 32, textAlign: 'right', flexShrink: 0 }}>
        {value}/10
      </span>
    </div>
  )
}

function MobileComparisonBars({ bars, keyPrefix, providerIdentity = 'novara' }: { bars: Page07ComparisonBar[]; keyPrefix: string; providerIdentity?: 'novara' | 'upwork' }) {
  const withProviderLabel = providerIdentity === 'upwork' ? 'With Jayson' : 'With Novara'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {([['rgba(255,255,255,0.35)', 'Current position'], [TEAL, withProviderLabel]] as const).map(([color, label]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontFamily: FONT_GS, fontWeight: 500, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{label}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {bars.map((bar, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p data-editor-key={`${keyPrefix}.bar${i}.label`} style={{ fontFamily: FONT_GS, fontWeight: 500, fontSize: 14, color: WHITE, margin: 0 }}>
              {bar.label}
            </p>
            <MobileScoreBarTrack value={bar.currentScore} color="rgba(255,255,255,0.35)" />
            <MobileScoreBarTrack value={bar.targetScore} color={TEAL} />
          </div>
        ))}
      </div>
    </div>
  )
}

function MobileFunnelChart({ stages, keyPrefix }: { stages: Page07FunnelStage[]; keyPrefix: string }) {
  const maxValue = Math.max(...stages.map((s) => s.value), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      {stages.map((stage, i) => {
        const widthPct = Math.max(22, (stage.value / maxValue) * 100)
        const taper = 6 + i * 2
        return (
          <div key={i} style={{ width: `${widthPct}%`, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{
              width: '100%',
              clipPath: `polygon(${taper}% 0%, ${100 - taper}% 0%, 100% 100%, 0% 100%)`,
              background: i === 0 ? ORANGE : SEGMENT_COLORS[(i - 1) % SEGMENT_COLORS.length],
              padding: '10px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', boxSizing: 'border-box',
            }}>
              <span data-editor-key={`${keyPrefix}.stage${i}.label`} style={{ fontFamily: FONT_GS, fontWeight: 600, fontSize: 13, color: DARK, textAlign: 'center' }}>
                {stage.label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MobileStackedBarChart({ title, segments, keyPrefix }: { title: string; segments: Page07StackedBarSegment[]; keyPrefix: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {title && (
        <p data-editor-key={`${keyPrefix}.stackedBarTitle`} style={{ fontFamily: FONT_GS, fontWeight: 500, fontSize: 14, color: WHITE, margin: 0 }}>
          {title}
        </p>
      )}
      <div style={{ display: 'flex', width: '100%', height: 16, borderRadius: 999, overflow: 'hidden', background: 'rgba(255,255,255,0.06)' }}>
        {segments.map((seg, i) => (
          <div key={i} style={{ height: '100%', width: `${seg.percent}%`, background: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {segments.map((seg, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: SEGMENT_COLORS[i % SEGMENT_COLORS.length], flexShrink: 0 }} />
            <span data-editor-key={`${keyPrefix}.segment${i}.label`} style={{ fontFamily: FONT_GS, fontWeight: 500, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
              {seg.label}
            </span>
            <span style={{ fontFamily: FONT_GS, fontWeight: 400, fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{seg.percent}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MobileTreemapChart({ items, keyPrefix }: { items: Page07TreemapItem[]; keyPrefix: string }) {
  const total = items.reduce((sum, it) => sum + it.weight, 0) || 1
  const sorted = [...items].sort((a, b) => b.weight - a.weight)
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {sorted.map((item, i) => {
        const share = item.weight / total
        return (
          <div key={i} style={{
            flex: `${Math.max(share * 100, 14)} 1 0`, minWidth: 90, height: 64,
            background: SEGMENT_COLORS[i % SEGMENT_COLORS.length], borderRadius: 6,
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 8, boxSizing: 'border-box',
          }}>
            <span data-editor-key={`${keyPrefix}.item${i}.label`} style={{ fontFamily: FONT_GS, fontWeight: 600, fontSize: 12, color: i % 2 === 0 ? DARK : WHITE }}>
              {item.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function MobileRoadmapSteps({ steps }: { steps: Page07RoadmapStep[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {steps.map((step, i) => (
        <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <p aria-hidden style={{ fontFamily: FONT_CLASH, fontWeight: 600, fontSize: 30, lineHeight: 1, color: 'rgba(255,255,255,0.12)', margin: 0, flexShrink: 0, minWidth: 40 }}>
            {String(i + 1).padStart(2, '0')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 2 }}>
            <p data-editor-key={`page07.enrichment.step${i}.title`} style={{ fontFamily: FONT_GS, fontWeight: 500, fontSize: 15, lineHeight: 1.4, color: WHITE, margin: 0 }}>
              {step.title}
            </p>
            <p data-editor-key={`page07.enrichment.step${i}.description`} style={{ fontFamily: FONT_GS, fontWeight: 300, fontSize: 14, lineHeight: 1.5, color: 'rgba(255,255,255,0.7)', margin: 0 }}>
              {step.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

function MobileOpportunityCards({ cards }: { cards: Page07OpportunityCard[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {cards.map((card, i) => (
        <div key={i} style={{
          display: 'flex', flexDirection: 'column', gap: 6,
          background: 'rgba(228,238,240,0.02)', border: '0.769px solid rgba(255,255,255,0.2)',
          borderRadius: 6, padding: 14, boxSizing: 'border-box',
        }}>
          <p data-editor-key={`page07.enrichment.card${i}.title`} style={{ fontFamily: FONT_GS, fontWeight: 500, fontSize: 15, lineHeight: 1.4, color: WHITE, margin: 0 }}>
            {card.title}
          </p>
          <p data-editor-key={`page07.enrichment.card${i}.description`} style={{ fontFamily: FONT_GS, fontWeight: 300, fontSize: 14, lineHeight: 1.5, color: 'rgba(255,255,255,0.7)', margin: 0 }}>
            {card.description}
          </p>
        </div>
      ))}
    </div>
  )
}

function MobileProjectionChart({ title, unit, points, keyPrefix }: { title: string; unit: string; points: Page07ProjectionPoint[]; keyPrefix: string }) {
  const width = 320
  const height = 170
  const padX = 8
  const padTop = 28
  const padBottom = 24
  const values = points.map((p) => p.value)
  const minValue = Math.min(0, ...values)
  const maxValue = Math.max(...values, minValue + 1)
  const range = maxValue - minValue || 1
  const plotWidth = width - padX * 2
  const plotHeight = height - padTop - padBottom
  const xFor = (i: number) => padX + (points.length > 1 ? (i / (points.length - 1)) * plotWidth : plotWidth / 2)
  const yFor = (v: number) => padTop + plotHeight - ((v - minValue) / range) * plotHeight
  const linePoints = points.map((p, i) => `${xFor(i)},${yFor(p.value)}`).join(' ')
  const areaPoints = `${xFor(0)},${yFor(minValue)} ${linePoints} ${xFor(points.length - 1)},${yFor(minValue)}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {title && (
        <p data-editor-key={`${keyPrefix}.projectionTitle`} style={{ fontFamily: FONT_GS, fontWeight: 500, fontSize: 14, color: WHITE, margin: 0 }}>
          {title}
        </p>
      )}
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}>
        <polygon points={areaPoints} fill="rgba(15,175,188,0.14)" />
        <polyline points={linePoints} fill="none" stroke={TEAL} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={xFor(i)} cy={yFor(p.value)} r={3} fill={TEAL} />
            <text x={xFor(i)} y={yFor(p.value) - 9} textAnchor="middle" fontFamily={FONT_GS} fontWeight={600} fontSize={10} fill={WHITE}>
              {p.value}{unit}
            </text>
            <text x={xFor(i)} y={height - 4} textAnchor="middle" fontFamily={FONT_GS} fontWeight={400} fontSize={9} fill="rgba(255,255,255,0.5)">
              {p.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}

function MobilePriorityMatrix({ xLabel, yLabel, items, keyPrefix }: { xLabel: string; yLabel: string; items: Page07PriorityMatrixItem[]; keyPrefix: string }) {
  const size = 300
  const pad = 16
  const plot = size - pad * 2
  const xFor = (v: number) => pad + (Math.max(0, Math.min(10, v)) / 10) * plot
  const yFor = (v: number) => pad + plot - (Math.max(0, Math.min(10, v)) / 10) * plot

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ width: '100%', maxWidth: 260, height: 'auto', display: 'block', margin: '0 auto' }}>
        <rect x={pad} y={pad} width={plot} height={plot} fill="rgba(228,238,240,0.02)" stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
        <line x1={pad} y1={pad + plot / 2} x2={pad + plot} y2={pad + plot / 2} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
        <line x1={pad + plot / 2} y1={pad} x2={pad + plot / 2} y2={pad + plot} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
        {items.map((item, i) => (
          <g key={i}>
            <circle cx={xFor(item.x)} cy={yFor(item.y)} r={5} fill={ORANGE} />
            <text
              data-editor-key={`${keyPrefix}.priorityMatrixItem${i}.label`}
              x={xFor(item.x)} y={yFor(item.y) - 9} textAnchor="middle" fontFamily={FONT_GS} fontWeight={500} fontSize={10} fill={WHITE}
            >
              {item.label}
            </text>
          </g>
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span data-editor-key={`${keyPrefix}.priorityMatrixYLabel`} style={{ fontFamily: FONT_GS, fontWeight: 500, fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
          ↑ {yLabel}
        </span>
        <span data-editor-key={`${keyPrefix}.priorityMatrixXLabel`} style={{ fontFamily: FONT_GS, fontWeight: 500, fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
          {xLabel} →
        </span>
      </div>
    </div>
  )
}

function MobileComparisonTable({ title, columns, rows, keyPrefix }: { title: string; columns: string[]; rows: Page07ComparisonTableRow[]; keyPrefix: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {title && (
        <p data-editor-key={`${keyPrefix}.comparisonTableTitle`} style={{ fontFamily: FONT_GS, fontWeight: 500, fontSize: 14, color: WHITE, margin: 0 }}>
          {title}
        </p>
      )}
      <div style={{ overflowX: 'auto', border: '0.769px solid rgba(255,255,255,0.2)', borderRadius: 6 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {columns.map((col, i) => (
                <th
                  key={i}
                  data-editor-key={`${keyPrefix}.comparisonTableColumn${i}`}
                  style={{
                    fontFamily: FONT_GS, fontWeight: 600, fontSize: 12, color: WHITE, textAlign: i === 0 ? 'left' : 'center',
                    padding: 10, background: 'rgba(228,238,240,0.04)', borderBottom: '0.769px solid rgba(255,255,255,0.2)', whiteSpace: 'nowrap',
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                <td data-editor-key={`${keyPrefix}.comparisonTableRow${ri}.label`} style={{
                  fontFamily: FONT_GS, fontWeight: 500, fontSize: 12, color: WHITE, padding: 10,
                  borderBottom: ri < rows.length - 1 ? '0.769px solid rgba(255,255,255,0.1)' : 'none', whiteSpace: 'nowrap',
                }}>
                  {row.label}
                </td>
                {row.values.map((val, ci) => (
                  <td
                    key={ci}
                    data-editor-key={`${keyPrefix}.comparisonTableRow${ri}.value${ci}`}
                    style={{
                      fontFamily: FONT_GS, fontWeight: 400, fontSize: 12, color: 'rgba(255,255,255,0.75)', textAlign: 'center', padding: 10,
                      borderBottom: ri < rows.length - 1 ? '0.769px solid rgba(255,255,255,0.1)' : 'none', whiteSpace: 'nowrap',
                    }}
                  >
                    {val}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** The mobile entry point — dispatches one block to its layout's renderer. See renderEnrichmentBlockDesktop for `keyPrefix`. */
export function renderEnrichmentBlockMobile(block: Page07EnrichmentBlock, keyPrefix: string, providerIdentity: 'novara' | 'upwork' = 'novara') {
  switch (block.layout) {
    case 'stats':
      return <MobileStatsStrip stats={block.stats} />
    case 'beforeAfter':
      return (
        <MobileBeforeAfterPanel
          beforeLabel={block.beforeLabel}
          beforeText={block.beforeText}
          afterLabel={block.afterLabel}
          afterText={block.afterText}
        />
      )
    case 'roadmap':
      return <MobileRoadmapSteps steps={block.roadmapSteps} />
    case 'opportunityCards':
      return <MobileOpportunityCards cards={block.opportunityCards} />
    case 'comparisonBars':
      return <MobileComparisonBars bars={block.comparisonBars} keyPrefix={keyPrefix} providerIdentity={providerIdentity} />
    case 'funnel':
      return <MobileFunnelChart stages={block.funnelStages} keyPrefix={keyPrefix} />
    case 'stackedBar':
      return <MobileStackedBarChart title={block.stackedBarTitle} segments={block.stackedBarSegments} keyPrefix={keyPrefix} />
    case 'treemap':
      return <MobileTreemapChart items={block.treemapItems} keyPrefix={keyPrefix} />
    case 'projection':
      return <MobileProjectionChart title={block.projectionTitle} unit={block.projectionUnit} points={block.projectionPoints} keyPrefix={keyPrefix} />
    case 'priorityMatrix':
      return <MobilePriorityMatrix xLabel={block.priorityMatrixXLabel} yLabel={block.priorityMatrixYLabel} items={block.priorityMatrixItems} keyPrefix={keyPrefix} />
    case 'comparisonTable':
      return <MobileComparisonTable title={block.comparisonTableTitle} columns={block.comparisonTableColumns} rows={block.comparisonTableRows} keyPrefix={keyPrefix} />
    default:
      return null
  }
}
