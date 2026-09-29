/**
 * ProposalPage03 — "Our Approach in Practice" page.
 * Figma source: node 4798:594 (1920×1080)
 *
 * Layout: same background + header pattern as Pages 01–02.
 * Main content: 3×2 grid of principle cards, each with an icon badge,
 * title (General Sans Medium 30px), and body (General Sans Light 22px).
 * Cards share an orange 0.585px border and a very-light teal fill.
 *
 * Restored to this exact original template — this page is part of the
 * frozen core design system and is never repurposed for dynamic/AI content.
 * See ProposalPageInsightsBusiness.tsx for where Business Intelligence
 * content now lives instead (a new page inserted after Page 07).
 */

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ProposalBackground } from './ProposalBackground'
import { DesktopTabletWrapper, MobileWrapper } from './ProposalLayout'
import { PageNumber } from './ProposalLogo'
import icon01 from '../../src/assets/p03/icon-01.png'
import icon02 from '../../src/assets/p03/icon-02.png'
import icon03 from '../../src/assets/p03/icon-03.png'
import icon04 from '../../src/assets/p03/icon-04.png'
import icon05 from '../../src/assets/p03/icon-05.png'
import icon06 from '../../src/assets/p03/icon-06.png'

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

// ─── Card data ────────────────────────────────────────────────────────────────
// Figma node 4798:662, 3-col × 2-row grid of principle cards.

const CARDS = [
  {
    icon: icon01,
    title: 'Grounded in Context',
    body: 'We start inside your numbers, not your narrative. Pipeline, conversion rates, and where deals actually die.',
  },
  {
    icon: icon02,
    title: 'Carried Through to Execution',
    body: 'We do not hand you a deck and disappear. We build the fix and stay until it is running.',
  },
  {
    icon: icon03,
    title: 'Commercially Disciplined',
    body: 'If it does not move revenue, it does not make the plan. Simple as that.',
  },
  {
    icon: icon04,
    title: 'Integrated by Design',
    body: 'Strategy, systems, and delivery sit in one team. Nothing gets lost in translation between departments.',
  },
  {
    icon: icon05,
    title: 'Focused on Momentum',
    body: 'Quick wins first. Then we build on what is already working.',
  },
  {
    icon: icon06,
    title: 'Accountable to Results',
    body: 'You will always know what has shipped, what it has done for revenue, and what is next.',
  },
] as const

// ─── Props ────────────────────────────────────────────────────────────────────

interface ProposalPage03Props {
  pageNumber?: number
}

// ─── Desktop + Tablet (≥768px) ────────────────────────────────────────────────
// 16:9 aspect-ratio canvas. All positions as % of 1920×1080 Figma canvas.

function DesktopTabletPage03({ pageNumber }: Required<ProposalPage03Props>) {
  return (
    <DesktopTabletWrapper>
      <ProposalBackground />

      {/* Heading ── Figma: 4798:633, left=90px(4.69%), top=89.86px(8.32%), w=921px(47.97%) */}
      <motion.h2
        className="absolute"
        style={{
          left: '4.6875%',
          top: '8.32%',
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
        Our Approach in{' '}
        <span style={{ color: ORANGE }}>Practice.</span>
      </motion.h2>

      {/* Subtitle ── Figma: 4798:634, left=90px(4.69%), top=184.86px(17.13%), w=741px(38.6%) */}
      <motion.p
        className="absolute"
        style={{
          left: '4.6875%',
          top: '17.13%',
          width: '38.6%',
          fontFamily: FONT_GS,
          fontWeight: 300,
          fontSize: 'clamp(14px, 1.15vw, 22px)',
          lineHeight: 1.5,
          color: WHITE,
          opacity: 0.9,
          margin: 0,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.9 }}
        transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
      >
        No theory. Just what actually moves revenue.
      </motion.p>

      {/* Page number badge ── same position and size as Page 02 (left=90.88%, top=8.36%) */}
      <div className="absolute" style={{ left: '90.88%', top: '8.36%' }}>
        <PageNumber pageNumber={pageNumber} width="clamp(30px, 4.479vw, 86px)" />
      </div>

      {/* 3×2 principle card grid */}
      {/* Figma: 4798:662  x=90 y=277.86 w=1740 h=694 */}
      {/* left: 90/1920=4.6875%  top: 277.86/1080=25.73% */}
      {/* width: 1740/1920=90.625%  height: 694/1080=64.26% */}
      <motion.div
        className="absolute grid"
        style={{
          left: '4.6875%',
          top: '25.73%',
          width: '90.625%',
          height: '64.26%',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gridTemplateRows: 'repeat(2, 1fr)',
        }}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.35, ease: 'easeOut' }}
      >
        {CARDS.map((card, i) => (
          <div
            key={i}
            style={{
              background: 'rgba(228,238,240,0.02)',
              border: '0.585px solid #FF5B04',
              padding: 'clamp(18px, 2.44vw, 46.83px)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'clamp(12px, 1.52vw, 29.27px)',
              overflow: 'hidden',
            }}
          >
            {/* Icon badge — 52.68×52.68px at Figma 1x, exported at 2x */}
            <img
              src={card.icon}
              alt=""
              aria-hidden="true"
              draggable={false}
              style={{
                width: 'clamp(32px, 2.74vw, 52.68px)',
                height: 'clamp(32px, 2.74vw, 52.68px)',
                objectFit: 'contain',
                flexShrink: 0,
              }}
            />

            {/* Title + body */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'clamp(6px, 0.61vw, 11.71px)',
            }}>
              <p style={{
                fontFamily: FONT_GS,
                fontWeight: 500,
                fontSize: 'clamp(13px, 1.5625vw, 30px)',
                letterSpacing: '-0.3px',
                lineHeight: 1.5,
                color: WHITE,
                margin: 0,
              }}>
                {card.title}
              </p>
              <p style={{
                fontFamily: FONT_GS,
                fontWeight: 300,
                fontSize: 'clamp(11px, 1.15vw, 22px)',
                letterSpacing: '-0.22px',
                lineHeight: 1.5,
                color: WHITE,
                opacity: 0.9,
                margin: 0,
              }}>
                {card.body}
              </p>
            </div>
          </div>
        ))}
      </motion.div>
    </DesktopTabletWrapper>
  )
}

// ─── Mobile (<768px) ──────────────────────────────────────────────────────────
// Single-column card stack below the heading section.

function MobilePage03({ pageNumber }: Required<ProposalPage03Props>) {
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
          Our Approach in{' '}
          <span style={{ color: ORANGE }}>Practice.</span>
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
            margin: '0 0 24px',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.9 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          No theory. Just what actually moves revenue.
        </motion.p>

        {/* Cards — 1 column */}
        <motion.div
          style={{ display: 'flex', flexDirection: 'column' }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35 }}
        >
          {CARDS.map((card, i) => (
            <div
              key={i}
              style={{
                background: 'rgba(228,238,240,0.02)',
                border: '0.585px solid #FF5B04',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              <img
                src={card.icon}
                alt=""
                aria-hidden="true"
                draggable={false}
                style={{ width: 44, height: 44, objectFit: 'contain', flexShrink: 0 }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{
                  fontFamily: FONT_GS,
                  fontWeight: 500,
                  fontSize: 16,
                  lineHeight: 1.4,
                  color: WHITE,
                  margin: 0,
                }}>
                  {card.title}
                </p>
                <p style={{
                  fontFamily: FONT_GS,
                  fontWeight: 300,
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: WHITE,
                  opacity: 0.9,
                  margin: 0,
                }}>
                  {card.body}
                </p>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </MobileWrapper>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function ProposalPage03({ pageNumber = 3 }: ProposalPage03Props) {
  const isDesktopTablet = useIsDesktopTablet()
  const [animKey, setAnimKey] = useState(0)
  useEffect(() => {
    setAnimKey(k => k + 1)
  }, [isDesktopTablet])

  return isDesktopTablet
    ? <DesktopTabletPage03 key={`dt-${animKey}`} pageNumber={pageNumber} />
    : <MobilePage03 key={`m-${animKey}`} pageNumber={pageNumber} />
}
