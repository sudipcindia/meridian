/**
 * ProposalPageDynamicInsight — generic renderer for the 8 reserved
 * "dynamicInsight01".."08" page slots (see masterTemplate/index.ts).
 *
 * Unlike insightsBusiness/insightsGrowth (one bespoke component each, fixed
 * content shape, always present), every dynamic slot shares this ONE
 * component — what varies per-instance is entirely data: an AI-chosen
 * title/kicker plus 1-2 visual blocks drawn from the same 11-layout
 * library Page 07's own enrichment slot uses (see
 * blocks/enrichmentBlockRenderers.tsx, shared rather than forked). Which
 * (if any) of the 8 slots actually appear in a given proposal, and what
 * each one contains, is decided per-proposal by the Content Architect step
 * of the Meeting-Transcript auto-flow — a proposal with none of these ids
 * present renders identically to before this feature existed.
 */

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ProposalBackground } from './ProposalBackground'
import { MobileWrapper } from './ProposalLayout'
import { PageNumber } from './ProposalLogo'
import {
  FONT_CLASH, FONT_GS, WHITE, ORANGE,
  renderEnrichmentBlockDesktop, renderEnrichmentBlockMobile,
  type Page07EnrichmentBlock,
} from './blocks/enrichmentBlockRenderers'

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

export interface ProposalPageDynamicInsightProps {
  /** Which of the 8 reserved slots this instance is (e.g. 'dynamicInsight01') — scopes every data-editor-key on this page uniquely, since up to 8 instances of this same component can render in one document at once (unlike insightsBusiness/insightsGrowth, which only ever have one instance each). */
  pageId?: string
  title?: string
  kicker?: string
  /** 1-2 AI-selected visual blocks, same shape/rules as Page07's own enrichment slot — never two of the same layout. */
  blocks?: Page07EnrichmentBlock[]
  pageNumber?: number
  /** Who this proposal represents as the provider/brand — see ProposalPage10's identical prop for the full rationale. Only affects the "With Novara"/"With Jayson" comparison-chart legend label here; defaults to 'novara' so every existing render is unchanged. */
  providerIdentity?: 'novara' | 'upwork'
}

const DEFAULT_PAGE_ID = 'dynamicInsight01'
const DEFAULT_TITLE = 'A Closer Look.'
const DEFAULT_BLOCKS: Page07EnrichmentBlock[] = []

// ─── Desktop + Tablet (≥768px) ────────────────────────────────────────────────

function DesktopTabletDynamicInsight({ pageId, title, kicker, blocks, pageNumber, providerIdentity }: Required<ProposalPageDynamicInsightProps>) {
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {kicker && (
            <motion.p
              data-editor-key={`${pageId}.kicker`}
              style={{
                fontFamily: FONT_GS, fontWeight: 500, fontSize: 'clamp(12px, 0.94vw, 18px)',
                lineHeight: 1.5, color: 'rgba(255,255,255,0.55)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em',
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.05, ease: 'easeOut' }}
            >
              {kicker}
            </motion.p>
          )}
          <motion.h2
            data-editor-key={`${pageId}.title`}
            style={{
              fontFamily: FONT_CLASH, fontWeight: 600, fontSize: 'clamp(36px, 3.75vw, 72px)',
              lineHeight: 1.1, color: WHITE, margin: 0,
            }}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
          >
            {title}
          </motion.h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(28px, 3.2vw, 62px)' }}>
          {blocks.map((block, i) => (
            <motion.div
              key={i}
              style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(8px, 0.96vw, 18px)' }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 + i * 0.1, ease: 'easeOut' }}
            >
              {renderEnrichmentBlockDesktop(block, `${pageId}.block${i}`, providerIdentity)}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Mobile (<768px) ──────────────────────────────────────────────────────────

function MobileDynamicInsight({ pageId, title, kicker, blocks, pageNumber, providerIdentity }: Required<ProposalPageDynamicInsightProps>) {
  return (
    <MobileWrapper>
      <ProposalBackground />
      <div className="relative z-10 flex flex-col w-full" style={{ minHeight: '100dvh', padding: '24px 22px 48px' }}>
        <div className="flex items-center justify-end" style={{ marginBottom: 20 }}>
          <PageNumber pageNumber={pageNumber} width="30px" />
        </div>

        {kicker && (
          <motion.p
            data-editor-key={`${pageId}.kicker`}
            style={{
              fontFamily: FONT_GS, fontWeight: 500, fontSize: 12, lineHeight: 1.5, color: 'rgba(255,255,255,0.55)',
              margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.04em',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.05 }}
          >
            {kicker}
          </motion.p>
        )}
        <motion.h2
          data-editor-key={`${pageId}.title`}
          style={{ fontFamily: FONT_CLASH, fontWeight: 600, fontSize: 'clamp(30px, 9vw, 48px)', lineHeight: 1.1, color: WHITE, margin: '0 0 20px' }}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          {title}
        </motion.h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {blocks.map((block, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 + i * 0.08 }}
            >
              {renderEnrichmentBlockMobile(block, `${pageId}.block${i}`, providerIdentity)}
            </motion.div>
          ))}
        </div>
      </div>
    </MobileWrapper>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function ProposalPageDynamicInsight({
  pageId = DEFAULT_PAGE_ID,
  title = DEFAULT_TITLE,
  kicker = '',
  blocks = DEFAULT_BLOCKS,
  pageNumber = 8,
  providerIdentity = 'novara',
}: ProposalPageDynamicInsightProps) {
  const isDesktopTablet = useIsDesktopTablet()
  const [animKey, setAnimKey] = useState(0)
  useEffect(() => {
    setAnimKey((k) => k + 1)
  }, [isDesktopTablet])

  return isDesktopTablet
    ? <DesktopTabletDynamicInsight key={`dt-${animKey}`} pageId={pageId} title={title} kicker={kicker} blocks={blocks} pageNumber={pageNumber} providerIdentity={providerIdentity} />
    : <MobileDynamicInsight key={`m-${animKey}`} pageId={pageId} title={title} kicker={kicker} blocks={blocks} pageNumber={pageNumber} providerIdentity={providerIdentity} />
}
