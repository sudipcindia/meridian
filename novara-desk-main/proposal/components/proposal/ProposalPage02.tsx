/**
 * ProposalPage02 — "Who We Are" page.
 *
 * Architecture mirrors ProposalCover exactly:
 *  DesktopTabletWrapper (≥768px): 16:9 absolute-% canvas, vw font sizes
 *  MobileWrapper (<768px): full-height flex-column stack
 *  useIsDesktopTablet(): renders exactly one layout tree at a time
 *
 * Figma source: node 4943:116 "Who We Are" (1920×1080)
 * Editable props: welcomeHeading, introParagraph, companyDescription
 */

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ProposalBackground } from './ProposalBackground'
import { DesktopTabletWrapper, MobileWrapper } from './ProposalLayout'
import { PageNumber } from './ProposalLogo'
import chessMaskedImg from '../../src/assets/p02/chess-masked.png'
import subtractSvg from '../../src/assets/p02/subtract.svg'

// ─── Breakpoint hook (mirrors ProposalCover) ──────────────────────────────────

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

export interface ProposalPage02Props {
  /** Orange welcome heading. */
  welcomeHeading?: string
  /** First paragraph directly under the orange heading. */
  introParagraph?: string
  /** Main body about the provider (Novara Consult, or Jayson Kandiah for Upwork). Use \\n\\n to create paragraph breaks. Only affects the DEFAULT text below — an AI-generated companyDescription (the normal case) is unaffected by this prop. */
  companyDescription?: string
  pageNumber?: number
  /** Who this proposal represents as the provider/brand — see ProposalPage10's identical prop for the full rationale. Only changes the DEFAULT companyDescription fallback text; defaults to 'novara' so every existing render is unchanged. */
  providerIdentity?: 'novara' | 'upwork'
}

// ─── Fixed copy (non-editable) ────────────────────────────────────────────────

const SECTION_HEADING = 'Who We Are'
const SECTION_SUBTITLE = 'A RevOps consultancy that gets inside your pipeline, not just your slide deck.'

// ─── Default editable content ─────────────────────────────────────────────────

const DEFAULT_WELCOME = 'Welcome, [Client First Name]'

const DEFAULT_INTRO =
  'Most founders find out their revenue process is broken when the numbers stop adding up. By then it has already cost them deals.'

const DEFAULT_COMPANY =
  'Novara is a RevOps consultancy built for founders who need their sales and marketing systems working as one, not bolted together. We get inside the pipeline, find where revenue is leaking, and fix it.\n\nStrategy, systems, and execution sit under one roof. No handoffs. No agency relay race. Everything is owned and delivered in the UK, directly by us.'

const DEFAULT_COMPANY_UPWORK =
  "I'm an independent RevOps consultant who works directly with founders who need their sales and marketing systems working as one, not bolted together. I get inside the pipeline, find where revenue is leaking, and fix it.\n\nStrategy, systems, and execution sit under one roof. No handoffs. No agency relay race. Everything is delivered in the UK, directly by me."

// ─── Shared tokens ────────────────────────────────────────────────────────────

const FONT_CLASH = 'Clash Display, sans-serif'
const FONT_GS    = 'General Sans, sans-serif'
const WHITE      = '#FFFFFF'
const ORANGE     = '#FF5B04'

// ─── Desktop + Tablet (≥768px) ────────────────────────────────────────────────
// 16:9 aspect-ratio canvas. All positions expressed as % of 1920×1080.
// Figma pixel → %: leftPct = px/1920×100, topPct = px/1080×100

function DesktopTabletPage02({
  welcomeHeading, introParagraph, companyDescription, pageNumber,
}: Required<ProposalPage02Props>) {
  return (
    <DesktopTabletWrapper>
      <ProposalBackground />

      {/* ── Chess image LAYER 1: crown + arch area (y=0–422) ─────────────── */}
      {/* Covers page y=0–422: the queen crown (mask-no-clip above mask group at
          y=272) plus the arch column (y=272–422). mix-blend-mode: lighten makes
          the dark chess background disappear (max(chess_dark, page_dark) ≈ page
          bg) while keeping the bright orange queen prominent. Height=39.07%
          matches Figma page y=422/1080 — the rectangle top. */}
      <motion.div
        className="absolute"
        style={{
          left: '4.69%',
          top: 0,
          width: '34.84%',
          height: '39.07%',
          overflow: 'hidden',
          mixBlendMode: 'lighten',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.9, delay: 0.25, ease: 'easeOut' }}
      >
        <img
          src={chessMaskedImg}
          alt=""
          aria-hidden={true}
          draggable={false}
          style={{ position: 'absolute', top: '7.661vw', left: 0, width: '100%', height: 'auto' }}
        />
      </motion.div>

      {/* ── Chess image LAYER 2: rectangle card (y=422–1080) ─────────────── */}
      {/* Starts at Figma page y=422 (39.07%) — the rectangle portion of the
          masked chess card. 30px border-radius (1.5625vw = 30px at 1920px canvas)
          on top corners matches the Figma rectangle shape. Image bottom-anchored
          so the chess board fills the card bottom. */}
      <motion.div
        className="absolute"
        style={{
          left: '4.69%',
          top: '39.07%',
          width: '34.84%',
          height: '60.93%',
          overflow: 'hidden',
          borderRadius: '1.5625vw 1.5625vw 0 0',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.9, delay: 0.25, ease: 'easeOut' }}
      >
        <img
          src={chessMaskedImg}
          alt="Chess queen — strategic positioning"
          draggable={false}
          style={{
            position: 'absolute',
            top: 'calc(-14.318vw)',
            left: 0,
            width: '100%',
            height: 'auto',
          }}
        />
      </motion.div>

      {/* ── Orange corner accent ── */}
      {/* Figma: 4943:173 "Subtract", left=729px(37.97%), top=407px(37.69%), 44×44px.
          Sits 15px above the rectangle card top (page y=422), flush with the
          top-right corner where the 30px border-radius begins (page x=729). */}
      <div
        aria-hidden="true"
        className="absolute"
        style={{ left: '37.97%', top: '37.69%', width: 44, height: 44 }}
      >
        <img
          src={subtractSvg}
          alt=""
          draggable={false}
          style={{ display: 'block', width: '100%', height: '100%' }}
        />
      </div>

      {/* ── "Who We Are" section heading — rendered after chess so it sits on top ── */}
      {/* Figma: left=90px(4.69%), top=89.86px(8.32%), 72px Clash Display Semibold */}
      <motion.h2
        data-editor-key="page02.heading"
        className="absolute"
        style={{
          left: '4.69%',
          top: '8.32%',
          fontFamily: FONT_CLASH,
          fontWeight: 600,
          fontSize: 'clamp(36px, 3.75vw, 72px)',
          lineHeight: 1.1,
          color: WHITE,
          width: '40.6%',
          margin: 0,
        }}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
      >
        {SECTION_HEADING}
      </motion.h2>

      {/* ── Subtitle ── */}
      {/* Figma: left=4.69%, top=185px(17.13%), 22px General Sans Light */}
      <motion.p
        data-editor-key="page02.subtitle"
        className="absolute"
        style={{
          left: '4.69%',
          top: '17.13%',
          width: '38.6%',
          fontFamily: FONT_GS,
          fontWeight: 300,
          fontSize: 'clamp(14px, 1.15vw, 22px)',
          lineHeight: 1.5,
          color: WHITE,
          margin: 0,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.9 }}
        transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
      >
        {SECTION_SUBTITLE}
      </motion.p>

      {/* ── Page number badge ── */}
      {/* Figma: left=1745px(90.88%), top=90.3px(8.36%) */}
      <div className="absolute" style={{ left: '90.88%', top: '8.36%' }}>
        <PageNumber pageNumber={pageNumber} width="clamp(30px, 4.479vw, 86px)" />
      </div>

      {/* ── Right text block ── */}
      {/* Figma: 4943:152, left=895px(46.6%), top=418px(38.7%), width=935px(48.7%), gap=18px */}
      <motion.div
        className="absolute flex flex-col"
        style={{
          left: '46.6%',
          top: '38.7%',
          width: '48.7%',
          gap: 'clamp(10px, 0.94vw, 18px)',
        }}
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, delay: 0.45, ease: 'easeOut' }}
      >
        {/* Orange welcome heading */}
        <p data-editor-key="page02.welcomeHeading" style={{
          fontFamily: FONT_GS,
          fontWeight: 600,
          fontSize: 'clamp(15px, 1.25vw, 24px)',
          lineHeight: 'normal',
          color: ORANGE,
          margin: 0,
        }}>
          {welcomeHeading}
        </p>

        {/* Intro paragraph */}
        <p data-editor-key="page02.introParagraph" style={{
          fontFamily: FONT_GS,
          fontWeight: 400,
          fontSize: 'clamp(13px, 1.25vw, 24px)',
          lineHeight: 1.6,
          color: WHITE,
          opacity: 0.92,
          margin: 0,
        }}>
          {introParagraph}
        </p>

        {/* Company description — \n\n rendered as paragraph breaks */}
        <p data-editor-key="page02.companyDescription" style={{
          fontFamily: FONT_GS,
          fontWeight: 400,
          fontSize: 'clamp(13px, 1.25vw, 24px)',
          lineHeight: 1.6,
          color: WHITE,
          opacity: 0.92,
          whiteSpace: 'pre-line',
          margin: 0,
        }}>
          {companyDescription}
        </p>
      </motion.div>
    </DesktopTabletWrapper>
  )
}

// ─── Mobile (<768px) ──────────────────────────────────────────────────────────
// Flex-column full-height stack. Image placed above the text content.

function MobilePage02({
  welcomeHeading, introParagraph, companyDescription, pageNumber,
}: Required<ProposalPage02Props>) {
  return (
    <MobileWrapper>
      <ProposalBackground />

      <div
        className="relative z-10 flex flex-col w-full"
        style={{ minHeight: '100dvh', padding: '24px 22px 48px' }}
      >
        {/* ── Header: page number ── */}
        <div className="flex items-center justify-end" style={{ marginBottom: 20 }}>
          <PageNumber pageNumber={pageNumber} width="30px" />
        </div>

        {/* ── Section heading ── */}
        <motion.h2
          data-editor-key="page02.heading"
          style={{
            fontFamily: FONT_CLASH,
            fontWeight: 600,
            fontSize: 'clamp(36px, 10vw, 56px)',
            lineHeight: 1.1,
            color: WHITE,
            margin: '0 0 10px',
          }}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          {SECTION_HEADING}
        </motion.h2>

        {/* ── Subtitle ── */}
        <motion.p
          data-editor-key="page02.subtitle"
          style={{
            fontFamily: FONT_GS,
            fontWeight: 300,
            fontSize: 15,
            lineHeight: 1.5,
            color: WHITE,
            margin: '0 0 24px',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.9 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          {SECTION_SUBTITLE}
        </motion.p>

        {/* ── Chess image — full-bleed, rounded top corners, no coloured wrapper ── */}
        <motion.div
          style={{
            margin: '0 -22px 32px',
            overflow: 'hidden',
            borderRadius: '12px 12px 0 0',
          }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.25 }}
        >
          <img
            src={chessMaskedImg}
            alt="Chess queen — strategic positioning"
            draggable={false}
            style={{ display: 'block', width: '100%', height: 'auto' }}
          />
        </motion.div>

        {/* ── Text content ── */}
        <motion.div
          className="flex flex-col"
          style={{ gap: 18 }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.45 }}
        >
          {/* Orange welcome heading */}
          <p data-editor-key="page02.welcomeHeading" style={{
            fontFamily: FONT_GS,
            fontWeight: 600,
            fontSize: 17,
            lineHeight: 'normal',
            color: ORANGE,
            margin: 0,
          }}>
            {welcomeHeading}
          </p>

          {/* Intro paragraph */}
          <p data-editor-key="page02.introParagraph" style={{
            fontFamily: FONT_GS,
            fontWeight: 400,
            fontSize: 15,
            lineHeight: 1.65,
            color: WHITE,
            opacity: 0.92,
            margin: 0,
          }}>
            {introParagraph}
          </p>

          {/* Company description */}
          <p data-editor-key="page02.companyDescription" style={{
            fontFamily: FONT_GS,
            fontWeight: 400,
            fontSize: 15,
            lineHeight: 1.65,
            color: WHITE,
            opacity: 0.92,
            whiteSpace: 'pre-line',
            margin: 0,
          }}>
            {companyDescription}
          </p>
        </motion.div>
      </div>
    </MobileWrapper>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function ProposalPage02({
  welcomeHeading = DEFAULT_WELCOME,
  introParagraph = DEFAULT_INTRO,
  companyDescription,
  pageNumber = 2,
  providerIdentity = 'novara',
}: ProposalPage02Props) {
  const isDesktopTablet = useIsDesktopTablet()
  const resolvedCompanyDescription = companyDescription ?? (providerIdentity === 'upwork' ? DEFAULT_COMPANY_UPWORK : DEFAULT_COMPANY)
  const props = { welcomeHeading, introParagraph, companyDescription: resolvedCompanyDescription, pageNumber, providerIdentity }

  const [animKey, setAnimKey] = useState(0)
  useEffect(() => {
    setAnimKey(k => k + 1)
  }, [isDesktopTablet])

  return isDesktopTablet
    ? <DesktopTabletPage02 key={`dt-${animKey}`} {...props} />
    : <MobilePage02 key={`m-${animKey}`} {...props} />
}
