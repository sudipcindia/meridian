import { useEffect, useMemo, useState } from 'react'
import { getDocumentByProposalId, updateDocumentContent } from '../lib/documents.js'
import { applyVariables, getVariableManifestForPages, type VariableMap } from '../modules/variables/index.js'
import type { ProposalDocument } from '../types/document.js'
import type { TemplatePageId } from '../masterTemplate/index.js'
import { inputClass } from './FormField.js'
import { ErrorBanner } from './ErrorBanner.js'

interface VariablesPanelProps {
  proposalId: string
  pages: TemplatePageId[]
}

/**
 * Lists every placeholder the Variable Engine auto-detected in the master
 * template pages this proposal includes, with an editable value per
 * placeholder and a live preview (via the shared applyVariables engine —
 * no replacement logic lives here). Saving only updates this proposal's own
 * Document; the master template is never read from or written to here.
 */
export function VariablesPanel({ proposalId, pages }: VariablesPanelProps) {
  const [document, setDocument] = useState<ProposalDocument | null>(null)
  const [values, setValues] = useState<VariableMap>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getDocumentByProposalId(proposalId)
      .then((doc) => {
        if (cancelled) return
        setDocument(doc)
        setValues(doc?.variables ?? {})
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Failed to load variables'))
      .finally(() => !cancelled && setLoading(false))

    return () => {
      cancelled = true
    }
  }, [proposalId])

  const entries = useMemo(() => getVariableManifestForPages(pages), [pages])

  async function handleSave() {
    if (!document) return
    setSaving(true)
    setError(null)
    try {
      const updated = await updateDocumentContent(document, {
        variables: values,
        contentOverrides: document.contentOverrides,
      })
      setDocument(updated)
      setSavedAt(Date.now())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save variables')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return null
  if (error && !document) return <ErrorBanner message={error} />
  if (!document || entries.length === 0) return null

  return (
    <div className="border border-novara-border rounded-xl p-6 bg-white/[0.02] flex flex-col gap-5">
      <div>
        <p className="font-clash-display text-white text-[16px]">Variables</p>
        <p className="text-[12px] font-general-sans text-novara-light/40 mt-0.5">
          Detected automatically from the master template. Saving only updates this proposal's copy.
        </p>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {entries.map((entry) => (
          <div key={entry.key} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor={`var-${entry.key}`} className="text-[12px] font-general-sans font-medium text-novara-light/70">
                {entry.label}
              </label>
              <span className="text-[10px] font-general-sans text-novara-light/30 uppercase tracking-wide shrink-0">
                {entry.pages.join(', ')}
              </span>
            </div>
            <input
              id={`var-${entry.key}`}
              className={inputClass}
              placeholder={entry.token}
              value={values[entry.key] ?? ''}
              onChange={(e) => setValues({ ...values, [entry.key]: e.target.value })}
            />
            <p
              className="text-[11px] font-general-sans text-novara-light/40 truncate"
              title={applyVariables(entry.sample, values)}
            >
              {applyVariables(entry.sample, values)}
            </p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-sm font-general-sans font-medium bg-novara-teal hover:bg-novara-teal/90 disabled:opacity-40 text-white px-4 py-2.5 rounded-lg transition-colors"
        >
          {saving ? 'Saving…' : 'Save Variables'}
        </button>
        {savedAt && <span className="text-[12px] font-general-sans text-novara-teal">Saved</span>}
      </div>
    </div>
  )
}
