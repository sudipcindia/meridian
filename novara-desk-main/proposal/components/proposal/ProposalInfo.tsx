import { motion } from 'framer-motion'

export interface ProposalInfoProps {
  clientName?: string
  preparedBy?: string
  /** desktop: vw/clamp sizes for the absolute canvas. mobile: fixed px sizes for in-flow stack. */
  variant?: 'desktop' | 'mobile'
}

const DIVIDER_COLOR = 'rgba(228,238,240,0.38)'

const SIZE = {
  desktop: {
    colWidth: 'clamp(120px, 13.8vw, 265px)',
    sectionGap: 'clamp(8px, 1.14vw, 21.835px)',
    textGap: 'clamp(5px, 0.63vw, 12px)',
    label: 'clamp(13px, 1.667vw, 32px)',
    value: 'clamp(12px, 1.458vw, 28px)',
  },
  mobile: {
    colWidth: '100%',
    sectionGap: '16px',
    textGap: '6px',
    label: '18px',
    value: '16px',
  },
} as const

export function ProposalInfo({
  clientName = '[Client Name]',
  preparedBy = 'Jayson Kandiah',
  variant = 'desktop',
}: ProposalInfoProps) {
  const s = SIZE[variant]

  return (
    <motion.div
      style={{ display: 'flex', alignItems: 'stretch', gap: 12, paddingBlock: 10 }}
      initial={{ opacity: 0, x: variant === 'desktop' ? 28 : 0, y: variant === 'mobile' ? 12 : 0 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.7, delay: 0.9, ease: 'easeOut' }}
      aria-label="Proposal metadata"
    >
      {/* Vertical separator */}
      <div
        aria-hidden="true"
        style={{ width: 1.5, alignSelf: 'stretch', background: DIVIDER_COLOR, flexShrink: 0 }}
      />

      {/* Text content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: s.sectionGap, width: s.colWidth }}>

        <div style={{ display: 'flex', flexDirection: 'column', gap: s.textGap }}>
          <p style={{ fontFamily: 'General Sans, sans-serif', fontWeight: 500, fontSize: s.label, lineHeight: 1.5, color: '#fff' }}>
            Prepared For:
          </p>
          <p data-editor-key="cover.clientName" style={{ fontFamily: 'General Sans, sans-serif', fontWeight: 300, fontSize: s.value, lineHeight: 1.5, color: '#fff' }}>
            {clientName}
          </p>
        </div>

        <div aria-hidden="true" style={{ width: '100%', height: 1.5, background: DIVIDER_COLOR }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: s.textGap }}>
          <p style={{ fontFamily: 'General Sans, sans-serif', fontWeight: 500, fontSize: s.label, lineHeight: 1.5, color: '#fff' }}>
            Prepared By:
          </p>
          <p data-editor-key="cover.preparedBy" style={{ fontFamily: 'General Sans, sans-serif', fontWeight: 300, fontSize: s.value, lineHeight: 1.5, color: '#fff' }}>
            {preparedBy}
          </p>
        </div>

      </div>
    </motion.div>
  )
}
