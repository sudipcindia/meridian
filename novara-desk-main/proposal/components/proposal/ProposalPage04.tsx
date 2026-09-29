/**
 * ProposalPage04 — "Support That Scales." page.
 * Figma source: node 4798:730 (1920×1612 frame).
 *
 * The Figma design extends 1612px — 49% taller than the 1080px slide canvas.
 * Heading is kept at full 72px (matching Pages 02-03). Gaps and tag sizes are
 * compressed proportionally so all 4 service categories fit within 1080px.
 *
 * Restored to this exact original template — this page is part of the
 * frozen core design system and is never repurposed for dynamic/AI content.
 * See ProposalPageInsightsGrowth.tsx for where Business Intelligence content
 * now lives instead (a new page inserted after Page 07).
 */

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ProposalBackground } from './ProposalBackground'
import { DesktopTabletWrapper, MobileWrapper } from './ProposalLayout'
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
const TAG_BG     = '#121E23'

// ─── Service categories ───────────────────────────────────────────────────────

const CATEGORIES = [
  {
    icon: icon01,
    title: 'Growth & Strategy',
    tags: [
      'Commercial strategy and planning',
      'Go-to-market strategy and positioning',
      'Funnel and conversion optimisation',
      'Offer structuring and pricing strategy',
      'Business expansion, M&A and exit advisory',
    ],
  },
  {
    icon: icon02,
    title: 'Digital & Creative',
    tags: [
      'Website and landing page development',
      'Brand identity and visual systems',
      'UI/UX design and optimisation',
      'AI and business automation',
      'ERP & CRM integration',
    ],
  },
  {
    icon: icon03,
    title: 'Marketing & Acquisition',
    tags: [
      'Paid media (Google, Meta, paid social)',
      'SEO and content strategy',
      'Social media strategy and growth content',
      'Lead generation frameworks',
      'Performance marketing strategy',
    ],
  },
  {
    icon: icon03,
    title: 'Operations & Systems',
    tags: [
      'CRM implementation and workflow automation',
      'Data structuring, reporting, and insights',
      'Process optimisation and efficiency',
      'Internal systems and tooling',
      'Cost efficiency and vendor management',
      'Revenue operations and pipeline architecture',
      'CRM and sales stack integration',
    ],
  },
] as const

// ─── Props ────────────────────────────────────────────────────────────────────

interface ProposalPage04Props {
  pageNumber?: number
}

// ─── Desktop + Tablet (≥768px) ────────────────────────────────────────────────

function DesktopTabletPage04({ pageNumber }: Required<ProposalPage04Props>) {
  return (
    <DesktopTabletWrapper>
      <ProposalBackground />

      {/* Page number badge — same position as Pages 02-03 */}
      {/* Figma: node 4798:771, left=1740px(90.625%), top=90px(8.33%) */}
      <div className="absolute" style={{ left: '90.625%', top: '8.33%' }}>
        <PageNumber pageNumber={pageNumber} width="clamp(30px, 4.69vw, 90px)" />
      </div>

      {/* Main content container */}
      {/* Figma: left=90px(4.6875%), top=90px(8.33%), width=1740px(90.625%) */}
      <div
        className="absolute flex flex-col"
        style={{
          left: '4.6875%',
          top: '8.33%',
          width: '90.625%',
          gap: 'clamp(12px, 1.46vw, 28px)', // compressed from Figma 60px — fits 4 cats in 1080px
        }}
      >
        {/* Header block: heading + subtitle */}
        {/* Figma: node 4817:389, width=1219px(63.49%) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '63.49%' }}>
          <motion.h2
            style={{
              fontFamily: FONT_CLASH,
              fontWeight: 600,
              fontSize: 'clamp(36px, 3.75vw, 72px)',
              lineHeight: 1.1,
              color: WHITE,
              margin: 0,
              whiteSpace: 'nowrap',
            }}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
          >
            Support That{' '}
            <span style={{ color: ORANGE }}>Scales.</span>
          </motion.h2>

          <motion.p
            style={{
              fontFamily: FONT_GS,
              fontWeight: 300,
              fontSize: 'clamp(12px, 0.94vw, 18px)',
              lineHeight: 1.5,
              color: WHITE,
              opacity: 0.9,
              margin: 0,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.9 }}
            transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
          >
            Built for founders who need revenue systems that work, not another vendor to manage.
          </motion.p>
        </div>

        {/* Service categories */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'clamp(10px, 1.67vw, 32px)', // compressed from Figma 58px
          }}
        >
          {CATEGORIES.map((cat, i) => (
            <motion.div
              key={cat.title}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'clamp(6px, 0.73vw, 14px)', // icon-title gap + title-tags gap; Figma 33.606px
              }}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 + i * 0.08, ease: 'easeOut' }}
            >
              {/* Icon + category title */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'clamp(8px, 1.04vw, 20px)' }}>
                <img
                  src={cat.icon}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  style={{
                    width: 'clamp(22px, 1.875vw, 36px)',
                    height: 'clamp(22px, 1.875vw, 36px)',
                    objectFit: 'contain',
                    flexShrink: 0,
                  }}
                />
                <p
                  style={{
                    fontFamily: FONT_GS,
                    fontWeight: 500,
                    fontSize: 'clamp(12px, 1.15vw, 22px)',
                    letterSpacing: '-0.3px',
                    lineHeight: 1.5,
                    color: WHITE,
                    margin: 0,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {cat.title}
                </p>
              </div>

              {/* Pill tags — flex-wrap */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 'clamp(6px, 0.73vw, 14px)', // Figma 33.606px compressed
                }}
              >
                {cat.tags.map((tag) => (
                  <div
                    key={tag}
                    style={{
                      background: TAG_BG,
                      border: '0.672px solid rgba(255,255,255,0.2)',
                      borderRadius: 'clamp(3px, 0.23vw, 4.5px)',
                      padding: 'clamp(5px, 0.52vw, 10px) clamp(6px, 0.625vw, 12px)',
                      flexShrink: 0,
                    }}
                  >
                    <p
                      style={{
                        fontFamily: FONT_GS,
                        fontWeight: 400,
                        fontSize: 'clamp(10px, 0.885vw, 17px)',
                        letterSpacing: '-0.22px',
                        lineHeight: 1.5,
                        color: WHITE,
                        margin: 0,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      • {tag}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </DesktopTabletWrapper>
  )
}

// ─── Mobile (<768px) ──────────────────────────────────────────────────────────

function MobilePage04({ pageNumber }: Required<ProposalPage04Props>) {
  return (
    <MobileWrapper>
      <ProposalBackground />
      <div
        className="relative z-10 flex flex-col w-full"
        style={{ minHeight: '100dvh', padding: '24px 22px 48px' }}
      >
        {/* Page number */}
        <motion.div
          className="flex items-center justify-end"
          style={{ marginBottom: 20 }}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <PageNumber pageNumber={pageNumber} width="30px" />
        </motion.div>

        {/* Heading */}
        <motion.h2
          style={{
            fontFamily: FONT_CLASH,
            fontWeight: 600,
            fontSize: 'clamp(30px, 9vw, 48px)',
            lineHeight: 1.1,
            color: WHITE,
            margin: '0 0 10px',
          }}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          Support That{' '}
          <span style={{ color: ORANGE }}>Scales.</span>
        </motion.h2>

        {/* Subtitle */}
        <motion.p
          style={{
            fontFamily: FONT_GS,
            fontWeight: 300,
            fontSize: 15,
            lineHeight: 1.5,
            color: WHITE,
            opacity: 0.9,
            margin: '0 0 28px',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.9 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          Built for founders who need revenue systems that work, not another vendor to manage.
        </motion.p>

        {/* Categories */}
        <motion.div
          style={{ display: 'flex', flexDirection: 'column', gap: 28 }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
        >
          {CATEGORIES.map((cat) => (
            <div key={cat.title} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Icon + title */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <img
                  src={cat.icon}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  style={{ width: 28, height: 28, objectFit: 'contain', flexShrink: 0 }}
                />
                <p style={{
                  fontFamily: FONT_GS,
                  fontWeight: 500,
                  fontSize: 16,
                  letterSpacing: '-0.3px',
                  lineHeight: 1.4,
                  color: WHITE,
                  margin: 0,
                }}>
                  {cat.title}
                </p>
              </div>
              {/* Tags */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {cat.tags.map((tag) => (
                  <div
                    key={tag}
                    style={{
                      background: TAG_BG,
                      border: '0.672px solid rgba(255,255,255,0.2)',
                      borderRadius: 4,
                      padding: '7px 10px',
                    }}
                  >
                    <p style={{
                      fontFamily: FONT_GS,
                      fontWeight: 400,
                      fontSize: 13,
                      letterSpacing: '-0.22px',
                      lineHeight: 1.4,
                      color: WHITE,
                      margin: 0,
                    }}>
                      • {tag}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </MobileWrapper>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function ProposalPage04({ pageNumber = 4 }: ProposalPage04Props) {
  const isDesktopTablet = useIsDesktopTablet()
  const [animKey, setAnimKey] = useState(0)
  useEffect(() => {
    setAnimKey(k => k + 1)
  }, [isDesktopTablet])

  return isDesktopTablet
    ? <DesktopTabletPage04 key={`dt-${animKey}`} pageNumber={pageNumber} />
    : <MobilePage04 key={`m-${animKey}`} pageNumber={pageNumber} />
}
