import { useState } from 'react'
import { FileDown } from 'lucide-react'
import { ErrorBanner } from '../ErrorBanner.js'
import { apiFetch } from '../../lib/apiFetch.js'

interface DownloadAuditReportButtonProps {
  proposalId: string
}

interface GenerateAuditReportResult {
  filename: string
  url: string
}

/**
 * Clone of components/pdf/GeneratePdfButton.tsx for the audit report
 * document type — same trigger-then-open pattern, secure backend only,
 * never renders or calls Chromium client-side. Unlike the proposal PDF,
 * there's no "must be Approved" gate here: an audit report can be pulled
 * for any proposal, signed or not.
 */
export function DownloadAuditReportButton({ proposalId }: DownloadAuditReportButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<GenerateAuditReportResult | null>(null)

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await apiFetch('/api/pdf/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId, type: 'audit' }),
        authenticated: true,
        timeoutMs: 60_000,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Audit report request failed (${res.status})`)
      setResult(data)
      window.open(data.url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate audit report')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border border-novara-border rounded-xl p-6 bg-white/[0.02] flex flex-col gap-3">
      <p className="font-clash-display text-white text-[16px]">Download Audit Report</p>
      <p className="text-[12px] font-general-sans text-novara-light/50">
        A complete PDF record — signature, timestamps, device/browser/location, verification status, activity
        timeline, and document integrity — for compliance or legal purposes.
      </p>

      {error && <ErrorBanner message={error} />}

      {result && (
        <p className="text-[12px] font-general-sans text-novara-teal">Generated — {result.filename}</p>
      )}

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="self-start flex items-center gap-1.5 text-sm font-general-sans font-medium bg-novara-orange hover:bg-novara-orange/90 disabled:opacity-40 text-white px-4 py-2.5 rounded-lg transition-colors"
      >
        <FileDown size={15} />
        {loading ? 'Generating…' : 'Download Audit Report'}
      </button>
    </div>
  )
}
