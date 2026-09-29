import { useEffect, useRef } from 'react'
import { Sparkles } from 'lucide-react'

interface InlineEditPopoverProps {
  anchorRect: DOMRect
  label: string
  value: string
  onChange: (value: string) => void
  onClose: () => void
  onOpenAIAssist: () => void
}

/**
 * The entire editing surface for a clicked piece of live-preview text — a
 * normal controlled textarea anchored near the clicked element. There is no
 * contentEditable anywhere in the Editor; all character input is captured
 * by this fully React-owned field.
 */
export function InlineEditPopover({ anchorRect, label, value, onChange, onClose, onOpenAIAssist }: InlineEditPopoverProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
    textareaRef.current?.select()
  }, [])

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const top = Math.min(anchorRect.bottom + 8, window.innerHeight - 180)
  const left = Math.min(Math.max(anchorRect.left, 12), window.innerWidth - 340)

  return (
    <div
      ref={panelRef}
      style={{ position: 'fixed', top, left, width: 320, zIndex: 60 }}
      className="bg-novara-panel border border-novara-border rounded-xl shadow-2xl p-4 flex flex-col gap-2"
    >
      <p className="text-[11px] font-general-sans font-medium text-novara-light/50 uppercase tracking-wide">
        {label}
      </p>
      <textarea
        ref={textareaRef}
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white/5 border border-novara-border rounded-lg px-3 py-2.5 text-sm text-white font-general-sans focus:outline-none focus:border-novara-teal/50 transition-colors resize-none"
      />
      <div className="flex items-center justify-between">
        <button
          onClick={onOpenAIAssist}
          className="flex items-center gap-1 text-[12px] font-general-sans font-medium text-novara-light/70 hover:text-white transition-colors"
        >
          <Sparkles size={13} /> AI Assist
        </button>
        <button
          onClick={onClose}
          className="text-[12px] font-general-sans font-medium text-novara-teal hover:text-novara-teal/80 transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  )
}
