import { useRef, useState } from 'react'

export interface SignatureValue {
  method: 'drawn' | 'typed'
  dataUrl?: string
  text?: string
}

interface SignatureCaptureProps {
  onChange: (value: SignatureValue | null) => void
}

// Internal canvas resolution — kept fixed and independent of however large
// or small the element is rendered on screen (mobile vs desktop). Pointer
// coordinates are rescaled from CSS pixels into this coordinate space so a
// stroke lands where the finger/pen actually touched on any device.
const CANVAS_WIDTH = 600
const CANVAS_HEIGHT = 180

export function SignatureCapture({ onChange }: SignatureCaptureProps) {
  const [mode, setMode] = useState<'drawn' | 'typed'>('drawn')
  const [typedText, setTypedText] = useState('')
  const [captureError, setCaptureError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const hasDrawnRef = useRef(false)

  function getPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = e.currentTarget
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drawingRef.current = true
    const { x, y } = getPoint(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = getPoint(e)
    ctx.strokeStyle = '#0D1A1F'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineTo(x, y)
    ctx.stroke()
    hasDrawnRef.current = true
  }

  function handlePointerUp() {
    if (!drawingRef.current) return
    drawingRef.current = false
    emitDrawnChange()
  }

  function emitDrawnChange() {
    if (!hasDrawnRef.current || !canvasRef.current) {
      onChange(null)
      return
    }
    try {
      setCaptureError(null)
      onChange({ method: 'drawn', dataUrl: canvasRef.current.toDataURL('image/png') })
    } catch {
      onChange(null)
      setCaptureError('Could not capture the signature — please try again or use "Type Signature" instead.')
    }
  }

  function clearCanvas() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    hasDrawnRef.current = false
    onChange(null)
  }

  function switchMode(next: 'drawn' | 'typed') {
    if (next === mode) return
    setMode(next)
    onChange(null)
    if (next === 'typed') {
      setTypedText('')
    } else {
      hasDrawnRef.current = false
    }
  }

  function handleTypedChange(value: string) {
    setTypedText(value)
    onChange(value.trim() ? { method: 'typed', text: value.trim() } : null)
  }

  const tabClass = (active: boolean) =>
    `px-4 py-2 rounded-lg text-[13px] font-medium font-general-sans transition-colors ${
      active ? 'bg-novara-teal text-novara-dark' : 'bg-white/5 text-novara-light/60 hover:bg-white/10'
    }`

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <button type="button" onClick={() => switchMode('drawn')} className={tabClass(mode === 'drawn')}>
          Draw Signature
        </button>
        <button type="button" onClick={() => switchMode('typed')} className={tabClass(mode === 'typed')}>
          Type Signature
        </button>
      </div>

      {mode === 'drawn' ? (
        <div className="flex flex-col gap-2">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="w-full max-w-[600px] rounded-lg border border-novara-border bg-white touch-none"
            style={{ aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}` }}
          />
          {captureError && (
            <p className="text-[12px] font-general-sans text-red-400">{captureError}</p>
          )}
          <button
            type="button"
            onClick={clearCanvas}
            className="self-start text-[12px] font-general-sans text-novara-light/50 hover:text-novara-light/80 underline"
          >
            Clear Signature
          </button>
        </div>
      ) : (
        <input
          value={typedText}
          onChange={(e) => handleTypedChange(e.target.value)}
          placeholder="Type your full name"
          className="w-full max-w-[600px] rounded-lg border border-novara-border bg-white px-4 py-3 text-novara-dark outline-none focus:border-novara-teal"
          style={{ fontFamily: "'Brush Script MT', cursive", fontSize: 30 }}
        />
      )}
    </div>
  )
}
