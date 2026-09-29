import { Modal } from './Modal.js'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  destructive,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button
            onClick={onCancel}
            className="text-sm font-general-sans font-medium text-novara-light/70 hover:text-white px-4 py-2 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`text-sm font-general-sans font-medium px-4 py-2 rounded-lg transition-colors ${
              destructive
                ? 'bg-red-500/90 hover:bg-red-500 text-white'
                : 'bg-novara-teal hover:bg-novara-teal/90 text-white'
            }`}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm font-general-sans text-novara-light/70">{message}</p>
    </Modal>
  )
}
