import { useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import {
  PROPOSAL_SECTIONS,
  AI_CONTEXT_FIELDS,
  generateAIContent,
  type AIAction,
  type AITone,
  type AIContext,
} from '../../modules/ai/index.js'
import { ErrorBanner } from '../ErrorBanner.js'
import { inputClass } from '../FormField.js'
import type { ProviderIdentity } from '../../modules/branding/identity.js'

interface AIAssistPanelProps {
  currentText: string
  context: AIContext
  providerIdentity?: ProviderIdentity
  onContextFieldChange: (key: string, value: string) => void
  onApply: (text: string, mode: 'replace' | 'append') => void
  onClose: () => void
}

const TONE_OPTIONS: { value: AITone; label: string }[] = [
  { value: 'professional', label: 'Professional' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'luxury', label: 'Luxury' },
  { value: 'technical', label: 'Technical' },
  { value: 'simple', label: 'Simple English' },
]

/**
 * The AI Assistant surface for one editable block. Suggestions are always
 * shown here first — nothing is written back to the proposal until the
 * user explicitly chooses Replace or Append. Calls the Builder's own
 * secure backend only (see modules/ai/client.ts); no API key ever touches
 * this component or any frontend code.
 */
export function AIAssistPanel({ currentText, context, providerIdentity, onContextFieldChange, onApply, onClose }: AIAssistPanelProps) {
  const [sectionId, setSectionId] = useState('general')
  const [tone, setTone] = useState<AITone>('professional')
  const [suggestion, setSuggestion] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showContext, setShowContext] = useState(false)

  async function run(action: AIAction) {
    setLoading(true)
    setError(null)
    try {
      const text = await generateAIContent({
        sectionId,
        action,
        tone,
        currentText: suggestion ?? currentText,
        context,
        providerIdentity,
      })
      setSuggestion(text)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 360, zIndex: 70 }}
      className="bg-novara-panel border-l border-novara-border shadow-2xl flex flex-col"
    >
      <div className="flex items-center justify-between px-4 py-4 border-b border-novara-border">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-novara-teal" />
          <p className="font-clash-display text-white text-[15px]">AI Assistant</p>
        </div>
        <button onClick={onClose} className="text-novara-light/50 hover:text-white transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        {error && <ErrorBanner message={error} />}

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-general-sans font-medium text-novara-light/50 uppercase tracking-wide">
            Section
          </label>
          <select className={inputClass} value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
            {PROPOSAL_SECTIONS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-general-sans font-medium text-novara-light/50 uppercase tracking-wide">
            Tone
          </label>
          <select className={inputClass} value={tone} onChange={(e) => setTone(e.target.value as AITone)}>
            {TONE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <button
            onClick={() => setShowContext((v) => !v)}
            className="text-[12px] font-general-sans font-medium text-novara-teal hover:text-novara-teal/80 transition-colors"
          >
            {showContext ? 'Hide' : 'Edit'} client context
          </button>
          {showContext && (
            <div className="mt-3 flex flex-col gap-3">
              {AI_CONTEXT_FIELDS.map((field) => (
                <div key={field.key} className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-general-sans font-medium text-novara-light/50">{field.label}</label>
                  <input
                    className={inputClass}
                    value={context[field.key as keyof AIContext] ?? ''}
                    onChange={(e) => onContextFieldChange(field.key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => run('generate')}
            disabled={loading}
            className="text-[12px] font-general-sans font-medium bg-novara-orange hover:bg-novara-orange/90 disabled:opacity-40 text-white px-3 py-2 rounded-lg transition-colors"
          >
            {suggestion ? 'Regenerate' : 'Generate'}
          </button>
          <button
            onClick={() => run('improve')}
            disabled={loading}
            className="text-[12px] font-general-sans font-medium border border-novara-border text-novara-light/70 hover:text-white disabled:opacity-40 px-3 py-2 rounded-lg transition-colors"
          >
            Improve
          </button>
          <button
            onClick={() => run('shorten')}
            disabled={loading}
            className="text-[12px] font-general-sans font-medium border border-novara-border text-novara-light/70 hover:text-white disabled:opacity-40 px-3 py-2 rounded-lg transition-colors"
          >
            Shorten
          </button>
          <button
            onClick={() => run('expand')}
            disabled={loading}
            className="text-[12px] font-general-sans font-medium border border-novara-border text-novara-light/70 hover:text-white disabled:opacity-40 px-3 py-2 rounded-lg transition-colors"
          >
            Expand
          </button>
        </div>

        {loading && <p className="text-[12px] font-general-sans text-novara-light/40">Thinking…</p>}

        {suggestion && !loading && (
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-general-sans font-medium text-novara-light/50 uppercase tracking-wide">
              Suggestion
            </label>
            <div className="bg-white/5 border border-novara-border rounded-lg px-3 py-2.5 text-sm text-white font-general-sans whitespace-pre-wrap">
              {suggestion}
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => onApply(suggestion, 'replace')}
                className="text-[12px] font-general-sans font-medium bg-novara-teal hover:bg-novara-teal/90 text-white px-3 py-2 rounded-lg transition-colors"
              >
                Replace
              </button>
              <button
                onClick={() => onApply(suggestion, 'append')}
                className="text-[12px] font-general-sans font-medium border border-novara-border text-novara-light/70 hover:text-white px-3 py-2 rounded-lg transition-colors"
              >
                Append
              </button>
              <button
                onClick={() => setSuggestion(null)}
                className="text-[12px] font-general-sans font-medium text-novara-light/50 hover:text-white px-3 py-2 rounded-lg transition-colors"
              >
                Ignore
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
