import { motion } from 'framer-motion'

export interface FloatingTagProps {
  text: string
  rotation: number
  bg: string
  textColor: string
  border?: string
  floatDuration?: number
  floatDelay?: number
  entryDelay?: number
  /** Override font-size with any CSS value (default: clamp scales with vw for desktop/tablet) */
  fontSize?: string
  /** Editor hook for the Builder's click-to-edit — applied only to the text leaf, never the styled wrapper, so DOM patching can't clobber the tag's chrome. */
  editorKey?: string
}

export function FloatingTag({
  text,
  rotation,
  bg,
  textColor,
  border,
  floatDuration = 3,
  floatDelay = 0,
  entryDelay = 0.5,
  fontSize = 'clamp(11px, 1.255vw, 24.094px)',
  editorKey,
}: FloatingTagProps) {
  return (
    // Outer: static rotation + spring pop-in
    <motion.div
      style={{ rotate: rotation, display: 'inline-block' }}
      initial={{ opacity: 0, scale: 0.55 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 220, damping: 18, delay: entryDelay }}
    >
      {/* Inner: perpetual float + hover lift */}
      <motion.div
        animate={{ y: [0, -9, 0] }}
        transition={{ duration: floatDuration, delay: floatDelay, repeat: Infinity, ease: 'easeInOut' }}
        whileHover={{ scale: 1.07, transition: { duration: 0.18 } }}
        style={{ display: 'inline-block', cursor: 'default' }}
      >
        <div
          role="note"
          style={{
            backgroundColor: bg,
            border: border ?? 'none',
            borderRadius: 'clamp(6px, 0.52vw, 10px)',
            padding: 'clamp(7px, 0.6vw, 12px) clamp(10px, 1.15vw, 22px)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            whiteSpace: 'nowrap',
          }}
        >
          <span
            data-editor-key={editorKey}
            style={{
              fontFamily: 'Clash Display, sans-serif',
              fontWeight: 500,
              fontSize,
              lineHeight: 0.97,
              color: textColor,
              whiteSpace: 'nowrap',
              fontStyle: 'normal',
            }}
          >
            {text}
          </span>
        </div>
      </motion.div>
    </motion.div>
  )
}
