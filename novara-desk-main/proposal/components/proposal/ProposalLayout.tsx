/**
 * ProposalLayout — responsive wrapper system for all proposal pages.
 *
 * DesktopTabletWrapper  768px+   16:9 aspect-ratio canvas, absolute-% positioning
 * MobileWrapper         <768px   full-height flex-column stack
 *
 * Both wrappers are used by ProposalCover via useIsDesktopTablet() so only
 * ONE layout tree is mounted at a time — prevents Framer Motion from receiving
 * duplicate animation contexts and avoids React 18 Strict Mode conflicts.
 */

interface WrapperProps {
  children: React.ReactNode
  className?: string
}

export function DesktopTabletWrapper({ children, className = '' }: WrapperProps) {
  return (
    <div
      className={`relative w-full overflow-hidden ${className}`}
      style={{ aspectRatio: '16 / 9' }}
    >
      {children}
    </div>
  )
}

export function MobileWrapper({ children, className = '' }: WrapperProps) {
  return (
    <div
      className={`relative w-full overflow-hidden flex flex-col ${className}`}
      style={{ minHeight: '100dvh' }}
    >
      {children}
    </div>
  )
}
