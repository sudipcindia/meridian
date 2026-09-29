/**
 * ProposalPage05 — "Experience Across Sectors." page.
 * Figma source: node 4817:391 (1920×1294 frame; slide visible area 1920×1080).
 *
 * Two sections:
 *  1. Header + description + client logo grid (5×2, orange-bordered cells)
 *  2. Certifications (full-width divider, heading, 5 white cert cards)
 *
 * The logo grid and cert cards are downloaded as composite PNG images to avoid
 * re-implementing complex CSS masking needed for the white logos.
 */

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ProposalBackground } from './ProposalBackground'
import { DesktopTabletWrapper, MobileWrapper } from './ProposalLayout'
import { PageNumber } from './ProposalLogo'
import logoGrid from '../../src/assets/p05/logo-grid.png'
import certCards from '../../src/assets/p05/cert-cards.png'

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

// ─── Desktop + Tablet (≥768px) ────────────────────────────────────────────────
// All positions as % of the 1920×1080 Figma slide canvas.
// calc() top values use % of canvas height — identical expressions work for
// both the 1294px Figma frame and our 1080px canvas since the % reference
// point is the containing block (DesktopTabletWrapper, always 16:9).

interface ProposalPage05Props {
  pageNumber?: number
}

function DesktopTabletPage05({ pageNumber }: Required<ProposalPage05Props>) {
  return (
    <>
    <DesktopTabletWrapper>
      <ProposalBackground />

      {/* Page number badge */}
      {/* Figma: node 4817:432, left=1740px(90.625%), top=90px(8.33%), w=87px */}
      <div className="absolute" style={{ left: '90.625%', top: '8.33%' }}>
        <PageNumber pageNumber={pageNumber} width="clamp(30px, 4.54vw, 87px)" />
      </div>

      {/* Header container: heading + description */}
      {/* Figma: node 4836:349, left=90px(4.69%), top=90px(8.33%), width=1741px(90.68%), gap=40px */}
      <div
        className="absolute flex flex-col"
        style={{
          left: '4.6875%',
          top: '8.33%',
          width: '90.68%',
          gap: 'clamp(16px, 2.08vw, 40px)',
        }}
      >
        {/* Heading block — constrained to 1219px (63.49% of 1920) */}
        {/* Figma: node 4817:429 */}
        <motion.h2
          style={{
            fontFamily: FONT_CLASH,
            fontWeight: 600,
            fontSize: 'clamp(36px, 3.75vw, 72px)',
            lineHeight: 1.1,
            color: WHITE,
            margin: 0,
            maxWidth: '63.49%',
            whiteSpace: 'nowrap',
          }}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
        >
          Experience Across{' '}
          <span style={{ color: ORANGE }}>Sectors.</span>
        </motion.h2>

        {/* Description paragraph — full width, General Sans Light 24px */}
        {/* Figma: node 4817:514 */}
        <motion.p
          style={{
            fontFamily: FONT_GS,
            fontWeight: 300,
            fontSize: 'clamp(14px, 1.25vw, 24px)',
            lineHeight: 1.5,
            color: WHITE,
            margin: 0,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
        >
          We have rebuilt revenue engines across healthcare, technology, consumer brands, and
          operations-heavy businesses. Different sectors, same problem: growth outpacing the
          systems meant to support it.
        </motion.p>
      </div>

      {/* "Founders who trusted us..." sub-label */}
      {/* Figma: node 4920:25, left=90px(4.69%), top=calc(20%+84.2px), 26px GS Medium */}
      <motion.p
        className="absolute"
        style={{
          left: '4.6875%',
          top: 'calc(20% + 84.2px)',
          width: '90.68%',
          fontFamily: FONT_GS,
          fontWeight: 500,
          fontSize: 'clamp(16px, 1.354vw, 26px)',
          lineHeight: 1.5,
          color: WHITE,
          margin: 0,
        }}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.25, ease: 'easeOut' }}
      >
        Founders who trusted us to fix what was costing them revenue.
      </motion.p>

      {/* Client logo grid — 5×2, rendered as composite PNG */}
      {/* Figma: node 4817:515, left=90px(4.69%), top=calc(20%+153.2px), w=1726px(89.9%), h=317px */}
      <motion.div
        className="absolute"
        style={{ left: '4.6875%', top: 'calc(20% + 153.2px)', width: '89.9%' }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.35, ease: 'easeOut' }}
      >
        <img
          src={logoGrid}
          alt="Client logos: Regrow, LeShuttle, BBC Earth, Armorgie, Costa Coffee, Nailson, Nick Rutter, Sky Matrix, Zeltri, and many more"
          draggable={false}
          style={{ display: 'block', width: '100%', height: 'auto' }}
        />
      </motion.div>

      {/* Certifications section */}
      {/* Figma: node 4817:618, left=0, top=calc(60%+54.6px), width=1920px, flex-col gap=70px */}
      <motion.div
        className="absolute flex flex-col items-center"
        style={{
          left: 0,
          top: 'calc(60% + 54.6px)',
          width: '100%',
          gap: 'clamp(24px, 3.65vw, 70px)',
        }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.5, ease: 'easeOut' }}
      >
        {/* Full-width divider line */}
        <div
          aria-hidden="true"
          style={{
            width: '100%',
            height: 0,
            borderTop: '0.753px solid rgba(228,238,240,0.12)',
          }}
        />

        {/* "Certifications." heading */}
        {/* Figma: px=112px(5.83%), Clash Display Semibold 72px */}
        <h3
          style={{
            fontFamily: FONT_CLASH,
            fontWeight: 600,
            fontSize: 'clamp(36px, 3.75vw, 72px)',
            lineHeight: 1.1,
            color: WHITE,
            margin: 0,
            padding: '0 5.83%',
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          Certifications<span style={{ color: ORANGE }}>.</span>
        </h3>

        {/* Certification card images — 5 white cards, rendered as composite PNG */}
        {/* Figma: node 4817:620, w=1694px(88.23%), within px=112px(5.83%) container */}
        <div
          style={{
            width: '100%',
            padding: '0 5.83%',
            boxSizing: 'border-box',
          }}
        >
          <img
            src={certCards}
            alt="Certifications: Bark Elite Pro, Trustpilot, Google Partner, Bing Partner, Meta Business Partner"
            draggable={false}
            style={{ display: 'block', width: '100%', height: 'auto' }}
          />
        </div>
      </motion.div>
    </DesktopTabletWrapper>
    <div aria-hidden style={{ height: 'clamp(24px, 3.125vw, 60px)' }} />
    </>
  )
}

// ─── Mobile (<768px) ──────────────────────────────────────────────────────────

function MobilePage05({ pageNumber }: Required<ProposalPage05Props>) {
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
            fontSize: 'clamp(30px, 9vw, 48px)',
            lineHeight: 1.1,
            color: WHITE,
            margin: '0 0 10px',
          }}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          Experience Across{' '}
          <span style={{ color: ORANGE }}>Sectors.</span>
        </motion.h2>

        {/* Description */}
        <motion.p
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
          We have rebuilt revenue engines across healthcare, technology, consumer brands, and
          operations-heavy businesses. Different sectors, same problem: growth outpacing the
          systems meant to support it.
        </motion.p>

        {/* Sub-label */}
        <motion.p
          style={{
            fontFamily: FONT_GS,
            fontWeight: 500,
            fontSize: 15,
            lineHeight: 1.5,
            color: WHITE,
            margin: '0 0 16px',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.25 }}
        >
          Founders who trusted us to fix what was costing them revenue.
        </motion.p>

        {/* Logo grid */}
        <motion.img
          src={logoGrid}
          alt="Client logos"
          draggable={false}
          style={{ display: 'block', width: '100%', height: 'auto', margin: '0 0 32px' }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
        />

        {/* Certifications */}
        <div style={{ borderTop: '0.753px solid rgba(228,238,240,0.15)', marginBottom: 20 }} />
        <motion.h3
          style={{
            fontFamily: FONT_CLASH,
            fontWeight: 600,
            fontSize: 'clamp(28px, 8vw, 40px)',
            lineHeight: 1.1,
            color: WHITE,
            margin: '0 0 16px',
          }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          Certifications<span style={{ color: ORANGE }}>.</span>
        </motion.h3>
        <motion.img
          src={certCards}
          alt="Certifications"
          draggable={false}
          style={{ display: 'block', width: '100%', height: 'auto' }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.45 }}
        />
      </div>
    </MobileWrapper>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function ProposalPage05({ pageNumber = 5 }: ProposalPage05Props) {
  const isDesktopTablet = useIsDesktopTablet()
  const [animKey, setAnimKey] = useState(0)
  useEffect(() => {
    setAnimKey(k => k + 1)
  }, [isDesktopTablet])

  return isDesktopTablet
    ? <DesktopTabletPage05 key={`dt-${animKey}`} pageNumber={pageNumber} />
    : <MobilePage05 key={`m-${animKey}`} pageNumber={pageNumber} />
}
