import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ProposalBackground } from './ProposalBackground'
import { MobileWrapper } from './ProposalLayout'
import { PageNumber } from './ProposalLogo'
import timelineDots from '../../src/assets/p09/timeline-dots.svg'

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

// ─── Data ─────────────────────────────────────────────────────────────────────

// topPct = top / 1708 frame height, converted from Figma absolute positions
const STEPS = [
  { num: '01', title: 'Proposal approval',   desc: 'Sign digitally. One click and we move.',                                                            side: 'left',  topPct: '14.17%' },
  { num: '02', title: 'Onboarding setup',    desc: 'We get access, get onboarded, and get moving. No drawn-out kickoff process.',                        side: 'right', topPct: '28.87%' },
  { num: '03', title: 'Alignment & planning',desc: 'We lock the plan, the timeline, and what winning looks like. Then we execute.',                      side: 'left',  topPct: '45.67%' },
  { num: '04', title: 'Delivery begins',     desc: 'Work starts on the agreed plan. Direct contact, no account manager relay.',                          side: 'right', topPct: '62.47%' },
  { num: '05', title: 'Ongoing review',      desc: 'We track it, report on it, and keep tightening it as we go.',                                        side: 'left',  topPct: '79.27%' },
] as const

// ─── Sub-components ───────────────────────────────────────────────────────────

// Number badge with teal radial gradient background
function StepBadge({ num }: { num: string }) {
  const size = 'clamp(36px, 3.623vw, 70px)'
  return (
    <div style={{
      width: size,
      height: size,
      flexShrink: 0,
      borderRadius: 'clamp(3px, 0.276vw, 5.3px)',
      border: '1px solid rgba(255,255,255,0.1)',
      background: 'radial-gradient(ellipse at 14% 19%, rgba(14,98,105,1) 0%, rgba(17,68,75,0.5) 50%, rgba(20,38,45,0) 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: 'clamp(1px, 0.123vw, 2.4px)',
      paddingLeft: 'clamp(2px, 0.215vw, 4.1px)',
      boxSizing: 'border-box',
    }}>
      <span style={{
        fontFamily: FONT_GS,
        fontWeight: 600,
        fontSize: 'clamp(16px, 1.610vw, 31px)',
        lineHeight: 1.5,
        color: WHITE,
        letterSpacing: '-0.01em',
        whiteSpace: 'nowrap',
      }}>
        {num}
      </span>
    </div>
  )
}

function StepCard({ step, delay }: { step: typeof STEPS[number]; delay: number }) {
  const isLeft = step.side === 'left'
  return (
    <motion.div
      className="absolute"
      style={{
        left: isLeft ? '11.09%' : '57.6%',
        top: step.topPct,
        width: '31.25%',
        display: 'flex',
        flexDirection: 'column',
        gap: 'clamp(12px, 1.208vw, 23px)',
        background: '#121e23',
        border: '0.773px solid rgba(255,255,255,0.2)',
        borderRadius: 'clamp(4px, 0.402vw, 7.73px)',
        padding: 'clamp(14px, 1.563vw, 30px)',
        boxSizing: 'border-box',
      }}
      initial={{ opacity: 0, x: isLeft ? -20 : 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.7, delay, ease: 'easeOut' }}
    >
      {/* Number + title row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(16px, 2.013vw, 38.6px)' }}>
        <StepBadge num={step.num} />
        <p style={{
          fontFamily: FONT_GS,
          fontWeight: 600,
          fontSize: 'clamp(16px, 1.667vw, 32px)',
          lineHeight: 1.5,
          color: WHITE,
          margin: 0,
          letterSpacing: '-0.01em',
          whiteSpace: 'nowrap',
        }}>
          {step.title}
        </p>
      </div>
      {/* Description */}
      <p style={{
        fontFamily: FONT_GS,
        fontWeight: 300,
        fontSize: 'clamp(13px, 1.25vw, 24px)',
        lineHeight: 1.5,
        color: WHITE,
        margin: 0,
        letterSpacing: '-0.01em',
      }}>
        {step.desc}
      </p>
    </motion.div>
  )
}

// ─── Desktop + Tablet (≥768px) ────────────────────────────────────────────────
// Frame: 1920×1708px — use custom aspectRatio wrapper.
// All top/height values are percentages of the 1708px frame height.
// Left positions are percentages of the 1920px frame width.

interface ProposalPage09Props {
  pageNumber?: number
}

function DesktopTabletPage09({ pageNumber }: Required<ProposalPage09Props>) {
  return (
    <div className="relative w-full overflow-hidden" style={{ aspectRatio: '1920 / 1708' }}>
      <ProposalBackground />

      {/* Page badge — Figma: left=1740px(90.625%), top=90px */}
      <div className="absolute" style={{ left: '90.625%', top: 'clamp(40px, 4.688vw, 90px)' }}>
        <PageNumber pageNumber={pageNumber} width="clamp(30px, 4.54vw, 87px)" />
      </div>

      {/* Heading — Figma: left=90px(4.6875%), top=90px, Clash Display Semibold 72px */}
      <motion.h2
        className="absolute"
        style={{
          left: '4.6875%',
          top: 'clamp(40px, 4.688vw, 90px)',
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
        So, <span style={{ color: ORANGE }}>What&apos;s Next?</span>
      </motion.h2>

      {/* Timeline vertical line — Figma: left=50%, top=242px(14.17%), width=10px, height=1373px(80.39%) */}
      <div
        className="absolute"
        style={{
          left: '50%',
          top: '14.17%',
          transform: 'translateX(-50%)',
          width: 'clamp(5px, 0.521vw, 10px)',
          height: '80.39%',
          borderRadius: 'clamp(40px, 4.375vw, 84px)',
          background: 'linear-gradient(to bottom, #075056, #132831)',
        }}
      />

      {/* Timeline orange dots — Figma: left=50%, top=327px(19.14%), width=30px, height=1178px(68.97%) */}
      <img
        src={timelineDots}
        alt=""
        aria-hidden
        draggable={false}
        className="absolute"
        style={{
          left: '50%',
          top: '19.14%',
          transform: 'translateX(-50%)',
          width: 'clamp(14px, 1.563vw, 30px)',
          height: '68.97%',
          display: 'block',
        }}
      />

      {/* 5 step cards */}
      {STEPS.map((step, i) => (
        <StepCard key={step.num} step={step} delay={0.2 + i * 0.1} />
      ))}
    </div>
  )
}

// ─── Mobile (<768px) ──────────────────────────────────────────────────────────

function MobilePage09({ pageNumber }: Required<ProposalPage09Props>) {
  return (
    <MobileWrapper>
      <ProposalBackground />
      <div className="relative z-10 flex flex-col w-full" style={{ padding: '24px 22px 48px' }}>

        {/* Page badge */}
        <div className="flex items-center justify-end" style={{ marginBottom: 20 }}>
          <PageNumber pageNumber={pageNumber} width="30px" />
        </div>

        {/* Heading */}
        <motion.h2
          style={{ fontFamily: FONT_CLASH, fontWeight: 600, fontSize: 'clamp(30px, 9vw, 48px)', lineHeight: 1.1, color: WHITE, margin: '0 0 32px' }}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          So, <span style={{ color: ORANGE }}>What&apos;s Next?</span>
        </motion.h2>

        {/* Steps with left timeline strip */}
        <div style={{ display: 'flex', gap: 16 }}>
          {/* Left timeline strip */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ width: 4, flex: 1, background: 'linear-gradient(to bottom, #075056, #132831)', borderRadius: 8 }} />
          </div>

          {/* Cards column */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {STEPS.map((step, i) => (
              <motion.div
                key={step.num}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  background: '#121e23',
                  border: '0.773px solid rgba(255,255,255,0.2)',
                  borderRadius: 8,
                  padding: 16,
                  boxSizing: 'border-box',
                }}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 + i * 0.1 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* Number badge */}
                  <div style={{
                    width: 44, height: 44, flexShrink: 0,
                    borderRadius: 5,
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'radial-gradient(ellipse at 14% 19%, rgba(14,98,105,1) 0%, rgba(17,68,75,0.5) 50%, rgba(20,38,45,0) 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontFamily: FONT_GS, fontWeight: 600, fontSize: 18, color: WHITE }}>
                      {step.num}
                    </span>
                  </div>
                  <p style={{ fontFamily: FONT_GS, fontWeight: 600, fontSize: 18, color: WHITE, margin: 0, letterSpacing: '-0.01em' }}>
                    {step.title}
                  </p>
                </div>
                <p style={{ fontFamily: FONT_GS, fontWeight: 300, fontSize: 14, lineHeight: 1.5, color: WHITE, margin: 0 }}>
                  {step.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </MobileWrapper>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function ProposalPage09({ pageNumber = 9 }: ProposalPage09Props) {
  const isDesktopTablet = useIsDesktopTablet()
  const [animKey, setAnimKey] = useState(0)
  useEffect(() => {
    setAnimKey(k => k + 1)
  }, [isDesktopTablet])

  return isDesktopTablet
    ? <DesktopTabletPage09 key={`dt-${animKey}`} pageNumber={pageNumber} />
    : <MobilePage09 key={`m-${animKey}`} pageNumber={pageNumber} />
}
