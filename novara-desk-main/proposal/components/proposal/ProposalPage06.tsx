/**
 * ProposalPage06 — "Regrow Case Study" scrollable document.
 * Figma source: node 4817:808 (1920×6779 frame).
 *
 * This page is intentionally NOT wrapped in DesktopTabletWrapper — the Figma
 * frame is 6779px tall across eight distinct sections, and compressing to a
 * 1080px slide would make the content unreadable. Instead it renders as a
 * full-height scrollable document that shares the same design language
 * (colors, typography, ProposalBackground) as the other pages.
 */

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ProposalBackground } from './ProposalBackground'
import { MobileWrapper } from './ProposalLayout'
import { PageNumber } from './ProposalLogo'
import overviewImg from '../../src/assets/p06/overview-photo.png'
import websiteLeft  from '../../src/assets/p06/website-left.png'
import websiteRight from '../../src/assets/p06/website-right.png'
import serviceIcon  from '../../src/assets/p06/service-icon.svg'
import arrowIcon    from '../../src/assets/p06/arrow.svg'
// Sourced from originals up to 18MB (2160-3240px-wide lossless PNG screenshots
// displayed at a small square grid-tile size) — recompressed to quality-82 JPEG
// at 1200px, ~97% smaller, with no visible difference at their actual display
// size. This was pushing exported PDFs (which embed these near source
// fidelity) over Supabase Storage's upload size limit.
import social01 from '../../src/assets/p06/social-01.jpg'
import social02 from '../../src/assets/p06/social-02.jpg'
import social03 from '../../src/assets/p06/social-03.jpg'
import social04 from '../../src/assets/p06/social-04.jpg'
import social05 from '../../src/assets/p06/social-05.jpg'
import social06 from '../../src/assets/p06/social-06.jpg'

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

const FC = 'Clash Display, sans-serif'
const FG = 'General Sans, sans-serif'
const W  = '#FFFFFF'
const O  = '#FF5B04'

// ─── Data ─────────────────────────────────────────────────────────────────────

const BRANDS = [
  { name: 'Regrow Hair Centre', desc: 'Hair transplants & replacement clinic' },
  { name: 'Regrow',             desc: 'Direct-to-consumer hair-care store'    },
]

const SERVICES = [
  { title: 'Website Design & Development', sub: 'Rebuilt to convert, not just to look good.' },
  { title: 'E-commerce & Product Pages',   sub: 'Turned browsing into buying with a structure that actually sells.' },
  { title: 'SEO & Content',               sub: 'Organic traffic that arrives already wanting to buy.' },
  { title: 'Social Media',                sub: 'Visibility that keeps the brand top of mind between purchases.' },
]

const PROBLEMS = [
  { num: '01', problem: 'Dated, unprofessional websites',  solution: 'Rebuilt to convert, not just to exist.' },
  { num: '02', problem: 'A shop that did not convert',      solution: 'Restructured into a real sales engine with proper checkout flow.' },
  { num: '03', problem: 'Demand that was not converting',  solution: 'Fixed the journey so interest turns into enquiries, not bounces.' },
  { num: '04', problem: 'Low visibility in search',         solution: 'Organic traffic that arrives ready to buy, at zero media cost.' },
  { num: '05', problem: 'Quiet, low-engagement social',    solution: 'Content that keeps both brands visible between purchases.' },
]

const RESULTS = [
  { stat: '120%', desc: 'increase in organic click-through rate' },
  { stat: '150%', desc: 'ROAS across paid campaigns'            },
  { stat: '35%',  desc: 'reduction in cost per acquisition'     },
  { stat: '45%',  desc: 'increase in paid click-through rate'   },
]

const SOCIAL = [social01, social02, social03, social04, social05, social06]

// ─── Shared sub-components ────────────────────────────────────────────────────

function SectionHeading({ title, orange, sub }: { title: string; orange: string; sub: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(8px, 0.61vw, 11.7px)' }}>
      <p style={{
        fontFamily: FC, fontWeight: 500,
        fontSize: 'clamp(28px, 2.6vw, 50px)',
        letterSpacing: '-0.5px', lineHeight: 1.5,
        color: W, margin: 0, whiteSpace: 'nowrap',
      }}>
        {title}<span style={{ color: O }}>{orange}</span>
      </p>
      <p style={{
        fontFamily: FG, fontWeight: 300,
        fontSize: 'clamp(14px, 1.15vw, 22px)',
        letterSpacing: '-0.22px', lineHeight: 1.5,
        color: W, margin: 0,
      }}>
        {sub}
      </p>
    </div>
  )
}

function ServiceCard({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{
      background: 'rgba(228,238,240,0.02)',
      border: '0.585px solid #FF5B04',
      padding: 'clamp(24px, 2.44vw, 46.83px)',
      display: 'flex', flexDirection: 'column',
      gap: 'clamp(16px, 1.25vw, 24px)',
      minHeight: 'clamp(200px, 16.25vw, 312px)',
    }}>
      {/* Icon box */}
      <div style={{
        width: 'clamp(44px, 3.39vw, 65px)',
        height: 'clamp(44px, 3.39vw, 65px)',
        flexShrink: 0,
        borderRadius: 'clamp(3px, 0.28vw, 5.3px)',
        border: '1px solid rgba(255,255,255,0.1)',
        background: 'radial-gradient(circle at 40% 45%, rgba(14,98,105,1) 0%, rgba(17,68,75,0.5) 50%, rgba(20,38,45,0) 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <img src={serviceIcon} alt="" aria-hidden draggable={false}
          style={{ width: '55%', height: '55%', objectFit: 'contain' }} />
      </div>
      {/* Text */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(8px, 0.61vw, 11.7px)' }}>
        <p style={{
          fontFamily: FG, fontWeight: 500,
          fontSize: 'clamp(18px, 1.56vw, 30px)',
          letterSpacing: '-0.3px', lineHeight: 1.5,
          color: W, margin: 0,
        }}>{title}</p>
        <p style={{
          fontFamily: FG, fontWeight: 300,
          fontSize: 'clamp(14px, 1.15vw, 22px)',
          letterSpacing: '-0.22px', lineHeight: 1.5,
          color: W, margin: 0,
        }}>{sub}</p>
      </div>
    </div>
  )
}

// ─── Desktop + Tablet ─────────────────────────────────────────────────────────
// Custom scrollable wrapper — ProposalBackground stretches to full content height.

interface ProposalPage06Props {
  pageNumber?: number
  /** Who this proposal represents as the provider/brand — see ProposalPage10's identical prop for the full rationale. This Regrow case study is real past work; for Upwork it's narrated in first person (Jayson's own track record) rather than "Novara"/"we". Defaults to 'novara' so every existing render is unchanged. */
  providerIdentity?: 'novara' | 'upwork'
}

function DesktopTabletPage06({ pageNumber, providerIdentity }: Required<ProposalPage06Props>) {
  const isUpwork = providerIdentity === 'upwork'
  const I = isUpwork ? 'I' : 'We'
  const i = isUpwork ? 'I' : 'we'
  // The case-study sentence originally named "Novara" as a proper noun, not "We" — kept
  // as its own variable so the novara path renders byte-identical to before this change.
  const rebuiltSubject = isUpwork ? 'I' : 'Novara'
  const SEC_GAP = 'clamp(48px, 4.17vw, 80px)'
  const BIG_GAP = 'clamp(56px, 4.69vw, 90px)' // main section-to-section

  return (
    <div style={{ position: 'relative', width: '100%', background: '#0D1A1F', overflow: 'hidden' }}>
      <ProposalBackground />

      {/* Page number badge — same position + PageNumber component as pages 03-05 */}
      {/* Figma: left=1740px(90.625%), top=90px(8.33%) */}
      <div style={{ position: 'absolute', right: '4.6875%', top: 'clamp(40px, 4.69vw, 90px)', zIndex: 10 }}>
        <PageNumber pageNumber={pageNumber} width="clamp(30px, 4.54vw, 87px)" />
      </div>

      {/* ── All content in normal flow ── */}
      <div style={{
        position: 'relative', zIndex: 1,
        padding: `clamp(48px, 4.69vw, 90px) clamp(32px, 4.6875%, 90px) clamp(64px, 5.21vw, 100px)`,
        display: 'flex', flexDirection: 'column', gap: BIG_GAP,
      }}>

        {/* ── 1. Header: heading + subtitle ── */}
        {/* Figma: node 4817:846, flex-col gap-16px, width=1219px */}
        <motion.div
          style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(10px, 0.83vw, 16px)', maxWidth: '63.49%' }}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
        >
          <h2 style={{
            fontFamily: FC, fontWeight: 600,
            fontSize: 'clamp(36px, 3.75vw, 72px)',
            lineHeight: 1.1, color: W, margin: 0, whiteSpace: 'nowrap',
          }}>
            Regrow <span style={{ color: O }}>Case Study</span>
          </h2>
          <p style={{
            fontFamily: FG, fontWeight: 300,
            fontSize: 'clamp(14px, 1.15vw, 22px)',
            lineHeight: 1.5, color: W, opacity: 0.9, margin: 0,
          }}>
            Two brands losing revenue to a broken digital front end. One fix.
          </p>
        </motion.div>

        {/* ── 2. Client brand badges ── */}
        {/* Figma: node 4825:1107, flex gap-40px, each badge: h=79px, p=40px, rounded-10px, orange left shadow */}
        <motion.div
          style={{ display: 'flex', gap: 'clamp(16px, 2.08vw, 40px)', flexWrap: 'wrap' }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.18, ease: 'easeOut' }}
        >
          {BRANDS.map((b) => (
            <div key={b.name} style={{
              display: 'flex', alignItems: 'center',
              gap: 'clamp(16px, 1.25vw, 24px)',
              padding: 'clamp(14px, 1.04vw, 20px) clamp(24px, 2.08vw, 40px)',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(228,238,240,0.02)',
              boxShadow: 'inset 5px 0px 0px 0px #FF5B04',
              flexShrink: 0,
            }}>
              <p style={{
                fontFamily: FG, fontWeight: 600,
                fontSize: 'clamp(16px, 1.25vw, 24px)',
                letterSpacing: '-0.24px', lineHeight: 1.5,
                color: W, margin: 0, whiteSpace: 'nowrap',
              }}>{b.name}</p>
              {/* Vertical divider */}
              <div style={{ width: 1, height: 'clamp(22px, 2.03vw, 39px)', background: 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
              <p style={{
                fontFamily: FG, fontWeight: 300,
                fontSize: 'clamp(16px, 1.25vw, 24px)',
                letterSpacing: '-0.24px', lineHeight: 1.5,
                color: 'rgba(255,255,255,0.6)', margin: 0, whiteSpace: 'nowrap',
              }}>{b.desc}</p>
            </div>
          ))}
        </motion.div>

        {/* ── 3. Overview: text left + photo right ── */}
        {/* Figma: node 4825:1109, flex gap-138px, text w=796px, photo w=806px h=456px */}
        <motion.div
          style={{ display: 'flex', gap: 'clamp(32px, 7.19vw, 138px)', alignItems: 'flex-start' }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25, ease: 'easeOut' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(14px, 1.04vw, 20px)', flex: '0 0 auto', maxWidth: '45%' }}>
            <p style={{
              fontFamily: FG, fontWeight: 500,
              fontSize: 'clamp(20px, 1.56vw, 30px)',
              letterSpacing: '-0.3px', lineHeight: 1.5,
              color: O, margin: 0,
            }}>Overview</p>
            <div style={{
              fontFamily: FG, fontWeight: 300,
              fontSize: 'clamp(14px, 1.25vw, 24px)',
              lineHeight: 1.5, color: W,
            }}>
              <p style={{ margin: '0 0 1.5em' }}>
                Regrow had real demand and no system to capture it. Two brands, two websites, both too dated to convert the interest they were already generating. Leads were walking in the door and walking back out.
              </p>
              <p style={{ margin: 0 }}>
                {rebuiltSubject} rebuilt both properties and took ownership of the full funnel, design through SEO through social. Both brands now convert the demand they were already getting instead of losing it.
              </p>
            </div>
          </div>
          <div style={{
            flex: '1 1 0', minWidth: 0,
            position: 'relative',
            borderRadius: 6,
            overflow: 'hidden',
            aspectRatio: '806 / 456',
          }}>
            <img src={overviewImg} alt="Regrow website overview" draggable={false}
              style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} />
          </div>
        </motion.div>

        {/* ── 4. What We Delivered: 2×2 service grid ── */}
        {/* Figma: node 4836:137, flex-col gap-40px */}
        <motion.div
          style={{ display: 'flex', flexDirection: 'column', gap: SEC_GAP }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease: 'easeOut' }}
        >
          <SectionHeading title="What " orange={`${I} Delivered.`} sub="One team. Two brands. Every leak found and closed." />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
            {SERVICES.map((s) => <ServiceCard key={s.title} {...s} />)}
          </div>
        </motion.div>

        {/* ── 5. Five Problems, We Solved: table rows ── */}
        {/* Figma: node 4836:61 */}
        <motion.div
          style={{ display: 'flex', flexDirection: 'column', gap: SEC_GAP }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35, ease: 'easeOut' }}
        >
          <SectionHeading title="Five Problems, " orange={`${I} Solved.`} sub={`Where revenue was leaking, and what ${i} shut down.`} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(16px, 1.25vw, 24px)' }}>
            {/* Column headers */}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              paddingLeft: 'clamp(14px, 1.25vw, 24px)',
            }}>
              <p style={{
                fontFamily: FG, fontWeight: 600,
                fontSize: 'clamp(14px, 1.15vw, 22px)',
                letterSpacing: '-0.22px', lineHeight: 1.5,
                color: 'rgba(255,255,255,0.6)', margin: 0, whiteSpace: 'nowrap',
              }}>The Problem</p>
              <p style={{
                fontFamily: FG, fontWeight: 600,
                fontSize: 'clamp(14px, 1.15vw, 22px)',
                letterSpacing: '-0.22px', lineHeight: 1.5,
                color: O, margin: 0, marginRight: '35.42%',
              }}>What {i} did</p>
            </div>

            {/* Rows */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {PROBLEMS.map((row) => (
                <div key={row.num} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: 'clamp(14px, 1.25vw, 24px)',
                  borderTop: '1px solid rgba(255,255,255,0.1)',
                  borderBottom: '1px solid rgba(255,255,255,0.1)',
                }}>
                  {/* Problem side */}
                  <div style={{ display: 'flex', gap: 'clamp(10px, 0.73vw, 14px)', alignItems: 'center' }}>
                    <span style={{
                      fontFamily: FG, fontWeight: 600,
                      fontSize: 'clamp(16px, 1.354vw, 26px)',
                      letterSpacing: '-0.26px', lineHeight: 1.5,
                      color: O, whiteSpace: 'nowrap',
                    }}>{row.num}</span>
                    <span style={{
                      fontFamily: FG, fontWeight: 400,
                      fontSize: 'clamp(16px, 1.354vw, 26px)',
                      letterSpacing: '-0.26px', lineHeight: 1.5,
                      color: W, whiteSpace: 'nowrap',
                    }}>{row.problem}</span>
                  </div>
                  {/* Solution side */}
                  <div style={{
                    display: 'flex', gap: 'clamp(14px, 1.3vw, 25px)', alignItems: 'center',
                    width: '41.04%',
                  }}>
                    {/* Arrow — Figma: w-31 h-0 container, image with -7.36px top/bottom inset */}
                    <div style={{ width: 'clamp(14px, 1.615vw, 31px)', height: 0, position: 'relative', flexShrink: 0 }}>
                      <div style={{ position: 'absolute', top: '-7.36px', right: '-3.23%', bottom: '-7.36px', left: 0 }}>
                        <img src={arrowIcon} alt="" aria-hidden draggable={false}
                          style={{ display: 'block', width: '100%', height: '100%' }} />
                      </div>
                    </div>
                    <p style={{
                      fontFamily: FG, fontWeight: 400,
                      fontSize: 'clamp(16px, 1.354vw, 26px)',
                      letterSpacing: '-0.26px', lineHeight: 1.5,
                      color: W, margin: 0,
                    }}>{row.solution}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── 6. The Results: 4 stat cards ── */}
        {/* Figma: node 4836:65, stat cards h=264.677px each, flex row */}
        <motion.div
          style={{ display: 'flex', flexDirection: 'column', gap: SEC_GAP }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4, ease: 'easeOut' }}
        >
          <SectionHeading title="The " orange="Results." sub="The numbers that matter. Revenue, not vanity metrics." />
          <div style={{ display: 'flex', width: '100%' }}>
            {RESULTS.map((r) => (
              <div key={r.stat} style={{
                flex: '1 1 0',
                background: 'rgba(228,238,240,0.02)',
                border: '0.585px solid #FF5B04',
                padding: 'clamp(28px, 2.44vw, 46.83px)',
                display: 'flex', flexDirection: 'column',
                gap: 'clamp(16px, 1.52vw, 29.27px)',
                minHeight: 'clamp(160px, 13.79vw, 264.68px)',
              }}>
                <p style={{
                  fontFamily: FG, fontWeight: 500,
                  fontSize: 'clamp(36px, 3.125vw, 60px)',
                  letterSpacing: '-0.6px', lineHeight: 1.5,
                  color: O, margin: 0, whiteSpace: 'nowrap',
                }}>{r.stat}</p>
                <p style={{
                  fontFamily: FG, fontWeight: 400,
                  fontSize: 'clamp(15px, 1.25vw, 24px)',
                  letterSpacing: '-0.24px', lineHeight: 1.5,
                  color: W, margin: 0,
                }}>{r.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── 7. Selected Work: two website screenshots ── */}
        {/* Figma: node 4836:136, two 850×1830px overflow-hidden frames side by side */}
        <motion.div
          style={{ display: 'flex', flexDirection: 'column', gap: SEC_GAP }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.45, ease: 'easeOut' }}
        >
          <SectionHeading title="Selected " orange="Work." sub="The new storefront, redesigned pages, and social content." />
          <div style={{ display: 'flex', gap: 'clamp(20px, 2.08vw, 40px)', alignItems: 'flex-end' }}>
            {/* Left screenshot: image is 297.96% of container height, top offset -1.7% */}
            <div style={{
              flex: '1 1 0', position: 'relative', borderRadius: 6, overflow: 'hidden',
              height: 'clamp(500px, 60vw, 1200px)',
            }}>
              <img src={websiteLeft} alt="Regrow Hair Centre website" draggable={false} style={{
                position: 'absolute', top: '-1.7%', left: 0,
                width: '100%', height: '297.96%', objectFit: 'cover', objectPosition: 'top',
              }} />
            </div>
            {/* Right screenshot: image is 244.7% of container height */}
            <div style={{
              flex: '1 1 0', position: 'relative', borderRadius: 6, overflow: 'hidden',
              height: 'clamp(500px, 60vw, 1200px)',
            }}>
              <img src={websiteRight} alt="Regrow e-commerce store website" draggable={false} style={{
                position: 'absolute', top: 0, left: 0,
                width: '100%', height: '244.7%', objectFit: 'cover', objectPosition: 'top',
              }} />
            </div>
          </div>
        </motion.div>

        {/* ── 8. Social Content: 3×2 image grid ── */}
        {/* Figma: node 4836:134, grid-cols-3 grid-rows-2 gap-x-33 gap-y-30 */}
        <motion.div
          style={{ display: 'flex', flexDirection: 'column', gap: SEC_GAP }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5, ease: 'easeOut' }}
        >
          <p style={{
            fontFamily: FG, fontWeight: 600,
            fontSize: 'clamp(18px, 1.25vw, 24px)',
            lineHeight: 1.5, color: O, margin: 0,
          }}>Social Content</p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gridTemplateRows: 'repeat(2, 1fr)',
            gap: 'clamp(16px, 1.72vw, 33px) clamp(14px, 1.56vw, 30px)',
          }}>
            {SOCIAL.map((src, i) => (
              <div key={i} style={{ position: 'relative', overflow: 'hidden', aspectRatio: '1 / 1' }}>
                <img src={src} alt="" aria-hidden={i !== 0} draggable={false} style={{
                  position: 'absolute', inset: 0,
                  width: '100%', height: '100%', objectFit: 'cover',
                }} />
              </div>
            ))}
          </div>
        </motion.div>

      </div>
    </div>
  )
}

// ─── Mobile (<768px) ──────────────────────────────────────────────────────────

function MobilePage06({ pageNumber, providerIdentity }: Required<ProposalPage06Props>) {
  const isUpwork = providerIdentity === 'upwork'
  const I = isUpwork ? 'I' : 'We'
  // See DesktopTabletPage06's identical comment — this sentence originally named "Novara".
  const rebuiltSubject = isUpwork ? 'I' : 'Novara'
  return (
    <MobileWrapper>
      <ProposalBackground />
      <div
        className="relative z-10 flex flex-col w-full"
        style={{ minHeight: '100dvh', padding: '24px 22px 48px', gap: 40 }}
      >
        {/* Page number */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <PageNumber pageNumber={pageNumber} width="30px" />
        </div>

        {/* Heading */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 style={{ fontFamily: FC, fontWeight: 600, fontSize: 'clamp(30px, 9vw, 48px)', lineHeight: 1.1, color: W, margin: 0 }}>
            Regrow <span style={{ color: O }}>Case Study</span>
          </h2>
          <p style={{ fontFamily: FG, fontWeight: 300, fontSize: 15, lineHeight: 1.5, color: W, opacity: 0.9, margin: 0 }}>
            Two brands losing revenue to a broken digital front end. One fix.
          </p>
        </div>

        {/* Brand badges (stacked on mobile) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {BRANDS.map((b) => (
            <div key={b.name} style={{
              padding: '14px 20px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(228,238,240,0.02)',
              boxShadow: 'inset 5px 0 0 0 #FF5B04',
            }}>
              <p style={{ fontFamily: FG, fontWeight: 600, fontSize: 15, color: W, margin: '0 0 4px' }}>{b.name}</p>
              <p style={{ fontFamily: FG, fontWeight: 300, fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: 0 }}>{b.desc}</p>
            </div>
          ))}
        </div>

        {/* Overview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontFamily: FG, fontWeight: 500, fontSize: 18, color: O, margin: 0 }}>Overview</p>
          <img src={overviewImg} alt="" draggable={false}
            style={{ display: 'block', width: '100%', borderRadius: 6, height: 'auto' }} />
          <p style={{ fontFamily: FG, fontWeight: 300, fontSize: 14, lineHeight: 1.6, color: W, margin: 0 }}>
            Regrow had real demand and no system to capture it. Two brands, two websites, both too dated to convert the interest they were already generating. {rebuiltSubject} rebuilt both properties and took ownership of the full funnel — both brands now convert the demand they were already getting.
          </p>
        </div>

        {/* What We Delivered */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 style={{ fontFamily: FC, fontWeight: 500, fontSize: 28, color: W, margin: 0 }}>
            What <span style={{ color: O }}>{I} Delivered.</span>
          </h3>
          {SERVICES.map((s) => (
            <div key={s.title} style={{
              background: 'rgba(228,238,240,0.02)',
              border: '0.585px solid #FF5B04',
              padding: '20px',
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <p style={{ fontFamily: FG, fontWeight: 500, fontSize: 16, color: W, margin: 0 }}>{s.title}</p>
              <p style={{ fontFamily: FG, fontWeight: 300, fontSize: 14, color: W, margin: 0 }}>{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Problems */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 style={{ fontFamily: FC, fontWeight: 500, fontSize: 28, color: W, margin: 0 }}>
            Five Problems, <span style={{ color: O }}>{I} Solved.</span>
          </h3>
          {PROBLEMS.map((row) => (
            <div key={row.num} style={{
              borderTop: '1px solid rgba(255,255,255,0.1)',
              paddingTop: 12,
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <p style={{ fontFamily: FG, fontWeight: 400, fontSize: 15, color: W, margin: 0 }}>
                <span style={{ color: O, fontWeight: 600 }}>{row.num} </span>{row.problem}
              </p>
              <p style={{ fontFamily: FG, fontWeight: 300, fontSize: 14, color: 'rgba(255,255,255,0.75)', margin: 0 }}>
                → {row.solution}
              </p>
            </div>
          ))}
        </div>

        {/* Results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 style={{ fontFamily: FC, fontWeight: 500, fontSize: 28, color: W, margin: 0 }}>
            The <span style={{ color: O }}>Results.</span>
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
            {RESULTS.map((r) => (
              <div key={r.stat} style={{
                background: 'rgba(228,238,240,0.02)',
                border: '0.585px solid #FF5B04',
                padding: '20px 16px',
              }}>
                <p style={{ fontFamily: FG, fontWeight: 500, fontSize: 32, color: O, margin: '0 0 8px' }}>{r.stat}</p>
                <p style={{ fontFamily: FG, fontWeight: 400, fontSize: 13, color: W, margin: 0 }}>{r.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Work */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 style={{ fontFamily: FC, fontWeight: 500, fontSize: 28, color: W, margin: 0 }}>
            Selected <span style={{ color: O }}>Work.</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ borderRadius: 6, overflow: 'hidden', height: 400, position: 'relative' }}>
              <img src={websiteLeft} alt="" draggable={false}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', objectFit: 'cover', objectPosition: 'top' }} />
            </div>
            <div style={{ borderRadius: 6, overflow: 'hidden', height: 400, position: 'relative' }}>
              <img src={websiteRight} alt="" draggable={false}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', objectFit: 'cover', objectPosition: 'top' }} />
            </div>
          </div>
        </div>

        {/* Social Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontFamily: FG, fontWeight: 600, fontSize: 18, color: O, margin: 0 }}>Social Content</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {SOCIAL.map((src, i) => (
              <div key={i} style={{ aspectRatio: '1 / 1', overflow: 'hidden', position: 'relative' }}>
                <img src={src} alt="" aria-hidden draggable={false}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
          </div>
        </div>

      </div>
    </MobileWrapper>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function ProposalPage06({ pageNumber = 6, providerIdentity = 'novara' }: ProposalPage06Props) {
  const isDesktopTablet = useIsDesktopTablet()
  const [animKey, setAnimKey] = useState(0)
  useEffect(() => {
    setAnimKey(k => k + 1)
  }, [isDesktopTablet])

  return isDesktopTablet
    ? <DesktopTabletPage06 key={`dt-${animKey}`} pageNumber={pageNumber} providerIdentity={providerIdentity} />
    : <MobilePage06 key={`m-${animKey}`} pageNumber={pageNumber} providerIdentity={providerIdentity} />
}
