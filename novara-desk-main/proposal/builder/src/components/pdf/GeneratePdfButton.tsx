import { useState } from 'react'
import { FileDown } from 'lucide-react'
import { ErrorBanner } from '../ErrorBanner.js'
import { apiFetch } from '../../lib/apiFetch.js'
import { PDF_VIEWABLE_STATUSES } from '../../modules/status/gates.js'
import type { Proposal } from '../../types/proposal.js'

interface GeneratePdfButtonProps {
  proposal: Proposal
}

interface GeneratePdfResult {
  filename: string
  pageCount: number
  cached: boolean
  url: string
}

/** Triggers PDF generation via the secure backend only — never renders or calls Chromium client-side. */
export function GeneratePdfButton({ proposal }: GeneratePdfButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<GeneratePdfResult | null>(null)

  const allowed = PDF_VIEWABLE_STATUSES.includes(proposal.status)

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await apiFetch('/api/pdf/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId: proposal.id }),
        authenticated: true,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `PDF request failed (${res.status})`)
      setResult(data)
      window.open(data.url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate PDF')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border border-novara-border rounded-xl p-6 bg-white/[0.02] flex flex-col gap-3">
      <p className="font-clash-display text-white text-[16px]">Generate PDF</p>

      {!allowed && (
        <p className="text-[12px] font-general-sans text-novara-light/40">
          This proposal must be Approved before a PDF can be generated.
        </p>
      )}

      {error && <ErrorBanner message={error} />}

      {result && (
        <p className="text-[12px] font-general-sans text-novara-teal">
          {result.cached ? 'Using a previously generated PDF' : 'PDF generated'} — {result.filename}
        </p>
      )}

      <button
        onClick={handleGenerate}
        disabled={!allowed || loading}
        className="self-start flex items-center gap-1.5 text-sm font-general-sans font-medium bg-novara-orange hover:bg-novara-orange/90 disabled:opacity-40 text-white px-4 py-2.5 rounded-lg transition-colors"
      >
        <FileDown size={15} />
        {loading ? 'Generating…' : 'Generate PDF'}
      </button>
    </div>
  )
}
