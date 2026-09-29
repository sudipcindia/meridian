import { motion } from 'framer-motion'

// Asset URL expires in 7 days — replace with a local file for production.
export const DEFAULT_LOGO_URL =
  'https://www.figma.com/api/mcp/asset/79429e93-ccc2-4cb7-8b5f-18e12bf7eda1'

interface LogoMarkProps {
  src?: string
  width?: string
  className?: string
}

/** Just the Novara wordmark image. Caller handles positioning. */
export function LogoMark({ src = DEFAULT_LOGO_URL, width = 'clamp(80px, 7.57vw, 145px)', className = '' }: LogoMarkProps) {
  return (
    <motion.img
      src={src}
      alt="Novara"
      draggable={false}
      className={className}
      style={{ width, height: 'auto', display: 'block', objectFit: 'contain', objectPosition: 'left center' }}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
    />
  )
}

interface PageNumProps {
  pageNumber?: number
  width?: string
  className?: string
}

/**
 * Page number badge — text-rendered (bold numeral + thin orange underline),
 * not the baked-PNG-per-page image this used to be. That image had the
 * digits rendered as pixels inside the asset itself, so the number could
 * never actually change no matter what was passed in — this component now
 * computes real page numbers from the document's own page order (see
 * `computePageNumbers` in masterTemplate/index.ts), matched visually to the
 * original assets (bold Clash Display numeral, 2-digit zero-padded, short
 * orange underline) so pages renumber correctly with zero visual change.
 */
export function PageNumber({ pageNumber = 1, width = 'clamp(30px, 3.37vw, 65px)', className = '' }: PageNumProps) {
  return (
    <motion.div
      className={className}
      style={{ width, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 'clamp(2px, 0.3vw, 6px)' }}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.25, ease: 'easeOut' }}
    >
      <span
        aria-label={`Page ${String(pageNumber).padStart(2, '0')}`}
        style={{
          fontFamily: 'Clash Display, sans-serif',
          fontWeight: 600,
          fontSize: 'clamp(18px, 1.9vw, 36px)',
          lineHeight: 1,
          color: '#FFFFFF',
        }}
      >
        {String(pageNumber).padStart(2, '0')}
      </span>
      <span style={{ width: '55%', height: 'clamp(2px, 0.2vw, 3px)', background: '#FF5B04', display: 'block' }} />
    </motion.div>
  )
}

interface ProposalLogoProps {
  logoUrl?: string
  pageNumber?: number
}

/**
 * ProposalLogo — renders logo + page number as a flex row (justify-between).
 * Wrap in an absolutely-positioned container for desktop; use as-is on mobile.
 */
export function ProposalLogo({ logoUrl, pageNumber = 1 }: ProposalLogoProps) {
  return (
    <div className="flex items-center justify-between w-full">
      <LogoMark src={logoUrl} />
      <PageNumber pageNumber={pageNumber} />
    </div>
  )
}
