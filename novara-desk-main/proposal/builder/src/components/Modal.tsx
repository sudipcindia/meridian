import { type ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

export function Modal({ title, onClose, children, footer }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-[480px] max-h-[90vh] flex flex-col bg-novara-panel border border-novara-border rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-5 border-b border-novara-border shrink-0">
          <h2 className="font-clash-display text-white text-[18px]">{title}</h2>
          <button
            onClick={onClose}
            className="text-novara-light/50 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-novara-border">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
