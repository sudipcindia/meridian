import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ProposalBackground } from './ProposalBackground'
import { PageNumber } from './ProposalLogo'
import logoSvg     from '../../src/assets/logo.svg'
import centerGraphic from '../../src/assets/p11/center-graphic.png'
import arrowRight  from '../../src/assets/p11/arrow-right.svg'

// ─── Tokens ───────────────────────────────────────────────────────────────────

const FONT_CLASH = 'Clash Display, sans-serif'
const FONT_GS    = 'General Sans, sans-serif'
const WHITE      = '#FFFFFF'
const ORANGE     = '#FF5B04'

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

// ─── Desktop + Tablet (≥768px) ────────────────────────────────────────────────
// Frame: 1920×1170px — custom aspectRatio wrapper.
// All top values are % of 1170px height; left values are % of 1920px width.

interface Page11Props {
  onAcceptClick?: () => void
  alreadyAccepted?: boolean
  pageNumber?: number
  /** Who this proposal represents as the provider/brand — see ProposalPage10's identical prop for the full rationale. Defaults to 'novara' so every existing render is unchanged. */
  providerIdentity?: 'novara' | 'upwork'
}

function DesktopTabletPage11({ onAcceptClick, alreadyAccepted, pageNumber, providerIdentity = 'novara' }: Page11Props) {
  const providerShortName = providerIdentity === 'upwork' ? 'Jayson' : 'Novara'
  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ aspectRatio: '1920 / 1170' }}
    >
      <ProposalBackground />

      {/* Center decorative graphic — Figma: container 1070×895px at (22.14%, 15.81%) */}
      {/* Image child has negative insets: top=-10.59%, left/right=-8.72% (Figma overflow pattern) */}
      {/* PNG is 1257×990px (full image incl. bleed). Render with insets so AR is preserved. */}
      <div
        aria-hidden="true"
        className="absolute overflow-hidden"
        style={{ left: '22.14%', top: '15.81%', width: '55.73%', height: '76.49%', pointerEvents: 'none' }}
      >
        <img
          src={centerGraphic}
          alt=""
          draggable={false}
          className="absolute block"
          style={{
            top: '-10.59%',
            left: '-8.72%',
            width: '117.44%',
            height: '110.59%',
            maxWidth: 'none',
          }}
        />
      </div>

      {/* Bottom gradient fade */}
      <div
        aria-hidden="true"
        className="absolute bottom-0 left-0 w-full"
        style={{
          height: '17.61%',
          background: 'linear-gradient(to bottom, rgba(13,26,31,0) 0%, #0D1A1F 59.377%)',
        }}
      />

      {/* Logo — Figma: left=4.69%, top=6.69% */}
      {/* Plain <img> avoids Framer Motion overriding height: auto on motion.img */}
      {providerIdentity !== 'upwork' && (
        <div className="absolute" style={{ left: '4.69%', top: '6.69%' }}>
          <img
            src={logoSvg}
            alt="Novara"
            draggable={false}
            style={{
              display: 'block',
              width: 'clamp(80px, 10.05vw, 193px)',
              height: 'clamp(14px, 1.823vw, 35px)',
              objectFit: 'contain',
              objectPosition: 'left center',
            }}
          />
        </div>
      )}

      {/* Page badge — Figma: left=1743px(90.78%), top=93.11px(7.96%) */}
      <div className="absolute" style={{ left: '90.78%', top: '7.96%' }}>
        <PageNumber pageNumber={pageNumber} width="clamp(36px, 4.271vw, 82px)" />
      </div>

      {/* "Thank You" heading — Figma: center x=960px, top=132px(11.28%), 178px Clash Display */}
      {/* x: '-50%' in initial/animate keeps Framer Motion's transform from stripping translateX */}
      <motion.h2
        className="absolute"
        style={{
          left: '50%',
          top: '11.28%',
          fontFamily: FONT_CLASH,
          fontWeight: 600,
          fontSize: 'clamp(60px, 9.27vw, 178px)',
          lineHeight: 1.15,
          color: WHITE,
          margin: 0,
          textAlign: 'center',
          whiteSpace: 'nowrap',
          letterSpacing: '-0.02em',
        }}
        initial={{ opacity: 0, y: -12, x: '-50%' }}
        animate={{ opacity: 1, y: 0, x: '-50%' }}
        transition={{ duration: 0.7, delay: 0.1, ease: 'easeOut' }}
      >
        Thank You
      </motion.h2>

      {/* Body text — Figma: center x≈960px, top=398px(34.02%), 24px GS, w=643px */}
      <motion.p
        data-editor-key="page11.envelopeMessage"
        className="absolute"
        style={{
          left: '50%',
          top: '34.02%',
          width: 'clamp(260px, 33.49vw, 643px)',
          fontFamily: FONT_GS,
          fontWeight: 400,
          fontSize: 'clamp(13px, 1.25vw, 24px)',
          lineHeight: 1.54,
          color: WHITE,
          margin: 0,
          textAlign: 'center',
          whiteSpace: 'pre-line',
        }}
        initial={{ opacity: 0, y: 10, x: '-50%' }}
        animate={{ opacity: 1, y: 0, x: '-50%' }}
        transition={{ duration: 0.6, delay: 0.25, ease: 'easeOut' }}
      >
        [Company Name] has the demand. This is how you stop losing it. If you want to talk through the plan, tighten the scope, or just get moving, we are ready.
      </motion.p>

      {/* CTA group — Figma: center x=960px, top=551px(47.09%), w=714px, gap=35px */}
      <motion.div
        className="absolute flex flex-col items-center"
        style={{
          left: '50%',
          top: '47.09%',
          width: 'clamp(280px, 37.19vw, 714px)',
          gap: 'clamp(16px, 1.823vw, 35px)',
        }}
        initial={{ opacity: 0, y: 14, x: '-50%' }}
        animate={{ opacity: 1, y: 0, x: '-50%' }}
        transition={{ duration: 0.6, delay: 0.4, ease: 'easeOut' }}
      >
        {/* Orange CTA button */}
        <button
          type="button"
          onClick={alreadyAccepted ? undefined : onAcceptClick}
          disabled={alreadyAccepted}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'clamp(4px, 0.313vw, 6px)',
            background: ORANGE,
            border: 'none',
            borderRadius: 'clamp(5px, 0.417vw, 8px)',
            paddingTop: 'clamp(10px, 0.833vw, 16px)',
            paddingBottom: 'clamp(10px, 0.938vw, 18px)',
            paddingLeft: 'clamp(18px, 2.083vw, 40px)',
            paddingRight: 'clamp(18px, 2.083vw, 40px)',
            cursor: alreadyAccepted ? 'default' : 'pointer',
            opacity: alreadyAccepted ? 0.6 : 1,
            flexShrink: 0,
          }}
        >
          <span style={{
            fontFamily: FONT_GS,
            fontWeight: 500,
            fontSize: 'clamp(15px, 1.36vw, 26.116px)',
            lineHeight: 1.5,
            color: WHITE,
            textAlign: 'center',
            whiteSpace: 'nowrap',
          }}>
            Accept the Proposal
          </span>
          <img
            src={arrowRight}
            alt=""
            aria-hidden
            draggable={false}
            style={{ width: 'clamp(16px, 1.464vw, 28.124px)', height: 'clamp(16px, 1.464vw, 28.124px)', display: 'block', flexShrink: 0 }}
          />
        </button>

        {/* Tagline */}
        <p style={{
          fontFamily: FONT_GS,
          fontWeight: 400,
          fontSize: 'clamp(12px, 1.151vw, 22.098px)',
          lineHeight: 1.5,
          color: WHITE,
          margin: 0,
          textAlign: 'center',
          letterSpacing: '0.221px',
          whiteSpace: 'nowrap',
        }}>
          Built by {providerShortName}, specifically for [Company Name].
        </p>
      </motion.div>
    </div>
  )
}

// ─── Mobile (<768px) ──────────────────────────────────────────────────────────

function MobilePage11({ onAcceptClick, alreadyAccepted, pageNumber, providerIdentity = 'novara' }: Page11Props) {
  const providerShortName = providerIdentity === 'upwork' ? 'Jayson' : 'Novara'
  return (
    // No minHeight — page height is content height only, eliminating bottom whitespace
    <div className="relative w-full overflow-hidden flex flex-col">
      <ProposalBackground />

      {/* Center graphic — container maintains Figma's 1070:895 AR so image never distorts.
          top:80px puts bracket at ~148px, 10px below heading bottom (~138px) and 14px above body text (~162px). */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 80,
          left: 0,
          width: '100%',
          aspectRatio: '1070 / 895',
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
      >
        <img
          src={centerGraphic}
          alt=""
          draggable={false}
          style={{
            position: 'absolute',
            top: '-10.59%',
            left: '-8.72%',
            width: '117.44%',
            height: '110.59%',
            display: 'block',
            maxWidth: 'none',
          }}
        />
      </div>

      {/* Bottom gradient */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: 80,
          background: 'linear-gradient(to bottom, rgba(13,26,31,0), #0D1A1F)',
          pointerEvents: 'none',
        }}
      />

      <div className="relative z-10 flex flex-col w-full" style={{ padding: '24px 22px 40px' }}>
        {/* Top row: logo + badge — logo uses same asset + style as Page 01 mobile */}
        {/* Always 2 flex children — an empty span keeps justify-between pushing
            PageNumber to the right even when the logo itself is omitted for
            Upwork (a single flex child collapses justify-between to the left). */}
        <div className="flex items-center justify-between" style={{ marginBottom: 32 }}>
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
          <PageNumber pageNumber={pageNumber} width="30px" />
        </div>

        {/* Heading */}
        <motion.h2
          style={{
            fontFamily: FONT_CLASH,
            fontWeight: 600,
            fontSize: 'clamp(52px, 14vw, 96px)',
            lineHeight: 1.1,
            color: WHITE,
            margin: '0 0 24px',
            textAlign: 'center',
            letterSpacing: '-0.02em',
          }}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          Thank You
        </motion.h2>

        {/* Body text */}
        <motion.p
          data-editor-key="page11.envelopeMessage"
          style={{
            fontFamily: FONT_GS,
            fontWeight: 400,
            fontSize: 'clamp(14px, 4vw, 18px)',
            lineHeight: 1.54,
            color: WHITE,
            margin: '0 auto 32px',
            textAlign: 'center',
            maxWidth: 340,
            whiteSpace: 'pre-line',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          [Company Name] has the demand. This is how you stop losing it. If you want to talk through the plan, tighten the scope, or just get moving, we are ready.
        </motion.p>

        {/* CTA group */}
        <motion.div
          className="flex flex-col items-center"
          style={{ gap: 20 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <button
            type="button"
            onClick={alreadyAccepted ? undefined : onAcceptClick}
            disabled={alreadyAccepted}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: ORANGE,
              border: 'none',
              borderRadius: 8,
              padding: '14px 28px',
              cursor: alreadyAccepted ? 'default' : 'pointer',
              opacity: alreadyAccepted ? 0.6 : 1,
            }}
          >
            <span style={{ fontFamily: FONT_GS, fontWeight: 500, fontSize: 18, color: WHITE, whiteSpace: 'nowrap' }}>
              Accept the Proposal
            </span>
            <img src={arrowRight} alt="" aria-hidden draggable={false}
              style={{ width: 20, height: 20, display: 'block' }} />
          </button>

          <p style={{
            fontFamily: FONT_GS,
            fontWeight: 400,
            fontSize: 14,
            lineHeight: 1.5,
            color: WHITE,
            margin: 0,
            textAlign: 'center',
            letterSpacing: '0.2px',
          }}>
            Built by {providerShortName}, specifically for [Company Name].
          </p>
        </motion.div>
      </div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function ProposalPage11({ onAcceptClick, alreadyAccepted, pageNumber = 11, providerIdentity = 'novara' }: Page11Props = {}) {
  const isDesktopTablet = useIsDesktopTablet()
  const [animKey, setAnimKey] = useState(0)
  useEffect(() => {
    setAnimKey(k => k + 1)
  }, [isDesktopTablet])

  return isDesktopTablet
    ? <DesktopTabletPage11 key={`dt-${animKey}`} onAcceptClick={onAcceptClick} alreadyAccepted={alreadyAccepted} pageNumber={pageNumber} providerIdentity={providerIdentity} />
    : <MobilePage11 key={`m-${animKey}`} onAcceptClick={onAcceptClick} alreadyAccepted={alreadyAccepted} pageNumber={pageNumber} providerIdentity={providerIdentity} />
}
