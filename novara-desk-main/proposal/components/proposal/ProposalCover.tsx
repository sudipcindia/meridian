/**
 * ProposalCover — responsive Cover Page.
 *
 * Three true adaptive breakpoints (no CSS scale / ResizeObserver):
 *
 *
 * Desktop  (≥1440px)   aspect-ratio 16:9, absolute-% positions, vw font sizes
 * Tablet   (768–1439px) same layout, clamp() enforces readable floor sizes
 * Mobile   (<768px)     flex-column stack, vertically stacked content
 */

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ProposalBackground } from './ProposalBackground'
import { FloatingTag } from './FloatingTag'
import { ProposalInfo } from './ProposalInfo'
import { DesktopTabletWrapper, MobileWrapper } from './ProposalLayout'
import { DEFAULT_LOGO_URL, PageNumber } from './ProposalLogo'
import logoSvg from '../../src/assets/logo.svg'

// Returns true when viewport ≥ 768px. Initialises synchronously from window.matchMedia
// so there is no layout flash on first render.
function useIsDesktopTablet(): boolean {
  const [isDesktopTablet, setIsDesktopTablet] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(min-width: 768px)').matches
      : true
  )
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)')
    const handler = (e: MediaQueryListEvent) => setIsDesktopTablet(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])
  return isDesktopTablet
}

// ─── Public types ─────────────────────────────────────────────────────────────

export interface TagData {
  text: string
}

export interface ProposalCoverProps {
  title?: string
  subtitle?: string
  description?: string
  clientName?: string
  preparedBy?: string
  tags?: TagData[]
  pageNumber?: number
  logoUrl?: string
  /** Who this proposal represents as the provider/brand — the Upwork use case hides the Novara wordmark entirely (this is presented as Jayson Kandiah personally, not a Novara Consult document). Plain inline union, matching the pattern already used by ProposalPage10/11's identical prop. Defaults to 'novara' so every existing render is unchanged. */
  providerIdentity?: 'novara' | 'upwork'
}

// ─── Tag slot design tokens ───────────────────────────────────────────────────
//
// Positions expressed as % of the original 1920×1080 Figma canvas:
//   leftPct  = px / 1920 × 100
//   topPct   = px / 1080 × 100
//   widthPct = containerW / 1920 × 100
//   heightPct= containerH / 1080 × 100

interface TagSlot {
  bg: string
  border?: string
  textColor: string
  rotation: number
  leftPct: string
  topPct: string
  widthPct: string
  heightPct: string
  floatDuration: number
  floatDelay: number
}

const TAG_SLOTS: TagSlot[] = [
  // 0 – Diagnose
  {
    bg: 'rgba(228,238,240,0.12)', border: '1px solid rgba(228,238,240,0.22)',
    textColor: '#E4EEF0', rotation: -8,
    leftPct: '26.25%', topPct: '20.46%', widthPct: '8.59%', heightPct: '8.80%',
    floatDuration: 3.2, floatDelay: 0,
  },
  // 1 – Fix
  {
    bg: '#FFFFFF', textColor: '#FF5B04', rotation: -14,
    leftPct: '46.30%', topPct: '36.48%', widthPct: '8.85%', heightPct: '10.19%',
    floatDuration: 2.8, floatDelay: 0.4,
  },
  // 2 – Automate
  {
    bg: '#0FAFBC', textColor: '#FFFFFF', rotation: 11,
    leftPct: '68.49%', topPct: '29.07%', widthPct: '8.44%', heightPct: '8.52%',
    floatDuration: 3.5, floatDelay: 0.8,
  },
  // 3 – Convert
  {
    bg: '#075056', textColor: '#FFFFFF', rotation: 4,
    leftPct: '35.89%', topPct: '58.33%', widthPct: '8.13%', heightPct: '6.85%',
    floatDuration: 3.0, floatDelay: 1.2,
  },
  // 4 – Scale
  {
    bg: '#FF5B04', textColor: '#E4EEF0', rotation: -5,
    leftPct: '65.36%', topPct: '59.44%', widthPct: '8.18%', heightPct: '7.13%',
    floatDuration: 2.6, floatDelay: 0.6,
  },
]

// Mobile positions for each tag slot (relative to the title container)
const MOBILE_TAG_POS: React.CSSProperties[] = [
  // 0 Diagnose – above title, far left
  { position: 'absolute', top: -4, left: '2%' },
  // 1 Fix – middle of title, right-centre
  { position: 'absolute', top: '48%', right: '2%', transform: 'translateY(-50%)' },
  // 2 Automate – above title, far right
  { position: 'absolute', top: 8, right: '0%' },
  // 3 Convert – below title, left
  { position: 'absolute', bottom: 0, left: '4%' },
  // 4 Scale – below title, right
  { position: 'absolute', bottom: 4, right: '0%' },
]

const DEFAULT_TAGS: TagData[] = [
  { text: 'Diagnose' },
  { text: 'Fix' },
  { text: 'Automate' },
  { text: 'Convert' },
  { text: 'Scale' },
]

const DEFAULT_DESCRIPTION =
  'Built for [Client Name]. Most founders are not short on leads. They are losing revenue between the lead and the close, and they do not know where. This proposal finds the leak and fixes it.'

// ─── Desktop + Tablet ─────────────────────────────────────────────────────────
// 16:9 aspect-ratio canvas. Elements positioned as % of canvas.
// clamp() on fonts: scales between a readable floor and the Figma ceiling.

function DesktopTabletCover({
  title, subtitle, description, clientName, preparedBy, tags, pageNumber, logoUrl, providerIdentity,
}: Required<ProposalCoverProps>) {
  return (
    <DesktopTabletWrapper>
      <ProposalBackground />

      {/* ── Header: logo ↔ page number ── */}
      <div
        className="absolute left-0 right-0 flex items-center justify-between"
        style={{ top: '7.30%', paddingLeft: '4.74%', paddingRight: '4.36%' }}
      >
        {/* Wrapper always renders (even with nothing inside for Upwork) so this
            row keeps exactly 2 flex children — justify-between collapses to
            flex-start instead of the far edge when only 1 child is present,
            which would otherwise push PageNumber to the left when the logo
            itself is omitted. */}
        <motion.div
          style={{ flexShrink: 0 }}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
        >
          {providerIdentity !== 'upwork' && (
            /* Figma: 145.32 × 25.19 px — SVG viewBox 146×26, ratio ~5.6:1 */
            <img
              src={logoSvg}
              alt="Novara"
              draggable={false}
              style={{ display: 'block', width: 'auto', height: 'auto', maxHeight: 'clamp(14px, 1.354vw, 26px)' }}
            />
          )}
        </motion.div>
        <PageNumber pageNumber={pageNumber} width="clamp(24px, 2.274vw, 44px)" />
      </div>

      {/* ── Title ── */}
      <div
        className="absolute"
        style={{ left: '50%', top: '23.88%', transform: 'translateX(-50%)' }}
      >
        <motion.div
          style={{
            fontFamily: 'Clash Display, sans-serif',
            fontWeight: 400,
            fontSize: 'clamp(60px, 11.72vw, 225px)',
            lineHeight: 0,
            color: '#FFFFFF',
            textAlign: 'center',
            whiteSpace: 'nowrap',
            fontStyle: 'normal',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.85, delay: 0.3, ease: 'easeOut' }}
        >
          <p data-editor-key="cover.title" style={{ lineHeight: 0.97, marginBottom: 0 }}>{title + ' '}</p>
          <p data-editor-key="cover.heading" style={{ lineHeight: 0.97 }}>{subtitle}</p>
        </motion.div>
      </div>

      {/* ── Floating tags ── */}
      {tags.slice(0, 5).map((tag, i) => {
        const slot = TAG_SLOTS[i]
        if (!slot) return null
        return (
          <div
            key={i}
            className="absolute flex items-center justify-center"
            style={{
              left: slot.leftPct,
              top: slot.topPct,
              width: slot.widthPct,
              height: slot.heightPct,
            }}
          >
            <FloatingTag
              text={tag.text}
              bg={slot.bg}
              border={slot.border}
              textColor={slot.textColor}
              rotation={slot.rotation}
              floatDuration={slot.floatDuration}
              floatDelay={slot.floatDelay}
              entryDelay={0.5 + i * 0.1}
              editorKey={`cover.tag${i}`}
            />
          </div>
        )
      })}

      {/* ── Description ── */}
      <div
        className="absolute"
        style={{ left: '50%', top: '69.85%', transform: 'translateX(-50%)', width: '45.37%' }}
      >
        <motion.p
          data-editor-key="cover.paragraph"
          style={{
            fontFamily: 'General Sans, sans-serif',
            fontWeight: 300,
            fontSize: 'clamp(13px, 1.25vw, 24px)',
            lineHeight: 1.5,
            color: '#FFFFFF',
            textAlign: 'center',
            wordBreak: 'break-word',
          }}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.7, ease: 'easeOut' }}
        >
          {description}
        </motion.p>
      </div>

      {/* ── Info panel ── */}
      <div className="absolute" style={{ left: '80.88%', top: '66.84%' }}>
        <ProposalInfo clientName={clientName} preparedBy={preparedBy} variant="desktop" />
      </div>
    </DesktopTabletWrapper>
  )
}

// ─── Mobile ───────────────────────────────────────────────────────────────────
// Flex-column full-height stack. Tags repositioned relative to title block.

function MobileCover({
  title, subtitle, description, clientName, preparedBy, tags, pageNumber, logoUrl, providerIdentity,
}: Required<ProposalCoverProps>) {
  return (
    <MobileWrapper>
      <ProposalBackground />

      <div
        className="relative z-10 flex flex-col w-full"
        style={{ minHeight: '100dvh', padding: '24px 22px 40px' }}
      >
        {/* ── Header ── */}
        <motion.div
          className="flex items-center justify-between"
          style={{ marginBottom: 40 }}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          {/* Always 2 flex children (see DesktopTabletCover's identical comment) —
              an empty span keeps justify-between pushing PageNumber to the right
              even when the logo itself is omitted for Upwork. */}
          {providerIdentity !== 'upwork' ? (
            <img
              src={logoSvg}
              alt="Novara"
              draggable={false}
              style={{ display: 'block', width: 'auto', height: 'auto', maxHeight: 22 }}
            />
          ) : (
            <span />
          )}
          <PageNumber pageNumber={pageNumber} width="34px" />
        </motion.div>

        {/* ── Title + floating tags ── */}
        <div
          className="flex items-center justify-center flex-1"
          style={{ marginBottom: 32 }}
        >
          {/* Padding creates breathing room for tags above/below the title text */}
          <div className="relative w-full" style={{ paddingTop: 56, paddingBottom: 56 }}>

            {tags.slice(0, 5).map((tag, i) => {
              const slot = TAG_SLOTS[i]
              const mPos = MOBILE_TAG_POS[i]
              if (!slot || !mPos) return null
              return (
                <div key={i} className="z-10" style={mPos}>
                  <FloatingTag
                    text={tag.text}
                    bg={slot.bg}
                    border={slot.border}
                    textColor={slot.textColor}
                    rotation={slot.rotation}
                    floatDuration={slot.floatDuration}
                    floatDelay={slot.floatDelay}
                    entryDelay={0.5 + i * 0.1}
                    fontSize="13px"
                    editorKey={`cover.tag${i}`}
                  />
                </div>
              )
            })}

            {/* Title */}
            <motion.div
              style={{
                fontFamily: 'Clash Display, sans-serif',
                fontWeight: 400,
                fontSize: 'clamp(52px, 14vw, 80px)',
                lineHeight: 0,
                color: '#FFFFFF',
                textAlign: 'center',
                whiteSpace: 'nowrap',
                fontStyle: 'normal',
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.85, delay: 0.3 }}
            >
              <p data-editor-key="cover.title" style={{ lineHeight: 0.97, marginBottom: 0 }}>{title}</p>
              <p data-editor-key="cover.heading" style={{ lineHeight: 0.97 }}>{subtitle}</p>
            </motion.div>
          </div>
        </div>

        {/* ── Description ── */}
        <motion.p
          data-editor-key="cover.paragraph"
          style={{
            fontFamily: 'General Sans, sans-serif',
            fontWeight: 300,
            fontSize: 15,
            lineHeight: 1.65,
            color: '#FFFFFF',
            textAlign: 'center',
            marginBottom: 32,
          }}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.7 }}
        >
          {description}
        </motion.p>

        {/* ── Info panel ── */}
        <ProposalInfo clientName={clientName} preparedBy={preparedBy} variant="mobile" />
      </div>
    </MobileWrapper>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function ProposalCover({
  title = 'RevOps',
  subtitle = 'Proposal',
  description = DEFAULT_DESCRIPTION,
  clientName = '[Client Name]',
  preparedBy = 'Jayson Kandiah',
  tags = DEFAULT_TAGS,
  pageNumber = 1,
  logoUrl = DEFAULT_LOGO_URL,
  providerIdentity = 'novara',
}: ProposalCoverProps) {
  const isDesktopTablet = useIsDesktopTablet()
  const props = { title, subtitle, description, clientName, preparedBy, tags, pageNumber, logoUrl, providerIdentity }

  // Framer Motion 11 needs a React state update after mount to trigger initial→animate
  // transitions when the motion elements are not immediate children of AnimatePresence.
  // animKey increments after mount (and on layout switch), forcing a fresh component
  // mount so FM sees a clean enter and plays the animations.
  const [animKey, setAnimKey] = useState(0)
  useEffect(() => {
    setAnimKey(k => k + 1)
  }, [isDesktopTablet])

  return isDesktopTablet
    ? <DesktopTabletCover key={`dt-${animKey}`} {...props} />
    : <MobileCover key={`m-${animKey}`} {...props} />
}
